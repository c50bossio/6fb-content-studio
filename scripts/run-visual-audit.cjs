const { spawn } = require('node:child_process');
const { resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..');
const port = Number(process.env.SIXFB_QA_PORT || 5179);
const host = '127.0.0.1';
const appUrl = `http://${host}:${port}/`;
const viteBin = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));

async function waitForServer(serverState) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (serverState.error) throw serverState.error;
    if (serverState.exit) {
      throw new Error(`Vite exited before readiness (code ${serverState.exit.code ?? 'null'}, signal ${serverState.exit.signal ?? 'none'})`);
    }
    try {
      const response = await fetch(appUrl);
      const spawnedServerIsReady = /\bready in\b|\bLocal:\s+http/i.test(serverState.output);
      if (response.ok && spawnedServerIsReady) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Vite did not become ready at ${appUrl}`);
}

async function run() {
  const server = spawn(process.execPath, [viteBin, '--host', host, '--port', String(port), '--strictPort'], {
    cwd: projectRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  const serverState = { output: '', exit: null, error: null };
  server.stdout.on('data', chunk => {
    serverOutput += String(chunk);
    serverState.output = serverOutput;
  });
  server.stderr.on('data', chunk => {
    serverOutput += String(chunk);
    serverState.output = serverOutput;
  });
  server.once('exit', (code, signal) => { serverState.exit = { code, signal }; });
  server.once('error', error => { serverState.error = error; });

  try {
    await waitForServer(serverState);
    const audit = spawn(process.execPath, [resolve(projectRoot, 'take-screenshots.mjs')], {
      cwd: projectRoot,
      env: {
        ...process.env,
        SIXFB_SCREENSHOT_URL: appUrl,
        SIXFB_SCREENSHOT_DIR: process.env.SIXFB_SCREENSHOT_DIR || resolve(projectRoot, 'out/qa/final-proof'),
      },
      stdio: 'inherit',
    });
    const auditExit = await new Promise((resolveExit, reject) => {
      audit.once('error', reject);
      audit.once('exit', code => resolveExit(code ?? 1));
    });
    if (auditExit !== 0) {
      process.stderr.write(serverOutput);
      process.exitCode = auditExit;
    } else if (/\b(?:warn(?:ing)?|error)\b/i.test(serverOutput)) {
      process.stderr.write(serverOutput);
    }
  } catch (error) {
    if (serverOutput) process.stderr.write(serverOutput);
    throw error;
  } finally {
    server.kill('SIGTERM');
    await delay(100);
  }
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
