import { useState } from 'react';

type OutputFormat = '9x16' | '1x1' | '16x9';

interface CaptionStyle {
  text: string;
  fontWeight: 'normal' | 'bold' | 'extrabold';
  fontSize: number;
  color: string;
  position: 'top' | 'center' | 'bottom';
  bgOpacity: number;
}

interface Transition {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const TRANSITIONS: Transition[] = [
  { id: 'cut', name: 'Cut', icon: '⚡', description: 'Instant cut — no transition' },
  { id: 'fade', name: 'Fade', icon: '🌅', description: 'Smooth fade to black' },
  { id: 'slide-left', name: 'Slide Left', icon: '⬅️', description: 'Slide out to left' },
  { id: 'zoom', name: 'Zoom', icon: '🔍', description: 'Zoom into center' },
  { id: 'blur', name: 'Blur', icon: '💨', description: 'Blur dissolve' },
];

const CAPTION_COLORS = ['#FFFFFF', '#00c851', '#FFD700', '#FF6B6B', '#6B8AFF', '#FF69B4'];

interface VideoEditorProps {
  initialClipPath?: string;
}

export default function VideoEditor({ initialClipPath }: VideoEditorProps) {
  const [clipPath, setClipPath] = useState(initialClipPath || '');
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(30);
  const [duration] = useState(30);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('9x16');
  const [transition, setTransition] = useState<string>('cut');
  const [caption, setCaption] = useState<CaptionStyle>({
    text: '',
    fontWeight: 'bold',
    fontSize: 48,
    color: '#FFFFFF',
    position: 'bottom',
    bgOpacity: 60,
  });
  const [musicPath, setMusicPath] = useState('');
  const [musicVolume, setMusicVolume] = useState(40);
  const [activePanel, setActivePanel] = useState<'caption' | 'transition' | 'music' | 'format'>('caption');
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string; outputPath?: string } | null>(null);

  const handleSelectClip = async () => {
    const result = await window.electronAPI.selectVideo();
    if (!result.cancelled && result.filePath) {
      setClipPath(result.filePath);
      setExportResult(null);
    }
  };

  const handleSelectMusic = async () => {
    const result = await window.electronAPI.selectVideo(); // reuses file picker
    if (!result.cancelled && result.filePath) {
      setMusicPath(result.filePath);
    }
  };

  const [outputDir, setOutputDir] = useState('');
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);

  const handleSelectOutputDir = async () => {
    const result = await window.electronAPI.selectOutputDir();
    if (!result.cancelled && result.dirPath) {
      setOutputDir(result.dirPath);
    }
  };

  const handleExport = async () => {
    if (!clipPath) return;
    setExporting(true);
    setExportResult(null);
    setProgress({ percent: 0, label: 'Preparing...' });

    // Listen for progress updates
    const cleanup = window.electronAPI.onProgress((data) => {
      setProgress(data);
    });

    try {
      const props = {
        clipPath,
        trimStart,
        trimEnd,
        outputFormat,
        transition,
        caption: caption.text ? caption : null,
        music: musicPath ? { path: musicPath, volume: musicVolume / 100 } : null,
        outputDir: outputDir || undefined,
      };

      const result = await window.electronAPI.renderVideo('clip-editor', props);
      if (result.success) {
        const filename = result.outputPath?.split('/').pop() || 'video';
        setExportResult({
          success: true,
          message: `Exported: ${filename}`,
          outputPath: result.outputPath,
        });
      } else {
        setExportResult({ success: false, message: result.error || 'Export failed' });
      }
    } catch {
      setExportResult({ success: false, message: 'Export failed. Check that FFmpeg is installed.' });
    }

    cleanup();
    setProgress(null);
    setExporting(false);
  };

  const PANELS = [
    { id: 'caption' as const, icon: '💬', label: 'Captions' },
    { id: 'transition' as const, icon: '🎞️', label: 'Transitions' },
    { id: 'music' as const, icon: '🎵', label: 'Music' },
    { id: 'format' as const, icon: '📐', label: 'Format' },
  ];

  const ASPECT_RATIOS: { format: OutputFormat; label: string; desc: string }[] = [
    { format: '9x16', label: '9:16', desc: 'TikTok / Reels / Shorts' },
    { format: '1x1', label: '1:1', desc: 'Instagram Feed' },
    { format: '16x9', label: '16:9', desc: 'YouTube / Landscape' },
  ];

  const aspectClass = outputFormat === '9x16' ? 'aspect-[9/16] max-h-[380px]'
    : outputFormat === '1x1' ? 'aspect-square max-h-[320px]'
    : 'aspect-video max-h-[260px]';

  return (
    <div className="p-8 max-w-5xl mx-auto animate-page-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-white">Video Editor</h1>
          <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-blue-500/20">
            Beta
          </span>
        </div>
        <p className="text-sm text-6fb-text-secondary">
          Trim clips, add captions and transitions, set music, and export.
        </p>
      </div>

      {/* Main Layout: Preview + Controls */}
      <div className="grid grid-cols-[1fr_340px] gap-6">
        {/* Left: Preview Canvas + Timeline */}
        <div>
          {/* Canvas */}
          <div className="bg-6fb-card rounded-2xl border border-6fb-border p-4 mb-4">
            {!clipPath ? (
              <button
                onClick={handleSelectClip}
                className="w-full bg-6fb-bg border-2 border-dashed border-6fb-border rounded-xl p-12 flex flex-col items-center justify-center hover:border-6fb-green/50 hover:bg-6fb-green/5 transition-all group"
              >
                <div className="w-14 h-14 rounded-xl bg-6fb-border/50 flex items-center justify-center mb-3 group-hover:bg-6fb-green/10 transition-colors">
                  <span className="text-2xl">🎬</span>
                </div>
                <p className="text-sm font-semibold text-white mb-1">Select a clip to edit</p>
                <p className="text-xs text-6fb-text-muted">Or extract clips first from the Clip Extractor</p>
              </button>
            ) : (
              <div className="flex flex-col items-center">
                {/* Mock preview canvas */}
                <div className={`${aspectClass} w-full bg-6fb-bg rounded-xl border border-6fb-border/50 flex flex-col items-center justify-center relative overflow-hidden`}>
                  {/* Background pattern */}
                  <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #333 0, #333 1px, transparent 0, transparent 10px)' }} />

                  {/* Caption preview */}
                  {caption.text && (
                    <div
                      className={`absolute left-4 right-4 ${
                        caption.position === 'top' ? 'top-6' : caption.position === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-6'
                      }`}
                    >
                      <div
                        className="px-4 py-2 rounded-lg text-center mx-auto max-w-[90%]"
                        style={{
                          backgroundColor: `rgba(0,0,0,${caption.bgOpacity / 100})`,
                          color: caption.color,
                          fontSize: `${Math.max(12, caption.fontSize / 4)}px`,
                          fontWeight: caption.fontWeight === 'extrabold' ? 800 : caption.fontWeight === 'bold' ? 700 : 400,
                        }}
                      >
                        {caption.text}
                      </div>
                    </div>
                  )}

                  {/* Center icon */}
                  <span className="text-5xl opacity-20">🎬</span>
                  <p className="text-xs text-6fb-text-muted mt-2 truncate max-w-[200px]">{clipPath.split('/').pop()}</p>
                </div>

                {/* Change clip */}
                <button
                  onClick={handleSelectClip}
                  className="mt-3 text-xs text-6fb-text-muted hover:text-white transition-colors"
                >
                  Change clip
                </button>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-6fb-card rounded-xl border border-6fb-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-6fb-text-muted uppercase tracking-wider">Timeline</p>
              <p className="text-xs text-6fb-text-secondary font-mono">
                {formatTime(trimStart)} — {formatTime(trimEnd)}
              </p>
            </div>

            {/* Track */}
            <div className="relative h-12 bg-6fb-bg rounded-lg overflow-hidden mb-3">
              {/* Full track */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-6fb-green/20 rounded-lg" />

              {/* Selected region */}
              <div
                className="absolute top-0 bottom-0 bg-6fb-green/20 border-x-2 border-6fb-green rounded"
                style={{
                  left: `${(trimStart / duration) * 100}%`,
                  width: `${((trimEnd - trimStart) / duration) * 100}%`,
                }}
              />

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg shadow-white/20"
                style={{ left: `${(trimStart / duration) * 100 + 2}%` }}
              />

              {/* Waveform bars (decorative) */}
              <div className="absolute inset-0 flex items-end gap-px px-1 py-1">
                {Array.from({ length: 60 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-white/10 rounded-t"
                    style={{ height: `${20 + Math.sin(i * 0.7) * 40 + Math.random() * 30}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Trim controls */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-6fb-text-muted uppercase mb-1 block">Start</label>
                <input
                  type="range"
                  min={0}
                  max={duration - 1}
                  value={trimStart}
                  onChange={e => {
                    const v = Number(e.target.value);
                    if (v < trimEnd) setTrimStart(v);
                  }}
                  className="w-full accent-6fb-green"
                />
              </div>
              <div>
                <label className="text-[10px] text-6fb-text-muted uppercase mb-1 block">End</label>
                <input
                  type="range"
                  min={1}
                  max={duration}
                  value={trimEnd}
                  onChange={e => {
                    const v = Number(e.target.value);
                    if (v > trimStart) setTrimEnd(v);
                  }}
                  className="w-full accent-6fb-green"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Control Panels */}
        <div>
          {/* Panel Tabs */}
          <div className="grid grid-cols-4 gap-1 mb-4 bg-6fb-card rounded-xl border border-6fb-border p-1">
            {PANELS.map(p => (
              <button
                key={p.id}
                onClick={() => setActivePanel(p.id)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  activePanel === p.id
                    ? 'bg-6fb-green/10 text-6fb-green'
                    : 'text-6fb-text-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-sm">{p.icon}</span>
                <span className="text-[10px]">{p.label}</span>
              </button>
            ))}
          </div>

          {/* Caption Panel */}
          {activePanel === 'caption' && (
            <div className="bg-6fb-card rounded-xl border border-6fb-border p-5 space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-white">Caption Overlay</h3>

              <div>
                <label className="text-[10px] text-6fb-text-muted uppercase tracking-wider mb-1.5 block">Text</label>
                <textarea
                  value={caption.text}
                  onChange={e => setCaption({ ...caption, text: e.target.value })}
                  placeholder="Your caption text..."
                  rows={3}
                  className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-white text-sm placeholder-6fb-text-muted focus:outline-none focus:border-6fb-green transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-6fb-text-muted uppercase tracking-wider mb-1.5 block">Color</label>
                <div className="flex gap-2">
                  {CAPTION_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setCaption({ ...caption, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        caption.color === c ? 'border-white scale-110' : 'border-6fb-border hover:border-6fb-text-muted'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-6fb-text-muted uppercase tracking-wider mb-1.5 block">Position</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['top', 'center', 'bottom'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => setCaption({ ...caption, position: pos })}
                      className={`py-2 rounded-lg border text-xs font-medium transition-all capitalize ${
                        caption.position === pos
                          ? 'border-6fb-green bg-6fb-green/10 text-6fb-green'
                          : 'border-6fb-border text-6fb-text-secondary hover:border-6fb-text-muted'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-6fb-text-muted uppercase tracking-wider mb-1.5 block">Weight</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['normal', 'bold', 'extrabold'] as const).map(w => (
                    <button
                      key={w}
                      onClick={() => setCaption({ ...caption, fontWeight: w })}
                      className={`py-2 rounded-lg border text-xs transition-all capitalize ${
                        caption.fontWeight === w
                          ? 'border-6fb-green bg-6fb-green/10 text-6fb-green'
                          : 'border-6fb-border text-6fb-text-secondary hover:border-6fb-text-muted'
                      }`}
                      style={{ fontWeight: w === 'extrabold' ? 800 : w === 'bold' ? 700 : 400 }}
                    >
                      {w === 'extrabold' ? 'Heavy' : w.charAt(0).toUpperCase() + w.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-6fb-text-muted uppercase tracking-wider">BG Opacity</label>
                  <span className="text-[10px] text-6fb-text-secondary font-mono">{caption.bgOpacity}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={caption.bgOpacity}
                  onChange={e => setCaption({ ...caption, bgOpacity: Number(e.target.value) })}
                  className="w-full accent-6fb-green"
                />
              </div>
            </div>
          )}

          {/* Transition Panel */}
          {activePanel === 'transition' && (
            <div className="bg-6fb-card rounded-xl border border-6fb-border p-5 space-y-3 animate-fade-in">
              <h3 className="text-sm font-bold text-white">Transitions</h3>
              {TRANSITIONS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTransition(t.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                    transition === t.id
                      ? 'border-6fb-green bg-6fb-green/10'
                      : 'border-6fb-border hover:border-6fb-text-muted'
                  }`}
                >
                  <span className="text-xl">{t.icon}</span>
                  <div>
                    <p className={`text-sm font-medium ${transition === t.id ? 'text-6fb-green' : 'text-white'}`}>
                      {t.name}
                    </p>
                    <p className="text-[10px] text-6fb-text-muted">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Music Panel */}
          {activePanel === 'music' && (
            <div className="bg-6fb-card rounded-xl border border-6fb-border p-5 space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-white">Background Music</h3>

              {!musicPath ? (
                <button
                  onClick={handleSelectMusic}
                  className="w-full border-2 border-dashed border-6fb-border rounded-xl p-6 flex flex-col items-center hover:border-6fb-green/50 hover:bg-6fb-green/5 transition-all group"
                >
                  <span className="text-2xl mb-2">🎵</span>
                  <p className="text-xs text-6fb-text-secondary group-hover:text-white transition-colors">
                    Select audio file
                  </p>
                </button>
              ) : (
                <div className="bg-6fb-bg border border-6fb-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span>🎵</span>
                      <p className="text-xs text-white truncate max-w-[180px]">
                        {musicPath.split('/').pop()}
                      </p>
                    </div>
                    <button
                      onClick={() => setMusicPath('')}
                      className="text-xs text-6fb-text-muted hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-6fb-text-muted uppercase">Volume</label>
                      <span className="text-[10px] text-6fb-text-secondary font-mono">{musicVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={musicVolume}
                      onChange={e => setMusicVolume(Number(e.target.value))}
                      className="w-full accent-6fb-green"
                    />
                  </div>
                </div>
              )}

              <p className="text-[10px] text-6fb-text-muted">Supported: MP3, WAV, AAC, M4A</p>
            </div>
          )}

          {/* Format Panel */}
          {activePanel === 'format' && (
            <div className="bg-6fb-card rounded-xl border border-6fb-border p-5 space-y-3 animate-fade-in">
              <h3 className="text-sm font-bold text-white">Output Format</h3>
              {ASPECT_RATIOS.map(ar => (
                <button
                  key={ar.format}
                  onClick={() => setOutputFormat(ar.format)}
                  className={`w-full flex items-center gap-4 p-3 rounded-lg border text-left transition-all ${
                    outputFormat === ar.format
                      ? 'border-6fb-green bg-6fb-green/10'
                      : 'border-6fb-border hover:border-6fb-text-muted'
                  }`}
                >
                  {/* Mini aspect preview */}
                  <div className={`rounded border ${
                    outputFormat === ar.format ? 'border-6fb-green bg-6fb-green/5' : 'border-6fb-border bg-6fb-bg'
                  } flex items-center justify-center ${
                    ar.format === '9x16' ? 'w-6 h-10' : ar.format === '1x1' ? 'w-8 h-8' : 'w-12 h-7'
                  }`}>
                    <span className="text-[8px] text-6fb-text-muted">{ar.label}</span>
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${outputFormat === ar.format ? 'text-6fb-green' : 'text-white'}`}>
                      {ar.label}
                    </p>
                    <p className="text-[10px] text-6fb-text-muted">{ar.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Output Directory */}
          <div className="mt-4 bg-6fb-card rounded-xl border border-6fb-border p-4">
            <label className="text-[10px] text-6fb-text-muted uppercase tracking-wider mb-2 block">Output Directory</label>
            <button
              onClick={handleSelectOutputDir}
              className="w-full text-left bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-xs hover:border-6fb-green/50 transition-colors"
            >
              {outputDir ? (
                <span className="text-white truncate block">{outputDir}</span>
              ) : (
                <span className="text-6fb-text-muted">Default (App Data) — click to change</span>
              )}
            </button>
          </div>

          {/* Progress Bar */}
          {progress && (
            <div className="mt-3 bg-6fb-card rounded-xl border border-6fb-border p-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-6fb-text-secondary">{progress.label}</p>
                <p className="text-xs text-6fb-green font-mono">{Math.round(progress.percent)}%</p>
              </div>
              <div className="w-full h-2 bg-6fb-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-6fb-green to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={!clipPath || exporting}
            className="w-full mt-3 bg-6fb-green hover:bg-6fb-green-hover disabled:bg-6fb-border disabled:text-6fb-text-muted text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Rendering...
              </>
            ) : (
              <>🚀 Export Video</>
            )}
          </button>

          {/* Export result */}
          {exportResult && (
            <div className={`mt-3 rounded-lg p-3 text-xs ${
              exportResult.success
                ? 'bg-6fb-green/10 border border-6fb-green/20 text-6fb-green'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}>
              <p>{exportResult.message}</p>
              {exportResult.success && exportResult.outputPath && (
                <button
                  onClick={() => window.electronAPI.openPath(exportResult.outputPath!.split('/').slice(0, -1).join('/'))}
                  className="mt-2 text-[10px] underline hover:text-white transition-colors"
                >
                  Open in Finder
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
