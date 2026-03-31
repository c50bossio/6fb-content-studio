/**
 * Python Bridge — Spawns clip_extractor pipeline from the IX system.
 * Runs the full reframe pipeline: detect faces → smooth → crop → render.
 */

import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { BrowserWindow } from 'electron';

// Path to IX clip extractor
const IX_CLIP_EXTRACTOR = join(
  process.env.HOME || '~',
  'clawd/projects/ix-social-media-manager/tools/clip_extractor'
);

interface ClipExtractorOptions {
  outputFormat?: '9x16' | '1x1' | 'split';
  startSec?: number;
  endSec?: number;
  configPath?: string;
}

interface ExtractResult {
  success: boolean;
  outputPath?: string;
  cropPathFile?: string;
  stats?: {
    framesAnalyzed: number;
    faceDetectedPct: number;
    avgConfidence: number;
    renderTime: number;
  };
  error?: string;
}

/**
 * Check if Python and required dependencies are available.
 */
export async function checkPythonDeps(): Promise<{
  python: boolean;
  ffmpeg: boolean;
  mediapipe: boolean;
  clipExtractor: boolean;
}> {
  const check = (cmd: string, args: string[]): Promise<boolean> =>
    new Promise(resolve => {
      const proc = spawn(cmd, args, { stdio: 'pipe' });
      proc.on('close', code => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });

  const [python, ffmpeg, mediapipe] = await Promise.all([
    check('python3', ['--version']),
    check('ffmpeg', ['-version']),
    check('python3', ['-c', 'import mediapipe; print(mediapipe.__version__)']),
  ]);

  const clipExtractor = existsSync(join(IX_CLIP_EXTRACTOR, 'core/pipeline.py'));

  return { python, ffmpeg, mediapipe, clipExtractor };
}

/**
 * Run the full clip extractor reframe pipeline.
 */
export function runClipExtractor(
  videoPath: string,
  outputDir: string,
  options: ClipExtractorOptions,
  mainWindow: BrowserWindow | null,
): Promise<ExtractResult> {
  return new Promise((resolve) => {
    const format = options.outputFormat || '9x16';

    // Build Python command
    const pythonScript = `
import sys, json, os
sys.path.insert(0, '${join(IX_CLIP_EXTRACTOR, '..')}')
from clip_extractor.core.pipeline import reframe

try:
    result = reframe(
        video_path='${videoPath.replace(/'/g, "\\'")}',
        output_path='${outputDir.replace(/'/g, "\\'")}',
        output_format='${format}',
        ${options.startSec !== undefined ? `start_sec=${options.startSec},` : ''}
        ${options.endSec !== undefined ? `end_sec=${options.endSec},` : ''}
        ${options.configPath ? `config_path='${options.configPath}',` : ''}
    )
    print(json.dumps({"success": True, "output": result}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
`;

    const proc: ChildProcess = spawn('python3', ['-c', pythonScript], {
      cwd: IX_CLIP_EXTRACTOR,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    let stdout = '';
    let stderr = '';
    let lastProgressPct = 0;

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;

      // Parse progress from IX stdout output
      const frameMatch = text.match(/Analyzed (\d+) frames/);
      if (frameMatch && mainWindow) {
        const frames = parseInt(frameMatch[1]);
        // Rough estimate: analysis is 0-60%, render is 60-100%
        const pct = Math.min(60, (frames / 200) * 60);
        if (pct > lastProgressPct) {
          lastProgressPct = pct;
          mainWindow.webContents.send('progress-update', {
            percent: pct,
            label: `Analyzing frames... (${frames} processed)`,
          });
        }
      }

      const renderMatch = text.match(/Rendering:/);
      if (renderMatch && mainWindow) {
        lastProgressPct = 65;
        mainWindow.webContents.send('progress-update', {
          percent: 65,
          label: 'Rendering reframed video...',
        });
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (mainWindow) {
        mainWindow.webContents.send('progress-update', {
          percent: 100,
          label: code === 0 ? 'Complete!' : 'Failed',
        });
      }

      // Try to parse JSON result from last line of stdout
      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1];

      try {
        const result = JSON.parse(lastLine);
        if (result.success) {
          resolve({
            success: true,
            outputPath: result.output,
            cropPathFile: join(outputDir, 'crop_path.json'),
          });
        } else {
          resolve({ success: false, error: result.error });
        }
      } catch {
        resolve({
          success: false,
          error: code === 0
            ? 'Could not parse pipeline output'
            : `Pipeline failed (exit ${code}): ${stderr.slice(-300)}`,
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        error: `Failed to start Python: ${err.message}. Install Python 3.10+ and the IX dependencies.`,
      });
    });
  });
}
