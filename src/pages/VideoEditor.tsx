import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────
type OutputFormat = '9x16' | '1x1' | '16x9';
type CaptionPosition = 'top' | 'center' | 'bottom';
type FontWeight = 'normal' | 'bold' | 'extrabold';

interface Caption {
  text: string;
  fontWeight: FontWeight;
  fontSize: number;
  color: string;
  position: CaptionPosition;
  bgOpacity: number;
}

interface LibraryClip {
  clipId: string;
  title: string;
  filePath: string | null;
  thumbnailPath: string | null;
  contentType: string;
  duration?: number;
  specPath?: string;
}

interface LibraryRun {
  runId: string;
  timestamp: number;
  sourceVideo: string;
  clips: LibraryClip[];
}

// ─── Constants ───────────────────────────────────────────────────────
const CAPTION_COLORS = ['#FFFFFF', '#FFFF00', '#00C851', '#FF6B6B', '#60A5FA', '#E879F9'];

const FORMATS: { id: OutputFormat; label: string; desc: string; w: number; h: number }[] = [
  { id: '9x16',  label: '9:16',  desc: 'Reels / TikTok / Shorts', w: 3, h: 5 },
  { id: '1x1',   label: '1:1',   desc: 'Instagram Feed',          w: 4, h: 4 },
  { id: '16x9',  label: '16:9',  desc: 'YouTube / Landscape',     w: 6, h: 3.5 },
];

// ─── Helpers ─────────────────────────────────────────────────────────
const fmtTime = (s: number) => {
  if (isNaN(s) || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
};

const fmtDate = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── Main Component ───────────────────────────────────────────────────
export default function VideoEditor({ initialClipPath }: { initialClipPath?: string | null } = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Clip state
  const [clipPath, setClipPath] = useState(initialClipPath || '');
  const [clipTitle, setClipTitle] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Trim
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Edit options
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('9x16');
  const [caption, setCaption] = useState<Caption>({
    text: '', fontWeight: 'bold', fontSize: 56, color: '#FFFFFF', position: 'bottom', bgOpacity: 65,
  });
  const [musicPath, setMusicPath] = useState('');
  const [musicVolume, setMusicVolume] = useState(0.4);
  const [outputDir, setOutputDir] = useState('');

  // Panel
  const [panel, setPanel] = useState<'caption' | 'music' | 'format' | 'transcript'>('caption');

  // Transcript
  const [transcript, setTranscript] = useState<{ word: string; start: number; end: number }[] | null>(null);
  const [deletedWords, setDeletedWords] = useState<Set<number>>(new Set());

  // Library
  const [runs, setRuns] = useState<LibraryRun[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  // Export
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; label: string } | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; outputPath?: string } | null>(null);

  // Load library on mount
  useEffect(() => {
    loadLibrary();
    const cleanup = window.electronAPI.onProgress(p => setProgress(p));
    return () => { cleanup?.(); };
  }, []);

  // Auto-load clip if passed via props
  useEffect(() => {
    if (initialClipPath) openClip(initialClipPath);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialClipPath]);

  const loadLibrary = async () => {
    setLibraryLoading(true);
    try {
      const r = await window.electronAPI.scanLibrary() as { runs: LibraryRun[] };
      setRuns(r.runs || []);
      // Auto-expand the most recent run
      if (r.runs?.length > 0) {
        setExpandedRuns(new Set([r.runs[0].runId]));
      }
    } catch { setRuns([]); }
    setLibraryLoading(false);
  };

  const openClip = async (path: string, title?: string) => {
    setClipPath(path);
    setClipTitle(title || path.split('/').pop() || '');
    setPlaying(false);
    setCurrentTime(0);
    setTrimStart(0);
    setResult(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    try {
      const ts = await window.electronAPI.readClipTranscript(path);
      setTranscript(ts);
      setDeletedWords(new Set());
    } catch {
      setTranscript(null);
    }
  };

  const handlePickFile = async () => {
    const r = await window.electronAPI.selectVideo();
    if (!r.cancelled && r.filePath) openClip(r.filePath);
  };

  const handleVideoLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = isFinite(v.duration) ? v.duration : 0;
    setDuration(d);
    setTrimEnd(d);
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !clipPath) return;
    if (v.paused) {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) v.currentTime = trimStart;
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [clipPath, trimStart, trimEnd]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.currentTime >= trimEnd && !v.paused) v.currentTime = trimStart;
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    setCurrentTime(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const toggleRun = (runId: string) => {
    setExpandedRuns(prev => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  const handleExport = async () => {
    if (!clipPath || exporting) return;
    setExporting(true);
    setResult(null);
    setProgress({ percent: 0, label: 'Preparing…' });

    let cuts: { start: number; end: number }[] | undefined = undefined;
    if (transcript && deletedWords.size > 0) {
      cuts = [];
      let currentCutStart = trimStart;
      let inDeletedRegion = false;
      const finalEnd = trimEnd || duration;
      transcript.forEach((w, i) => {
        if (w.start < trimStart || w.end > finalEnd) return;
        const isDeleted = deletedWords.has(i);
        if (isDeleted && !inDeletedRegion) {
          if (w.start > currentCutStart) cuts!.push({ start: currentCutStart, end: w.start });
          inDeletedRegion = true;
        } else if (!isDeleted && inDeletedRegion) {
          currentCutStart = w.start;
          inDeletedRegion = false;
        }
      });
      if (!inDeletedRegion && currentCutStart < finalEnd) cuts.push({ start: currentCutStart, end: finalEnd });
    }

    try {
      const r = await window.electronAPI.renderVideo('clip-editor', {
        clipPath, trimStart, trimEnd: trimEnd || duration,
        outputFormat, caption: caption.text ? caption : null,
        music: musicPath ? { path: musicPath, volume: musicVolume } : null,
        outputDir: outputDir || undefined, cuts,
      }) as { success: boolean; outputPath?: string; error?: string };

      if (r.success) {
        setResult({ success: true, message: r.outputPath?.split('/').pop() || 'Done!', outputPath: r.outputPath });
      } else {
        setResult({ success: false, message: r.error || 'Export failed' });
      }
    } catch (e) {
      setResult({ success: false, message: String(e) });
    }
    setProgress(null);
    setExporting(false);
  };

  const cpPos = { top: 'top-4', center: 'top-1/2 -translate-y-1/2', bottom: 'bottom-4' }[caption.position];
  const previewStyle = outputFormat === '9x16' ? 'aspect-[9/16] max-h-[400px]'
    : outputFormat === '1x1' ? 'aspect-square max-h-[340px]'
    : 'aspect-video w-full max-h-[260px]';

  return (
    <div className="h-full flex overflow-hidden bg-[#0f0f0f]">

      {/* ─── LEFT: Clip Library ─────────────────────────────────── */}
      <div className="w-[220px] shrink-0 flex flex-col border-r border-[#1a1a1a] bg-[#0a0a0a]">
        {/* Header */}
        <div className="shrink-0 px-3 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-white">Clip Library</p>
            <p className="text-[9px] text-[#444] mt-0.5">{runs.reduce((a, r) => a + r.clips.length, 0)} clips</p>
          </div>
          <button onClick={loadLibrary}
            className="w-6 h-6 flex items-center justify-center text-[#444] hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path strokeLinecap="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>

        {/* Runs list */}
        <div className="flex-1 overflow-y-auto">
          {libraryLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 border border-[#333] border-t-[#00C851] rounded-full animate-spin" />
            </div>
          ) : runs.length === 0 ? (
            <div className="p-4 text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={1.5} className="w-8 h-8 mx-auto mb-2">
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
              <p className="text-[10px] text-[#444]">No clips yet</p>
              <p className="text-[9px] text-[#333] mt-1">Use Clip Extractor first</p>
            </div>
          ) : (
            <div className="py-1">
              {runs.map(run => {
                const isExpanded = expandedRuns.has(run.runId);
                const sourceName = run.sourceVideo?.replace(/\.[^.]+$/, '') || 'Unknown';
                return (
                  <div key={run.runId}>
                    {/* Run header */}
                    <button
                      onClick={() => toggleRun(run.runId)}
                      className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-white/5 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth={2}
                        className={`w-3 h-3 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[10px] font-semibold text-[#666] truncate">{sourceName}</p>
                        <p className="text-[8px] text-[#333]">{fmtDate(run.timestamp)} · {run.clips.length} clips</p>
                      </div>
                    </button>

                    {/* Clips in run */}
                    {isExpanded && (
                      <div className="pb-1">
                        {run.clips.filter(c => c.filePath).map(clip => {
                          const isActive = clipPath === clip.filePath;
                          return (
                            <button
                              key={clip.clipId}
                              onClick={() => openClip(clip.filePath!, clip.title)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 transition-all ${
                                isActive ? 'bg-[#00C851]/10 border-l-2 border-[#00C851]' : 'pl-[13px] hover:bg-white/5 border-l-2 border-transparent'
                              }`}
                            >
                              {/* Thumbnail */}
                              <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-[#141414]">
                                {clip.thumbnailPath ? (
                                  <img src={`localfile://${clip.thumbnailPath}`} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={1.5} className="w-3.5 h-3.5">
                                      <polygon points="5 3 19 12 5 21 5 3"/>
                                    </svg>
                                  </div>
                                )}
                              </div>
                              {/* Info */}
                              <div className="flex-1 min-w-0 text-left">
                                <p className={`text-[10px] font-medium truncate leading-tight ${isActive ? 'text-[#00C851]' : 'text-[#888]'}`}>
                                  {clip.title || 'Untitled'}
                                </p>
                                {clip.duration && (
                                  <p className="text-[8px] text-[#444]">{fmtTime(clip.duration)}</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Browse external file */}
        <div className="shrink-0 p-3 border-t border-[#1a1a1a]">
          <button onClick={handlePickFile}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#222] text-[10px] text-[#555] hover:text-white hover:border-[#333] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
              <path strokeLinecap="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            Browse file…
          </button>
        </div>
      </div>

      {/* ─── CENTER: Player + Timeline ─────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-[#1a1a1a]">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
          <div>
            <h1 className="text-sm font-bold text-white">Video Editor</h1>
            <p className="text-[10px] text-[#444] mt-0.5 truncate max-w-[280px]">
              {clipTitle || 'Select a clip from the library'}
            </p>
          </div>
          {clipPath && (
            <button
              onClick={() => (window.electronAPI as any).showInFinder?.(clipPath)}
              className="flex items-center gap-1 text-[10px] text-[#555] hover:text-white transition-colors px-2 py-1 rounded border border-transparent hover:border-[#222]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                <path strokeLinecap="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
              </svg>
              Show in Finder
            </button>
          )}
        </div>

        {/* Video player */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-4 bg-black">
          {!clipPath ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={1} strokeLinecap="round" className="w-8 h-8">
                  <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#444]">Pick a clip from the library</p>
                <p className="text-xs text-[#333] mt-1">Or browse a file below</p>
              </div>
            </div>
          ) : (
            <div className={`relative ${previewStyle} overflow-hidden rounded-xl bg-black`}>
              <video
                ref={videoRef}
                src={`localfile://${clipPath}`}
                className="w-full h-full object-cover"
                onLoadedMetadata={handleVideoLoaded}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setPlaying(false)}
                muted={!!musicPath}
              />
              {/* Caption overlay */}
              {caption.text && (
                <div className={`absolute left-3 right-3 ${cpPos} flex justify-center`}>
                  <div className="px-3 py-1.5 rounded-lg text-center max-w-[90%]"
                    style={{
                      background: `rgba(0,0,0,${caption.bgOpacity / 100})`,
                      color: caption.color,
                      fontSize: `${Math.max(10, Math.round(caption.fontSize / 5))}px`,
                      fontWeight: caption.fontWeight === 'extrabold' ? 900 : caption.fontWeight === 'bold' ? 700 : 400,
                    }}>
                    {caption.text}
                  </div>
                </div>
              )}
              {/* Play/pause overlay */}
              <button onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
                <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                  {playing
                    ? <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    : <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  }
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Timeline */}
        {clipPath && duration > 0 && (
          <div className="shrink-0 border-t border-[#1a1a1a] px-4 py-3 bg-[#0a0a0a] space-y-3">
            {/* Seek bar */}
            <div className="relative">
              <div className="absolute top-0 bottom-0 rounded-full bg-[#00C851]/20 pointer-events-none"
                style={{ left: `${(trimStart / duration) * 100}%`, width: `${((trimEnd - trimStart) / duration) * 100}%` }} />
              <input type="range" min={0} max={duration} step={0.05} value={currentTime}
                onChange={handleScrub}
                className="w-full h-1.5 appearance-none rounded-full cursor-pointer relative z-10"
                style={{ background: `linear-gradient(to right, #00C851 ${(currentTime / duration) * 100}%, #1a1a1a ${(currentTime / duration) * 100}%)` }} />
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#444]">{fmtTime(currentTime)}</span>
              <button onClick={togglePlay}
                className="w-8 h-8 rounded-full border border-[#2a2a2a] bg-[#141414] flex items-center justify-center text-white hover:border-[#00C851]/40 transition-colors">
                {playing
                  ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  : <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                }
              </button>
              <span className="text-[10px] font-mono text-[#444]">{fmtTime(duration)}</span>
            </div>

            {/* Trim */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#444]">Trim in</p>
                  <span className="text-[9px] font-mono text-[#00C851]">{fmtTime(trimStart)}</span>
                </div>
                <input type="range" min={0} max={duration - 0.1} step={0.05} value={trimStart}
                  onChange={e => { const v = Number(e.target.value); if (v < trimEnd - 0.5) { setTrimStart(v); if (videoRef.current) videoRef.current.currentTime = v; } }}
                  className="w-full accent-[#00C851]" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#444]">Trim out</p>
                  <span className="text-[9px] font-mono text-[#00C851]">{fmtTime(trimEnd)}</span>
                </div>
                <input type="range" min={0.1} max={duration} step={0.05} value={trimEnd}
                  onChange={e => { const v = Number(e.target.value); if (v > trimStart + 0.5) { setTrimEnd(v); if (videoRef.current) videoRef.current.currentTime = v; } }}
                  className="w-full accent-[#00C851]" />
              </div>
            </div>
            <p className="text-[9px] text-[#333] text-center">
              {fmtTime(trimEnd - trimStart)} selected of {fmtTime(duration)}
            </p>
          </div>
        )}
      </div>

      {/* ─── RIGHT: Edit Controls ───────────────────────────────── */}
      <div className="w-[280px] shrink-0 flex flex-col border-l border-[#1a1a1a] overflow-y-auto">

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-[#1a1a1a]">
          {([
            { id: 'caption',    label: 'Captions' },
            { id: 'music',      label: 'Music' },
            { id: 'format',     label: 'Format' },
            { id: 'transcript', label: 'Script' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setPanel(t.id)}
              className={`flex-1 py-2.5 text-[10px] font-semibold transition-colors border-b-2 ${
                panel === t.id ? 'text-white border-[#00C851]' : 'text-[#444] border-transparent hover:text-[#666]'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 space-y-4">
          {/* ── Caption Panel ── */}
          {panel === 'caption' && (
            <>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#444] mb-1.5">Text</p>
                <textarea value={caption.text} onChange={e => setCaption(c => ({ ...c, text: e.target.value }))}
                  placeholder="Add a caption to your video…" rows={3}
                  className="w-full bg-black border border-[#222] rounded-xl px-3 py-2 text-xs text-white placeholder-[#333] resize-none focus:outline-none focus:border-[#00C851]/40 transition-colors" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#444] mb-2">Color</p>
                <div className="flex gap-1.5">
                  {CAPTION_COLORS.map(c => (
                    <button key={c} onClick={() => setCaption(cap => ({ ...cap, color: c }))}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${caption.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#444] mb-2">Position</p>
                <div className="grid grid-cols-3 gap-1">
                  {(['top', 'center', 'bottom'] as const).map(pos => (
                    <button key={pos} onClick={() => setCaption(c => ({ ...c, position: pos }))}
                      className={`py-1.5 rounded-lg border text-[10px] font-semibold capitalize transition-all ${
                        caption.position === pos ? 'border-[#00C851]/50 bg-[#00C851]/10 text-[#00C851]' : 'border-[#1e1e1e] text-[#444] hover:text-white hover:border-[#2a2a2a]'
                      }`}>
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#444] mb-2">Weight</p>
                <div className="grid grid-cols-3 gap-1">
                  {([['normal', 'Regular'], ['bold', 'Bold'], ['extrabold', 'Heavy']] as const).map(([w, label]) => (
                    <button key={w} onClick={() => setCaption(c => ({ ...c, fontWeight: w }))}
                      className={`py-1.5 rounded-lg border text-[10px] transition-all ${
                        caption.fontWeight === w ? 'border-[#00C851]/50 bg-[#00C851]/10 text-[#00C851]' : 'border-[#1e1e1e] text-[#444] hover:text-white hover:border-[#2a2a2a]'
                      }`}
                      style={{ fontWeight: w === 'extrabold' ? 800 : w === 'bold' ? 700 : 400 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#444]">BG Opacity</p>
                  <span className="text-[9px] font-mono text-[#555]">{caption.bgOpacity}%</span>
                </div>
                <input type="range" min={0} max={100} value={caption.bgOpacity}
                  onChange={e => setCaption(c => ({ ...c, bgOpacity: Number(e.target.value) }))}
                  className="w-full accent-[#00C851]" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#444]">Font Size</p>
                  <span className="text-[9px] font-mono text-[#555]">{caption.fontSize}px</span>
                </div>
                <input type="range" min={24} max={120} value={caption.fontSize}
                  onChange={e => setCaption(c => ({ ...c, fontSize: Number(e.target.value) }))}
                  className="w-full accent-[#00C851]" />
              </div>
            </>
          )}

          {/* ── Music Panel ── */}
          {panel === 'music' && (
            <>
              <p className="text-[10px] text-[#444]">Add background music mixed with your video audio.</p>
              {!musicPath ? (
                <button onClick={async () => {
                  const r = await window.electronAPI.selectVideo();
                  if (!r.cancelled && r.filePath) setMusicPath(r.filePath);
                }}
                  className="w-full border border-dashed border-[#1e1e1e] rounded-xl p-6 flex flex-col items-center gap-2 hover:border-[#00C851]/30 transition-colors group">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={1.5} strokeLinecap="round" className="w-7 h-7 group-hover:stroke-[#00C851] transition-colors">
                    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                  </svg>
                  <p className="text-xs text-[#444] group-hover:text-white transition-colors">Select audio file</p>
                  <p className="text-[9px] text-[#333]">MP3, AAC, WAV, M4A</p>
                </button>
              ) : (
                <div className="border border-[#1e1e1e] rounded-xl p-3 bg-black/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#00C851]/10 border border-[#00C851]/20 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth={1.5} strokeLinecap="round" className="w-4 h-4">
                        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                    <p className="text-xs text-white flex-1 truncate">{musicPath.split('/').pop()}</p>
                    <button onClick={() => setMusicPath('')} className="text-[#444] hover:text-red-400 transition-colors shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#444]">Volume</p>
                    <span className="text-[9px] font-mono text-[#555]">{Math.round(musicVolume * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.01} value={musicVolume}
                    onChange={e => setMusicVolume(Number(e.target.value))}
                    className="w-full accent-[#00C851]" />
                </div>
              )}
            </>
          )}

          {/* ── Format Panel ── */}
          {panel === 'format' && (
            <>
              <p className="text-[9px] text-[#444]">Output aspect ratio — video will be scaled and cropped.</p>
              <div className="flex flex-col gap-2">
                {FORMATS.map(f => (
                  <button key={f.id} onClick={() => setOutputFormat(f.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      outputFormat === f.id ? 'border-[#00C851]/40 bg-[#00C851]/7' : 'border-[#1e1e1e] hover:border-[#2a2a2a]'
                    }`}>
                    <div className={`rounded border shrink-0 flex items-center justify-center ${outputFormat === f.id ? 'border-[#00C851]/40' : 'border-[#2a2a2a]'}`}
                      style={{ width: f.w * 6, height: f.h * 6, background: outputFormat === f.id ? 'rgba(0,200,81,0.1)' : '#141414' }}>
                      <span className="text-[7px] text-[#555]">{f.label}</span>
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${outputFormat === f.id ? 'text-[#00C851]' : 'text-white'}`}>{f.label}</p>
                      <p className="text-[9px] text-[#444]">{f.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#444] mb-2">Output folder</p>
                <button onClick={async () => {
                  const r = await window.electronAPI.selectOutputDir();
                  if (!r.cancelled && r.dirPath) setOutputDir(r.dirPath);
                }}
                  className="w-full text-left bg-black border border-[#1e1e1e] rounded-xl px-3 py-2 text-[10px] hover:border-[#2a2a2a] transition-colors">
                  {outputDir
                    ? <span className="text-white truncate block">{outputDir.split('/').slice(-2).join('/')}</span>
                    : <span className="text-[#333]">Downloads (default)</span>
                  }
                </button>
              </div>
            </>
          )}

          {/* ── Transcript Panel ── */}
          {panel === 'transcript' && (
            <div className="space-y-4">
              {transcript ? (
                <>
                  <p className="text-[10px] text-[#555]">Click words to remove them from the exported video.</p>
                  <div className="bg-[#111] p-3 rounded-xl border border-[#222] leading-relaxed text-sm">
                    {transcript.map((w, i) => {
                      const isActive = currentTime >= w.start && currentTime <= w.end;
                      const isDeleted = deletedWords.has(i);
                      return (
                        <span key={i}
                          className={`mr-1 transition-colors select-none cursor-pointer ${
                            isDeleted ? 'line-through text-red-500/50 hover:text-red-400/80 bg-red-500/5'
                            : isActive ? 'text-[#00C851] font-bold bg-[#00C851]/10 rounded px-0.5'
                            : 'text-[#888] hover:text-white'
                          }`}
                          onClick={() => {
                            setDeletedWords(prev => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i); else next.add(i);
                              return next;
                            });
                            if (!isDeleted && videoRef.current) {
                              videoRef.current.currentTime = w.start;
                              setCurrentTime(w.start);
                            }
                          }}>
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                  {deletedWords.size > 0 && (
                    <button onClick={() => setDeletedWords(new Set())}
                      className="text-[10px] text-[#555] hover:text-white transition-colors underline">
                      Clear {deletedWords.size} removed word{deletedWords.size !== 1 ? 's' : ''}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center p-8 bg-[#111] rounded-xl border border-[#222]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 mx-auto mb-3">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                  </svg>
                  <p className="text-sm font-medium text-[#555]">No transcript</p>
                  <p className="text-[10px] text-[#444] mt-1">Load a clip from the Clip Extractor library to use text-based editing.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export */}
        <div className="shrink-0 p-4 border-t border-[#1a1a1a]">
          {progress && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-[#555]">{progress.label}</p>
                <p className="text-[10px] font-mono text-[#00C851]">{Math.round(progress.percent)}%</p>
              </div>
              <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%`, background: 'linear-gradient(to right, #00C851, #00ff73)' }} />
              </div>
            </div>
          )}
          {result && !progress && (
            <div className={`mb-3 rounded-xl px-3 py-2 text-[10px] ${
              result.success ? 'bg-[#00C851]/10 border border-[#00C851]/20 text-[#00C851]' : 'bg-red-900/20 border border-red-800/30 text-red-400'
            }`}>
              <p className="font-semibold">{result.success ? '✓ Exported' : '✕ Failed'}</p>
              <p className="mt-0.5 opacity-80 truncate">{result.message}</p>
              {result.success && result.outputPath && (
                <button
                  onClick={() => (window.electronAPI as any).showInFinder?.(result.outputPath!)}
                  className="mt-1.5 text-[9px] underline opacity-70 hover:opacity-100 transition-opacity">
                  Show in Finder
                </button>
              )}
            </div>
          )}
          <button onClick={handleExport} disabled={!clipPath || exporting}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: !clipPath || exporting ? '#1a1a1a' : '#00C851', color: !clipPath || exporting ? '#444' : 'black' }}>
            {exporting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Rendering…
              </span>
            ) : 'Export Video'}
          </button>
          <p className="text-[9px] text-[#333] text-center mt-1.5">
            Saves to {outputDir ? outputDir.split('/').pop() : 'Downloads'}
          </p>
        </div>
      </div>
    </div>
  );
}
