import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Menu } from 'electron';
import { isAbsolute, join, relative, resolve } from 'path';
import { existsSync, readdirSync, readFileSync, mkdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { runClipExtractor, checkPythonDeps, cancelActiveExtraction, resolveSystemPython, type ClipExtractorRuntime } from './python-bridge';
import { autoUpdater } from 'electron-updater';
import type { ContentBrain, ContentStrategyBrief } from '../src/types/content-strategy';
import type { PublishingPlatform, PublishingQueuePost, PublishingQueueResponse, PublishingStatus } from '../src/types/publishing';

// ── MUST be called before app.whenReady() ──────────────────────────────────
// Disables GPU hardware acceleration & accelerated video decode.
// Without these, Chromium's VideoToolbox decoder on Apple Silicon renders
// solid green frames for H.264 video instead of actual video content.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-accelerated-video-encode');
app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');

// electron-store: handle ESM default export
import Store from 'electron-store';
const ElectronStore = (Store as unknown as { default: typeof Store }).default || Store;

/**
 * StoreSchema — canonical shape of persisted app state.
 * Used for typed direct-key reads; dynamic dot-path writes (e.g. apiKeys.claude)
 * bypass generics so we keep the store untyped at runtime.
 */
export interface StoreSchema {
  apiKeys?: {
    claude?: string;
    openai?: string;
    contentPlanner?: string;
  };
  setupComplete?: boolean;
  brandProfile?: Record<string, unknown>;
  contentBrain?: ContentBrain;
  contentManagerToken?: string;
  contentManagerEmail?: string;
  igAccessToken?: string;
  igUserId?: string;
  igUsername?: string;
  igTokenExpiresAt?: string | null;
}

// Untyped at runtime due to electron-store's dot-notation dynamic keys (apiKeys.${provider})
// StoreSchema above is the authoritative reference for what keys exist.
const store = new ElectronStore();
let mainWindow: BrowserWindow | null = null;
const approvedFilePaths = new Set<string>();

type PipelineSettings = {
  mode?: 'bundled' | 'custom';
  pythonPath?: string;
  ffmpegPath?: string;
  ffprobePath?: string;
  toolsDir?: string;
  pipelineScriptPath?: string;
  binaryPath?: string;
};

function resourcePath(...parts: string[]) {
  return app.isPackaged
    ? join(process.resourcesPath, ...parts)
    : join(process.cwd(), ...parts);
}

function bundledToolsDir() {
  return resourcePath('python', 'tools');
}

function runtimeId() {
  return `${process.platform}-${process.arch}`;
}

function bundledRuntimeDir() {
  return resourcePath('python', 'runtime', runtimeId());
}

function bundledPipelineBinaryPath() {
  const executable = process.platform === 'win32'
    ? join(bundledRuntimeDir(), 'pipeline', '6fb-pipeline', '6fb-pipeline.exe')
    : join(bundledRuntimeDir(), 'pipeline', '6fb-pipeline', '6fb-pipeline');
  return existsSync(executable) ? executable : undefined;
}

function bundledFfmpegPath() {
  const executable = process.platform === 'win32'
    ? join(bundledRuntimeDir(), 'bin', 'ffmpeg.exe')
    : join(bundledRuntimeDir(), 'bin', 'ffmpeg');
  return existsSync(executable) ? executable : undefined;
}

function bundledFfprobePath() {
  const executable = process.platform === 'win32'
    ? join(bundledRuntimeDir(), 'bin', 'ffprobe.exe')
    : join(bundledRuntimeDir(), 'bin', 'ffprobe');
  return existsSync(executable) ? executable : undefined;
}

function existingPath(value?: string) {
  return value && existsSync(value) ? value : undefined;
}

function isInsidePath(childPath: string, parentPath: string) {
  const child = resolve(childPath);
  const parent = resolve(parentPath);
  const rel = relative(parent, child);
  return rel === '' || (!!rel && !rel.startsWith('..') && !isAbsolute(rel));
}

function registerApprovedPath(filePath?: string | null) {
  if (filePath) approvedFilePaths.add(resolve(filePath));
}

function registerApprovedPaths(paths: Array<string | null | undefined>) {
  for (const filePath of paths) registerApprovedPath(filePath);
}

function isAllowedLocalFilePath(filePath: string) {
  if (!filePath || !isAbsolute(filePath)) return false;
  const resolved = resolve(filePath);
  const appOwnedRoots = [
    app.getPath('userData'),
    app.getPath('temp'),
  ];
  if (appOwnedRoots.some(root => isInsidePath(resolved, root))) return true;

  const brand = store.get('brandProfile') as Record<string, unknown> | undefined;
  if (typeof brand?.logoPath === 'string' && resolve(brand.logoPath) === resolved) return true;

  return Array.from(approvedFilePaths).some(approvedPath =>
    resolved === approvedPath || isInsidePath(resolved, approvedPath)
  );
}

function pipelineSettings(): PipelineSettings {
  return (store.get('pipeline') as PipelineSettings | undefined) || {};
}

function runtimeConfig(): ClipExtractorRuntime {
  const settings = pipelineSettings();
  const mode = settings.mode === 'custom' ? 'custom' : 'bundled';
  const defaultToolsDir = bundledToolsDir();
  const configuredToolsDir = existingPath(settings.toolsDir);
  const configuredPipelineScriptPath = existingPath(settings.pipelineScriptPath);
  const toolsDir = mode === 'custom' && configuredToolsDir ? configuredToolsDir : defaultToolsDir;
  const pipelineScriptPath = mode === 'custom' && configuredPipelineScriptPath
    ? configuredPipelineScriptPath
    : join(toolsDir, 'pipeline', 'full_pipeline.py');

  return {
    mode,
    pythonPath: existingPath(settings.pythonPath) || resolveSystemPython(),
    ffmpegPath: existingPath(settings.ffmpegPath) || bundledFfmpegPath() || findFfmpeg(),
    ffprobePath: existingPath(settings.ffprobePath) || bundledFfprobePath() || findFfprobe(),
    toolsDir,
    pipelineScriptPath,
    binaryPath: existingPath(settings.binaryPath) || bundledPipelineBinaryPath(),
    anthropicApiKey: (store.get('apiKeys.claude', '') as string) || '',
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: '6FB Content Studio',
    backgroundColor: '#121212',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Dev or production
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register custom protocol for app-owned or explicitly selected local files.
protocol.registerSchemesAsPrivileged([{
  scheme: 'localfile',
  privileges: { secure: true, supportFetchAPI: true },
}]);

app.whenReady().then(() => {
  // Handle localfile:// protocol with proper byte-range support for video streaming.
  // net.fetch() ignores Range headers so video elements show 0:00 and never load.
  protocol.handle('localfile', (request) => {
    const filePath = decodeURIComponent(request.url.replace('localfile://', ''));
    if (!isAllowedLocalFilePath(filePath)) {
      return new Response('Forbidden local file path', { status: 403 });
    }

    // Detect MIME type for video files
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const MIME: Record<string, string> = {
      mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
      mkv: 'video/x-matroska', avi: 'video/x-msvideo',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    };
    const contentType = MIME[ext] ?? 'application/octet-stream';
    const isVideo = contentType.startsWith('video/');

    if (!isVideo) {
      // Non-video: simple fetch is fine
      return net.fetch(pathToFileURL(filePath).toString());
    }

    // Video: handle Range requests for proper seeking/streaming
    const { createReadStream, statSync } = require('fs') as typeof import('fs');
    try {
      const stat = statSync(filePath);
      const totalSize = stat.size;
      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
        const start = parseInt(startStr, 10);
        // When end is omitted (bytes=0-), serve to EOF — 1MB cap caused playback to stop after 1 second
        const end = Math.min((endStr && endStr.length > 0) ? parseInt(endStr, 10) : totalSize - 1, totalSize - 1);
        if (!Number.isFinite(start) || start < 0 || start >= totalSize || end < start) {
          return new Response('Requested range not satisfiable', {
            status: 416,
            headers: { 'Content-Range': `bytes */${totalSize}` },
          });
        }
        const chunkSize = end - start + 1;

        const stream = createReadStream(filePath, { start, end });
        const { Readable } = require('stream') as typeof import('stream');
        const webStream = Readable.toWeb(stream) as ReadableStream;

        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
          },
        });
      } else {
        // No Range header — stream the whole file
        const stream = createReadStream(filePath);
        const { Readable } = require('stream') as typeof import('stream');
        const webStream = Readable.toWeb(stream) as ReadableStream;

        return new Response(webStream, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(totalSize),
          },
        });
      }
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
  createWindow();
  startSchedulerDaemon();
  initAutoUpdater();
  buildAppMenu();
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up any running Python extraction before quitting
app.on('before-quit', () => {
  cancelActiveExtraction();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── IPC Handlers ─────────────────────────────────────────────────

// API Key Management
ipcMain.handle('save-api-key', async (_event, { provider, key }: { provider: string; key: string }) => {
  store.set(`apiKeys.${provider}`, key);
  return { success: true };
});

ipcMain.handle('get-api-key', async (_event, provider: string) => {
  const key = store.get(`apiKeys.${provider}`) as string | undefined;
  return { hasKey: !!key, hint: key ? key.slice(0, 7) + '...' + key.slice(-4) : null };
});

ipcMain.handle('get-app-version', async () => app.getVersion());

ipcMain.handle('get-all-settings', async () => {
  return {
    apiKeys: {
      claude: !!store.get('apiKeys.claude'),
      openai: !!store.get('apiKeys.openai'),
    },
    contentPlannerToken: !!(store.get('apiKeys.contentPlanner') as string | undefined),
    setupComplete: store.get('setupComplete', false),
  };
});

ipcMain.handle('complete-setup', async () => {
  store.set('setupComplete', true);
  return { success: true };
});

// Content Planner Brief — fetches today's topic + week plan from content.6fbmentorship.com
ipcMain.handle('fetch-today-brief', async () => {
  const token = store.get('apiKeys.contentPlanner') as string | undefined;
  if (!token) return { success: false, error: 'No Content Planner token. Add it in Settings.' };
  try {
    const res = await fetch('https://content.6fbmentorship.com/api/me/today-brief', {
      headers: { Authorization: `Bearer ${token}`, Cookie: `auth_token=${token}` },
    });
    if (!res.ok) return { success: false, error: `API returned ${res.status}` };
    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

// Complete today's play — marks a planned post as complete or skipped
ipcMain.handle('complete-today-play', async (_, { postId, action }: { postId: string; action: 'complete' | 'skip' }) => {
  const token = store.get('apiKeys.contentPlanner') as string | undefined;
  if (!token) return { success: false, error: 'No Content Planner token.' };
  try {
    const res = await fetch('https://content.6fbmentorship.com/apps/content/api/me/complete-play', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, action }),
    });
    return res.ok ? { success: true } : { success: false, error: `API ${res.status}` };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});

// Fetch user's voice profile from Content Planner web app
ipcMain.handle('fetch-voice-profile', async () => {
  const token = store.get('apiKeys.contentPlanner') as string | undefined;
  if (!token) return { success: false, error: 'No Content Planner token.' };
  try {
    const res = await fetch('https://content.6fbmentorship.com/apps/content/api/me/voice-profile', {
      headers: { 'Authorization': `Bearer ${token}`, Cookie: `auth_token=${token}` },
    });
    return res.ok ? { success: true, data: await res.json() } : { success: false };
  } catch (e) {
    return { success: false, error: String(e) };
  }
});


// File Dialogs
ipcMain.handle('select-video', async () => {
  if (!mainWindow) return { cancelled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Video',
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true };
  }
  registerApprovedPath(result.filePaths[0]);
  return { cancelled: false, filePath: result.filePaths[0] };
});

ipcMain.handle('select-output-dir', async () => {
  if (!mainWindow) return { cancelled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Output Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true };
  }
  registerApprovedPath(result.filePaths[0]);
  return { cancelled: false, dirPath: result.filePaths[0] };
});

// ─── Clip Extractor (Python Bridge) ───────────────────────────────

ipcMain.handle('extract-clips', async (_event, { videoPath, options }: {
  videoPath: string;
  options: { outputFormat?: string; contentType?: string; numClips?: number; startSec?: number; endSec?: number; planContext?: { topic: string; dropZones: { label: string; timestamp: string; endTimestamp: string }[] }; strategyBrief?: ContentStrategyBrief };
}) => {
  const outputDir = join(app.getPath('userData'), 'clips', Date.now().toString());
  const bp = (store.get('brandProfile') as Record<string, unknown>) || DEFAULT_BRAND;
  registerApprovedPaths([videoPath, outputDir]);

  // Save the full source video path so re-extraction works
  const mkdirSync = require('fs').mkdirSync;
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'run_meta.json'), JSON.stringify({ sourceVideoPath: videoPath, strategyBrief: options.strategyBrief || null }, null, 2));
  if (options.strategyBrief) writeFileSync(join(outputDir, 'strategy_brief.json'), JSON.stringify(options.strategyBrief, null, 2));

  const result = await runClipExtractor(
    videoPath,
    outputDir,
    {
      outputFormat: (options.outputFormat as '9x16' | '1x1' | 'split' | 'auto') || '9x16',
      contentType: options.contentType || 'auto',
      numClips: options.numClips || 3,
      startSec: options.startSec,
      endSec: options.endSec,
      brandName: (bp.brandName as string) || '6fbarber',
      planContext: options.planContext,
      strategyBrief: options.strategyBrief,
      runtime: runtimeConfig(),
    },
    mainWindow,
  );
  return result;
});

ipcMain.handle('cancel-extraction', async () => {
  cancelActiveExtraction();
  return { success: true };
});

ipcMain.handle('read-clip-transcript', async (_event, clipPath: string) => {
  // Looks for words.json or captions.json in the same folder as the clip 
  try {
    const { dirname, join } = require('path');
    const { existsSync, readFileSync } = require('fs');
    
    // Fallback search paths for the transcript JSON
    const dir = dirname(clipPath);
    const wordsPath = join(dir, 'words.json');
    const captionsPath = join(dir, 'captions.json');
    const clipSpecPath = join(dir, 'clip_spec.json');

    if (existsSync(wordsPath)) {
      return JSON.parse(readFileSync(wordsPath, 'utf-8'));
    } else if (existsSync(captionsPath)) {
      return JSON.parse(readFileSync(captionsPath, 'utf-8'));
    } else if (existsSync(clipSpecPath)) {
      const spec = JSON.parse(readFileSync(clipSpecPath, 'utf-8'));
      if (spec.words) return spec.words;
    }
    
    // Also check for the raw video's words.json located in the parent dir
    // E.g. parent/source-30s_words.json
    const parentDir = dirname(dir);
    const files = require('fs').readdirSync(parentDir);
    const parentWords = files.find((f: string) => f.endsWith('_words.json'));
    if (parentWords) {
      return JSON.parse(readFileSync(join(parentDir, parentWords), 'utf-8'));
    }

    return null;
  } catch (error) {
    console.error('Failed to read clip transcript:', error);
    return null;
  }
});

// ─── System Health Check ──────────────────────────────────────────

ipcMain.handle('check-system-health', async () => {
  const runtime = runtimeConfig();
  const deps = await checkPythonDeps(runtime);
  return {
    deps,
    paths: {
      userData: app.getPath('userData'),
      clipExtractor: join(runtime.toolsDir, 'clip_extractor'),
      pipelineScript: runtime.pipelineScriptPath,
      binaryPath: runtime.binaryPath,
      toolsDir: runtime.toolsDir,
      ffmpegPath: runtime.ffmpegPath,
      ffprobePath: runtime.ffprobePath,
      pythonPath: runtime.pythonPath,
    },
    apiKeys: {
      claude: !!store.get('apiKeys.claude'),
      openai: !!store.get('apiKeys.openai'),
    },
    pipeline: {
      mode: runtime.mode,
      bundledToolsDir: bundledToolsDir(),
    },
  };
});

// ─── Settings Management ──────────────────────────────────────────

ipcMain.handle('delete-api-key', async (_event, provider: string) => {
  store.delete(`apiKeys.${provider}`);
  return { success: true };
});

ipcMain.handle('reset-app', async () => {
  store.clear();
  return { success: true };
});

ipcMain.handle('open-path', async (_event, path: string) => {
  shell.openPath(path);
  return { success: true };
});

ipcMain.handle('show-in-finder', async (_event, path: string) => {
  shell.showItemInFolder(path);
  return { success: true };
});

function strategyPromptBlock(strategyBrief?: ContentStrategyBrief): string {
  if (!strategyBrief) return '';
  const packageVariants = Array.isArray(strategyBrief.packageVariants) ? strategyBrief.packageVariants : [];
  const variants = packageVariants.slice(0, 3).map((p, i) => {
    const variant = (p && typeof p === 'object') ? p as unknown as Record<string, unknown> : {};
    return `${i + 1}. ${String(variant.title || 'Untitled package')} | Thumb: ${String(variant.thumbnailText || 'Outcome-led cover')} | Angle: ${String(variant.platformAngle || 'Lead with the promise')}`;
  }).join('\n');
  return `

Content strategy brief:
- Intent: ${strategyBrief.intent}
- Audience: ${strategyBrief.audience}
- Viewer outcome: ${strategyBrief.viewerOutcome}
- Promise: ${strategyBrief.promise}
- Curiosity gap: ${strategyBrief.curiosityGap}
- Proof asset: ${strategyBrief.proofAsset}
- Payoff: ${strategyBrief.payoff}
- Positioning: ${strategyBrief.positioning}
Package variants:
${variants}
`;
}

// Carousel Generation (uses student's Claude API key)
ipcMain.handle('generate-carousel', async (_event, { topic, type, keyPoints, brandProfile, strategyBrief }: {
  topic: string;
  type: string;
  keyPoints: string[];
  brandProfile?: Record<string, unknown>;
  strategyBrief?: ContentStrategyBrief;
}) => {
  const apiKey = store.get('apiKeys.claude') as string;
  if (!apiKey) return { success: false, error: 'No Claude API key configured' };

  // Use brand profile if provided, otherwise fall back to stored/default
  const bp = brandProfile || (store.get('brandProfile') as Record<string, unknown>) || DEFAULT_BRAND;
  const toneMap: Record<string, string> = {
    professional: 'confident, clear, and authoritative — no fluff, no hype',
    hype: 'high-energy, punchy, short sentences, IG-native language',
    storyteller: 'narrative-driven, personal, relatable, first-person where natural',
    'data-driven': 'fact-first, cite specific numbers, lead with stats',
  };
  const tone = toneMap[bp.tone as string] || toneMap.professional;
  const layoutStyle = bp.layoutStyle as string || 'bold';
  const brandName = bp.brandName as string || '6FB Mentorship';

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const prompt = `You are a professional carousel designer for ${brandName}.

Brand tone: ${tone}
Visual style: ${layoutStyle} (affects how copy should be written — ${layoutStyle === 'minimal' ? 'very short, punchy' : layoutStyle === 'data-driven' ? 'lead with a number or stat' : 'bold headlines, clear value'})
Style: ${type === 'educational' ? 'Educational' : 'Product Announcement'}
Topic: ${topic}
${strategyPromptBlock(strategyBrief)}

Key Points:
${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Create a 5-slide Instagram carousel (1080x1350 each).
The cover slide must express the viewer outcome or curiosity gap from the strategy brief when available.

You must output your response as pure JSON matching EXACTLY this schema (no markdown, no extra text).
It must be a JSON array containing exactly 5 slide objects:
[
  {
    "slideNumber": 1,
    "slideType": "cover",
    "heading": "Short punchy hook",
    "body": "Optional body text",
    "stat": "Optional stat",
    "ctaText": ""
  }
]`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b: { type: string }) => b.type === 'text');
    let rawText = (textBlock as { text: string })?.text || '';

    rawText = rawText.trim();
    if (rawText.startsWith('\`\`\`json')) rawText = rawText.substring(7);
    if (rawText.startsWith('\`\`\`')) rawText = rawText.substring(3);
    if (rawText.endsWith('\`\`\`')) rawText = rawText.substring(0, rawText.length - 3);
    rawText = rawText.trim();

    let parsedSlides = [];
    try {
      parsedSlides = JSON.parse(rawText);
    } catch (e: any) {
      return { success: false, error: 'Failed to parse AI output: ' + e.message };
    }

    const slides = parsedSlides.map((s: any) => ({
      ...s,
      slideType: s.slideType?.toLowerCase().includes('cover') ? 'cover' : s.slideType?.toLowerCase().includes('cta') ? 'cta' : 'content'
    }));

    return { success: true, slides };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
});


// ─── Brand Profile ────────────────────────────────────────────────
const DEFAULT_BRAND: Record<string, unknown> = {
  brandName: '6FB Mentorship',
  primaryColor: '#00C851',
  accentColor: '#ffffff',
  backgroundColor: '#0f0f0f',
  fontPreset: 'clean-pro',
  headlineFont: 'Space Grotesk',
  bodyFont: 'Inter',
  layoutStyle: 'bold',
  tone: 'professional',
  logoPath: null,
};

const DEFAULT_CONTENT_BRAIN: ContentBrain = {
  audience: '',
  positioning: '',
  offers: [],
  contentPillars: [],
  proofAssets: [],
  voiceRules: [],
  preferredPhrases: [],
  avoidedPhrases: [],
  exampleHooks: [],
};

ipcMain.handle('save-brand-profile', async (_event, profile: Record<string, unknown>) => {
  if (typeof profile.logoPath === 'string') registerApprovedPath(profile.logoPath);
  store.set('brandProfile', profile);
  return { success: true };
});

ipcMain.handle('get-brand-profile', async () => {
  const saved = store.get('brandProfile') as Record<string, unknown> | undefined;
  return saved ?? DEFAULT_BRAND;
});

ipcMain.handle('save-content-brain', async (_event, brain: ContentBrain) => {
  store.set('contentBrain', { ...DEFAULT_CONTENT_BRAIN, ...brain, updatedAt: new Date().toISOString() });
  return { success: true };
});

ipcMain.handle('get-content-brain', async () => {
  const saved = store.get('contentBrain') as ContentBrain | undefined;
  return { ...DEFAULT_CONTENT_BRAIN, ...(saved ?? {}) };
});

ipcMain.handle('select-logo', async () => {
  if (!mainWindow) return { cancelled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Logo',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return { cancelled: true };
  registerApprovedPath(result.filePaths[0]);
  return { cancelled: false, filePath: result.filePaths[0] };
});

ipcMain.handle('select-image-file', async () => {
  if (!mainWindow) return { cancelled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Background Frame',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return { cancelled: true };
  registerApprovedPath(result.filePaths[0]);
  return { cancelled: false, filePath: result.filePaths[0] };
});

ipcMain.handle('export-carousel-deck', async (_event, { title, images }: { title: string; images: string[] }) => {
  try {
    const defaultTitle = title ? title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() : `Carousel_${Date.now()}`;
    const downloadsPath = app.getPath('downloads');
    const folderPath = join(downloadsPath, `6FB_Deck_${defaultTitle}`);
    
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }

    const savedPaths: string[] = [];
    for (let i = 0; i < images.length; i++) {
      // images comes in as standard base64 data URLs: 'data:image/png;base64,iVBORw0KGgo...'
      const base64Data = images[i].replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const filePath = join(folderPath, `slide_${String(i + 1).padStart(2, '0')}.png`);
      require('fs').writeFileSync(filePath, buffer);
      savedPaths.push(filePath);
    }
    registerApprovedPaths([folderPath, ...savedPaths]);
    
    return { success: true, folderPath, savedPaths };
  } catch (error) {
    console.error('Export Carousel Error:', error);
    return { success: false, error: String(error) };
  }
});

// ─── Transcript & Carousel Extraction ────────────────────────────
ipcMain.handle('read-transcript', async (_event, runPath: string) => {
  const formattedPath = join(runPath, 'formatted_transcript.txt');
  const srtFiles = existsSync(runPath)
    ? readdirSync(runPath).filter(f => f.endsWith('.srt'))
    : [];
  if (existsSync(formattedPath)) {
    return { success: true, transcript: readFileSync(formattedPath, 'utf-8'), format: 'formatted' };
  } else if (srtFiles.length > 0) {
    return { success: true, transcript: readFileSync(join(runPath, srtFiles[0]), 'utf-8'), format: 'srt' };
  }
  return { success: false, error: 'No transcript found in run directory' };
});

ipcMain.handle('extract-carousel', async (_event, {
  transcript,
  brandProfile,
  contentType,
  strategyBrief,
}: { transcript: string; brandProfile: Record<string, unknown>; contentType: string; strategyBrief?: ContentStrategyBrief }) => {
  const apiKey = store.get('apiKeys.claude') as string;
  if (!apiKey) return { success: false, error: 'No Claude API key configured' };

  const toneMap: Record<string, string> = {
    professional: 'confident, clear, and authoritative — no fluff, no hype',
    hype: 'high-energy, punchy, short sentences, IG-native language',
    storyteller: 'narrative-driven, personal, relatable, first-person where natural',
    'data-driven': 'fact-first, cite specific numbers, lead with stats',
  };
  const tone = toneMap[brandProfile.tone as string] || toneMap.professional;
  const layoutStyle = brandProfile.layoutStyle as string || 'bold';
  const brandName = brandProfile.brandName as string || '6FB';

  const truncated = transcript.slice(0, 8000);

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const prompt = `You are a social media content strategist for ${brandName}.

Content type: ${contentType || 'general'}
Brand tone: ${tone}
Visual style: ${layoutStyle} (affects how copy should be written — ${layoutStyle === 'minimal' ? 'very short, punchy' : layoutStyle === 'data-driven' ? 'lead with a number or stat' : 'bold headlines, clear value'})
${strategyPromptBlock(strategyBrief)}

Here is the video transcript (with timestamps):
---
${truncated}
---

Extract the 5 most compelling, shareable insights from this transcript and structure them as an Instagram carousel.

Slide 1 is always the HOOK — it must stop the scroll. Make it provocative or surprising.
When a strategy brief is available, Slide 1 must express the viewer outcome or curiosity gap.
Slides 2-4 are VALUE slides — each delivers one clear insight.
Slide 5 is the CALL TO ACTION — direct, specific, tells them what to do next.

IMPORTANT: For each slide, include the TIMESTAMP from the transcript where the insight comes from. Use the format MM:SS or HH:MM:SS matching the transcript timestamps.

You must output your response as pure JSON matching EXACTLY this schema (no markdown, no extra text).
It must be a JSON array containing exactly 5 slide objects:
[
  {
    "slideNumber": 1,
    "slideType": "cover",
    "timestamp": "01:23",
    "heading": "Short punchy hook",
    "body": "Expanded text",
    "stat": "Optional stat",
    "ctaText": ""
  }
]`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b: { type: string }) => b.type === 'text');
    let rawText = (textBlock as { text: string })?.text || '';

    rawText = rawText.trim();
    if (rawText.startsWith('\`\`\`json')) rawText = rawText.substring(7);
    if (rawText.startsWith('\`\`\`')) rawText = rawText.substring(3);
    if (rawText.endsWith('\`\`\`')) rawText = rawText.substring(0, rawText.length - 3);
    rawText = rawText.trim();

    let parsedSlides = [];
    try {
      parsedSlides = JSON.parse(rawText);
    } catch (e: any) {
      return { success: false, error: 'Failed to parse AI output: ' + e.message };
    }

    const slides = parsedSlides.map((s: any) => ({
      ...s,
      slideType: s.slideNumber === 1 ? 'cover' : s.slideNumber === 5 ? 'cta' : 'content'
    }));

    return { success: true, slides };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
});

// ─── Auto-match Frames from Clip Thumbnails ────────────────────
ipcMain.handle('auto-match-carousel-frames', async (_event, {
  runPath,
  timestamps,
}: { runPath: string; timestamps: string[] }) => {
  try {
    // Read validated clips to get time ranges
    const clipsFile = join(runPath, 'validated_clips.json');
    if (!existsSync(clipsFile)) return { success: false, error: 'No validated clips found' };

    const clips: { id: number; title: string; start: number; end: number }[] =
      JSON.parse(readFileSync(clipsFile, 'utf-8'));

    // Parse timestamp "MM:SS" or "HH:MM:SS" to seconds
    const parseTs = (ts: string): number => {
      if (!ts) return -1;
      const parts = ts.replace(/[^\d:]/g, '').split(':').map(Number);
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      return -1;
    };

    // Find clip directories
    const clipDirs = readdirSync(runPath)
      .filter(d => d.startsWith('clip-') && existsSync(join(runPath, d, 'thumbnail.jpg')))
      .map(d => {
        const match = d.match(/^clip-(\d+)/);
        const num = match ? parseInt(match[1], 10) : -1;
        // Find the matching validated clip
        const clipDef = clips.find(c => c.id === num);
        return {
          dir: d,
          num,
          start: clipDef?.start ?? 0,
          end: clipDef?.end ?? 0,
          thumbnailPath: join(runPath, d, 'thumbnail.jpg'),
        };
      })
      .filter(c => c.num > 0);

    if (clipDirs.length === 0) return { success: false, error: 'No clip thumbnails found' };

    // Match each timestamp to the closest clip
    const frames: (string | null)[] = timestamps.map(ts => {
      const seconds = parseTs(ts);
      if (seconds < 0) {
        // No timestamp — use a random clip thumbnail
        return clipDirs[Math.floor(Math.random() * clipDirs.length)].thumbnailPath;
      }

      // Find clip whose time range contains this timestamp
      let best = clipDirs[0];
      let bestDist = Infinity;
      for (const clip of clipDirs) {
        if (seconds >= clip.start && seconds <= clip.end) {
          return clip.thumbnailPath; // exact match
        }
        const dist = Math.min(Math.abs(seconds - clip.start), Math.abs(seconds - clip.end));
        if (dist < bestDist) { bestDist = dist; best = clip; }
      }
      return best.thumbnailPath; // closest match
    });

    return { success: true, frames };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ─── Library & Thumbnails ─────────────────────────────────────────
import { execFile } from 'child_process';
import { rmSync, writeFileSync } from 'fs';

function findFfmpeg(): string {
  const configured = pipelineSettings().ffmpegPath;
  if (configured && existsSync(configured)) return configured;
  const bundled = bundledFfmpegPath();
  if (bundled) return bundled;
  const candidates = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'];
  for (const p of candidates) { if (existsSync(p)) return p; }
  return 'ffmpeg';
}

function findFfprobe(): string {
  const configured = pipelineSettings().ffprobePath;
  if (configured && existsSync(configured)) return configured;
  const bundled = bundledFfprobePath();
  if (bundled) return bundled;
  const candidates = ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe', '/usr/bin/ffprobe'];
  for (const p of candidates) { if (existsSync(p)) return p; }
  return 'ffprobe';
}

// Per-clip async thumbnail — never blocks scan
ipcMain.handle('generate-thumbnail', (_event, { videoPath, thumbPath }: { videoPath: string; thumbPath: string }) => {
  const ffmpeg = findFfmpeg();
  registerApprovedPaths([videoPath, thumbPath]);
  return new Promise<{ success: boolean; thumbPath?: string }>((resolve) => {
    // -frames:v 1 -update 1 required for newer ffmpeg to write a single JPEG without pattern
    execFile(ffmpeg, ['-y', '-ss', '1', '-i', videoPath, '-frames:v', '1', '-q:v', '3', '-vf', 'scale=540:960', '-update', '1', thumbPath],
      { timeout: 12000 }, (err) => {
        if (!err && existsSync(thumbPath)) {
          registerApprovedPath(thumbPath);
          resolve({ success: true, thumbPath });
        }
        else resolve({ success: false });
      });
  });
});

// Fast scan — no ffmpeg, returns immediately
ipcMain.handle('scan-library', async () => {
  const clipsRoot = join(app.getPath('userData'), 'clips');
  if (!existsSync(clipsRoot)) return { runs: [] };
  try {
    const runDirs = readdirSync(clipsRoot, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name)
      .sort((a, b) => Number(b) - Number(a));

    const runs = runDirs.map(runId => {
      const runPath = join(clipsRoot, runId);
      const clips: object[] = [];
      let sourceVideoName = '';
      let sourceVideoPath = '';
      let strategyBrief: ContentStrategyBrief | null = null;
      try {
        const metaPath = join(runPath, 'run_meta.json');
        if (existsSync(metaPath)) {
          const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
          sourceVideoPath = meta.sourceVideoPath || '';
          sourceVideoName = sourceVideoPath.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
          strategyBrief = meta.strategyBrief || null;
        }
        const strategyPath = join(runPath, 'strategy_brief.json');
        if (!strategyBrief && existsSync(strategyPath)) {
          strategyBrief = JSON.parse(readFileSync(strategyPath, 'utf-8'));
        }
        if (!sourceVideoName) {
          const srt = readdirSync(runPath).find(f => f.endsWith('.srt'));
          if (srt) sourceVideoName = srt.replace(/\.srt$/, '');
        }
      } catch {}

      try {
        const clipDirs = readdirSync(runPath, { withFileTypes: true })
          .filter(d => d.isDirectory() && !d.name.startsWith('.'))
          .sort((a, b) => a.name.localeCompare(b.name));
        for (const cd of clipDirs) {
          const clipPath = join(runPath, cd.name);
          const specPath = join(clipPath, 'clip_spec.json');
          const rendered = join(clipPath, 'rendered_composition.mp4');
          const reframed = join(clipPath, 'reframed-9x16.mp4');
          const raw = join(clipPath, 'raw.mp4');
          const filePath = existsSync(rendered) ? rendered : existsSync(reframed) ? reframed : existsSync(raw) ? raw : null;
          const thumbPath = join(clipPath, 'thumbnail.jpg');
          const thumbnailPath = existsSync(thumbPath) ? thumbPath : null;
          let spec: Record<string, unknown> = {};
          if (existsSync(specPath)) { try { spec = JSON.parse(readFileSync(specPath, 'utf-8')); } catch {} }
          const dirTitle = cd.name.replace(/^clip-\d+-/, '');
          clips.push({
            clipId: spec.clipId || cd.name,
            title: (spec.title as string) || dirTitle,
            score: (spec.score as number) || (spec.total_score as number) || 0,
            contentType: (spec.contentType as string) || 'vlog',
            start: (spec.clipStart as number) || 0,
            end: (spec.clipEnd as number) || 0,
            duration: (spec.duration as number) || 0,
            filePath, thumbnailPath,
            thumbPath,
            needsThumbnail: !thumbnailPath && !!filePath,
            status: (spec.status as string) || 'unknown',
            composedAt: (spec.composedAt as string) || null,
            strategyLabel: spec.strategyLabel,
            strategyRationale: spec.strategyRationale,
            strategyScores: spec.strategyScores,
            packageVariant: spec.packageVariant,
            clipPath, specPath,
          });
        }
      } catch {}
      return { runId, timestamp: Number(runId), sourceVideo: sourceVideoPath || sourceVideoName, runPath, strategyBrief, clips };
    }).filter(r => r.clips.length > 0);

    return { runs };
  } catch (err) { return { runs: [], error: String(err) }; }
});

// ─── CRUD ────────────────────────────────────────────────────────────
ipcMain.handle('delete-run', async (_event, runId: string) => {
  try { rmSync(join(app.getPath('userData'), 'clips', runId), { recursive: true, force: true }); return { success: true }; }
  catch (err) { return { success: false, error: String(err) }; }
});

ipcMain.handle('delete-clip', async (_event, clipPath: string) => {
  try { rmSync(clipPath, { recursive: true, force: true }); return { success: true }; }
  catch (err) { return { success: false, error: String(err) }; }
});

ipcMain.handle('rename-clip', async (_event, { specPath, newTitle }: { specPath: string; newTitle: string }) => {
  try {
    const spec = JSON.parse(readFileSync(specPath, 'utf-8'));
    spec.title = newTitle;
    writeFileSync(specPath, JSON.stringify(spec, null, 2));
    return { success: true };
  } catch (err) { return { success: false, error: String(err) }; }
});

// Re-trim an existing extracted clip to new in/out points
ipcMain.handle('trim-clip', async (_event, {
  filePath, specPath, startSec, endSec,
}: { filePath: string; specPath: string; startSec: number; endSec: number }) => {
  const ffmpeg = findFfmpeg();
  const tmpOut = filePath.replace(/\.mp4$/, '_trimmed.mp4');
  const duration = endSec - startSec;
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    execFile(ffmpeg, [
      '-y', '-i', filePath,
      '-ss', String(startSec), '-t', String(duration),
      '-c', 'copy', tmpOut,
    ], { timeout: 60000 }, (err) => {
      if (err) return resolve({ success: false, error: err.message });
      try {
        // renameSync is atomic on POSIX — it replaces filePath in one operation.
        // Do NOT delete first: if rename fails after delete, the clip is permanently lost.
        require('fs').renameSync(tmpOut, filePath);
        // Update spec
        if (existsSync(specPath)) {
          const spec = JSON.parse(readFileSync(specPath, 'utf-8'));
          spec.clipStart = (spec.clipStart ?? 0) + startSec;
          spec.clipEnd = spec.clipStart + duration;
          spec.duration = duration;
          writeFileSync(specPath, JSON.stringify(spec, null, 2));
        }
        resolve({ success: true });
      } catch (e) { resolve({ success: false, error: String(e) }); }
    });
  });
});

// ─── Video Editor: Full Render Pipeline ───────────────────────────
type RenderVideoProps = {
  clipPath: string;
  trimStart: number;
  trimEnd: number;
  outputFormat: '9x16' | '1x1' | '16x9';
  transition?: string;
  caption?: { text: string; fontWeight: string; fontSize: number; color: string; position: 'top' | 'center' | 'bottom'; bgOpacity: number } | null;
  music?: { path: string; volume: number } | null;
  outputDir?: string;
  cuts?: { start: number; end: number }[];
};

ipcMain.handle('render-video', async (_event, payload: RenderVideoProps | { props: RenderVideoProps }) => {
  const props: RenderVideoProps = 'props' in payload ? payload.props : payload;
  const { clipPath, trimStart, trimEnd, outputFormat, caption, music, outputDir, cuts } = props;
  const ffmpeg = findFfmpeg();
  const outDir = outputDir || app.getPath('downloads');
  if (!existsSync(outDir)) { try { mkdirSync(outDir, { recursive: true }); } catch {} }
  const outFile = join(outDir, `6fb_edit_${Date.now()}.mp4`);
  registerApprovedPaths([clipPath, music?.path, outDir, outFile]);
  
  // Calculate duration correctly depending on if cuts exist
  let duration = trimEnd - trimStart;
  if (cuts && cuts.length > 0) {
    duration = cuts.reduce((acc, c) => acc + (c.end - c.start), 0);
  }

  const args: string[] = ['-y', '-i', clipPath];
  const hasMusic = music?.path && existsSync(music.path);
  if (hasMusic) args.push('-i', music.path);

  // If we lack cuts, perform the standard fast-seek trim on input
  if (!cuts || cuts.length === 0) {
    args.push('-ss', String(trimStart), '-t', String(duration));
  }

  // ── Build Filtergraph ──
  const vf: string[] = [];
  if (outputFormat === '9x16') {
    vf.push('scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920');
  } else if (outputFormat === '1x1') {
    vf.push('scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080');
  }

  if (caption?.text) {
    const safeText = caption.text.replace(/'/g, "\\'").replace(/:/g, '\\:');
    const hexColor = caption.color.startsWith('#') ? '0x' + caption.color.slice(1) + 'FF' : caption.color;
    const yExpr = caption.position === 'top' ? 'h*0.08' : caption.position === 'center' ? '(h-text_h)/2' : 'h*0.82';
    const bgAlpha = (caption.bgOpacity / 100).toFixed(2);
    const fontSize = Math.max(24, Math.round(caption.fontSize * 0.7));
    const fontBold = caption.fontWeight !== 'normal' ? ':style=Bold' : '';
    vf.push(`drawtext=text='${safeText}':fontsize=${fontSize}${fontBold}:fontcolor=${hexColor}:x=(w-text_w)/2:y=${yExpr}:box=1:boxcolor=black@${bgAlpha}:boxborderw=12`);
  }

  let filterComplex = '';
  let currentV = '0:v';
  let currentA = '0:a';

  // 1. Text-Based Concat
  if (cuts && cuts.length > 0) {
    cuts.forEach((c, i) => {
      filterComplex += `[0:v]trim=start=${c.start}:end=${c.end},setpts=PTS-STARTPTS[v${i}];`;
      filterComplex += `[0:a]atrim=start=${c.start}:end=${c.end},asetpts=PTS-STARTPTS[a${i}];`;
    });
    filterComplex += `${cuts.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${cuts.length}:v=1:a=1[concatv][concata];`;
    currentV = '[concatv]';
    currentA = '[concata]';
  }

  // 2. Video Filters
  if (vf.length > 0) {
    filterComplex += `${currentV}${vf.join(',')}[finalv];`;
    currentV = '[finalv]';
  }

  // 3. Audio Mixing
  if (hasMusic) {
    const vol = (music!.volume).toFixed(2);
    filterComplex += `[1:a]volume=${vol}[mv];${currentA}[mv]amix=inputs=2:duration=first[finala];`;
    currentA = '[finala]';
  }

  const needsEncode = filterComplex.length > 0 || vf.length > 0 || hasMusic || (cuts && cuts.length > 0);

  if (filterComplex.length > 0) {
    args.push('-filter_complex', filterComplex.replace(/;$/, ''));
    args.push('-map', currentV, '-map', currentA);
  } else if (vf.length > 0) {
    // Fallback if no music/cuts but has visual filters (legacy safety)
    args.push('-vf', vf.join(','));
  }

  if (needsEncode) {
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '128k', '-async', '1');
  } else {
    args.push('-c', 'copy');
  }

  args.push(outFile);

  // ── Spawn ffmpeg and stream progress ──
  return new Promise<{ success: boolean; outputPath?: string; error?: string }>((resolve) => {
    const { spawn } = require('child_process');
    const child = spawn(ffmpeg, args);
    let stderr = '';

    child.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      // Parse time progress
      const m = chunk.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
      if (m && mainWindow) {
        const secs = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
        const percent = Math.min(95, Math.round((secs / Math.max(duration, 1)) * 100));
        mainWindow.webContents.send('progress-update', { percent, label: `Rendering… ${percent}%` });
      }
    });

    child.on('close', (code: number) => {
      if (code === 0) {
        mainWindow?.webContents.send('progress-update', { percent: 100, label: 'Done!' });
        registerApprovedPath(outFile);
        resolve({ success: true, outputPath: outFile });
      } else {
        resolve({ success: false, error: `ffmpeg exited ${code}: ${stderr.slice(-300)}` });
      }
    });

    child.on('error', (err: Error) => resolve({ success: false, error: err.message }));
  });
});


const carouselsDir = () => join(app.getPath('userData'), 'carousels');

ipcMain.handle('save-carousel', async (_event, { title, slides, brandSnapshot }: {
  title: string; slides: object[]; brandSnapshot: object;
}) => {
  const dir = carouselsDir();
  if (!existsSync(dir)) { const { mkdirSync } = await import('fs'); mkdirSync(dir, { recursive: true }); }
  const id = Date.now().toString();
  const filePath = join(dir, `${id}.json`);
  writeFileSync(filePath, JSON.stringify({ id, title, slides, brandSnapshot, createdAt: new Date().toISOString() }, null, 2));
  return { success: true, id };
});

ipcMain.handle('list-carousels', async () => {
  const dir = carouselsDir();
  if (!existsSync(dir)) return { carousels: [] };
  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse();
    const carousels = files.map(f => {
      try {
        const data = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
        return { id: data.id, title: data.title, slideCount: (data.slides || []).length, createdAt: data.createdAt };
      } catch { return null; }
    }).filter(Boolean);
    return { carousels };
  } catch (err) { return { carousels: [], error: String(err) }; }
});

ipcMain.handle('load-carousel', async (_event, id: string) => {
  const filePath = join(carouselsDir(), `${id}.json`);
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    return { success: true, data };
  } catch (err) { return { success: false, error: String(err) }; }
});

ipcMain.handle('delete-carousel', async (_event, id: string) => {
  const filePath = join(carouselsDir(), `${id}.json`);
  try { rmSync(filePath, { force: true }); return { success: true }; }
  catch (err) { return { success: false, error: String(err) }; }
});

ipcMain.handle('rename-carousel', async (_event, { id, title }: { id: string; title: string }) => {
  const filePath = join(carouselsDir(), `${id}.json`);
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    data.title = title;
    require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (err) { return { success: false, error: String(err) }; }
});

// ─── Blog Post Writer ─────────────────────────────────────────────
ipcMain.handle('generate-blog-post', async (_event, {
  transcript,
  brandProfile,
  contentType,
  strategyBrief,
}: { transcript: string; brandProfile: Record<string, unknown>; contentType: string; strategyBrief?: ContentStrategyBrief }) => {
  const apiKey = store.get('apiKeys.claude') as string;
  if (!apiKey) return { success: false, error: 'No Claude API key configured' };

  const toneMap: Record<string, string> = {
    professional: 'confident, clear, and authoritative — backed by expertise',
    hype: 'high-energy, punchy, short paragraphs, conversational and direct',
    storyteller: 'narrative-driven, personal anecdotes, relatable first-person voice',
    'data-driven': 'fact-first, cite specific numbers, analytical and structured',
  };
  const tone = toneMap[brandProfile.tone as string] || toneMap.professional;
  const brandName = brandProfile.brandName as string || 'Our Brand';
  const truncated = transcript.slice(0, 12000);

  // Optionally inject voice profile from Content Planner
  let voiceProfileNote = '';
  try {
    const vpToken = store.get('apiKeys.contentPlanner') as string | undefined;
    if (vpToken) {
      const vpRes = await fetch('https://content.6fbmentorship.com/apps/content/api/me/voice-profile', {
        headers: { 'Authorization': `Bearer ${vpToken}`, Cookie: `auth_token=${vpToken}` },
      });
      if (vpRes.ok) {
        const vpData = await vpRes.json();
        const vp = vpData.voiceProfile;
        if (vp) {
          const phrases = vp.preferredPhrases?.length ? `Use phrases like: ${vp.preferredPhrases.join(', ')}.` : '';
          const avoid = vp.avoidedPhrases?.length ? `Avoid: ${vp.avoidedPhrases.join(', ')}.` : '';
          voiceProfileNote = `\nVoice profile from Content Planner: Tone is ${vp.tone || 'professional'}. ${phrases} ${avoid}`.trim();
        }
      }
    }
  } catch {
    // Voice profile fetch failed — continue without it
  }

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const prompt = `You are a blog content writer for ${brandName}.

Content type: ${contentType || 'general'}
Writing voice: ${tone}
${voiceProfileNote}
${strategyPromptBlock(strategyBrief)}

Here is a video transcript (with timestamps):
---
${truncated}
---

Transform this transcript into a well-structured, SEO-optimized blog post (800-1200 words).

Rules:
- Write a compelling title that would rank on Google
- Write a meta description (under 160 characters) for SEO
- Preserve the promise and viewer outcome from the strategy brief when available
- Create 4-6 sections, each with a clear H2 heading
- Each section should have 2-4 paragraphs of substantive content
- Include "[IMAGE]" markers where a supporting image from the video would add value (place 2-3 total)
- For each [IMAGE] marker, include a TIMESTAMP from the transcript indicating the best frame to use
- End with a strong conclusion and call-to-action
- Match the brand voice throughout

You must output your response as pure JSON matching EXACTLY this schema (no markdown, no extra text).
{
  "title": "Blog post title",
  "metaDescription": "Meta description under 160 chars",
  "sections": [
    {
      "heading": "H2 heading",
      "imageTimestamp": "01:23 or none",
      "body": "2-4 paragraphs of content"
    }
  ]
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b: { type: string }) => b.type === 'text');
    let rawText = (textBlock as { text: string })?.text || '';

    rawText = rawText.trim();
    if (rawText.startsWith('\`\`\`json')) rawText = rawText.substring(7);
    if (rawText.startsWith('\`\`\`')) rawText = rawText.substring(3);
    if (rawText.endsWith('\`\`\`')) rawText = rawText.substring(0, rawText.length - 3);
    rawText = rawText.trim();

    let parsed = { title: 'Untitled Post', metaDescription: '', sections: [] };
    try {
      parsed = JSON.parse(rawText);
    } catch (e: any) {
      return { success: false, error: 'Failed to parse AI output: ' + e.message };
    }

    const sections = (parsed.sections || []).map((s: any, idx: number) => ({
      id: `section-${idx}`,
      heading: s.heading || `Section ${idx + 1}`,
      imageTimestamp: s.imageTimestamp || 'none',
      imagePath: null as string | null,
      body: s.body || ''
    }));

    return { success: true, blogPost: { title: parsed.title, metaDescription: parsed.metaDescription, sections } };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ─── Blog Post Persistence ────────────────────────────────────────
const blogsDir = () => join(app.getPath('userData'), 'blogs');

ipcMain.handle('save-blog-post', async (_event, { title, metaDescription, sections, brandSnapshot }: {
  title: string; metaDescription: string; sections: object[]; brandSnapshot: object;
}) => {
  const dir = blogsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const id = Date.now().toString();
  const filePath = join(dir, `${id}.json`);
  require('fs').writeFileSync(filePath, JSON.stringify({ id, title, metaDescription, sections, brandSnapshot, createdAt: new Date().toISOString() }, null, 2));
  return { success: true, id };
});

ipcMain.handle('list-blog-posts', async () => {
  const dir = blogsDir();
  if (!existsSync(dir)) return { posts: [] };
  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse();
    const posts = files.map(f => {
      try {
        const data = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
        return { id: data.id, title: data.title, sectionCount: (data.sections || []).length, createdAt: data.createdAt };
      } catch { return null; }
    }).filter(Boolean);
    return { posts };
  } catch (err) { return { posts: [], error: String(err) }; }
});

ipcMain.handle('load-blog-post', async (_event, id: string) => {
  const filePath = join(blogsDir(), `${id}.json`);
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    return { success: true, data };
  } catch (err) { return { success: false, error: String(err) }; }
});

ipcMain.handle('delete-blog-post', async (_event, id: string) => {
  const filePath = join(blogsDir(), `${id}.json`);
  try { rmSync(filePath, { force: true }); return { success: true }; }
  catch (err) { return { success: false, error: String(err) }; }
});

// ─── Blog Export ──────────────────────────────────────────────────
ipcMain.handle('export-blog-markdown', async (_event, {
  title, metaDescription, sections,
}: { title: string; metaDescription: string; sections: { heading: string; body: string; imagePath?: string | null }[] }) => {
  try {
    const sanitized = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 60);
    const downloadsPath = app.getPath('downloads');
    const filePath = join(downloadsPath, `${sanitized}.md`);

    let md = `# ${title}\n\n`;
    md += `> ${metaDescription}\n\n---\n\n`;

    for (const section of sections) {
      md += `## ${section.heading}\n\n`;
      if (section.imagePath) {
        md += `![${section.heading}](${section.imagePath})\n\n`;
      }
      md += `${section.body}\n\n`;
    }

    require('fs').writeFileSync(filePath, md, 'utf-8');
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ─── Post Scheduler ───────────────────────────────────────────────
const schedulerPath = () => join(app.getPath('userData'), 'scheduled_posts.json');

const visiblePublishingStatuses = new Set<PublishingStatus>(['scheduled', 'due', 'published', 'failed']);

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizePublishingStatus(value: unknown, posted?: unknown): PublishingStatus {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (raw === 'posted' || raw === 'complete' || raw === 'completed' || posted === true) return 'published';
  if (raw === 'scheduled' || raw === 'due' || raw === 'published' || raw === 'failed' || raw === 'cancelled' || raw === 'studio_queue') {
    return raw;
  }
  return 'scheduled';
}

function normalizePlatform(value: unknown): PublishingPlatform {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (raw === 'tiktok' || raw === 'youtube' || raw === 'linkedin') return raw;
  return 'instagram';
}

function normalizePlatforms(value: unknown, fallback: unknown): PublishingPlatform[] {
  const platforms = asStringArray(value).map(normalizePlatform);
  if (platforms.length > 0) return Array.from(new Set(platforms));
  return [normalizePlatform(fallback)];
}

function normalizeMediaType(value: unknown): PublishingQueuePost['mediaType'] {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (raw === 'carousel' || raw === 'carousel_album') return 'carousel';
  if (raw === 'video') return 'video';
  if (raw === 'image') return 'image';
  if (raw === 'text') return 'text';
  if (raw === 'reel') return 'reel';
  return undefined;
}

function normalizePublishingPost(post: Record<string, unknown>, origin: 'local' | 'remote'): PublishingQueuePost | null {
  const id = asString(post.id);
  if (!id) return null;

  const status = normalizePublishingStatus(post.status, post.posted);
  const publishedAt = asString(post.publishedAt) ?? asString(post.postedAt) ?? null;
  const scheduledAt =
    asString(post.scheduledAt) ??
    asString(post.scheduledFor) ??
    publishedAt ??
    asString(post.updatedAt) ??
    asString(post.createdAt) ??
    new Date().toISOString();
  const mediaUrls = asStringArray(post.mediaUrls);
  const mediaPath = asString(post.mediaPath) ?? mediaUrls[0] ?? '';
  const thumbnailUrl = asString(post.thumbnailUrl) ?? null;
  const thumbnailPath = asString(post.thumbnailPath) ?? thumbnailUrl ?? undefined;
  const platforms = normalizePlatforms(post.platforms, post.platform);

  return {
    id,
    platform: platforms[0],
    platforms,
    caption: asString(post.caption) ?? asString(post.title) ?? '',
    mediaPath,
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : mediaPath ? [mediaPath] : [],
    scheduledAt,
    scheduledFor: asString(post.scheduledFor) ?? scheduledAt,
    status,
    createdAt: asString(post.createdAt) ?? scheduledAt,
    updatedAt: asString(post.updatedAt),
    publishedAt,
    postedAt: asString(post.postedAt) ?? publishedAt,
    thumbnailPath,
    thumbnailUrl,
    mediaType: normalizeMediaType(post.mediaType),
    title: asString(post.title) ?? null,
    errorMessage: asString(post.errorMessage) ?? asString(post.error) ?? null,
    source: asString(post.source),
    origin,
  };
}

function getPostSortTime(post: PublishingQueuePost) {
  return new Date(post.publishedAt || post.postedAt || post.updatedAt || post.scheduledAt).getTime();
}

function sortPublishingPosts(posts: PublishingQueuePost[]) {
  return [...posts].sort((a, b) => {
    const aActive = a.status === 'scheduled' || a.status === 'due';
    const bActive = b.status === 'scheduled' || b.status === 'due';
    if (aActive !== bActive) return aActive ? -1 : 1;
    if (aActive && bActive) return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    return getPostSortTime(b) - getPostSortTime(a);
  });
}

function mergePublishingPosts(remotePosts: PublishingQueuePost[], localPosts: PublishingQueuePost[]) {
  const merged = new Map<string, PublishingQueuePost>();
  for (const post of localPosts) merged.set(post.id, post);
  for (const post of remotePosts) merged.set(post.id, post);
  return sortPublishingPosts([...merged.values()]);
}

function loadLocalPublishingPosts(): PublishingQueuePost[] {
  const p = schedulerPath();
  if (!existsSync(p)) return [];
  try {
    const posts = JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>[];
    const normalized = posts
      .map(post => normalizePublishingPost(post, 'local'))
      .filter((post): post is PublishingQueuePost => !!post && visiblePublishingStatuses.has(post.status));
    for (const post of normalized) {
      registerApprovedPaths([post.mediaPath as string | undefined, post.thumbnailPath as string | undefined]);
    }
    return sortPublishingPosts(normalized);
  } catch { return []; }
}

function saveSchedulerData(posts: PublishingQueuePost[]) {
  writeFileSync(schedulerPath(), JSON.stringify(sortPublishingPosts(posts), null, 2));
}

async function fetchRemotePublishingQueue(): Promise<PublishingQueueResponse | null> {
  const token = store.get('contentManagerToken') as string | undefined;
  if (!token) return null;

  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(`${CONTENT_MANAGER}/api/scheduled-posts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Client': '6fb-content-studio',
      },
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      return {
        success: false,
        posts: [],
        source: 'remote',
        fetchedAt,
        error: asString(data.error) ?? `Publishing queue fetch failed (${res.status})`,
      };
    }

    const rawPosts = Array.isArray(data.posts)
      ? data.posts
      : Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.queue)
      ? data.queue
      : [];

    const posts = rawPosts
      .map(item => normalizePublishingPost(item as Record<string, unknown>, 'remote'))
      .filter((post): post is PublishingQueuePost => !!post && visiblePublishingStatuses.has(post.status));

    return {
      success: true,
      posts: sortPublishingPosts(posts),
      source: 'remote',
      fetchedAt,
    };
  } catch (err) {
    return {
      success: false,
      posts: [],
      source: 'remote',
      fetchedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function getPublishingQueueData(): Promise<PublishingQueueResponse> {
  const localPosts = loadLocalPublishingPosts();
  const remote = await fetchRemotePublishingQueue();
  const fetchedAt = new Date().toISOString();

  if (!remote) {
    return { success: true, posts: localPosts, source: 'local', fetchedAt };
  }

  if (remote.success) {
    return {
      ...remote,
      posts: mergePublishingPosts(remote.posts, localPosts),
    };
  }

  return {
    success: false,
    posts: localPosts,
    source: 'local',
    fetchedAt,
    error: remote.error,
  };
}

ipcMain.handle('get-publishing-queue', async () => getPublishingQueueData());

ipcMain.handle('get-scheduled-posts', async () => {
  const result = await getPublishingQueueData();
  return result.posts;
});

ipcMain.handle('save-scheduled-post', async (_event, post: Record<string, unknown>) => {
  const normalized = normalizePublishingPost(post, 'local');
  if (!normalized) return { success: false, error: 'Invalid post' };
  const posts = loadLocalPublishingPosts();
  const idx = posts.findIndex(p => p.id === normalized.id);
  if (idx >= 0) posts[idx] = normalized; else posts.push(normalized);
  registerApprovedPaths([normalized.mediaPath, normalized.thumbnailPath]);
  saveSchedulerData(posts);
  return { success: true, post: normalized };
});

ipcMain.handle('delete-scheduled-post', async (_event, id: string) => {
  saveSchedulerData(loadLocalPublishingPosts().filter(p => p.id !== id));
  return { success: true };
});

async function markLocalPostAsPublished(id: string) {
  const posts = loadLocalPublishingPosts();
  const idx = posts.findIndex(p => p.id === id);
  if (idx < 0) return { success: false, error: 'Post not found in local publishing queue' };
  const publishedAt = new Date().toISOString();
  posts[idx] = { ...posts[idx], status: 'published', publishedAt, postedAt: publishedAt };
  saveSchedulerData(posts);
  return { success: true };
}

ipcMain.handle('mark-post-as-published', async (_event, id: string) => markLocalPostAsPublished(id));

ipcMain.handle('mark-post-as-posted', async (_event, id: string) => {
  return markLocalPostAsPublished(id);
});

ipcMain.handle('post-to-social', async (_event, { platform }: { platform: string; content: Record<string, unknown> }) => {
  // Browser-open fallback — opens the platform's upload page.
  // For direct API posting use post-reel-to-instagram / post-carousel-to-instagram.
  const urls: Record<string, string> = {
    instagram: 'https://www.instagram.com/',
    tiktok: 'https://www.tiktok.com/upload',
    youtube: 'https://studio.youtube.com/',
    linkedin: 'https://www.linkedin.com/feed/',
  };
  const opened = !!(urls[platform] && shell.openExternal(urls[platform]));
  return { success: true, opened, note: 'Opened platform in browser. No API post was made.' };
});

// Background daemon — checks every 60s, marks posts 'due' when their time arrives
function startSchedulerDaemon() {
  setInterval(() => {
    if (!mainWindow) return;
    const posts = loadLocalPublishingPosts();
    const now = Date.now();
    let changed = false;
    for (const post of posts) {
      if (post.status === 'scheduled' && new Date(post.scheduledAt as string).getTime() <= now) {
        post.status = 'due';
        changed = true;
      }
    }
    if (changed) {
      saveSchedulerData(posts);
      mainWindow.webContents.send('post-due');
    }
  }, 60_000);
}

// ─── Auto-Updater ─────────────────────────────────────────────────────
function buildAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Check for Updates…',
          click: async () => {
            try {
              const result = await autoUpdater.checkForUpdates();
              if (!result?.updateInfo) {
                dialog.showMessageBox({ type: 'info', message: 'You\'re up to date!', detail: `Version ${app.getVersion()} is the latest.` });
              }
            } catch {
              dialog.showMessageBox({ type: 'info', message: 'You\'re up to date!', detail: `Version ${app.getVersion()} is the latest.` });
            }
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function initAutoUpdater() {

  if (process.env.NODE_ENV === 'development') return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes ?? null,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err.message);
  });

  // Check on launch, then every 4 hours
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
}

ipcMain.handle('check-for-update', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo ?? null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

// ─── 6FB Account (Content Manager integration) ───────────────────────
const CONTENT_MANAGER = 'https://content.6fbmentorship.com/apps/content';

ipcMain.handle('login-6fb', async (_event, { email, password }: { email: string; password: string }) => {
  try {
    const res = await fetch(`${CONTENT_MANAGER}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client': '6fb-content-studio' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, error: (data.error as string) || 'Login failed' };
    const setCookie = res.headers.get('set-cookie') ?? '';
    const token = setCookie.match(/auth_token=([^;]+)/)?.[1];
    if (token) {
      store.set('contentManagerToken', token);
      store.set('apiKeys.contentPlanner', token);
    }
    store.set('contentManagerEmail', email);
    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('sync-instagram-credentials', async () => {
  const token = store.get('contentManagerToken') as string | undefined;
  if (!token) return { success: false, error: 'Not signed in to Content Manager' };
  try {
    const res = await fetch(`${CONTENT_MANAGER}/api/me/credentials`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Client': '6fb-content-studio' },
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { success: false, error: (data.error as string) || 'Request failed' };
    if (!data.connected) return { success: false, error: data.message as string };
    if (data.expired) return { success: false, error: data.message as string };
    store.set('igAccessToken', data.accessToken);
    store.set('igUserId', data.instagramAccountId);
    store.set('igUsername', data.username);
    store.set('igTokenExpiresAt', data.tokenExpiresAt ?? null);
    return { success: true, username: data.username, tokenExpiresAt: data.tokenExpiresAt };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('get-6fb-account', async () => ({
  email: (store.get('contentManagerEmail') as string | null) ?? null,
  igUsername: (store.get('igUsername') as string | null) ?? null,
  igTokenExpiresAt: (store.get('igTokenExpiresAt') as string | null) ?? null,
  connected: !!store.get('contentManagerToken'),
}));

ipcMain.handle('disconnect-6fb', async () => {
  store.delete('contentManagerToken');
  store.delete('contentManagerEmail');
  store.delete('apiKeys.contentPlanner');
  store.delete('igAccessToken');
  store.delete('igUserId');
  store.delete('igUsername');
  store.delete('igTokenExpiresAt');
  return { success: true };
});

// ─── Instagram Direct Posting ─────────────────────────────────────────
const IG_GRAPH = 'https://graph.facebook.com/v18.0';

async function pollIgContainer(containerId: string, token: string, maxWaitMs = 120000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000));
    const r = await fetch(`${IG_GRAPH}/${containerId}?fields=status_code,status&access_token=${token}`);
    const d = await r.json() as Record<string, string>;
    if (d.status_code === 'FINISHED') return;
    if (d.status_code === 'ERROR' || d.status_code === 'EXPIRED') {
      throw new Error(`Instagram processing failed: ${d.status || d.status_code}`);
    }
  }
  throw new Error('Timed out waiting for Instagram to process media');
}

// Post a video clip as an Instagram Reel
ipcMain.handle('post-reel-to-instagram', async (_event, {
  filePath, caption,
}: { filePath: string; caption: string }) => {
  const token = store.get('igAccessToken') as string | undefined;
  const igUserId = store.get('igUserId') as string | undefined;
  if (!token || !igUserId) return { success: false, error: 'Instagram not connected. Go to Settings → 6FB Account → Sync Instagram.' };

  try {
    // 1. Init resumable upload container
    const initRes = await fetch(`${IG_GRAPH}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'REELS', upload_type: 'resumable', caption, access_token: token }),
    });
    const initData = await initRes.json() as Record<string, string>;
    if (!initData.id || !initData.uri) {
      return { success: false, error: initData.error?.toString() || 'Failed to start upload' };
    }

    // 2. Upload binary
    const videoBuffer = readFileSync(filePath);
    const uploadRes = await fetch(initData.uri, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${token}`,
        'Content-Type': 'video/mp4',
        'Content-Length': String(videoBuffer.byteLength),
        'offset': '0',
        'file_size': String(videoBuffer.byteLength),
      },
      body: videoBuffer,
    });
    if (!uploadRes.ok) {
      const e = await uploadRes.text();
      return { success: false, error: `Upload failed: ${e}` };
    }

    // 3. Poll until FINISHED
    await pollIgContainer(initData.id, token);

    // 4. Publish
    const pubRes = await fetch(`${IG_GRAPH}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: initData.id, access_token: token }),
    });
    const pubData = await pubRes.json() as Record<string, string>;
    if (!pubData.id) return { success: false, error: pubData.error?.toString() || 'Publish failed' };

    return { success: true, mediaId: pubData.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// Post an image carousel to Instagram
ipcMain.handle('post-carousel-to-instagram', async (_event, {
  imagePaths, caption,
}: { imagePaths: string[]; caption: string }) => {
  const token = store.get('igAccessToken') as string | undefined;
  const igUserId = store.get('igUserId') as string | undefined;
  if (!token || !igUserId) return { success: false, error: 'Instagram not connected. Go to Settings → 6FB Account → Sync Instagram.' };
  if (imagePaths.length < 2 || imagePaths.length > 10) {
    return { success: false, error: 'Carousel requires 2–10 images' };
  }

  try {
    // 1. Upload each image as a carousel item
    const childIds: string[] = [];
    for (const imgPath of imagePaths) {
      const imgBuffer = readFileSync(imgPath);
      const form = new FormData();
      form.append('source', new Blob([imgBuffer], { type: 'image/png' }), 'slide.png');
      form.append('is_carousel_item', 'true');
      form.append('access_token', token);

      const r = await fetch(`${IG_GRAPH}/${igUserId}/media`, { method: 'POST', body: form });
      const d = await r.json() as Record<string, string>;
      if (!d.id) throw new Error(`Image upload failed: ${d.error?.toString() || JSON.stringify(d)}`);
      childIds.push(d.id);
    }

    // 2. Create carousel container
    const carRes = await fetch(`${IG_GRAPH}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption,
        access_token: token,
      }),
    });
    const carData = await carRes.json() as Record<string, string>;
    if (!carData.id) return { success: false, error: carData.error?.toString() || 'Carousel creation failed' };

    // 3. Poll until FINISHED
    await pollIgContainer(carData.id, token);

    // 4. Publish
    const pubRes = await fetch(`${IG_GRAPH}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: carData.id, access_token: token }),
    });
    const pubData = await pubRes.json() as Record<string, string>;
    if (!pubData.id) return { success: false, error: pubData.error?.toString() || 'Publish failed' };

    return { success: true, mediaId: pubData.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ─── Analytics ────────────────────────────────────────────────────────
ipcMain.handle('get-analytics', async () => {
  const token = store.get('igAccessToken') as string | undefined;
  const igUserId = store.get('igUserId') as string | undefined;

  // ── Local studio stats ──
  const clipsDir = join(app.getPath('userData'), 'clips');
  let totalClips = 0;
  let totalRuns = 0;
  let postedClips = 0;
  try {
    const runs = readdirSync(clipsDir, { withFileTypes: true }).filter(d => d.isDirectory());
    totalRuns = runs.length;
    for (const run of runs) {
      const runDir = join(clipsDir, run.name);
      const specs = readdirSync(runDir).filter(f => f.endsWith('_spec.json'));
      totalClips += specs.length;
      for (const spec of specs) {
        try {
          const s = JSON.parse(readFileSync(join(runDir, spec), 'utf-8'));
          if (s.status === 'composed') postedClips++;
        } catch {}
      }
    }
  } catch {}

  const carouselsDir = join(app.getPath('userData'), 'carousels');
  let totalCarousels = 0;
  try {
    totalCarousels = readdirSync(carouselsDir).filter(f => f.endsWith('.json')).length;
  } catch {}

  const blogsDir = join(app.getPath('userData'), 'blogs');
  let totalBlogs = 0;
  try {
    totalBlogs = readdirSync(blogsDir).filter(f => f.endsWith('.json')).length;
  } catch {}

  let publishingQueue: PublishingQueuePost[] = [];
  let scheduledPosts = 0;
  let postedScheduled = 0;
  let failedScheduled = 0;
  try {
    const queue = await getPublishingQueueData();
    publishingQueue = queue.posts;
    scheduledPosts = publishingQueue.filter(p => p.status === 'scheduled' || p.status === 'due').length;
    postedScheduled = publishingQueue.filter(p => p.status === 'published').length;
    failedScheduled = publishingQueue.filter(p => p.status === 'failed').length;
  } catch {}

  const localStats = {
    totalRuns,
    totalClips,
    postedClips,
    totalCarousels,
    totalBlogs,
    totalScheduled: scheduledPosts,
    totalQueue: publishingQueue.length,
    postedScheduled,
    failedScheduled,
  };

  // ── Instagram account + recent media ──
  if (!token || !igUserId) {
    return { success: true, localStats, igConnected: false, account: null, media: [] };
  }

  try {
    const [accountRes, mediaRes] = await Promise.all([
      fetch(`${IG_GRAPH}/${igUserId}?fields=username,followers_count,media_count,profile_picture_url&access_token=${token}`),
      fetch(`${IG_GRAPH}/${igUserId}/media?fields=id,media_type,caption,timestamp,like_count,comments_count,thumbnail_url,media_url&limit=12&access_token=${token}`),
    ]);

    const account = await accountRes.json() as Record<string, unknown>;
    const mediaData = await mediaRes.json() as { data?: unknown[] };

    // Fetch insights for each media item (reach + plays for reels)
    const mediaItems = mediaData.data ?? [];
    const enriched = await Promise.all(
      (mediaItems as any[]).map(async (item: any) => {
        try {
          const insightMetrics = item.media_type === 'VIDEO' ? 'reach,plays,impressions' : 'reach,impressions';
          const ir = await fetch(`${IG_GRAPH}/${item.id}/insights?metric=${insightMetrics}&period=lifetime&access_token=${token}`);
          const id = await ir.json() as { data?: any[] };
          const insights: Record<string, number> = {};
          for (const m of (id.data ?? [])) insights[m.name] = m.values?.[0]?.value ?? 0;
          return { ...item, insights };
        } catch { return item; }
      })
    );

    return { success: true, localStats, igConnected: true, account, media: enriched };
  } catch (err) {
    return { success: true, localStats, igConnected: true, account: null, media: [], error: String(err) };
  }
});

// ── Video Planner ─────────────────────────────────────────────────────────

ipcMain.handle('generate-video-plan', async (_event, { prompt }: { prompt: string }) => {
  const apiKey = store.get('apiKeys.claude') as string;
  if (!apiKey) return { success: false, error: 'No Claude API key configured. Add it in Settings.' };
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    // Strip markdown fences if present
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const plan = JSON.parse(json);
    return { success: true, plan };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('save-video-plan', async (_event, plan: object) => {
  try {
    const plansDir = join(app.getPath('userData'), 'video-plans');
    mkdirSync(plansDir, { recursive: true });
    const id = (plan as any).id ?? Date.now().toString();
    writeFileSync(join(plansDir, `${id}.json`), JSON.stringify(plan, null, 2));
    return { success: true, id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('list-video-plans', async () => {
  try {
    const plansDir = join(app.getPath('userData'), 'video-plans');
    if (!existsSync(plansDir)) return { plans: [] };
    const files = readdirSync(plansDir).filter(f => f.endsWith('.json'));
    const plans = files.map(f => {
      try { return JSON.parse(readFileSync(join(plansDir, f), 'utf-8')); }
      catch { return null; }
    }).filter(Boolean).sort((a: any, b: any) => b.createdAt?.localeCompare(a.createdAt ?? '') ?? 0);
    return { plans };
  } catch (err) {
    return { plans: [], error: String(err) };
  }
});
