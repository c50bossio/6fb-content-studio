/**
 * Python Bridge — Spawns clip_extractor pipeline from the IX system.
 * Runs the full reframe pipeline: detect faces → smooth → crop → render.
 */

import { spawn, ChildProcess } from 'child_process';
import { delimiter, dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { BrowserWindow } from 'electron';
import type { ContentStrategyBrief } from '../src/types/content-strategy';

// 35-minute hard timeout for long 4K renders; cancellable via cancelActiveExtraction()
const EXTRACTION_TIMEOUT_MS = 35 * 60 * 1000;

// Singleton reference so main.ts can cancel mid-run
let activeProcess: ChildProcess | null = null;

/**
 * Kill the active extraction process if one is running.
 * Safe to call when idle — does nothing.
 */
export function cancelActiveExtraction(): void {
  if (activeProcess) {
    try { activeProcess.kill('SIGTERM'); } catch {}
    activeProcess = null;
  }
}

export interface ClipExtractorRuntime {
  mode: 'bundled' | 'custom';
  pythonPath: string;
  ffmpegPath: string;
  ffprobePath?: string;
  toolsDir: string;
  pipelineScriptPath: string;
  binaryPath?: string;
  anthropicApiKey?: string;
}

interface ClipExtractorOptions {
  outputFormat?: '9x16' | '1x1' | 'split' | 'auto';
  contentType?: string;
  numClips?: number;
  startSec?: number;
  endSec?: number;
  configPath?: string;
  brandName?: string;
  planContext?: {
    topic: string;
    dropZones: { label: string; timestamp: string; endTimestamp: string }[];
  };
  strategyBrief?: ContentStrategyBrief;
  runtime: ClipExtractorRuntime;
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

export function resolveSystemPython(): string {
  return 'python3';
}

function safeClipTitle(value: unknown, fallback: string): string {
  return String(value || '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 120) || fallback;
}

function findClipOutput(outputDir: string, id: string, title: unknown): { clipPath: string; filePath: string | null } {
  const safeTitle = safeClipTitle(title, `clip-${id}`);
  const expectedFolder = `clip-${id}-${safeTitle}`;
  const expectedPath = join(outputDir, expectedFolder);
  const matchingFolder = existsSync(expectedPath)
    ? expectedFolder
    : readdirSync(outputDir, { withFileTypes: true })
      .find((entry) => entry.isDirectory() && entry.name.startsWith(`clip-${id}-`))?.name;
  const clipPath = join(outputDir, matchingFolder || expectedFolder);

  const filePath = [
    'rendered_composition.mp4',
    'reframed-9x16.mp4',
    'reframed-split.mp4',
    'reframed-auto.mp4',
    'raw.mp4',
  ].map((name) => join(clipPath, name)).find((candidate) => existsSync(candidate)) || null;

  return { clipPath, filePath };
}

function companionToolPath(toolPath: string | undefined, executable: string): string {
  const fileName = process.platform === 'win32' ? `${executable}.exe` : executable;
  if (toolPath && toolPath !== executable) {
    const candidate = join(dirname(toolPath), fileName);
    if (existsSync(candidate)) return candidate;
  }
  return fileName;
}

function toolPathDirs(...toolPaths: Array<string | undefined>): string {
  const dirs = new Set<string>();
  for (const toolPath of toolPaths) {
    if (!toolPath || toolPath === 'ffmpeg' || toolPath === 'ffprobe') continue;
    dirs.add(dirname(toolPath));
  }
  return Array.from(dirs).join(delimiter);
}

/**
 * Check if Python and required dependencies are available.
 */
export async function checkPythonDeps(runtime: ClipExtractorRuntime): Promise<{
  python: boolean;
  ffmpeg: boolean;
  ffprobe: boolean;
  mediapipe: boolean;
  clipExtractor: boolean;
  pythonPath: string;
  ffmpegPath: string;
  ffprobePath: string;
  pipelineScriptPath: string;
  binaryPath?: string;
  toolsDir: string;
  mode: 'bundled' | 'custom';
}> {
  const check = (cmd: string, args: string[]): Promise<boolean> =>
    new Promise(resolve => {
      const proc = spawn(cmd, args, { stdio: 'pipe' });
      proc.on('close', code => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });

  const pythonPath = runtime.pythonPath || resolveSystemPython();
  const ffmpegPath = runtime.ffmpegPath || 'ffmpeg';
  const ffprobePath = runtime.ffprobePath || companionToolPath(ffmpegPath, 'ffprobe');
  const hasBinary = !!runtime.binaryPath && existsSync(runtime.binaryPath);

  const bundledRuntimeReady = hasBinary && runtime.binaryPath
    ? await check(runtime.binaryPath, ['--runtime-check'])
    : false;

  const [python, ffmpeg, ffprobe, mediapipe] = hasBinary && runtime.binaryPath
    ? [
      bundledRuntimeReady,
      await check(ffmpegPath, ['-version']),
      await check(ffprobePath, ['-version']),
      bundledRuntimeReady,
    ]
    : await Promise.all([
      check(pythonPath, ['--version']),
      check(ffmpegPath, ['-version']),
      check(ffprobePath, ['-version']),
      check(pythonPath, ['-c', 'import mediapipe; print(mediapipe.__version__)']),
    ]);

  const clipExtractor = hasBinary
    ? bundledRuntimeReady
    : (
      existsSync(runtime.pipelineScriptPath)
      && existsSync(join(runtime.toolsDir, 'clip_extractor/core/pipeline.py'))
    );

  return {
    python,
    ffmpeg,
    ffprobe,
    mediapipe,
    clipExtractor,
    pythonPath,
    ffmpegPath,
    ffprobePath,
    pipelineScriptPath: runtime.pipelineScriptPath,
    binaryPath: runtime.binaryPath,
    toolsDir: runtime.toolsDir,
    mode: runtime.mode,
  };
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
    const runtime = options.runtime;

    if (runtime?.binaryPath && !existsSync(runtime.binaryPath)) {
      resolve({
        success: false,
        error: 'Configured clip pipeline binary was not found.',
      });
      return;
    }

    if (!runtime?.binaryPath && (!runtime?.pipelineScriptPath || !existsSync(runtime.pipelineScriptPath))) {
      resolve({
        success: false,
        error: 'Bundled clip pipeline not found. Reinstall 6FB Content Studio or configure a custom pipeline in Settings.',
      });
      return;
    }

    // Build args
    const args = [
      '--video', videoPath,
      '--output', outputDir,
      '--format', format,
      '--content-type', contentType,
      '--clips', numClips.toString(),
      '--brand', options.brandName || '6fbarber',
      '--no-post'
    ];

    const command = runtime.binaryPath || runtime.pythonPath || resolveSystemPython();
    const commandArgs = runtime.binaryPath ? args : [runtime.pipelineScriptPath, ...args];
    const ffprobePath = runtime.ffprobePath || companionToolPath(runtime.ffmpegPath, 'ffprobe');
    const pathDirs = toolPathDirs(runtime.ffmpegPath, ffprobePath);
    const pathPrefix = pathDirs ? `${pathDirs}${delimiter}` : '';

    const proc: ChildProcess = spawn(command, commandArgs, {
      cwd: runtime.toolsDir,
      env: {
        ...process.env,
        PATH: `${pathPrefix}${process.env.PATH || ''}`,
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: runtime.toolsDir,
        ...(runtime.anthropicApiKey ? { ANTHROPIC_API_KEY: runtime.anthropicApiKey } : {}),
        // Pass Drop Zone context so the pipeline can boost scoring for planned hooks
        ...(options.planContext ? {
          PLAN_TOPIC: options.planContext.topic,
          PLAN_DROP_ZONES: JSON.stringify(options.planContext.dropZones),
        } : {}),
        ...(options.strategyBrief ? {
          CONTENT_STRATEGY_BRIEF: JSON.stringify(options.strategyBrief),
        } : {}),
      },
    });

    // Track process so it can be cancelled or killed on app quit
    activeProcess = proc;

    // Hard timeout: kill the process if it runs too long
    const timeoutHandle = setTimeout(() => {
      console.error('[python-bridge] Extraction timed out after 35 minutes — killing process');
      proc.kill('SIGTERM');
    }, EXTRACTION_TIMEOUT_MS);

    let stdout = '';
    let stderr = '';
    let lastProgressPct = 0;
    // Buffer incomplete lines so regex patterns don't fail on chunk boundaries
    let stdoutLineBuf = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdoutLineBuf += data.toString();
      // Split on newlines, keep the last (potentially incomplete) segment buffered
      const lines = stdoutLineBuf.split('\n');
      stdoutLineBuf = lines.pop() ?? '';
      const text = lines.join('\n');
      if (!text) return;
      stdout += text + '\n';

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

    const cleanup = () => {
      clearTimeout(timeoutHandle);
      if (activeProcess === proc) activeProcess = null;
    };

    proc.on('close', (code) => {
      cleanup();
      if (mainWindow) {
        mainWindow.webContents.send('progress-update', {
          percent: 100,
          label: code === 0 ? 'Complete!' : 'Failed',
        });
      }

      // Gather the outputs from the expected validated and spec JSON files
      try {
        const { readFileSync: readFS, existsSync: existsFS } = require('fs') as typeof import('fs');
        const validatedPath = join(outputDir, 'validated_clips.json');

        if (code === 0 && existsFS(validatedPath)) {
          const content = readFS(validatedPath, 'utf-8');
          const data = JSON.parse(content);

          // Map to clip layout format
          const formattedClips = (data || []).map((clip: any, i: number) => {
            // Find the generated mp4
            const formattedId = String(clip.id || i + 1).padStart(2, '0');
            const { clipPath, filePath } = findClipOutput(outputDir, formattedId, clip.title);

            return {
              start: clip.start || 0,
              end: clip.end || 0,
              score: (() => {
                const raw = Number(clip.score);
                if (!Number.isFinite(raw) || raw < 0 || raw > 100) return 0.90;
                return raw / 100;
              })(),
              label: clip.title || `AI Segment ${i + 1}`,
              filePath,
              clipPath,
              rationale: clip.reason,
              strategyLabel: clip.strategy_label,
              strategyRationale: clip.strategy_rationale,
              strategyScores: clip.strategy_scores,
              packageVariant: clip.package_variant,
            };
          });

          resolve({
            success: true,
            data: { clips: formattedClips },
            outputPath: outputDir
          });
        } else {
          console.error('[python-bridge] Pipeline failed to generate clips.');
          console.error('STDOUT (tail):', stdout.slice(-500));
          console.error('STDERR (tail):', stderr.slice(-500));
          resolve({
            success: false,
            error: code === 0
              ? 'No clips generated by AI Engine'
              : code === null
                ? 'Extraction was cancelled or timed out'
                : `Pipeline failed (exit ${code}): ${stderr.slice(-300)}`
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
      cleanup();
      resolve({
        success: false,
        error: `Failed to start Python: ${err.message}. Install Python 3.10+ and the IX dependencies.`,
      });
    });
  });
}
