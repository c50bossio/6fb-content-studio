#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const requiredSources = [
  'electron/main.ts',
  'electron/python-bridge.ts',
  'electron/preload.ts',
  'src/pages/Setup.tsx',
  'scripts/build-pipeline-runtime.ps1',
  '.github/workflows/release.yml',
  '.github/workflows/release-windows.yml',
  'scripts/test-docs.cjs',
  'scripts/test-python.cjs',
  'scripts/verify-public-macos-release-assets.sh',
  'scripts/validate-workspace.cjs',
  'take-screenshots.mjs',
  'src/App.tsx',
  'src/components/Sidebar.tsx',
  'src/pages/Scheduler.tsx',
  'src/hooks/useModalFocus.ts',
  'src/index.css',
  'src/pages/ClipExtractor.tsx',
  'src/components/ScheduleModal.tsx',
  'src/components/InstagramPostModal.tsx',
  'src/pages/VideoPlanner.tsx',
  'src/types/trends.ts',
  'electron/trend-intelligence.mts',
  'electron/smart-trend-service.mts',
  'electron/instagram-graph.mts',
];
const missingSources = requiredSources.filter(relativePath => !fs.existsSync(path.join(root, relativePath)));
if (missingSources.length) {
  missingSources.forEach(relativePath => console.error(`Missing contract source: ${relativePath}`));
  process.exit(1);
}
const [
  main,
  pythonBridge,
  preload,
  setup,
  windowsRuntimeBuilder,
  releaseWorkflow,
  windowsRelease,
  docsTest,
  pythonTest,
  publicMacManifestVerifier,
  workspaceValidator,
  screenshotHarness,
  app,
  sidebar,
  scheduler,
  modalFocus,
  globalStyles,
  clipExtractor,
  scheduleModal,
  instagramModal,
  videoPlanner,
  trendTypes,
  trendIntelligence,
  smartTrendService,
  instagramGraph,
] = requiredSources.map(relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8'));

const uniqueSorted = values => [...new Set(values)].sort();
const preloadChannels = uniqueSorted([...preload.matchAll(/ipcRenderer\.invoke\(['"]([^'"]+)['"]/g)].map(match => match[1]));
const mainChannels = uniqueSorted([...main.matchAll(/ipcMain\.handle\(['"]([^'"]+)['"]/g)].map(match => match[1]));

assert.deepEqual(preloadChannels, mainChannels, 'Preload invoke channels and main handlers must match exactly');
assert.ok(preloadChannels.length >= 60, `Expected a substantial IPC contract, found only ${preloadChannels.length} channels`);

const rawFetchCalls = [...main.matchAll(/(?<![A-Za-z.])fetch\(/g)];
assert.equal(rawFetchCalls.length, 1, 'Only boundedFetch may call the raw fetch API');
assert.match(main, /AbortSignal\.timeout\(timeoutMs\)/, 'External fetches must have a hard timeout');
assert.match(preload, /fetchSmartTrends:[\s\S]*?ipcRenderer\.invoke\('fetch-smart-trends'\)/, 'Smart Trends must cross the typed preload bridge');
assert.match(main, /ipcMain\.handle\('fetch-smart-trends'/, 'Smart Trends must run in Electron main');
assert.match(main, /ipcMain\.handle\('open-trend-source'[\s\S]*?sanitizeTrendUrl[\s\S]*?try \{[\s\S]*?shell\.openExternal\(safeUrl\)[\s\S]*?catch \{[\s\S]*?Could not open the trend source\./, 'Trend source links must be allowlisted and return a handled OS-open failure');
assert.match(smartTrendService, /ATTEMPT_TIMEOUT_MS = 5_000/, 'Trend source attempts must have a five-second timeout');
assert.match(smartTrendService, /AGGREGATE_TIMEOUT_MS = 8_000/, 'Trend source retries must have an aggregate deadline');
assert.match(smartTrendService, /attempt < 2/, 'Trend source retries must stop after two total attempts');
assert.match(smartTrendService, /CIRCUIT_FAILURE_LIMIT = 3/, 'Trend sources must open their circuit after three failures');
assert.match(smartTrendService, /CIRCUIT_OPEN_MS = 5 \* 60_000/, 'Trend source circuits must have a bounded open window');
assert.match(smartTrendService, /MAX_JSON_BYTES = 512 \* 1024/, 'Trend JSON responses must have a hard size cap');
assert.match(smartTrendService, /MIN_USEFUL_BARBER_FIT = 20/, 'Broad live data must clear a fixed useful-fit threshold');
assert.match(smartTrendService, /createIdeaStarters\(4\)[\s\S]*?broadLiveIdeas\.slice\(0, 2\)/, 'All-low-fit live data must lead with useful starters and cap broad signals');
assert.match(smartTrendService, /No signal cleared barber fit \$\{MIN_USEFUL_BARBER_FIT\}/, 'Low-fit source status must explain why starters lead');
assert.match(smartTrendService, /createHash\('sha256'\)/, 'Authenticated trend caches must be partitioned without storing raw credentials as keys');
assert.match(smartTrendService, /'tiktok', 'unavailable'/, 'TikTok must remain unavailable until an approved source exists');
assert.match(instagramGraph, /graph\.facebook\.com\/v23\.0/, 'Instagram integrations must use the centrally pinned supported Graph API version');
assert.doesNotMatch(`${main}\n${smartTrendService}\n${instagramGraph}`, /graph\.facebook\.com\/v1[89]\.0/, 'Instagram integrations must not use expired Graph API versions');
assert.match(trendTypes, /'your-plan'/, 'Planned content must have a non-live evidence state');
assert.match(trendTypes, /'connected'/, 'Content Planner must have a truthful connected source state');
assert.match(trendIntelligence, /MAX_GOOGLE_RSS_BYTES = 512 \* 1024/, 'Google RSS parsing must reject oversized payloads');
assert.match(trendIntelligence, /SENSITIVE_QUERY_KEY/, 'Trend source URLs must reject credential-like query keys');
assert.match(videoPlanner, /Find live trends/, 'The planner must use explicit live-source copy');
assert.equal((videoPlanner.match(/window\.electronAPI\.fetchSmartTrends\(\)/g) ?? []).length, 1, 'Live trend retrieval must have one explicit renderer call site');
assert.match(videoPlanner, /onClick=\{fetchTrending\}/, 'Only the explicit Find live trends control may invoke the renderer retrieval handler');
assert.match(videoPlanner, /Source checked.*source\.checkedAt/s, 'Trend source states must render their evidence timestamp');
assert.match(videoPlanner, /Published.*idea\.publishedAt/s, 'Trend ideas must render their source publication timestamp when present');
assert.match(videoPlanner, /Live signals, your plan, and offline starters are labelled separately\./, 'The planner must explain evidence states');
assert.doesNotMatch(videoPlanner, /Trending in your niche|How I price my cuts in 2025|Tools every barber needs in 2025/, 'The planner must not present stale starters as trends');
assert.doesNotMatch(videoPlanner, /access[_-]?token|contentPlannerToken|instagramAccessToken/i, 'The renderer must not receive trend credentials');

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
assert.match(windowsRuntimeBuilder, /Invoke-NativeCommand -FilePath "node" -ArgumentList @\("-p"/, 'PowerShell must pass Node print flags as explicit native arguments');
assert.match(windowsRuntimeBuilder, /IsNullOrWhiteSpace\(\$FfmpegStatic\)/, 'Windows runtime discovery must reject empty ffmpeg paths before Test-Path');
assert.match(windowsRelease, /name: Run full test suite[\s\S]*?SIXFB_TEST_PYTHON[\s\S]*?npm test/, 'Windows releases must test with the populated runtime venv');
assert.match(releaseWorkflow, /name: Run full test suite\s+env:\s+SIXFB_TEST_PYTHON: \$\{\{ github\.workspace \}\}\/python\/\.build-venv\/bin\/python\s+run: npm test/, 'macOS releases must test with the freshly built runtime venv');
assert.doesNotMatch(docsTest, /execFileSync\(['"]rg['"]/, 'Documentation tests must not require ripgrep on Windows runners');
assert.match(docsTest, /fs\.readdirSync\(absoluteDirectory, \{ withFileTypes: true \}\)/, 'Documentation tests must enumerate Markdown files portably');
assert.doesNotMatch(windowsRelease, /workflow_call:/, 'Deferred Windows validation must not be callable from the production release workflow');
assert.match(windowsRelease, /workflow_dispatch:/, 'Deferred Windows validation must remain an explicit non-publishing manual action');
assert.match(
  windowsRelease,
  /npm run package:win\s+--\s+--publish never/,
  'Deferred Windows validation must force publishing off',
);
assert.match(windowsRelease, /RELEASE_VERSION_INPUT: \$\{\{ inputs\.version \}\}/, 'Workflow inputs must enter PowerShell through the environment, not source interpolation');
assert.match(windowsRelease, /actions\/upload-artifact@v7/, 'Windows artifacts must use the current Node 24 staging action');
assert.match(releaseWorkflow, /actions\/download-artifact@v8/, 'Coordinated publication must use the current Node 24 download action');
assert.match(windowsRelease, /actions\/checkout@v6[\s\S]*?persist-credentials: false/, 'Windows release validation must not retain checkout credentials');
assert.match(releaseWorkflow, /actions\/checkout@v6[\s\S]*?persist-credentials: false/, 'Coordinated release validation must not retain checkout credentials');
const releaseCheckoutCount = (releaseWorkflow.match(/uses: actions\/checkout@v6/g) || []).length;
const hardenedReleaseCheckoutCount = (releaseWorkflow.match(/uses: actions\/checkout@v6\s+with:\s+persist-credentials: false/g) || []).length;
assert.equal(hardenedReleaseCheckoutCount, releaseCheckoutCount, 'Every coordinated release checkout must remove persisted credentials');
assert.doesNotMatch(windowsRelease, /softprops\/action-gh-release/, 'The Windows workflow must never publish independently');
assert.doesNotMatch(releaseWorkflow, /release-windows|\.exe|latest\.yml/, 'The production tag workflow must remain macOS-only');
assert.match(releaseWorkflow, /concurrency:[\s\S]*?cancel-in-progress: false/, 'Release reruns must serialize without cancelling an active release');
assert.match(releaseWorkflow, /validate-tag:[\s\S]*?\^v\[0-9\]\+/, 'Release tags must be validated before platform builds start');
assert.match(releaseWorkflow, /stage-release:[\s\S]*?needs: release-mac/, 'Release staging must wait for the macOS build');
assert.match(releaseWorkflow, /name: release-mac[\s\S]*?path: release/, 'Release staging must download only the macOS artifact set');
const exactMacReleaseAssets = [
  '6FB-Content-Studio-arm64.dmg',
  '6FB-Content-Studio-arm64.zip',
  '6FB-Content-Studio-arm64.zip.blockmap',
  'latest-mac.yml',
].sort();
const workflowManifestArrays = [...releaseWorkflow.matchAll(/expected=\(\s*([\s\S]*?)\s*\)/g)].map(match =>
  [...match[1].matchAll(/"([^"]+)"/g)].map(asset => asset[1]).sort(),
);
assert.equal(workflowManifestArrays.length, 2, 'The release workflow must validate exactly two asset manifests: local staging and draft');
for (const manifest of workflowManifestArrays) {
  assert.deepEqual(manifest, exactMacReleaseAssets, 'Every release workflow manifest must contain exactly the four macOS artifacts');
}
assert.match(releaseWorkflow, /Stage complete macOS draft release[\s\S]*?draft: true/, 'macOS artifacts must remain draft until certification passes');
assert.match(releaseWorkflow, /body_path: delivery\/release-notes\/v/, 'The public release must use the tracked release notes');
assert.match(releaseWorkflow, /RELEASE_ID: \$\{\{ steps\.stage-draft\.outputs\.id \}\}/, 'Draft verification must use the exact release created by the staging action');
assert.match(releaseWorkflow, /Verify exact draft asset manifest[\s\S]*?expected-assets\.txt[\s\S]*?actual-assets\.txt/, 'Draft verification must reject stale or missing release assets');
assert.match(releaseWorkflow, /RELEASE_INCLUDE_DRAFT: '1'/, 'macOS certification must inspect the staged draft asset');
assert.match(releaseWorkflow, /RELEASE_ID: \$\{\{ needs\.stage-release\.outputs\.release_id \}\}/, 'Staged macOS certification must use the exact draft release ID');
assert.match(releaseWorkflow, /publish-release:[\s\S]*?needs: smoke-staged-mac[\s\S]*?gh release edit[\s\S]*?--repo "\$GITHUB_REPOSITORY"[\s\S]*?--draft=false/, 'Publication must happen only after staged macOS certification and target the explicit repository');
assert.match(releaseWorkflow, /smoke-published-mac:[\s\S]*?needs: publish-release[\s\S]*?smoke-mac-release-dmg\.sh/, 'Workflow success must include a public macOS download smoke');
assert.doesNotMatch(releaseWorkflow.match(/smoke-published-mac:[\s\S]*$/)?.[0] || '', /GH_TOKEN:/, 'Public release smoke must prove anonymous availability');
assert.match(releaseWorkflow, /Verify anonymous public macOS asset manifest[\s\S]*?verify-public-macos-release-assets\.sh[\s\S]*?Smoke public macOS DMG/, 'Public certification must verify the exact anonymous asset manifest before DMG smoke');
assert.match(publicMacManifestVerifier, /curl[\s\S]*?--retry 2[\s\S]*?--connect-timeout 10 --max-time 60/, 'Public manifest verification must use bounded anonymous network calls');
assert.doesNotMatch(publicMacManifestVerifier, /Authorization:|GH_TOKEN/, 'Public manifest verification must not depend on authentication');
const publicManifestMatch = publicMacManifestVerifier.match(/expected=\(\s*([\s\S]*?)\s*\)/);
assert.ok(publicManifestMatch, 'Public manifest verifier must declare the expected asset set');
const publicManifestAssets = [...publicManifestMatch[1].matchAll(/"([^"]+)"/g)].map(asset => asset[1]).sort();
assert.deepEqual(publicManifestAssets, exactMacReleaseAssets, 'Public manifest verifier must require exactly the four macOS artifacts');
assert.match(pythonTest, /process\.env\.SIXFB_TEST_PYTHON/, 'Python tests must honor the workflow-selected interpreter');
assert.match(pythonTest, /const candidates = requestedPython \? \[requestedPython\] : systemCandidates/, 'An explicitly selected Python interpreter must fail closed instead of falling back to the host');
assert.match(pythonTest, /legacy_codepage_env\['PYTHONIOENCODING'\] = 'cp1252'/, 'Python tests must reproduce redirected Windows legacy-codepage output');
assert.match(pythonTest, /stderr\.strip\(\) == f'\[pipeline\] ERROR: \{expected_remotion_error\}'/, 'Python negative-path tests must assert the intended Remotion failure exactly');
assert.match(pythonBridge, /PYTHONUTF8: '1'/, 'Electron clip extraction must force Python UTF-8 mode');
assert.match(pythonBridge, /PYTHONIOENCODING: 'utf-8'/, 'Electron clip extraction must force UTF-8 child streams');
assert.match(pythonBridge, /proc\.stdout\?\.setEncoding\('utf8'\)/, 'Electron clip extraction must decode stdout across UTF-8 chunk boundaries');
assert.match(pythonBridge, /proc\.stderr\?\.setEncoding\('utf8'\)/, 'Electron clip extraction must decode stderr across UTF-8 chunk boundaries');
assert.match(windowsRelease, /PYTHONUTF8: '1'[\s\S]*?PYTHONIOENCODING: 'utf-8'/, 'Windows release validation must run Python under UTF-8');
assert.match(main, /isSamePath\(filePath, app\.getPath\('userData'\)\)/, 'Trusted Open Folder must allow only the exact app-data directory');
assert.match(workspaceValidator, /process\.env\.SIXFB_WORKSPACE_PYTHON/, 'Workspace validation must support an explicit Python interpreter');
assert.match(workspaceValidator, /process\.platform === 'win32'/, 'Workspace validation must select Python cross-platform');
assert.match(screenshotHarness, /socket\.on\('error'/, 'CDP must reject pending commands on persistent socket errors');
assert.match(screenshotHarness, /socket\.on\('close'/, 'CDP must reject pending commands when the socket closes');
assert.match(app, /saveApiKey:\s*async \(provider: string, _key: string\)/, 'Browser preview must preserve the two-argument API-key contract');
assert.match(sidebar, /useModalFocus\([\s\S]*?initialFocusRef: mobileDrawerRef[\s\S]*?returnFocusRef: mobileTriggerRef/, 'Mobile navigation must trap focus and restore its opener');
assert.match(scheduler, /useModalFocus\(\{ active: true, containerRef: dialogRef, onClose \}\)/, 'Scheduler dialog must use modal focus management');
assert.match(modalFocus, /event\.key === 'Escape'/, 'Modal focus management must close on Escape');
assert.match(modalFocus, /event\.key !== 'Tab'/, 'Modal focus management must trap Tab navigation');
assert.match(modalFocus, /for \(const sibling of modalBranch\.parentElement\.children\)/, 'Modal focus management must inert sibling subtrees along its ancestor chain');
assert.match(modalFocus, /if \(opener\?\.isConnected\) opener\.focus\(\)/, 'Modal focus management must restore the opener after close');
assert.match(scheduler, /const result = await window\.electronAPI\.postToSocial/, 'Scheduler publishing handoff must await the browser-open result');
assert.match(scheduler, /!result\.success \|\| !result\.opened/, 'Scheduler publishing handoff must fail unless the page actually opened');
assert.match(scheduler, /disabled=\{isPosting\}/, 'Scheduler publishing handoff must disable repeat attempts while pending');
assert.match(scheduler, /onClick=\{onMarkPosted\} disabled=\{isPosting\}/, 'Scheduler must block status mutation while a publishing handoff is pending');
assert.match(scheduler, /onClick=\{onDelete\} disabled=\{isPosting\}/, 'Scheduler must block deletion while a publishing handoff is pending');
assert.match(scheduler, /role="alert"/, 'Scheduler publishing handoff must surface failures accessibly');
assert.match(globalStyles, /min-height:\s*44px/, 'The verified 44px interaction target floor must remain enabled');
assert.match(screenshotHarness, /rect\.width < 44 \|\| rect\.height < 44/, 'Visual QA must continue rejecting undersized interaction targets at every audited width');
for (const [name, source] of [
  ['Clip preview', clipExtractor],
  ['Post details', scheduler],
  ['Schedule modal', scheduleModal],
  ['Instagram modal', instagramModal],
]) {
  assert.match(source, /useModalFocus\(/, `${name} must use complete modal focus management`);
  assert.match(source, /role="dialog"/, `${name} must expose dialog semantics`);
  assert.match(source, /aria-modal="true"/, `${name} must identify itself as modal`);
}
assert.match(clipExtractor, /useModalFocus\(\{ active: true, containerRef: dialogRef, onClose \}\)/, 'Clip preview must preserve its original opener while a nested Instagram dialog is active');
assert.match(scheduleModal, /requestClose = useCallback\(\(\) => \{ if \(!busy\) onClose\(\); \}/, 'Schedule modal must not close during upload or scheduling');
assert.match(instagramModal, /requestClose = useCallback\(\(\) => \{ if \(!isPosting\) onClose\(\); \}/, 'Instagram modal must not close while posting');
assert.match(scheduler, /closeDialog = \(\) => \{ if \(!isPosting\) onClose\(\); \}/, 'Post details must not close while a publishing handoff is pending');

console.log(`Contract checks passed: ${preloadChannels.length} IPC channels, bounded external clients, packaged assets, macOS release gates, deferred Windows validation, and critical validators.`);
