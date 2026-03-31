import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';

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

app.whenReady().then(createWindow);

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

// Carousel Generation (uses student's Claude API key)
ipcMain.handle('generate-carousel', async (_event, { topic, type, keyPoints }: {
  topic: string;
  type: string;
  keyPoints: string[];
}) => {
  const apiKey = store.get('apiKeys.claude') as string;
  if (!apiKey) return { success: false, error: 'No Claude API key configured' };

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const prompt = `You are a professional carousel designer for barber businesses.

Brand: 6FB Mentorship
Style: ${type === 'educational' ? 'Educational (light bg, text-heavy)' : 'Product Announcement (dark #2a2a2a bg, neon green #00c851)'}
Topic: ${topic}

Key Points:
${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Create a 5-slide Instagram carousel (1080x1350 each).

For EACH slide, output in EXACTLY this format:

SLIDE 1:
TYPE: cover
HEADING: [Main heading text]
BODY: [Supporting text, 2-3 lines max]
VISUALS: [Comma-separated: icon suggestions, stat callouts, visual elements]
DESIGN: [Layout notes: color usage, text placement, special effects]

Continue for all 5 slides. Keep text concise.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find((b: { type: string }) => b.type === 'text');
    const rawText = (textBlock as { text: string })?.text || '';

    // Parse slides
    const slideBlocks = rawText.split(/SLIDE\s+(\d+)\s*:/gi);
    const slides = [];
    for (let i = 1; i < slideBlocks.length; i += 2) {
      const num = parseInt(slideBlocks[i], 10);
      const block = slideBlocks[i + 1] || '';
      slides.push({
        slideNumber: num,
        heading: extractField(block, 'HEADING'),
        body: extractField(block, 'BODY'),
        visuals: extractField(block, 'VISUALS').split(',').map(v => v.trim()).filter(Boolean),
        designNotes: extractField(block, 'DESIGN'),
        slideType: extractField(block, 'TYPE').toLowerCase().includes('cover') ? 'cover'
          : extractField(block, 'TYPE').toLowerCase().includes('cta') ? 'cta' : 'content',
      });
    }

    return { success: true, slides };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
});

function extractField(block: string, field: string): string {
  const pattern = new RegExp(`${field}\\s*:\\s*(.+?)(?=\\n(?:TYPE|HEADING|BODY|VISUALS|DESIGN)\\s*:|$)`, 'is');
  const match = block.match(pattern);
  return match ? match[1].trim() : '';
}
