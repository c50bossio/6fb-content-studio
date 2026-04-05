import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Menu } from 'electron';
import { join } from 'path';
import { existsSync, readdirSync, readFileSync, mkdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { runClipExtractor, checkPythonDeps } from './python-bridge';
import { autoUpdater } from 'electron-updater';

// electron-store: handle ESM default export
import Store from 'electron-store';
const ElectronStore = (Store as unknown as { default: typeof Store }).default || Store;

const store = new ElectronStore();
let mainWindow: BrowserWindow | null = null;

// Disable GPU hardware acceleration — prevents green-screen video rendering in Electron's Chromium layer
app.disableHardwareAcceleration();


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

// Register custom protocol for serving local files (thumbnails, etc.)
// Bypasses Electron's file:// restriction when app is loaded from localhost
protocol.registerSchemesAsPrivileged([{
  scheme: 'localfile',
  privileges: { secure: true, supportFetchAPI: true, bypassCSP: true },
}]);

app.whenReady().then(() => {
  // Handle localfile:// protocol with proper byte-range support for video streaming.
  // net.fetch() ignores Range headers so video elements show 0:00 and never load.
  protocol.handle('localfile', (request) => {
    const filePath = decodeURIComponent(request.url.replace('localfile://', ''));

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
        const end = (endStr && endStr.length > 0) ? parseInt(endStr, 10) : totalSize - 1;
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
  return { cancelled: false, dirPath: result.filePaths[0] };
});

// ─── Clip Extractor (Python Bridge) ───────────────────────────────

ipcMain.handle('extract-clips', async (_event, { videoPath, options }: {
  videoPath: string;
  options: { outputFormat?: string; contentType?: string; numClips?: number; startSec?: number; endSec?: number; planContext?: { topic: string; dropZones: { label: string; timestamp: string; endTimestamp: string }[] } };
}) => {
  const outputDir = join(app.getPath('userData'), 'clips', Date.now().toString());
  const bp = (store.get('brandProfile') as Record<string, unknown>) || DEFAULT_BRAND;
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
    },
    mainWindow,
  );
  return result;
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
  const deps = await checkPythonDeps();
  return {
    deps,
    paths: {
      userData: app.getPath('userData'),
      ixClipExtractor: join(
        process.env.HOME || '~',
        'clawd/projects/ix-social-media-manager/tools/clip_extractor'
      ),
    },
    apiKeys: {
      claude: !!store.get('apiKeys.claude'),
      openai: !!store.get('apiKeys.openai'),
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


// Carousel Generation (uses student's Claude API key)
ipcMain.handle('generate-carousel', async (_event, { topic, type, keyPoints, brandProfile }: {
  topic: string;
  type: string;
  keyPoints: string[];
  brandProfile?: Record<string, unknown>;
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

Key Points:
${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Create a 5-slide Instagram carousel (1080x1350 each).

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

ipcMain.handle('save-brand-profile', async (_event, profile: Record<string, unknown>) => {
  store.set('brandProfile', profile);
  return { success: true };
});

ipcMain.handle('get-brand-profile', async () => {
  const saved = store.get('brandProfile') as Record<string, unknown> | undefined;
  return saved ?? DEFAULT_BRAND;
});

ipcMain.handle('select-logo', async () => {
  if (!mainWindow) return { cancelled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Logo',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return { cancelled: true };
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
}: { transcript: string; brandProfile: Record<string, unknown>; contentType: string }) => {
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

Here is the video transcript (with timestamps):
---
${truncated}
---

Extract the 5 most compelling, shareable insights from this transcript and structure them as an Instagram carousel.

Slide 1 is always the HOOK — it must stop the scroll. Make it provocative or surprising.
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
  const candidates = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'];
  for (const p of candidates) { if (existsSync(p)) return p; }
  return 'ffmpeg';
}

// Per-clip async thumbnail — never blocks scan
ipcMain.handle('generate-thumbnail', (_event, { videoPath, thumbPath }: { videoPath: string; thumbPath: string }) => {
  const ffmpeg = findFfmpeg();
  return new Promise<{ success: boolean; thumbPath?: string }>((resolve) => {
    // -frames:v 1 -update 1 required for newer ffmpeg to write a single JPEG without pattern
    execFile(ffmpeg, ['-y', '-ss', '1', '-i', videoPath, '-frames:v', '1', '-q:v', '3', '-vf', 'scale=540:960', '-update', '1', thumbPath],
      { timeout: 12000 }, (err) => {
        if (!err && existsSync(thumbPath)) resolve({ success: true, thumbPath });
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
      try {
        const srt = readdirSync(runPath).find(f => f.endsWith('.srt'));
        if (srt) sourceVideoName = srt.replace(/\.srt$/, '');
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
            clipPath, specPath,
          });
        }
      } catch {}
      return { runId, timestamp: Number(runId), sourceVideo: sourceVideoName, runPath, clips };
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
        // Atomically replace original with trimmed version
        rmSync(filePath, { force: true });
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
ipcMain.handle('render-video', async (_event, props: {
  clipPath: string;
  trimStart: number;
  trimEnd: number;
  outputFormat: '9x16' | '1x1' | '16x9';
  transition?: string;
  caption?: { text: string; fontWeight: string; fontSize: number; color: string; position: 'top' | 'center' | 'bottom'; bgOpacity: number } | null;
  music?: { path: string; volume: number } | null;
  outputDir?: string;
  cuts?: { start: number; end: number }[];
}) => {
  const { clipPath, trimStart, trimEnd, outputFormat, caption, music, outputDir, cuts } = props;
  const ffmpeg = findFfmpeg();
  const outDir = outputDir || app.getPath('downloads');
  if (!existsSync(outDir)) { try { mkdirSync(outDir, { recursive: true }); } catch {} }
  const outFile = join(outDir, `6fb_edit_${Date.now()}.mp4`);
  
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
}: { transcript: string; brandProfile: Record<string, unknown>; contentType: string }) => {
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

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const prompt = `You are a blog content writer for ${brandName}.

Content type: ${contentType || 'general'}
Writing voice: ${tone}

Here is a video transcript (with timestamps):
---
${truncated}
---

Transform this transcript into a well-structured, SEO-optimized blog post (800-1200 words).

Rules:
- Write a compelling title that would rank on Google
- Write a meta description (under 160 characters) for SEO
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

function loadScheduledPosts(): Record<string, unknown>[] {
  const p = schedulerPath();
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return []; }
}

function saveSchedulerData(posts: Record<string, unknown>[]) {
  writeFileSync(schedulerPath(), JSON.stringify(posts, null, 2));
}

ipcMain.handle('get-scheduled-posts', async () => loadScheduledPosts());

ipcMain.handle('save-scheduled-post', async (_event, post: Record<string, unknown>) => {
  const posts = loadScheduledPosts();
  const idx = posts.findIndex(p => p.id === post.id);
  if (idx >= 0) posts[idx] = post; else posts.push(post);
  saveSchedulerData(posts);
  return { success: true };
});

ipcMain.handle('delete-scheduled-post', async (_event, id: string) => {
  saveSchedulerData(loadScheduledPosts().filter(p => p.id !== id));
  return { success: true };
});

ipcMain.handle('mark-post-as-posted', async (_event, id: string) => {
  const posts = loadScheduledPosts();
  const idx = posts.findIndex(p => p.id === id);
  if (idx >= 0) posts[idx] = { ...posts[idx], status: 'posted', postedAt: new Date().toISOString() };
  saveSchedulerData(posts);
  return { success: true };
});

ipcMain.handle('post-to-social', async (_event, { platform }: { platform: string; content: Record<string, unknown> }) => {
  // Phase 1: open platform in browser (API integration in Phase 2)
  const urls: Record<string, string> = {
    instagram: 'https://www.instagram.com/',
    tiktok: 'https://www.tiktok.com/upload',
    youtube: 'https://studio.youtube.com/',
  };
  if (urls[platform]) shell.openExternal(urls[platform]);
  return { success: true };
});

// Background daemon — checks every 60s, marks posts 'due' when their time arrives
function startSchedulerDaemon() {
  setInterval(() => {
    if (!mainWindow) return;
    const posts = loadScheduledPosts();
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
    const token = data.token as string | undefined;
    if (token) store.set('contentManagerToken', token);
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

  const schedulerPath = join(app.getPath('userData'), 'scheduler.json');
  let scheduledPosts: unknown[] = [];
  let postedScheduled = 0;
  try {
    const data = JSON.parse(readFileSync(schedulerPath, 'utf-8')) as unknown[];
    scheduledPosts = data;
    postedScheduled = data.filter((p: any) => p.posted).length;
  } catch {}

  const localStats = { totalRuns, totalClips, postedClips, totalCarousels, totalBlogs, totalScheduled: scheduledPosts.length, postedScheduled };

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

