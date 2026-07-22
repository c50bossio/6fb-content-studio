#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { TextDecoder } = require('node:util');

const runtimeId = process.argv[2];

if (!runtimeId) {
  console.error('Usage: node scripts/assert-packaged-runtime.cjs <runtime-id>');
  process.exit(2);
}

const isWindows = runtimeId.startsWith('win32-');
const exe = isWindows ? '.exe' : '';
const runtimeDir = path.join(process.cwd(), 'python', 'runtime', runtimeId);
const pipelineBinary = path.join(runtimeDir, 'pipeline', '6fb-pipeline', `6fb-pipeline${exe}`);
const required = [
  path.join(runtimeDir, 'runtime.json'),
  pipelineBinary,
  path.join(runtimeDir, 'bin', `ffmpeg${exe}`),
  path.join(runtimeDir, 'bin', `ffprobe${exe}`),
];

const missing = required.filter((filePath) => !fs.existsSync(filePath));

if (missing.length > 0) {
  console.error(`Missing packaged pipeline runtime for ${runtimeId}.`);
  for (const filePath of missing) {
    console.error(`  - ${path.relative(process.cwd(), filePath)}`);
  }
  console.error('');
  console.error('Build the matching runtime before packaging so students do not get an installer with a dead extractor.');
  process.exit(1);
}

const hostRuntimeId = `${process.platform}-${process.arch}`;
if (runtimeId === hostRuntimeId) {
  const runtimeCheck = spawnSync(pipelineBinary, ['--runtime-check'], {
    cwd: path.dirname(pipelineBinary),
    encoding: 'utf8',
    timeout: 60_000,
  });

  if (runtimeCheck.status !== 0) {
    console.error(`Packaged pipeline runtime failed --runtime-check for ${runtimeId}.`);
    if (runtimeCheck.stdout) console.error(runtimeCheck.stdout.trim());
    if (runtimeCheck.stderr) console.error(runtimeCheck.stderr.trim());
    if (runtimeCheck.error) console.error(runtimeCheck.error.message);
    process.exit(1);
  }

  const legacyCodepageEnv = { ...process.env, PYTHONUTF8: '0', PYTHONIOENCODING: 'cp1252' };
  const redirectedUnicode = spawnSync(pipelineBinary, ['--video', 'missing.mp4', '--notify'], {
    cwd: path.dirname(pipelineBinary),
    timeout: 60_000,
    env: legacyCodepageEnv,
  });
  let redirectedStdout = '';
  let redirectedStderr = '';
  try {
    redirectedStdout = new TextDecoder('utf-8', { fatal: true }).decode(redirectedUnicode.stdout).replace(/\r\n/g, '\n');
    redirectedStderr = new TextDecoder('utf-8', { fatal: true }).decode(redirectedUnicode.stderr).replace(/\r\n/g, '\n');
  } catch (error) {
    console.error(`Packaged pipeline emitted invalid UTF-8 for ${runtimeId}: ${error.message}`);
    process.exit(1);
  }
  const expectedWarning = '[pipeline] ⚠️  --notify requires --compose (need clip specs). Enabling --compose.\n';
  const combinedOutput = `${redirectedStdout}\n${redirectedStderr}`;
  const forbiddenDiagnostics = /traceback|unicodeencodeerror|charmap|�/i;
  if (
    redirectedUnicode.status !== 1
    || redirectedStdout !== expectedWarning
    || !redirectedStderr.startsWith('[pipeline] ERROR: Remotion composition is unavailable')
    || redirectedStderr.trimEnd().split('\n').length !== 1
    || forbiddenDiagnostics.test(combinedOutput)
  ) {
    console.error(`Packaged pipeline UTF-8 failure probe did not reach the intended Remotion prerequisite error for ${runtimeId}.`);
    if (redirectedStdout) console.error(redirectedStdout.trim());
    if (redirectedStderr) console.error(redirectedStderr.trim());
    if (redirectedUnicode.error) console.error(redirectedUnicode.error.message);
    process.exit(1);
  }
  console.log(`Packaged pipeline redirected UTF-8 probe passed for ${runtimeId}.`);
}

console.log(`Packaged pipeline runtime OK: ${path.relative(process.cwd(), runtimeDir)}`);
