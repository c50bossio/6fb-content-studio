/**
 * FFmpeg Video Renderer — Builds and executes FFmpeg commands for the Video Editor.
 * Supports: trim, caption overlay, transitions (fade), background music, output format.
 */

import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { BrowserWindow } from 'electron';

export interface RenderOptions {
  clipPath: string;
  outputDir: string;
  trimStart: number;
  trimEnd: number;
  outputFormat: '9x16' | '1x1' | '16x9';
  transition: string; // 'cut' | 'fade' | 'slide-left' | 'zoom' | 'blur'
  caption: {
    text: string;
    fontWeight: 'normal' | 'bold' | 'extrabold';
    fontSize: number;
    color: string;
    position: 'top' | 'center' | 'bottom';
    bgOpacity: number;
  } | null;
  music: {
    path: string;
    volume: number; // 0-1
  } | null;
}

export interface RenderResult {
  success: boolean;
  outputPath?: string;
  duration?: number;
  error?: string;
}

// Output dimensions per format
const FORMAT_DIMENSIONS: Record<string, { w: number; h: number }> = {
  '9x16': { w: 1080, h: 1920 },
  '1x1':  { w: 1080, h: 1080 },
  '16x9': { w: 1920, h: 1080 },
};

/**
 * Build the FFmpeg filter chain and run the render.
 */
export function renderVideo(
  options: RenderOptions,
  mainWindow: BrowserWindow | null,
): Promise<RenderResult> {
  return new Promise((resolve) => {
    const {
      clipPath, outputDir, trimStart, trimEnd,
      outputFormat, transition, caption, music,
    } = options;

    // Validate input
    if (!existsSync(clipPath)) {
      return resolve({ success: false, error: `Input file not found: ${clipPath}` });
    }

    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const duration = trimEnd - trimStart;
    const dims = FORMAT_DIMENSIONS[outputFormat] || FORMAT_DIMENSIONS['9x16'];
    const timestamp = Date.now();
    const outputPath = join(outputDir, `6fb_export_${timestamp}.mp4`);

    // ─── Build FFmpeg arguments ───────────────────────────────

    const args: string[] = ['-y']; // overwrite

    // Input: main video
    args.push('-ss', String(trimStart));
    args.push('-t', String(duration));
    args.push('-i', clipPath);

    // Input: background music (optional)
    if (music && existsSync(music.path)) {
      args.push('-i', music.path);
    }

    // ─── Build filter graph ───────────────────────────────────

    const filters: string[] = [];
    let videoLabel = '0:v';
    let audioLabel = '0:a';

    // 1. Scale + crop/pad to target dimensions
    filters.push(
      `[${videoLabel}]scale=${dims.w}:${dims.h}:force_original_aspect_ratio=decrease,` +
      `pad=${dims.w}:${dims.h}:(ow-iw)/2:(oh-ih)/2:color=black[scaled]`
    );
    videoLabel = 'scaled';

    // 2. Fade transition (if requested)
    if (transition === 'fade') {
      const fadeOutStart = Math.max(0, duration - 0.5);
      filters.push(
        `[${videoLabel}]fade=t=in:st=0:d=0.5,fade=t=out:st=${fadeOutStart}:d=0.5[faded]`
      );
      videoLabel = 'faded';
    } else if (transition === 'blur') {
      // Blur dissolve at start and end
      filters.push(
        `[${videoLabel}]fade=t=in:st=0:d=0.3,fade=t=out:st=${Math.max(0, duration - 0.3)}:d=0.3[faded]`
      );
      videoLabel = 'faded';
    }

    // 3. Caption overlay (drawtext)
    if (caption && caption.text.trim()) {
      const escapedText = caption.text
        .replace(/\\/g, '\\\\\\\\')
        .replace(/'/g, "'\\''")
        .replace(/:/g, '\\:')
        .replace(/%/g, '%%');

      // Font weight mapping
      const fontFile = '/System/Library/Fonts/Helvetica.ttc';

      // Position mapping
      let yExpr: string;
      if (caption.position === 'top') {
        yExpr = 'y=h*0.08';
      } else if (caption.position === 'center') {
        yExpr = 'y=(h-text_h)/2';
      } else {
        yExpr = 'y=h*0.88-text_h';
      }

      // Font size scaled to output height
      const fontSize = Math.round(caption.fontSize * (dims.h / 1920));

      // Background box
      const bgAlpha = Math.round((caption.bgOpacity / 100) * 255);
      const boxColor = `black@${(bgAlpha / 255).toFixed(2)}`;

      filters.push(
        `[${videoLabel}]drawtext=text='${escapedText}':` +
        `fontfile='${fontFile}':fontsize=${fontSize}:fontcolor=${caption.color}:` +
        `${yExpr}:x=(w-text_w)/2:` +
        `box=1:boxcolor=${boxColor}:boxborderw=12[captioned]`
      );
      videoLabel = 'captioned';
    }

    // Build the complete filter_complex
    const filterComplex = filters.join(';');

    if (filterComplex) {
      args.push('-filter_complex', filterComplex);
      args.push('-map', `[${videoLabel}]`);
    }

    // Audio handling
    if (music && existsSync(music.path)) {
      // Mix original audio + music
      const musicVol = music.volume.toFixed(2);
      const audioFilter = `[0:a]volume=1.0[orig];[1:a]volume=${musicVol}[mus];[orig][mus]amix=inputs=2:duration=shortest[aout]`;

      // Append audio filter
      if (filterComplex) {
        args[args.indexOf('-filter_complex') + 1] += `;${audioFilter}`;
      } else {
        args.push('-filter_complex', audioFilter);
      }
      args.push('-map', '[aout]');
    } else {
      // Use original audio
      if (filterComplex) {
        args.push('-map', '0:a?');
      }
    }

    // Output settings
    args.push('-c:v', 'libx264');
    args.push('-preset', 'medium');
    args.push('-crf', '23');
    args.push('-c:a', 'aac');
    args.push('-b:a', '192k');
    args.push('-movflags', '+faststart');
    args.push('-shortest');
    args.push(outputPath);

    // ─── Execute FFmpeg ───────────────────────────────────────

    sendProgress(mainWindow, 5, 'Starting FFmpeg render...');

    const proc: ChildProcess = spawn('ffmpeg', args, {
      env: { ...process.env },
    });

    let stderr = '';

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;

      // Parse progress from FFmpeg stderr (time=HH:MM:SS.ss)
      const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (timeMatch && mainWindow) {
        const hours = parseInt(timeMatch[1]);
        const mins = parseInt(timeMatch[2]);
        const secs = parseFloat(timeMatch[3]);
        const currentSec = hours * 3600 + mins * 60 + secs;
        const pct = Math.min(95, 5 + (currentSec / duration) * 90);
        sendProgress(mainWindow, pct, `Rendering... ${formatTime(currentSec)} / ${formatTime(duration)}`);
      }
    });

    proc.on('close', (code) => {
      if (code === 0 && existsSync(outputPath)) {
        sendProgress(mainWindow, 100, 'Export complete!');
        resolve({
          success: true,
          outputPath,
          duration,
        });
      } else {
        sendProgress(mainWindow, 0, 'Export failed');
        // Extract useful error from FFmpeg stderr
        const errorLines = stderr.split('\n').filter(l =>
          l.includes('Error') || l.includes('Invalid') || l.includes('No such')
        );
        const errorMsg = errorLines.length > 0
          ? errorLines.slice(-3).join('; ')
          : `FFmpeg exited with code ${code}`;
        resolve({ success: false, error: errorMsg });
      }
    });

    proc.on('error', (err) => {
      sendProgress(mainWindow, 0, 'FFmpeg not found');
      resolve({
        success: false,
        error: `FFmpeg not found: ${err.message}. Install via: brew install ffmpeg`,
      });
    });
  });
}

// ─── Helpers ────────────────────────────────────────────────────

function sendProgress(win: BrowserWindow | null, percent: number, label: string) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('progress-update', { percent, label });
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
