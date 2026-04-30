#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const runtimeId = process.argv[2];

if (!runtimeId) {
  console.error('Usage: node scripts/assert-packaged-runtime.cjs <runtime-id>');
  process.exit(2);
}

const isWindows = runtimeId.startsWith('win32-');
const exe = isWindows ? '.exe' : '';
const runtimeDir = path.join(process.cwd(), 'python', 'runtime', runtimeId);
const required = [
  path.join(runtimeDir, 'runtime.json'),
  path.join(runtimeDir, 'pipeline', '6fb-pipeline', `6fb-pipeline${exe}`),
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

console.log(`Packaged pipeline runtime OK: ${path.relative(process.cwd(), runtimeDir)}`);
