import { useState, useRef, useEffect, useCallback } from 'react';

type OutputFormat = '9x16' | '1x1' | '16x9';
interface Segment { id: string; start: number; end: number; }
interface LibraryRun { runId: string; timestamp: number; sourceVideo: string; clips: LibraryClip[]; }
interface LibraryClip { clipId: string; title: string; filePath: string | null; thumbnailPath: string | null; duration?: number; }

let _id = 0;
const uid = () => `s${_id++}`;
const fmt = (s: number) => { if (!isFinite(s)) return '0:00'; const m = Math.floor(s/60); return `${m}:${String(Math.floor(s%60)).padStart(2,'0')}`; };
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric'});

const FORMATS: {id:OutputFormat;label:string;desc:string}[] = [
  {id:'9x16',label:'9:16',desc:'Reels / TikTok / Shorts'},
  {id:'1x1',label:'1:1',desc:'Instagram Feed'},
  {id:'16x9',label:'16:9',desc:'YouTube / Landscape'},
];

// ─── Timeline ─────────────────────────────────────────────────────────────
function Timeline({ segments, duration, currentTime, selectedId, onSeek, onSelect }:{
  segments: Segment[]; duration: number; currentTime: number; selectedId: string | null;
  onSeek:(t:number)=>void; onSelect:(id:string|null)=>void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const getTime = (e: React.MouseEvent | MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(((e.clientX - r.left) / r.width) * duration, duration));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    onSeek(getTime(e));
  };

  useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) onSeek(getTime(e)); };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [duration]); // eslint-disable-line

  // Ruler ticks
  const step = duration <= 30 ? 5 : duration <= 120 ? 15 : 30;
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += step) ticks.push(t);

  return (
    <div className="shrink-0 border-t border-[#1a1a1a] bg-[#080808] select-none">
      {/* Ruler */}
      <div className="relative h-5 border-b border-[#1a1a1a] mx-4">
        {ticks.map(t => (
          <div key={t} style={{left:`${(t/duration)*100}%`}} className="absolute top-0 flex flex-col items-center">
            <div className="w-px h-2 bg-[#2a2a2a]"/>
            <span className="text-[8px] text-[#444] mt-0.5">{fmt(t)}</span>
          </div>
        ))}
      </div>

      {/* Track */}
      <div ref={ref} onMouseDown={onMouseDown}
        className="relative h-12 mx-4 my-2 bg-[#111] rounded-lg overflow-hidden cursor-crosshair">
        {/* Gap background */}
        <div className="absolute inset-0 bg-[#0a0a0a]"/>

        {/* Segments */}
        {segments.map(seg => {
          const l = (seg.start / duration) * 100;
          const w = ((seg.end - seg.start) / duration) * 100;
          const isSelected = seg.id === selectedId;
          return (
            <div key={seg.id}
              onClick={e => { e.stopPropagation(); onSelect(seg.id === selectedId ? null : seg.id); }}
              style={{ left:`${l}%`, width:`${w}%` }}
              className={`absolute top-1 bottom-1 rounded cursor-pointer transition-colors ${
                isSelected ? 'bg-[#00C851] ring-1 ring-white/30' : 'bg-[#00C851]/40 hover:bg-[#00C851]/60'
              }`}
            />
          );
        })}

        {/* Playhead */}
        <div style={{ left:`${(currentTime/duration)*100}%` }}
          className="absolute top-0 bottom-0 w-0.5 bg-white z-10 pointer-events-none">
          <div className="absolute -top-0.5 -left-1 w-2 h-2 bg-white rounded-sm"/>
        </div>
      </div>

      {/* Time display */}
      <div className="flex items-center justify-between px-4 pb-2">
        <span className="text-[10px] font-mono text-[#555]">{fmt(currentTime)}</span>
        <span className="text-[10px] font-mono text-[#444]">
          {fmt(segments.reduce((a,s)=>a+(s.end-s.start),0))} kept / {fmt(duration)}
        </span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function VideoEditor({ initialClipPath }: { initialClipPath?: string | null } = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const segRef = useRef<Segment[]>([]);

  const [clipPath, setClipPath] = useState(initialClipPath || '');
  const [clipTitle, setClipTitle] = useState('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegId, setSelectedSegId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Segment[][]>([]);
  const [transcript, setTranscript] = useState<{word:string;start:number;end:number}[]|null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('9x16');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{percent:number;label:string}|null>(null);
  const [exportResult, setExportResult] = useState<{success:boolean;message:string;outputPath?:string}|null>(null);
  const [runs, setRuns] = useState<LibraryRun[]>([]);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [libraryLoading, setLibraryLoading] = useState(false);

  segRef.current = segments;

  useEffect(() => {
    loadLibrary();
    const cleanup = window.electronAPI.onProgress(p => setExportProgress(p));
    return () => cleanup?.();
  }, []);

  useEffect(() => { if (initialClipPath) openClip(initialClipPath); }, [initialClipPath]); // eslint-disable-line

  const loadLibrary = async () => {
    setLibraryLoading(true);
    try {
      const r = await window.electronAPI.scanLibrary() as {runs:LibraryRun[]};
      setRuns(r.runs || []);
      if (r.runs?.length) setExpandedRuns(new Set([r.runs[0].runId]));
    } catch { setRuns([]); }
    setLibraryLoading(false);
  };

  const openClip = async (path: string, title?: string) => {
    setClipPath(path);
    setClipTitle(title || path.split('/').pop() || '');
    setPlaying(false); setCurrentTime(0); setSegments([]); setSelectedSegId(null); setExportResult(null); setUndoStack([]);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
    try { setTranscript(await window.electronAPI.readClipTranscript(path)); } catch { setTranscript(null); }
  };

  const handleVideoLoaded = () => {
    const d = isFinite(videoRef.current?.duration||0) ? videoRef.current!.duration : 0;
    setDuration(d);
    setSegments([{id:uid(), start:0, end:d}]);
  };

  const seekTo = useCallback((t: number) => {
    const clamped = Math.max(0, Math.min(t, duration));
    setCurrentTime(clamped);
    if (videoRef.current) videoRef.current.currentTime = clamped;
  }, [duration]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !clipPath) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  }, [clipPath]);

  const handleTimeUpdate = () => {
    const v = videoRef.current; if (!v) return;
    setCurrentTime(v.currentTime);
  };

  // Undo/segment helpers
  const pushUndo = () => setUndoStack(u => [...u.slice(-29), [...segRef.current]]);

  const removeRange = useCallback((start: number, end: number) => {
    pushUndo();
    setSegments(segs => {
      const result: Segment[] = [];
      for (const seg of segs) {
        if (end <= seg.start || start >= seg.end) { result.push(seg); continue; }
        if (start > seg.start) result.push({id:uid(), start:seg.start, end:start});
        if (end < seg.end) result.push({id:uid(), start:end, end:seg.end});
      }
      return result;
    });
  }, []); // eslint-disable-line

  const splitAtPlayhead = useCallback(() => {
    const t = videoRef.current?.currentTime ?? currentTime;
    const seg = segRef.current.find(s => s.start < t && s.end > t);
    if (!seg) return;
    pushUndo();
    setSegments(segs => {
      const i = segs.findIndex(s => s.id === seg.id);
      const r = [...segs];
      r.splice(i, 1, {id:uid(),start:seg.start,end:t}, {id:uid(),start:t,end:seg.end});
      return r;
    });
  }, [currentTime]); // eslint-disable-line

  const deleteSelected = useCallback(() => {
    setSelectedSegId(id => { if (!id) return null; pushUndo(); setSegments(s => s.filter(x => x.id !== id)); return null; });
  }, []); // eslint-disable-line

  const undo = () => setUndoStack(u => { if (!u.length) return u; setSegments(u[u.length-1]); return u.slice(0,-1); });
  const resetSegments = () => { pushUndo(); setSegments([{id:uid(),start:0,end:duration}]); setSelectedSegId(null); };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'KeyS') splitAtPlayhead();
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSegId) { e.preventDefault(); deleteSelected(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.code === 'ArrowLeft') seekTo(currentTime - 0.1);
      if (e.code === 'ArrowRight') seekTo(currentTime + 0.1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, splitAtPlayhead, deleteSelected, selectedSegId, currentTime, seekTo]); // eslint-disable-line

  const isWordKept = (w: {start:number;end:number}) =>
    segments.some(s => s.start <= w.start + 0.01 && s.end >= w.end - 0.01);

  const handleExport = async () => {
    if (!clipPath || exporting) return;
    setExporting(true); setExportResult(null); setExportProgress({percent:0,label:'Preparing…'});
    try {
      const r = await window.electronAPI.renderVideo('clip-editor', {
        clipPath, trimStart:0, trimEnd:duration, outputFormat, caption:null, music:null,
        cuts: segments.map(s => ({start:s.start, end:s.end})),
      }) as {success:boolean;outputPath?:string;error?:string};
      setExportResult(r.success ? {success:true,message:r.outputPath?.split('/').pop()||'Done!',outputPath:r.outputPath} : {success:false,message:r.error||'Failed'});
    } catch(e) { setExportResult({success:false,message:String(e)}); }
    setExportProgress(null); setExporting(false);
  };

  const previewStyle = outputFormat==='9x16' ? 'aspect-[9/16] max-h-[340px]' : outputFormat==='1x1' ? 'aspect-square max-h-[300px]' : 'aspect-video w-full max-h-[240px]';

  return (
    <div className="h-full flex overflow-hidden bg-[#0f0f0f]">

      {/* ── LEFT: Library ─────────────────────────────────── */}
      <div className="w-[200px] shrink-0 flex flex-col border-r border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="px-3 py-2.5 border-b border-[#1a1a1a] flex items-center justify-between">
          <p className="text-[11px] font-bold text-white">Library</p>
          <button onClick={loadLibrary} className="text-[#444] hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path strokeLinecap="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {libraryLoading ? <div className="flex justify-center py-6"><div className="w-4 h-4 border border-[#333] border-t-[#00C851] rounded-full animate-spin"/></div>
          : runs.length === 0 ? <p className="text-[10px] text-[#444] p-4 text-center">No clips yet</p>
          : runs.map(run => {
            const open = expandedRuns.has(run.runId);
            return (
              <div key={run.runId}>
                <button onClick={() => setExpandedRuns(e => { const n=new Set(e); open?n.delete(run.runId):n.add(run.runId); return n; })}
                  className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-white/5 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth={2} className={`w-3 h-3 shrink-0 transition-transform ${open?'rotate-90':''}`}><polyline points="9 18 15 12 9 6"/></svg>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[10px] font-semibold text-[#666] truncate">{(run.sourceVideo||'').replace(/\.[^.]+$/,'')}</p>
                    <p className="text-[8px] text-[#333]">{fmtDate(run.timestamp)} · {run.clips.length}</p>
                  </div>
                </button>
                {open && run.clips.filter(c=>c.filePath).map(clip => {
                  const active = clipPath === clip.filePath;
                  return (
                    <button key={clip.clipId} onClick={() => openClip(clip.filePath!, clip.title)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 transition-all ${active?'bg-[#00C851]/10 border-l-2 border-[#00C851]':'pl-[13px] border-l-2 border-transparent hover:bg-white/5'}`}>
                      <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 bg-[#141414]">
                        {clip.thumbnailPath ? <img src={`localfile://${clip.thumbnailPath}`} alt="" className="w-full h-full object-cover"/> :
                          <div className="w-full h-full flex items-center justify-center"><svg viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={1.5} className="w-3 h-3"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-medium truncate ${active?'text-[#00C851]':'text-[#888]'}`}>{clip.title||'Untitled'}</p>
                        {clip.duration && <p className="text-[8px] text-[#444]">{fmt(clip.duration)}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t border-[#1a1a1a]">
          <button onClick={async()=>{const r=await window.electronAPI.selectVideo();if(!r.cancelled&&r.filePath)openClip(r.filePath);}}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#222] text-[10px] text-[#555] hover:text-white hover:border-[#333] transition-colors">
            Browse file…
          </button>
        </div>
      </div>

      {/* ── CENTER: Player + Timeline ──────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-[#1a1a1a] min-w-0">

        {/* Header + toolbar */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-[#1a1a1a]">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-white truncate">{clipTitle || 'Video Editor'}</p>
            <p className="text-[9px] text-[#444]">Space play · S split · Del remove · ⌘Z undo</p>
          </div>
          {clipPath && duration > 0 && (
            <div className="flex items-center gap-1.5">
              <button onClick={togglePlay}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] text-white text-[10px] font-semibold transition-colors">
                {playing ? '⏸' : '▶'} {playing ? 'Pause' : 'Play'}
              </button>
              <button onClick={splitAtPlayhead}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] text-[10px] font-semibold text-[#aaa] hover:text-white transition-colors">
                ✂ Split
              </button>
              {selectedSegId && (
                <button onClick={deleteSelected}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-[10px] font-semibold text-red-400 transition-colors">
                  🗑 Delete
                </button>
              )}
              {undoStack.length > 0 && (
                <button onClick={undo}
                  className="px-2 py-1.5 rounded-lg bg-[#1a1a1a] hover:bg-[#222] text-[10px] text-[#555] hover:text-white transition-colors">
                  ↩ Undo
                </button>
              )}
              <button onClick={resetSegments}
                className="px-2 py-1.5 rounded-lg text-[10px] text-[#444] hover:text-white transition-colors">
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Player */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-4 bg-black min-h-0"
          onClick={() => { if (clipPath) setSelectedSegId(null); }}>
          {!clipPath ? (
            <div className="text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth={1} className="w-16 h-16 mx-auto mb-3"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              <p className="text-sm text-[#333]">Select a clip from the library</p>
            </div>
          ) : (
            <div className={`relative ${previewStyle} overflow-hidden rounded-xl bg-black`}>
              <video ref={videoRef} src={`localfile://${clipPath}`}
                className="w-full h-full object-cover"
                onLoadedMetadata={handleVideoLoaded} onTimeUpdate={handleTimeUpdate} onEnded={()=>setPlaying(false)}/>
              <button onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
                <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                  {playing ? <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  : <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Timeline */}
        {clipPath && duration > 0 && (
          <Timeline segments={segments} duration={duration} currentTime={currentTime}
            selectedId={selectedSegId} onSeek={seekTo} onSelect={setSelectedSegId}/>
        )}
      </div>

      {/* ── RIGHT: Transcript + Controls ─────────────────── */}
      <div className="w-[280px] shrink-0 flex flex-col overflow-hidden">

        {/* Transcript */}
        <div className="flex flex-col border-b border-[#1a1a1a]" style={{height:'45%'}}>
          <div className="shrink-0 px-4 py-2.5 border-b border-[#1a1a1a] flex items-center justify-between">
            <p className="text-[10px] font-bold text-white uppercase tracking-wider">Transcript</p>
            {transcript && <p className="text-[9px] text-[#444]">Click words to cut</p>}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {!transcript ? (
              <div className="text-center py-6">
                <p className="text-[10px] text-[#444]">No transcript</p>
                <p className="text-[9px] text-[#333] mt-1">Load a clip from Clip Extractor</p>
              </div>
            ) : (
              <div className="leading-6">
                {transcript.map((w, i) => {
                  const kept = isWordKept(w);
                  const active = currentTime >= w.start && currentTime <= w.end;
                  return (
                    <span key={i}
                      onClick={() => {
                        seekTo(w.start);
                        if (kept) removeRange(w.start - 0.02, w.end + 0.02);
                      }}
                      className={`inline mr-1 cursor-pointer text-xs transition-all rounded px-0.5 ${
                        !kept ? 'line-through text-red-500/40 hover:text-red-400/60'
                        : active ? 'text-[#00C851] font-bold bg-[#00C851]/10'
                        : 'text-[#777] hover:text-white hover:bg-white/5'
                      }`}>
                      {w.word}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Edit Controls */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#444] mb-2">Output Format</p>
              <div className="flex flex-col gap-1.5">
                {FORMATS.map(f => (
                  <button key={f.id} onClick={()=>setOutputFormat(f.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${outputFormat===f.id?'border-[#00C851]/40 bg-[#00C851]/7':'border-[#1e1e1e] hover:border-[#2a2a2a]'}`}>
                    <span className={`text-xs font-bold ${outputFormat===f.id?'text-[#00C851]':'text-white'}`}>{f.label}</span>
                    <span className="text-[9px] text-[#444]">{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Export */}
          <div className="shrink-0 p-4 border-t border-[#1a1a1a] mt-auto">
            {exportProgress && (
              <div className="mb-3">
                <div className="flex justify-between mb-1">
                  <p className="text-[10px] text-[#555]">{exportProgress.label}</p>
                  <p className="text-[10px] font-mono text-[#00C851]">{Math.round(exportProgress.percent)}%</p>
                </div>
                <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{width:`${exportProgress.percent}%`,background:'linear-gradient(to right,#00C851,#00ff73)'}}/>
                </div>
              </div>
            )}
            {exportResult && !exportProgress && (
              <div className={`mb-3 rounded-xl px-3 py-2 text-[10px] ${exportResult.success?'bg-[#00C851]/10 border border-[#00C851]/20 text-[#00C851]':'bg-red-900/20 border border-red-800/30 text-red-400'}`}>
                <p className="font-semibold">{exportResult.success?'✓ Exported':'✕ Failed'}</p>
                <p className="mt-0.5 opacity-80 truncate">{exportResult.message}</p>
                {exportResult.success && exportResult.outputPath && (
                  <button onClick={()=>(window.electronAPI as any).showInFinder?.(exportResult.outputPath!)}
                    className="mt-1 text-[9px] underline opacity-70 hover:opacity-100">Show in Finder</button>
                )}
              </div>
            )}
            <button onClick={handleExport} disabled={!clipPath||exporting||segments.length===0}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{background:(!clipPath||exporting||segments.length===0)?'#1a1a1a':'#00C851',color:(!clipPath||exporting||segments.length===0)?'#444':'black'}}>
              {exporting?<span className="flex items-center justify-center gap-2"><span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin"/>Rendering…</span>:'Export Video'}
            </button>
            <p className="text-[9px] text-[#333] text-center mt-1.5">
              {segments.length} segment{segments.length!==1?'s':''} · {fmt(segments.reduce((a,s)=>a+(s.end-s.start),0))} total
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
