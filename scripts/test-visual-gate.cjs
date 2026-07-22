const { spawn } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..');
const outputDir = mkdtempSync(join(tmpdir(), '6fb-visual-gate-'));

async function run() {
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
  console.log(`Visual gate self-test passed: exit ${exitCode}, ${screenFailures.length} screen findings, ${report.console.length} console error(s), ${report.network.length} network error(s).`);
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}).finally(() => {
  rmSync(outputDir, { recursive: true, force: true });
});
