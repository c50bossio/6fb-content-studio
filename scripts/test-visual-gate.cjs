const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..');
const outputDir = mkdtempSync(join(tmpdir(), '6fb-visual-gate-'));

async function proveOccupiedPortFailsClosed() {
  const staleOutputDir = mkdtempSync(join(tmpdir(), '6fb-visual-stale-port-'));
  const staleServer = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><title>stale server</title>');
  });
  await new Promise((resolveListen, reject) => {
    staleServer.once('error', reject);
    staleServer.listen(0, '127.0.0.1', resolveListen);
  });
  const address = staleServer.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate stale-server test port');

  try {
    const child = spawn(process.execPath, [resolve(projectRoot, 'scripts/run-visual-audit.cjs')], {
      cwd: projectRoot,
      env: {
        ...process.env,
        SIXFB_QA_PORT: String(address.port),
        SIXFB_SCREENSHOT_DIR: staleOutputDir,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', chunk => { output += String(chunk); });
    child.stderr.on('data', chunk => { output += String(chunk); });
    const exitCode = await new Promise((resolveExit, reject) => {
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Occupied-port self-test timed out.\n${output}`));
      }, 10_000);
      child.once('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', code => {
        clearTimeout(timeout);
        resolveExit(code ?? 1);
      });
    });
    if (exitCode === 0) throw new Error(`Visual audit accepted a stale server on its configured port.\n${output}`);
    if (!/exited before readiness|address already in use|port .* already in use/i.test(output)) {
      throw new Error(`Occupied-port self-test failed without an ownership diagnostic.\n${output}`);
    }
  } finally {
    await new Promise(resolveClose => staleServer.close(resolveClose));
    rmSync(staleOutputDir, { recursive: true, force: true });
  }
}

async function run() {
  await proveOccupiedPortFailsClosed();
  const child = spawn(process.execPath, [resolve(projectRoot, 'scripts/run-visual-audit.cjs')], {
    cwd: projectRoot,
    env: {
      ...process.env,
      SIXFB_QA_INJECT_FAILURES: '1',
      SIXFB_SCREENSHOT_WIDTHS: '375',
      SIXFB_SCREENSHOT_DIR: outputDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += String(chunk); });
  child.stderr.on('data', chunk => { output += String(chunk); });
  const exitCode = await new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', code => resolveExit(code ?? 1));
  });

  if (exitCode === 0) throw new Error(`Visual gate self-test unexpectedly passed.\n${output}`);
  const report = JSON.parse(readFileSync(join(outputDir, 'report.json'), 'utf8'));
  const screenFailures = Object.values(report.screens).filter(result => (
    result.errorOverlay ||
    result.horizontalOverflow.length > 0 ||
    result.smallTargets.length > 0 ||
    result.clippedText.length > 0
  ));
  if (screenFailures.length === 0 || report.console.length === 0 || report.network.length === 0) {
    throw new Error(`Visual gate self-test did not record every injected failure class.\n${output}`);
  }
  console.log(`Visual gate self-test passed: occupied-port rejection, exit ${exitCode}, ${screenFailures.length} screen findings, ${report.console.length} console error(s), ${report.network.length} network error(s).`);
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}).finally(() => {
  rmSync(outputDir, { recursive: true, force: true });
});
