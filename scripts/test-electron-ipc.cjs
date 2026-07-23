const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const WebSocket = require('ws');
const { stopChildAndRemoveFixture } = require('./electron-ipc-cleanup.cjs');

const projectRoot = resolve(__dirname, '..');
const electronBinary = require('electron');
const fixtureRoot = mkdtempSync(join(tmpdir(), '6fb-electron-ipc-'));
const userDataDir = join(fixtureRoot, 'profile');
const clipsDir = join(userDataDir, 'clips', '1784660000000');
const clipPath = join(clipsDir, 'clip.mp4');
const specPath = join(clipsDir, 'clip_spec.json');
const outsideDir = join(fixtureRoot, 'outside');
const outsideSecret = join(outsideDir, 'secret.txt');
const linkedSecret = join(userDataDir, 'clips', 'linked-outside', 'secret.txt');
const debugPort = 9400 + (process.pid % 200);

mkdirSync(clipsDir, { recursive: true });
mkdirSync(outsideDir, { recursive: true });
const ffmpegResult = spawnSync(require('ffmpeg-static'), [
  '-y', '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=30:d=2',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clipPath,
], { encoding: 'utf8', timeout: 30_000 });
if (ffmpegResult.status !== 0) {
  throw new Error(`Could not create Electron trim fixture: ${ffmpegResult.stderr}`);
}
writeFileSync(specPath, JSON.stringify({ title: 'IPC smoke clip', clipStart: 10, clipEnd: 12, duration: 2 }));
writeFileSync(outsideSecret, 'secret');
symlinkSync(outsideDir, join(userDataDir, 'clips', 'linked-outside'), process.platform === 'win32' ? 'junction' : 'dir');

const firstApprovedTarget = join(fixtureRoot, 'approved-first');
const secondApprovedTarget = join(fixtureRoot, 'approved-second');
const persistedLink = join(fixtureRoot, 'persisted-selection');
mkdirSync(firstApprovedTarget);
mkdirSync(secondApprovedTarget);
writeFileSync(join(firstApprovedTarget, 'selected.png'), 'first');
writeFileSync(join(secondApprovedTarget, 'selected.png'), 'second');
symlinkSync(firstApprovedTarget, persistedLink, process.platform === 'win32' ? 'junction' : 'dir');
const persistedSelectedPath = join(persistedLink, 'selected.png');
const pinnedApprovedTarget = realpathSync.native(persistedSelectedPath);
rmSync(persistedLink, { recursive: true, force: true });
symlinkSync(secondApprovedTarget, persistedLink, process.platform === 'win32' ? 'junction' : 'dir');
writeFileSync(join(userDataDir, 'config.json'), JSON.stringify({ approvedMediaPaths: [pinnedApprovedTarget] }));

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async open() {
    await new Promise((resolveOpen, reject) => {
      this.socket.once('open', resolveOpen);
      this.socket.once('error', reject);
    });
    this.socket.on('message', data => {
      const message = JSON.parse(String(data));
      if (!message.id) {
        this.events.push(message);
        return;
      }
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));

async function waitForTarget() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl);
        if (page) return page;
      }
    } catch {}
    await delay(100);
  }
  throw new Error('Timed out waiting for the isolated Electron renderer');
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function waitForApi(client) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await evaluate(client, `Boolean(window.electronAPI?.checkSystemHealth)`)) return;
    await delay(100);
  }
  throw new Error('Timed out waiting for the preload API');
}

async function loadResourceStatus(client, filePath, elementName = 'img') {
  const eventStart = client.events.length;
  const url = `localfile://${encodeURIComponent(filePath)}`;
  await evaluate(client, `(() => {
    const element = document.createElement(${JSON.stringify(elementName)});
    element.style.display = 'none';
    element.src = ${JSON.stringify(url)};
    document.body.appendChild(element);
  })()`);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = client.events.slice(eventStart).find(event => (
      event.method === 'Network.responseReceived' && event.params?.response?.url === url
    ));
    if (response) return response.params.response.status;
    await delay(50);
  }
  throw new Error(`No protocol response observed for ${filePath}`);
}

async function run() {
  const child = spawn(electronBinary, [`--remote-debugging-port=${debugPort}`, projectRoot], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      SIXFB_USER_DATA_DIR: userDataDir,
      SIXFB_DISABLE_AUTO_UPDATES: '1',
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  let client;
  try {
    const target = await waitForTarget();
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.open();
    await Promise.all([client.send('Runtime.enable'), client.send('Network.enable')]);
    await waitForApi(client);
    const browserSsoApi = await evaluate(client, `({
      start: typeof window.electronAPI.start6FBBrowserLogin,
      cancel: typeof window.electronAPI.cancel6FBBrowserLogin,
      complete: typeof window.electronAPI.on6FBBrowserLoginComplete,
    })`);
    assert.deepEqual(browserSsoApi, { start: 'function', cancel: 'function', complete: 'function' }, 'browser SSO IPC must be exposed through the isolated preload API');

    let assetState;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      assetState = await evaluate(client, `(() => {
        const image = document.querySelector('img[alt="6FB Content Studio"]');
        return {
          exists: Boolean(image),
          complete: Boolean(image?.complete),
          naturalWidth: image?.naturalWidth || 0,
          src: image?.src || '',
          body: document.body?.innerText?.slice(0, 120) || '',
        };
      })()`);
      if (assetState.exists && assetState.complete && assetState.naturalWidth > 0) break;
      await delay(100);
    }
    assert.equal(assetState?.naturalWidth > 0, true, `packaged Setup artwork must load from file://: ${JSON.stringify(assetState)}`);

    const health = await evaluate(client, `window.electronAPI.checkSystemHealth()`);
    assert.equal(resolve(health.paths.userData), resolve(userDataDir), 'isolated profile must be active');
    assert.equal('settingsPath' in health.paths, false, 'renderer health must not expose the settings file');

    const thumbnailFixture = {
      diagnosis: 'A precise first pass protects the final taper.',
      titles: ['Stop Rushing the Taper', 'The First Guide Matters', 'Why Your Blend Looks Heavy'],
      thumbnails: [
        { text: 'DON’T START HIGH', creativeLane: 'warning', accent: 'red', treatment: 'clean', visualDirection: 'A barber sets the first guideline low at the temple.', transcriptEvidence: 'The speaker explains that the first guide sets the taper height.', timestamp: '02:14' },
        { text: 'TOO MUCH WEIGHT', creativeLane: 'mistake', accent: 'emerald', treatment: 'clean', visualDirection: 'A close taper shows weight left behind at the transition.', transcriptEvidence: 'The speaker explains that skipped blending leaves weight.', timestamp: '03:20' },
        { text: 'CLOSED FIRST?', creativeLane: 'curiosity', accent: 'none', treatment: 'clean', visualDirection: 'A barber begins the taper with a closed lever near the neckline.', transcriptEvidence: 'The speaker explains why the lever starts closed.', timestamp: '04:10' },
      ],
      description: 'The first taper decision controls the entire blend.',
      cta: 'Practice one clean guideline before your next client.',
    };
    const savedThumbnail = await evaluate(client, `window.electronAPI.saveThumbnailPackage({
      sourceName: 'IPC smoke source', sourceRunId: '1784660000000', package: ${JSON.stringify(thumbnailFixture)}
    })`);
    assert.equal(savedThumbnail.success, true, 'valid thumbnail package must save in the isolated profile');
    assert.ok(savedThumbnail.id, 'saved thumbnail package must receive a main-process record id');
    const savedThumbnails = await evaluate(client, `window.electronAPI.listThumbnailPackages()`);
    assert.equal(savedThumbnails.packages.some(item => item.id === savedThumbnail.id), true, 'saved thumbnail package must appear in the local library');
    const loadedThumbnail = await evaluate(client, `window.electronAPI.loadThumbnailPackage(${JSON.stringify(savedThumbnail.id)})`);
    assert.equal(loadedThumbnail.success, true, 'saved thumbnail package must reopen through the main-process boundary');
    assert.deepEqual(loadedThumbnail.record.package, thumbnailFixture, 'reopened thumbnail package must preserve the complete three-option decision set');
    const unsafeThumbnail = await evaluate(client, `window.electronAPI.saveThumbnailPackage({
      sourceName: 'Unsafe source', sourceRunId: '1784660000000', package: {
        ...${JSON.stringify(thumbnailFixture)},
        thumbnails: [{ ...${JSON.stringify(thumbnailFixture.thumbnails[0])}, framePath: ${JSON.stringify(outsideSecret)} }, ${JSON.stringify(thumbnailFixture.thumbnails[1])}, ${JSON.stringify(thumbnailFixture.thumbnails[2])}]
      }
    })`);
    assert.equal(unsafeThumbnail.success, false, 'thumbnail package persistence must reject paths outside app-owned media storage');

    const savedKey = await evaluate(client, `window.electronAPI.saveApiKey('claude', 'test-secret-value')`);
    assert.equal(savedKey.success, true);
    const configPath = join(userDataDir, 'config.json');
    const configStatus = await loadResourceStatus(client, configPath);
    assert.equal(configStatus, 403, 'localfile protocol must reject electron-store config');
    const symlinkStatus = await loadResourceStatus(client, linkedSecret);
    assert.equal(symlinkStatus, 403, 'localfile protocol must reject symlink escapes from clips');
    const pinnedStatus = await loadResourceStatus(client, pinnedApprovedTarget);
    assert.equal(pinnedStatus, 200, 'persisted canonical media approval must survive restart');
    const retargetedStatus = await loadResourceStatus(client, persistedSelectedPath);
    assert.equal(retargetedStatus, 403, 'persisted approval must reject a symlink retargeted after grant');
    const resetResult = await evaluate(client, `window.electronAPI.resetApp()`);
    assert.equal(resetResult.success, true, 'reset must succeed');
    const resetPinnedStatus = await loadResourceStatus(client, pinnedApprovedTarget);
    assert.equal(resetPinnedStatus, 403, 'reset must immediately revoke in-memory file approvals');

    const mediaStatus = await loadResourceStatus(client, clipPath, 'video');
    assert.equal([200, 206].includes(mediaStatus), true, 'localfile protocol must retain app-owned media access');
    const rejectedOpen = await evaluate(client, `window.electronAPI.openPath(${JSON.stringify(configPath)})`);
    assert.equal(rejectedOpen.success, false, 'openPath must reject settings files');

    const invalidPost = await evaluate(client, `window.electronAPI.saveScheduledPost({
      id: '../escape', platform: 'instagram', platforms: ['instagram'], caption: '',
      mediaPath: ${JSON.stringify(clipPath)}, mediaUrls: [${JSON.stringify(clipPath)}],
      scheduledAt: 'not-a-date', status: 'scheduled'
    })`);
    assert.equal(invalidPost.success, false, 'invalid scheduler data must fail');

    const scheduledAt = new Date(Date.now() + 86_400_000).toISOString();
    const validPost = await evaluate(client, `window.electronAPI.saveScheduledPost({
      id: 'ipc-smoke-post', platform: 'instagram', platforms: ['instagram'], caption: 'Local smoke post',
      mediaPath: ${JSON.stringify(clipPath)}, mediaUrls: [${JSON.stringify(clipPath)}],
      scheduledAt: ${JSON.stringify(scheduledAt)}, status: 'scheduled'
    })`);
    assert.equal(validPost.success, true, 'valid local scheduled post must save');
    const queue = await evaluate(client, `window.electronAPI.getLocalPublishingQueue()`);
    assert.equal(queue.posts.some(post => post.id === 'ipc-smoke-post'), true, 'saved post must reload');
    const removed = await evaluate(client, `window.electronAPI.deleteScheduledPost('ipc-smoke-post')`);
    assert.equal(removed.success, true);
    const cleanQueue = await evaluate(client, `window.electronAPI.getLocalPublishingQueue()`);
    assert.equal(cleanQueue.posts.some(post => post.id === 'ipc-smoke-post'), false, 'deleted post must stay removed');

    const invalidRender = await evaluate(client, `window.electronAPI.renderVideo('editor', {
      clipPath: ${JSON.stringify(clipPath)}, trimStart: 5, trimEnd: 1, outputFormat: '9x16'
    })`);
    assert.equal(invalidRender.success, false, 'invalid editor trim range must fail before FFmpeg');

    const invalidTrim = await evaluate(client, `window.electronAPI.trimClip({
      filePath: ${JSON.stringify(clipPath)}, specPath: ${JSON.stringify(specPath)},
      startSec: 5, endSec: 1
    })`);
    assert.equal(invalidTrim.success, false, 'invalid clip re-trim range must fail before FFmpeg');

    const mismatchedDir = join(userDataDir, 'clips', '1784660000001');
    const mismatchedSpec = join(mismatchedDir, 'clip_spec.json');
    mkdirSync(mismatchedDir, { recursive: true });
    writeFileSync(mismatchedSpec, JSON.stringify({ clipStart: 0, clipEnd: 2, duration: 2 }));
    const mismatchedTrim = await evaluate(client, `window.electronAPI.trimClip({
      filePath: ${JSON.stringify(clipPath)}, specPath: ${JSON.stringify(mismatchedSpec)},
      startSec: 0, endSec: 1
    })`);
    assert.equal(mismatchedTrim.success, false, 'clip and metadata from different directories must be rejected');

    const crossLinkedDir = join(userDataDir, 'clips', '1784660000002');
    const crossLinkedMedia = join(crossLinkedDir, 'clip.mp4');
    const crossLinkedSpec = join(crossLinkedDir, 'clip_spec.json');
    mkdirSync(crossLinkedDir, { recursive: true });
    copyFileSync(clipPath, crossLinkedMedia);
    symlinkSync(specPath, crossLinkedSpec, process.platform === 'win32' ? 'file' : undefined);
    const crossLinkedTrim = await evaluate(client, `window.electronAPI.trimClip({
      filePath: ${JSON.stringify(crossLinkedMedia)}, specPath: ${JSON.stringify(crossLinkedSpec)},
      startSec: 0, endSec: 1
    })`);
    assert.equal(crossLinkedTrim.success, false, 'cross-clip metadata symlinks must be rejected');

    const concurrentTrim = await evaluate(client, `Promise.all([
      window.electronAPI.trimClip({
        filePath: ${JSON.stringify(clipPath)}, specPath: ${JSON.stringify(specPath)},
        startSec: 0.25, endSec: 1.25
      }),
      window.electronAPI.trimClip({
        filePath: ${JSON.stringify(clipPath)}, specPath: ${JSON.stringify(specPath)},
        startSec: 0.5, endSec: 1.5
      })
    ])`);
    assert.equal(concurrentTrim.filter(result => result.success).length, 1, 'exactly one concurrent trim may mutate a clip');
    assert.equal(concurrentTrim.filter(result => !result.success && /already being trimmed/.test(result.error || '')).length, 1, 'the concurrent trim must fail closed on the clip lock');
    const trimmedSpec = JSON.parse(readFileSync(specPath, 'utf8'));
    assert.deepEqual(
      { clipStart: trimmedSpec.clipStart, clipEnd: trimmedSpec.clipEnd, duration: trimmedSpec.duration },
      concurrentTrim[0].success
        ? { clipStart: 10.25, clipEnd: 11.25, duration: 1 }
        : { clipStart: 10.5, clipEnd: 11.5, duration: 1 },
      'successful trim must update metadata exactly once',
    );
    const trimmedProbe = spawnSync(require('ffprobe-static').path, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=index:format=duration', '-of', 'json', clipPath,
    ], { encoding: 'utf8', timeout: 15_000 });
    assert.equal(trimmedProbe.status, 0, `trimmed media must be probeable: ${trimmedProbe.stderr}`);
    const trimmedMedia = JSON.parse(trimmedProbe.stdout);
    assert.equal(trimmedMedia.streams.length, 1, 'trimmed media must retain a video stream');
    assert.equal(Number(trimmedMedia.format.duration) > 0.9, true, 'trimmed media must retain the requested nonzero duration');

    const uppercaseDir = join(userDataDir, 'clips', '1784660000003');
    const uppercaseMedia = join(uppercaseDir, 'clip.MP4');
    const uppercaseSpec = join(uppercaseDir, 'clip_spec.json');
    mkdirSync(uppercaseDir, { recursive: true });
    copyFileSync(clipPath, uppercaseMedia);
    writeFileSync(uppercaseSpec, JSON.stringify({ clipStart: 20, clipEnd: 21, duration: 1 }));
    const uppercaseTrim = await evaluate(client, `window.electronAPI.trimClip({
      filePath: ${JSON.stringify(uppercaseMedia)}, specPath: ${JSON.stringify(uppercaseSpec)},
      startSec: 0, endSec: 0.5
    })`);
    assert.equal(uppercaseTrim.success, true, 'uppercase MP4 extensions must use a distinct temporary output');

    const staleDir = join(userDataDir, 'clips', '1784660000004');
    const staleMedia = join(staleDir, 'clip.mp4');
    const staleSpec = join(staleDir, 'clip_spec.json');
    mkdirSync(staleDir, { recursive: true });
    const shortFixture = spawnSync(require('ffmpeg-static'), [
      '-y', '-f', 'lavfi', '-i', 'color=c=black:s=320x180:r=30:d=0.2',
      '-f', 'lavfi', '-i', 'sine=frequency=1000:sample_rate=44100:duration=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', staleMedia,
    ], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(shortFixture.status, 0, `short trim fixture must render: ${shortFixture.stderr}`);
    writeFileSync(staleSpec, JSON.stringify({ clipStart: 30, clipEnd: 32, duration: 2 }));
    const staleTrim = await evaluate(client, `window.electronAPI.trimClip({
      filePath: ${JSON.stringify(staleMedia)}, specPath: ${JSON.stringify(staleSpec)},
      startSec: 0, endSec: 1
    })`);
    assert.equal(staleTrim.success, false, 'long audio must not hide a video stream shorter than the requested trim');
    assert.deepEqual(
      JSON.parse(readFileSync(staleSpec, 'utf8')),
      { clipStart: 30, clipEnd: 32, duration: 2 },
      'failed duration validation must preserve original metadata',
    );

    console.log('Electron IPC smoke passed: packaged asset, isolated profile, thumbnail-library persistence, pinned protocol approvals, symlink rejection, scheduler lifecycle, and transactional trim validation.');
  } finally {
    client?.close();
    await stopChildAndRemoveFixture(child, fixtureRoot);
    if (child.exitCode && child.exitCode !== 0 && stderr) process.stderr.write(stderr);
  }
}

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
