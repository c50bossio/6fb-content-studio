#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const main = fs.readFileSync(path.join(root, 'electron/main.ts'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'electron/preload.ts'), 'utf8');
const setup = fs.readFileSync(path.join(root, 'src/pages/Setup.tsx'), 'utf8');
const windowsRuntimeBuilder = fs.readFileSync(path.join(root, 'scripts/build-pipeline-runtime.ps1'), 'utf8');
const windowsRelease = fs.readFileSync(path.join(root, '.github/workflows/release-windows.yml'), 'utf8');
const pythonTest = fs.readFileSync(path.join(root, 'scripts/test-python.cjs'), 'utf8');

const uniqueSorted = values => [...new Set(values)].sort();
const preloadChannels = uniqueSorted([...preload.matchAll(/ipcRenderer\.invoke\(['"]([^'"]+)['"]/g)].map(match => match[1]));
const mainChannels = uniqueSorted([...main.matchAll(/ipcMain\.handle\(['"]([^'"]+)['"]/g)].map(match => match[1]));

assert.deepEqual(preloadChannels, mainChannels, 'Preload invoke channels and main handlers must match exactly');
assert.ok(preloadChannels.length >= 60, `Expected a substantial IPC contract, found only ${preloadChannels.length} channels`);

const rawFetchCalls = [...main.matchAll(/(?<![A-Za-z.])fetch\(/g)];
assert.equal(rawFetchCalls.length, 1, 'Only boundedFetch may call the raw fetch API');
assert.match(main, /AbortSignal\.timeout\(timeoutMs\)/, 'External fetches must have a hard timeout');

const anthropicClients = [...main.matchAll(/new Anthropic\(([^\n]+)\)/g)].map(match => match[1]);
assert.ok(anthropicClients.length >= 4, 'Expected all AI generation entry points to be present');
for (const config of anthropicClients) {
  assert.match(config, /maxRetries:\s*2/, 'Anthropic calls must have bounded retries');
  assert.match(config, /timeout:\s*30_000/, 'Anthropic calls must have a request timeout');
}

assert.match(main, /safeNumericRunPath\(runId, clipsDir\(\)\)/, 'Clip deletion must use a numeric owned run path');
assert.match(main, /validateLocalScheduledPost\(normalized\)/, 'Scheduled posts must cross the main-process validator');
assert.match(main, /return \{ success: false, error: 'Invalid trim range' \}/, 'Editor renders must reject invalid trim ranges');
assert.doesNotMatch(main, /settingsPath:\s*store\.path/, 'Renderer health must not expose the electron-store settings path');
assert.doesNotMatch(setup, /src=["']\/content-playbook\.png["']/, 'Packaged renderer assets must not use filesystem-root URLs');
assert.match(windowsRuntimeBuilder, /if \(\$LASTEXITCODE -ne 0\)/, 'Windows runtime native commands must fail closed');
assert.match(windowsRelease, /name: Run full test suite[\s\S]*?SIXFB_TEST_PYTHON[\s\S]*?npm test/, 'Windows releases must test with the populated runtime venv');
assert.match(pythonTest, /process\.env\.SIXFB_TEST_PYTHON/, 'Python tests must honor the workflow-selected interpreter');
assert.match(main, /isSamePath\(filePath, app\.getPath\('userData'\)\)/, 'Trusted Open Folder must allow only the exact app-data directory');

console.log(`Contract checks passed: ${preloadChannels.length} IPC channels, bounded external clients, packaged assets, Windows gates, and critical validators.`);
