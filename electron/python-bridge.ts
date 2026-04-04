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
  outputFormat?: '9x16' | '1x1' | 'split' | 'auto';
  contentType?: string;
  numClips?: number;
  startSec?: number;
  endSec?: number;
  configPath?: string;
  brandName?: string;
  contentStrategy?: string;
  planContext?: {
    topic: string;
    dropZones: { label: string; timestamp: string; endTimestamp: string }[];
  };
}

interface ExtractResult {
  success: boolean;
  outputPath?: string;
  data?: { clips: any[] };
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
    const contentType = options.contentType || 'auto';
    const numClips = options.numClips || 3;

    // Determine script path
    const pipelineScript = join(IX_CLIP_EXTRACTOR, '../pipeline/full_pipeline.py');

    // Build args
    const args = [
      pipelineScript,
      '--video', videoPath,
      '--output', outputDir,
      '--format', format,
      '--content-type', contentType,
      '--clips', numClips.toString(),
      '--brand', options.brandName || '6fbarber',
      '--compose', // render typography
      '--no-post'
    ];

    const venvPythonPath = join(IX_CLIP_EXTRACTOR, '../../venv/bin/python');
    
    // Read API key directly from config file (store only lives in main.ts)
    let storedApiKey = '';
    try {
      const configPath = join(process.env.HOME || '~', 'Library/Application Support/6fb-content-studio/config.json');
      const { readFileSync } = require('fs');
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        storedApiKey = config?.apiKeys?.claude || '';
      }
    } catch (_) {}
    
    const proc: ChildProcess = spawn(venvPythonPath, args, {
      cwd: join(IX_CLIP_EXTRACTOR, '..'),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        ANTHROPIC_API_KEY: storedApiKey,
        // Content strategy changes what Claude looks for
        CONTENT_STRATEGY: options.contentStrategy || 'talking_head',
        // Pass Drop Zone context so the pipeline can boost scoring for planned hooks
        ...(options.planContext ? {
          PLAN_TOPIC: options.planContext.topic,
          PLAN_DROP_ZONES: JSON.stringify(options.planContext.dropZones),
        } : {}),
      },
    });

    let stdout = '';
    let stderr = '';
    let lastProgressPct = 0;

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;

      // --- NEW PROGRESS PARSERS FOR MULTI STAGE PIPELINE ---

      // 1. Transcription (0-20%)
      if (text.includes('Using MLX Whisper') || text.includes('Using Whisper CLI')) {
        lastProgressPct = 5;
        mainWindow?.webContents.send('progress-update', { percent: 5, label: 'Transcribing video (GPU Accelerated)...' });
      }

      // 2. Transcription Segment Tracking
      const transMatch = text.match(/Segment (\d+)\/(\d+)/);
      if (transMatch) {
         lastProgressPct = 10;
         mainWindow?.webContents.send('progress-update', { percent: 10, label: `Transcribing audio...` });
      }

      // 3. Selection API
      if (text.includes('Evaluating segments via Anthropic')) {
        lastProgressPct = 25;
        mainWindow?.webContents.send('progress-update', { percent: lastProgressPct, label: 'Claude AI identifying viral hooks...' });
      }

      // 4. Reframing
      if (text.includes('Step 4/')) {
        lastProgressPct = 40;
        mainWindow?.webContents.send('progress-update', { percent: lastProgressPct, label: 'Analyzing framing boundaries...' });
      }
      
      const frameMatch = text.match(/Analyzed (\d+) frames/);
      if (frameMatch && mainWindow) {
        const frames = parseInt(frameMatch[1]);
        const pct = Math.floor(40 + Math.min(20, (frames / 2000) * 20)); // scale approx
        if (pct > lastProgressPct) {
          lastProgressPct = pct;
          mainWindow.webContents.send('progress-update', { percent: pct, label: `Tracking subjects... (${frames} frames)` });
        }
      }

      // 5. Composition / Render
      if (text.includes('Remotion compose') || text.includes('Composition spec generated')) {
        lastProgressPct = 70;
        mainWindow?.webContents.send('progress-update', { percent: lastProgressPct, label: 'Composing graphical overlays...' });
      }

      if (text.includes('Remotion render')) {
        lastProgressPct = 80;
        mainWindow?.webContents.send('progress-update', { percent: lastProgressPct, label: 'Rendering typography masks...' });
      }

      // FFMPEG Sub-render progress
      const renderProgressMatch = text.match(/Rendering:\s*(\d+)%\s*\((\d+)\/(\d+)/);
      if (renderProgressMatch && mainWindow) {
        const pyPct = parseInt(renderProgressMatch[1], 10);
        const frames = renderProgressMatch[2];
        const scaledPct = Math.floor(80 + (pyPct * 0.18)); // 80 -> 98%
        
        if (scaledPct > lastProgressPct) {
          lastProgressPct = scaledPct;
          mainWindow.webContents.send('progress-update', { percent: lastProgressPct, label: `Encoding final MP4s... (${frames} frames)` });
        }
      }

      // Universal [PROGRESS] parser for Step 7 (compose) and Step 8 (render)
      const progressMatch = text.match(/\[PROGRESS\]\s*(\d+)\s*(.*)/);
      if (progressMatch && mainWindow) {
        const pct = parseInt(progressMatch[1], 10);
        const msg = progressMatch[2].trim() || 'Processing...';
        if (pct > lastProgressPct || pct >= 70) {
          lastProgressPct = pct;
          const label = msg.includes('Compos') ? `🖌️ ${msg}` 
                      : msg.includes('Render') ? `🎞️ ${msg}` 
                      : msg;
          mainWindow.webContents.send('progress-update', { percent: pct, label });
        }
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      
      // Parse FFMPEG Progress (outputs directly to stderr)
      const frameMatch = text.match(/frame=\s*(\d+)/);
      if (frameMatch && mainWindow) {
        const frames = parseInt(frameMatch[1], 10);
        // Slowly advance from 65% to 98% based on completed frames
        const pct = Math.floor(65 + ((frames / (frames + 2000)) * 33));
        if (pct > lastProgressPct) {
          lastProgressPct = pct;
        }
        
        // Throttle updates slightly or just send
        mainWindow.webContents.send('progress-update', {
          percent: lastProgressPct,
          label: `Rendering reframed video... (Frame ${frames})`,
        });
      }
    });

    proc.on('close', (code) => {
      if (mainWindow) {
        mainWindow.webContents.send('progress-update', {
          percent: 100,
          label: code === 0 ? 'Complete!' : 'Failed',
        });
      }

      // Gather the outputs from the expected validated and spec JSON files
      try {
        const { readFileSync, existsSync } = require('fs');
        const validatedPath = join(outputDir, 'validated_clips.json');
        
        if ((code === 0 || code === null) && existsSync(validatedPath)) {
          const content = readFileSync(validatedPath, 'utf-8');
          const data = JSON.parse(content);
          
          // Map to clip layout format
          const formattedClips = (data || []).map((clip: any, i: number) => {
            // Find the generated mp4 
            const formattedId = String(clip.id || i + 1).padStart(2, '0');
            const clipFolder = `clip-${formattedId}-${clip.title}`;
            const expectedRenderPath = join(outputDir, clipFolder, 'rendered_composition.mp4');
            const fallbackPath = join(outputDir, clipFolder, 'reframed-9x16.mp4');
            const finalPath = existsSync(expectedRenderPath) ? expectedRenderPath : fallbackPath;

            return {
              start: clip.start || 0,
              end: clip.end || 0,
              score: clip.score ? clip.score / 100 : 0.90, // score is typically 80-100
              label: clip.title || `AI Segment ${i+1}`,
              filePath: finalPath,
              rationale: clip.reason,
            };
          });

          resolve({
            success: true,
            data: { clips: formattedClips },
            outputPath: outputDir
          });
        } else {
          console.error("PIPELINE FAILED TO GENERATE CLIPS.");
          console.error("STDOUT:", stdout);
          console.error("STDERR:", stderr);
          resolve({
            success: false,
            error: (code === 0 || code === null) ? 'No clips generated by AI Engine' : `Pipeline failed (exit ${code}): ${stderr.slice(-300)}`
          });
        }
      } catch (e: any) {
        resolve({
           success: false,
           error: `Failed to compile returned clips: ${e.message}`
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
