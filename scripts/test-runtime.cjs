#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const runtimeId = `${process.platform}-${process.arch}`;
const result = spawnSync(process.execPath, ['scripts/assert-packaged-runtime.cjs', runtimeId], {
  cwd: process.cwd(),
  encoding: 'utf8',
  timeout: 90_000,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
