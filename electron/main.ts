import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Notification } from 'electron';
import { join } from 'path';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { runClipExtractor, checkPythonDeps } from './python-bridge';

// electron-store: handle ESM default export
import Store from 'electron-store';
const ElectronStore = (Store as unknown as { default: typeof Store }).default || Store;

const store = new ElectronStore();
let mainWindow: BrowserWindow | null = null;

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
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
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
  protocol.handle('localfile', (request) => {
    // localfile:///absolute/path/to/file.jpg
    const filePath = decodeURIComponent(request.url.replace('localfile://', ''));
    return net.fetch(pathToFileURL(filePath).toString());
  });
  createWindow();
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
    setupComplete: store.get('setupComplete', false),
  };
});

ipcMain.handle('complete-setup', async () => {
  store.set('setupComplete', true);
  return { success: true };
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
  options: { outputFormat?: string; startSec?: number; endSec?: number; contentType?: string };
}) => {
  const outputDir = join(app.getPath('userData'), 'clips', Date.now().toString());
  const bp = (store.get('brandProfile') as Record<string, unknown>) || DEFAULT_BRAND;
  const result = await runClipExtractor(
    videoPath,
    outputDir,
    {
      outputFormat: (options.outputFormat as '9x16' | '1x1' | 'split' | 'auto') || 'auto',
      startSec: options.startSec,
      endSec: options.endSec,
      brandName: (bp.brandName as string) || '6fbarber',
      logoPath: (bp.logoPath as string) || null,
      contentType: (options.contentType as string) || 'auto',
    },
    mainWindow,
  );
  return result;
});

// ─── Native Notifications ─────────────────────────────────────────
ipcMain.handle('notify-clip-complete', async (_event, { clipCount, title }: { clipCount: number; title?: string }) => {
  if (Notification.isSupported()) {
    const notif = new Notification({
      title: '🎬 Your clips are ready!',
      body: title
        ? `"${title}" — ${clipCount} clip${clipCount !== 1 ? 's' : ''} extracted successfully`
        : `${clipCount} clip${clipCount !== 1 ? 's' : ''} extracted successfully`,
      silent: false,
    });
    notif.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
    notif.show();
  }
  return { success: true };
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

// Video Planner Generation
ipcMain.handle('generate-video-plan', async (_event, { topic, type, duration, perspective, useRag, targetLocation }: {
  topic: string;
  type: string;
  duration: string;
  perspective: string;
  useRag?: boolean;
  targetLocation?: string;
}) => {
  const apiKey = store.get('apiKeys.claude') as string;
  if (!apiKey) return { success: false, error: 'No Claude API key configured' };

  try {
    // 1. Initialize Knowledge Base Folder
    const knowledgeDir = join(app.getPath('userData'), '6FB_Knowledge_Base');
    if (!existsSync(knowledgeDir)) {
      mkdirSync(knowledgeDir, { recursive: true });
    }

    // 2. Build RAG Context if requested
    let ragContext = '';
    if (useRag) {
      try {
        // Local File Parsing
        const files = readdirSync(knowledgeDir);
        for (const file of files) {
          if (file.endsWith('.txt') || file.endsWith('.md') || file.endsWith('.json')) {
            const content = readFileSync(join(knowledgeDir, file), 'utf-8');
            ragContext += `\n--- Internal Document: ${file} ---\n${content}\n`;
          }
        }

        // Live Market Intel API Fetching
        if (targetLocation && targetLocation.trim() !== '') {
          try {
            const url = `http://localhost:3000/api/market-intel?city=${encodeURIComponent(targetLocation.trim())}`;
            const apiRes = await fetch(url);
            if (apiRes.ok) {
              const intelData = await apiRes.json();
              if (intelData.success && intelData.data) {
                ragContext += `\n--- Live Market Data for ${targetLocation} ---\n${JSON.stringify(intelData.data, null, 2)}\n`;
              }
            }
          } catch (apiErr) {
            console.error('[RAG] Failed to fetch live market data from localhost:3000', apiErr);
          }
        }
      } catch (err) {
        console.error('[RAG] Error assembling knowledge context:', err);
      }
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    let prompt = `You are an expert viral content strategist and YouTube architect for 6 Figure Barbers (6FB Mentorship).
Your primary audience is Barbershop Owners, Barber Entrepreneurs, and high-level barbers looking to scale their business.

Task: Create a highly structured "Shoot Blueprint" for a long-form video. The shoot blueprint will be printed by the creator and followed during recording.
Topic: ${topic}
Format: ${type}
Target Duration: ${duration}
Creator Perspective: ${perspective}

CRITICAL INSTRUCTION: Analyze the core topic and precisely engineer the script to align with the provided "Creator Perspective" (${perspective}). For example, if the perspective is "Shop Owner", speak from the vantage point of running a business and hiring. If "Solo Barber", speak from the vantage point of being behind the chair building clientele. Do NOT generalize.

Your goal is to script the video structure in a way that builds in "AI Drop Zones". An AI Drop Zone is a specific 5-10 second segment where the creator delivers a punchy, perfectly-contained hook or payoff. This allows our autonomous downstream AI to extract viral 9:16 shorts perfectly.

You must output your response as pure JSON matching EXACTLY this schema (no markdown, no extra text):
{
  "title": "A catchy title for the blueprint",
  "sections": [
    {
      "type": "hook" | "body" | "payoff",
      "timerange": "e.g., 0:00 - 0:05",
      "instruction": "What should the creator do/say here?",
      "scriptIdea": "An exact script line they can read to hit this beat perfectly"
    }
  ]
}

Make sure to include at least 1 "hook" at the beginning, 1 "payoff" near the end, and potentially another "hook" in the middle as a pattern interrupt. There should be around 5 to 8 sections total depending on duration. Keep scriptIdeas punchy.`;

    if (useRag && ragContext.trim().length > 0) {
      prompt += `\n\n<6FB_PROPRIETARY_KNOWLEDGE>\n${ragContext}\n</6FB_PROPRIETARY_KNOWLEDGE>\n\nCRITICAL DIRECTIVE: You MUST use the specific statistics, pricing ratios, and philosophies provided in the 6FB_PROPRIETARY_KNOWLEDGE block above when writing the "scriptIdea" instructions. Do NOT hallucinate generic prices or advice if real data is provided!`;
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: "You are a senior YouTube content strategist who replies only in valid JSON.",
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const text = (response.content.find((b: any) => b.type === 'text') as any)?.text || '';
    
    // Parse JSON
    let parsedData = null;
    const jsonMatch = text.match(/(\{.*\})/s);
    if (jsonMatch) {
      try { parsedData = JSON.parse(jsonMatch[1]); } catch (_) {}
    } 
    if (!parsedData) {
      let cleaned = text.trim();
      if (cleaned.startsWith('\`\`\`json')) cleaned = cleaned.replace(/^\`\`\`json/, '');
      if (cleaned.endsWith('\`\`\`')) cleaned = cleaned.replace(/\`\`\`$/, '');
      try { parsedData = JSON.parse(cleaned); } catch (_) {}
    }

    if (!parsedData) {
      return { success: false, error: 'Failed to parse AI structure' };
    }

    return { success: true, data: parsedData };
  } catch (error: any) {
    console.error('Shoot Plan Generation Error:', error);
    return { success: false, error: error.message || 'Generation failed' };
  }
});

// Carousel Generation (uses student's Claude API key)
ipcMain.handle('generate-carousel', async (_event, { topic, type, keyPoints, brandProfile, playbookBrief, playbookPostId, playbookTopicId }: {
  topic: string;
  type: string;
  keyPoints: string[];
  brandProfile?: Record<string, unknown>;
  playbookBrief?: {
    topicTitle: string;
    pillar: string;
    hookIdea: string;
    visualSuggestion: string;
    shotList: string[];
  };
  playbookPostId?: string;
  playbookTopicId?: string;
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

    const playbookContext = playbookBrief
      ? `The user is creating this content to execute their weekly content strategy. Today's planned topic: ${playbookBrief.topicTitle} (${playbookBrief.pillar}). Hook angle: ${playbookBrief.hookIdea}. Visual direction: ${playbookBrief.visualSuggestion}. Shot list beats: ${playbookBrief.shotList.join('; ')}. Anchor every slide to this brief — do not drift into an unrelated angle.\n\n`
      : '';

    const prompt = `${playbookContext}You are a professional carousel designer for ${brandName}.

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

    return { success: true, slides, playbookPostId, playbookTopicId };
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

// ─── Video Editor IPC ─────────────────────────────────────────────
ipcMain.handle('load-words-json', (_event, wordsJsonPath: string) => {
  try {
    if (!existsSync(wordsJsonPath)) return { success: false, error: 'Words JSON file not found' };
    const data = JSON.parse(readFileSync(wordsJsonPath, 'utf-8'));
    return { success: true, data };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('export-edited-spec', (_event, outputPath: string, spec: object) => {
  try {
    writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('extract-carousel', async (_event, {
  transcript,
  brandProfile,
  contentType,
  playbookBrief,
  playbookPostId,
  playbookTopicId,
}: {
  transcript: string;
  brandProfile: Record<string, unknown>;
  contentType: string;
  playbookBrief?: {
    topicTitle: string;
    pillar: string;
    hookIdea: string;
    visualSuggestion: string;
    shotList: string[];
  };
  playbookPostId?: string;
  playbookTopicId?: string;
}) => {
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

  const playbookContext = playbookBrief
    ? `\n\nThe user is creating this content to execute their weekly content strategy. Today's planned topic: ${playbookBrief.topicTitle} (${playbookBrief.pillar}). Hook angle: ${playbookBrief.hookIdea}. Visual direction: ${playbookBrief.visualSuggestion}. Shot list beats: ${(playbookBrief.shotList || []).join('; ')}. Anchor every slide to this brief — do not drift into an unrelated angle.\n`
    : '';

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const prompt = `You are a social media content strategist for ${brandName}.
${playbookContext}
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

    return { success: true, slides, playbookPostId, playbookTopicId };
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
import { rmSync } from 'fs';

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
  // Scan both the IX pipeline output dir AND the local userData clips dir
  const ixOutputDir = join(process.env.HOME || '~', 'clawd/projects/ix-social-media-manager/output/clips');
  const localClipsDir = join(app.getPath('userData'), 'clips');
  
  const scanDir = (clipsRoot: string): object[] => {
    if (!existsSync(clipsRoot)) return [];
    try {
      const runDirs = readdirSync(clipsRoot, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name)
        .sort((a, b) => String(b).localeCompare(String(a)));

      return runDirs.map(runId => {
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
            const reframedSplit = join(clipPath, 'reframed-split.mp4');
            const reframed9x16 = join(clipPath, 'reframed-9x16.mp4');
            const raw = join(clipPath, 'raw.mp4');
            const filePath = existsSync(rendered) ? rendered
              : existsSync(reframedSplit) ? reframedSplit
              : existsSync(reframed9x16) ? reframed9x16
              : existsSync(raw) ? raw : null;
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
        return { runId: `${clipsRoot}::${runId}`, timestamp: Number(runId) || Date.now(), sourceVideo: sourceVideoName, runPath, clips };
      }).filter((r: any) => r.clips.length > 0);
    } catch { return []; }
  };

  const ixRuns = scanDir(ixOutputDir);
  const localRuns = scanDir(localClipsDir);
  
  // Merge and sort by most recent
  const allRuns = [...ixRuns, ...localRuns].sort((a: any, b: any) => b.timestamp - a.timestamp);
  return { runs: allRuns };
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

// ─── Carousel Persistence ─────────────────────────────────────────
const carouselsDir = () => join(app.getPath('userData'), 'carousels');

ipcMain.handle('save-carousel', async (_event, { title, slides, brandSnapshot, playbookPostId, playbookTopicId }: {
  title: string; slides: object[]; brandSnapshot: object; playbookPostId?: string; playbookTopicId?: string;
}) => {
  const dir = carouselsDir();
  if (!existsSync(dir)) { const { mkdirSync } = await import('fs'); mkdirSync(dir, { recursive: true }); }
  const id = Date.now().toString();
  const filePath = join(dir, `${id}.json`);
  const record: Record<string, unknown> = { id, title, slides, brandSnapshot, createdAt: new Date().toISOString() };
  if (playbookPostId) record.playbookPostId = playbookPostId;
  if (playbookTopicId) record.playbookTopicId = playbookTopicId;
  writeFileSync(filePath, JSON.stringify(record, null, 2));
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

// ─── Publishing Bridge: Content Studio → Content Generator ────────────────────

ipcMain.handle('save-publishing-config', async (_event, config: { apiKey: string; userEmail: string; blobToken: string }) => {
  try {
    store.set('publishingBridge.apiKey', config.apiKey);
    store.set('publishingBridge.userEmail', config.userEmail);
    store.set('publishingBridge.blobToken', config.blobToken);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('get-publishing-config', async () => {
  return {
    apiKey: store.get('publishingBridge.apiKey', '') as string,
    userEmail: store.get('publishingBridge.userEmail', '') as string,
    blobToken: store.get('publishingBridge.blobToken', '') as string,
    configured: !!(store.get('publishingBridge.apiKey') && store.get('publishingBridge.userEmail')),
  };
});

ipcMain.handle('get-scheduled-queue', async () => {
  try {
    const apiKey = store.get('publishingBridge.apiKey', '') as string;
    const userEmail = store.get('publishingBridge.userEmail', '') as string;
    if (!apiKey || !userEmail) return { success: false, error: 'Publishing Bridge not configured. Go to Settings.' };

    const res = await fetch(
      `https://content.6fbmentorship.com/apps/content/api/external/scheduled-posts?email=${encodeURIComponent(userEmail)}&status=scheduled`,
      { headers: { 'x-api-key': apiKey } }
    );
    if (!res.ok) return { success: false, error: `Content Generator returned ${res.status}` };
    const data = await res.json();
    return { success: true, posts: data.posts || [] };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('push-to-scheduler', async (_event, payload: {
  filePath: string;
  caption: string;
  mediaType: 'image' | 'video' | 'carousel';
  scheduledFor: string; // ISO string
  hashtags?: string[];
  isTrial?: boolean;
  playbookPostId?: string;
}) => {
  try {
    const apiKey = store.get('publishingBridge.apiKey', '') as string;
    const userEmail = store.get('publishingBridge.userEmail', '') as string;
    const blobToken = store.get('publishingBridge.blobToken', '') as string;

    if (!apiKey || !userEmail) return { success: false, error: 'Publishing Bridge not configured. Go to Settings.' };

    // 1. Upload file to Vercel Blob
    const { readFileSync } = require('fs');
    const { basename } = require('path');
    const fileBuffer = readFileSync(payload.filePath);
    const fileName = basename(payload.filePath);

    const uploadRes = await fetch(`https://blob.vercel-storage.com/${fileName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${blobToken}`,
        'Content-Type': payload.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
        'x-content-type': 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      return { success: false, error: `Blob upload failed: ${errBody}` };
    }

    const blobData = await uploadRes.json() as { url: string };
    const mediaUrl = blobData.url;

    // 2. Create scheduled post via Content Generator External API
    const postRes = await fetch(
      'https://content.6fbmentorship.com/apps/content/api/external/scheduled-posts',
      {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          caption: payload.caption,
          mediaUrls: [mediaUrl],
          mediaType: payload.mediaType,
          hashtags: payload.hashtags || [],
          scheduledFor: payload.scheduledFor,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          isTrial: payload.isTrial ?? false,
          ...(payload.playbookPostId ? { playbookPostId: payload.playbookPostId } : {}),
        }),
      }
    );

    if (!postRes.ok) {
      const errBody = await postRes.text();
      return { success: false, error: `Scheduling failed: ${errBody}` };
    }

    const postData = await postRes.json();
    return { success: true, post: postData.post };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

// ─── Playbook Topics (fetch from Content Generator web app) ──────────────────

ipcMain.handle('fetch-playbook-topics', async () => {
  try {
    const apiKey = store.get('publishingBridge.apiKey', '') as string;
    const userEmail = store.get('publishingBridge.userEmail', '') as string;
    if (!apiKey || !userEmail) return [];

    const res = await fetch(
      `https://content.6fbmentorship.com/api/studio/planned-topics?userEmail=${encodeURIComponent(userEmail)}`,
      {
        headers: {
          'x-api-key': apiKey,
          'X-Client': '6fb-content-studio',
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data;
  } catch {
    return [];
  }
});

ipcMain.handle('fetch-today-brief', async () => {
  try {
    const apiKey = store.get('publishingBridge.apiKey', '') as string;
    const userEmail = store.get('publishingBridge.userEmail', '') as string;
    if (!apiKey || !userEmail) return null;

    const res = await fetch(
      `https://content.6fbmentorship.com/api/studio/today-brief?userEmail=${encodeURIComponent(userEmail)}`,
      {
        headers: {
          'x-api-key': apiKey,
          'X-Client': '6fb-content-studio',
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
});
