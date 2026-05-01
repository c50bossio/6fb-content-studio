#!/usr/bin/env node

const { execFileSync, spawn } = require('child_process');
const { existsSync, mkdtempSync } = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 120_000);
const port = Number(process.env.SMOKE_REMOTE_DEBUGGING_PORT || 9335);
const expectedVersion = (process.env.EXPECTED_VERSION || process.env.GITHUB_REF_NAME || '').replace(/^v/, '');
const appPath = process.env.SMOKE_APP_PATH || path.join(
  process.cwd(),
  'release',
  'win-unpacked',
  '6FB Content Studio.exe',
);

if (process.platform !== 'win32') {
  console.log('Windows app smoke skipped: this check only runs on Windows.');
  process.exit(0);
}

if (!existsSync(appPath)) {
  throw new Error(`Windows app executable not found: ${appPath}`);
}

const startedAt = Date.now();
const stdout = [];
const stderr = [];
let child;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tail(lines) {
  return lines.join('').split(/\r?\n/).slice(-60).join('\n');
}

function requestJson(route) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      host: '127.0.0.1',
      port,
      path: route,
      timeout: 2000,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GET ${route} returned ${res.statusCode}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`GET ${route} returned invalid JSON: ${error.message}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`GET ${route} timed out`)));
    req.on('error', reject);
  });
}

async function waitFor(predicate, label) {
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await predicate();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  socket.on('message', (message) => {
    const payload = JSON.parse(message.toString());
    if (!payload.id || !pending.has(payload.id)) return;
    const { resolve, reject } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) reject(new Error(`${payload.error.message || 'CDP error'} ${payload.error.data || ''}`.trim()));
    else resolve(payload.result);
  });

  const open = new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });

  return {
    async send(method, params = {}) {
      await open;
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        setTimeout(() => {
          if (!pending.has(id)) return;
          pending.delete(id);
          reject(new Error(`CDP ${method} timed out`));
        }, 15_000).unref();
      });
    },
    close() {
      try { socket.close(); } catch {}
    },
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const smokeProfile = mkdtempSync(path.join(os.tmpdir(), '6fb-content-studio-windows-smoke-'));
  child = spawn(appPath, [
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--disable-software-rasterizer',
    `--user-data-dir=${path.join(smokeProfile, 'chromium')}`,
  ], {
    cwd: path.dirname(appPath),
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.on('data', (chunk) => stdout.push(chunk.toString()));
  child.stderr.on('data', (chunk) => stderr.push(chunk.toString()));
  child.on('exit', (code, signal) => {
    if (code || signal) stderr.push(`\n[smoke] app exited early code=${code} signal=${signal}\n`);
  });

  const target = await waitFor(async () => {
    const targets = await requestJson('/json/list');
    return targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
  }, 'Electron renderer DevTools target');

  const cdp = connectCdp(target.webSocketDebuggerUrl);
  try {
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable').catch(() => {});

    await waitFor(async () => {
      const ready = await cdp.send('Runtime.evaluate', {
        expression: 'Boolean(window.electronAPI && window.electronAPI.checkSystemHealth)',
        returnByValue: true,
      });
      return ready.result && ready.result.value === true;
    }, 'electronAPI.checkSystemHealth');

    const evaluated = await cdp.send('Runtime.evaluate', {
      expression: `(
        async () => {
          const health = await window.electronAPI.checkSystemHealth();
          const version = typeof window.electronAPI.getAppVersion === 'function'
            ? await window.electronAPI.getAppVersion()
            : null;
          return { title: document.title, version, health };
        }
      )()`,
      awaitPromise: true,
      returnByValue: true,
    });

    if (evaluated.exceptionDetails) {
      throw new Error(`Renderer smoke evaluation failed: ${JSON.stringify(evaluated.exceptionDetails)}`);
    }

    const result = evaluated.result.value;
    const deps = result.health && result.health.deps;
    const paths = result.health && result.health.paths;

    assert(result.title === '6FB Content Studio', `Unexpected app title: ${result.title}`);
    if (expectedVersion) {
      assert(result.version === expectedVersion, `Expected app version ${expectedVersion}, got ${result.version}`);
    }
    for (const key of ['python', 'ffmpeg', 'ffprobe', 'mediapipe', 'clipExtractor']) {
      assert(deps && deps[key] === true, `System Health dependency failed: ${key}`);
    }
    assert(result.health.pipeline.mode === 'bundled', `Expected bundled pipeline mode, got ${result.health.pipeline.mode}`);
    assert(String(paths.binaryPath || '').includes('win32-x64'), `Expected Windows bundled pipeline path, got ${paths.binaryPath}`);
    assert(String(paths.ffmpegPath || '').endsWith('ffmpeg.exe'), `Expected bundled ffmpeg.exe path, got ${paths.ffmpegPath}`);
    assert(String(paths.ffprobePath || '').endsWith('ffprobe.exe'), `Expected bundled ffprobe.exe path, got ${paths.ffprobePath}`);

    console.log(JSON.stringify({
      ok: true,
      title: result.title,
      version: result.version,
      deps: {
        python: deps.python,
        ffmpeg: deps.ffmpeg,
        ffprobe: deps.ffprobe,
        mediapipe: deps.mediapipe,
        clipExtractor: deps.clipExtractor,
      },
      pipeline: result.health.pipeline,
      binaryPath: paths.binaryPath,
      ffmpegPath: paths.ffmpegPath,
      ffprobePath: paths.ffprobePath,
    }, null, 2));
  } finally {
    cdp.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  console.error('\n--- app stdout tail ---');
  console.error(tail(stdout));
  console.error('\n--- app stderr tail ---');
  console.error(tail(stderr));
  process.exitCode = 1;
}).finally(() => {
  if (!child || child.killed) return;
  try {
    execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    try { child.kill(); } catch {}
  }
});
