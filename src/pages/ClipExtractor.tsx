import { useState, useEffect, useCallback, useRef } from 'react';
import InstagramPostModal from '../components/InstagramPostModal';

// ─── SVG Icons ────────────────────────────────────────────────────────
const Icon = {
  Film: (props?: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={props?.className ?? 'w-full h-full'}>
      <rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/>
      <line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/>
      <line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>
    </svg>
  ),
  Play: () => (<svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><polygon points="5 3 19 12 5 21 5 3"/></svg>),
  Pause: () => (<svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>),
  Folder: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>),
  Trash: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  Pencil: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
  Refresh: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>),
  Plus: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-full h-full"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>),
  Bolt: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
  ChevronLeft: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="15 18 9 12 15 6"/></svg>),
  ChevronRight: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="9 18 15 12 9 6"/></svg>),
  Upload: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>),
  Loader: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>),
  Sparkles: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a1 1 0 0 1 0-1.926L8.5 9.937A2 2 0 0 0 9.937 8.5l1.582-6.135a1 1 0 0 1 1.926 0L15.063 8.5A2 2 0 0 0 16.5 9.937l6.135 1.582a1 1 0 0 1 0 1.926L16.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a1 1 0 0 1-1.926 0z"/></svg>),
  Brain: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18V5Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18V5Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/></svg>),
  Scissors: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>),
  Eye: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>),
  X: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-full h-full"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  Mic: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>),
  Activity: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>),
  VolumeX: () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>),
};

// ─── Types ───────────────────────────────────────────────────────────
interface Clip {
  clipId?: string;
  title: string;
  label?: string;
  start: number;
  end: number;
  duration: number;
  score: number;
  speechDensity?: number;
  motionScore?: number;
  silenceRatio?: number;
  filePath?: string | null;
  thumbnailPath?: string | null;
  contentType?: string;
  status?: string;
  composedAt?: string | null;
  clipPath?: string;
  specPath?: string;
}

interface LibraryRun {
  runId: string;
  timestamp: number;
  sourceVideo: string;
  runPath?: string;
  clips: Clip[];
}

interface VideoPlanSummary {
  id: string;
  topic: string;
  targetLength: string;
  timeline: { type: string; label: string; timestamp: string; endTimestamp: string }[];
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtFull = (s: number) => {
  if (isNaN(s) || !isFinite(s)) return '0:00';
  return fmt(s);
};

const formatRelative = (ts: number) => {
  const d = Date.now() - ts;
  if (d < 120000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
};

const CT: Record<string, { label: string; color: string }> = {
  HAIRCUT_TUTORIAL:    { label: 'Tutorial', color: '#3B82F6' },
  PRODUCT_REVIEW:      { label: 'Review',   color: '#F59E0B' },
  BARBERSHOP_BUSINESS: { label: 'Business', color: '#00C851' },
  MOTIVATIONAL:        { label: 'Mindset',  color: '#8B5CF6' },
  vlog:                { label: 'Vlog',     color: '#6B7280' },
};

const STATUS: Record<string, { label: string; color: string }> = {
  composed:       { label: 'Ready',   color: '#00C851' },
  compose_failed: { label: 'Failed',  color: '#EF4444' },
  pending:        { label: 'Pending', color: '#F59E0B' },
};

// ─── Score Bar ────────────────────────────────────────────────────────
function ScoreBar({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 shrink-0" style={{ color }}>{icon}</div>
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[9px] font-mono w-6 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────
function ClipPreviewModal({ clip, onClose, onOpenInEditor }: {
  clip: Clip;
  onClose: () => void;
  onOpenInEditor?: (clip: Clip) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(clip.duration || 0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(clip.duration || 0);
  const [trimming, setTrimming] = useState(false);
  const [trimMsg, setTrimMsg] = useState('');
  const [showIgModal, setShowIgModal] = useState(false);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.play(); setPlaying(true); }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      setTrimEnd(dur);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const handleTrim = async () => {
    if (!clip.filePath || !clip.specPath) return;
    if (trimEnd - trimStart < 1) { setTrimMsg('Trim window too short (min 1s)'); return; }
    setTrimming(true);
    setTrimMsg('');
    try {
      const res = await (window as any).electronAPI.trimClip({
        filePath: clip.filePath,
        specPath: clip.specPath,
        startSec: trimStart,
        endSec: trimEnd,
      });
      if (res.success) {
        setTrimMsg('✓ Saved');
        // Reload video
        if (videoRef.current) { videoRef.current.load(); videoRef.current.currentTime = 0; setCurrentTime(0); }
      } else {
        setTrimMsg('Trim failed: ' + (res.error || 'unknown'));
      }
    } catch (e) {
      setTrimMsg('Trim failed: ' + String(e));
    }
    setTrimming(false);
  };

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (showIgModal) return;
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [showIgModal]);

  const clipSrc = clip.filePath ? `localfile://${clip.filePath}` : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex gap-4 max-h-[92vh] w-[860px] max-w-[95vw]">

        {/* Video column */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          {/* Video */}
          <div className="relative bg-black rounded-2xl overflow-hidden border border-[#222]"
            style={{ aspectRatio: '9/16', maxHeight: '65vh' }}>
            {clipSrc ? (
              <video
                ref={videoRef}
                src={clipSrc}
                className="absolute inset-0 w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setPlaying(false)}
                onClick={togglePlay}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[#333]">
                <div className="w-10 h-10"><Icon.Film /></div>
              </div>
            )}

            {/* Play/pause overlay */}
            <button
              onClick={togglePlay}
              className="absolute bottom-3 left-3 w-9 h-9 bg-black/60 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-[#00C851]/80 transition-colors"
            >
              <div className="w-4 h-4 ml-0.5">{playing ? <Icon.Pause /> : <Icon.Play />}</div>
            </button>

            {/* Time */}
            <div className="absolute bottom-3 right-3 text-[10px] font-mono text-white/60 bg-black/50 px-1.5 py-0.5 rounded">
              {fmtFull(currentTime)} / {fmtFull(duration)}
            </div>
          </div>

          {/* Seek bar */}
          <div className="relative px-1">
            {/* Trim region highlight */}
            <div className="absolute top-[6px] h-1.5 rounded-full bg-[#00C851]/20 pointer-events-none"
              style={{
                left: `calc(${(trimStart / (duration || 1)) * 100}% + 4px)`,
                width: `calc(${((trimEnd - trimStart) / (duration || 1)) * 100}%)`,
              }}
            />
            <input type="range" min={0} max={duration || 1} step={0.1} value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 appearance-none bg-white/10 rounded-full cursor-pointer"
              style={{ accentColor: '#00C851' }}
            />
          </div>
        </div>

        {/* Info + controls column */}
        <div className="w-52 shrink-0 flex flex-col gap-4">

          {/* Close */}
          <button onClick={onClose}
            className="self-end w-8 h-8 flex items-center justify-center text-[#555] hover:text-white transition-colors rounded-lg border border-[#222] hover:border-[#333]">
            <div className="w-4 h-4"><Icon.X /></div>
          </button>

          {/* Title + meta */}
          <div>
            <h3 className="text-sm font-bold text-white leading-snug mb-1">{clip.title}</h3>
            <p className="text-[10px] text-[#555] font-mono">{fmtFull(clip.start)} – {fmtFull(clip.end)}</p>
          </div>

          {/* Show in Finder */}
          {clip.clipPath && (
            <button
              onClick={() => (window as any).electronAPI.showInFinder(clip.clipPath)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#252525] text-[11px] text-[#555] hover:text-white hover:border-[#333] transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Show in Finder
            </button>
          )}

          {/* Score breakdown */}
          <div className="bg-[#141414] border border-[#222] rounded-xl p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[9px] font-bold text-[#555] uppercase tracking-wider">AI Score</p>
              <span className="text-sm font-bold text-[#00C851]">{Math.round(clip.score * 100)}%</span>
            </div>
            {/* Overall bar */}
            <ScoreBar label="Overall" value={clip.score} color="#00C851"
              icon={<Icon.Sparkles />} />
            {/* Sub-scores — real data if present, estimated if not */}
            <ScoreBar label="Speech" value={clip.speechDensity ?? clip.score * 0.9 + 0.05} color="#3B82F6"
              icon={<Icon.Mic />} />
            <ScoreBar label="Motion" value={clip.motionScore ?? clip.score * 0.8 + 0.1} color="#F59E0B"
              icon={<Icon.Activity />} />
            <ScoreBar label="Silence" value={1 - (clip.silenceRatio ?? Math.max(0, 1 - clip.score - 0.1))} color="#8B5CF6"
              icon={<Icon.VolumeX />} />
          </div>


          {/* Edit in Video Editor */}
          {clip.filePath && (
            <button
              onClick={() => { onClose(); onOpenInEditor?.(clip); }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#252525] text-[11px] text-[#777] hover:text-white hover:border-[#333] transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Edit in Video Editor
            </button>
          )}

          {/* Post as Reel */}
          {clip.filePath && (
            <button
              onClick={() => setShowIgModal(true)}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold text-white transition-colors"
              style={{ background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)' }}
            >
              <svg viewBox="0 0 24 24" fill="white" width="12" height="12">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
              </svg>
              Post as Reel
            </button>
          )}

          {/* Show in Finder */}
          {clip.clipPath && (
            <button
              onClick={() => (window as any).electronAPI.showInFinder(clip.clipPath)}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#222] text-[11px] text-[#555] hover:text-white hover:border-[#333] transition-colors"
            >
              <div className="w-3 h-3"><Icon.Folder /></div>
              Show in Finder
            </button>
          )}
        </div>
      </div>

      {/* Instagram Modal */}
      {showIgModal && clip.filePath && (
        <InstagramPostModal
          type="reel"
          filePath={clip.filePath}
          defaultCaption={clip.title}
          onClose={() => setShowIgModal(false)}
        />
      )}
    </div>
  );
}

// ─── Rename Input ─────────────────────────────────────────────────────
function RenameInput({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.select(); }, []);
  return (
    <input ref={ref} value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onSave(val.trim() || value); if (e.key === 'Escape') onCancel(); }}
      onBlur={() => onSave(val.trim() || value)}
      className="w-full bg-black/70 border border-[#00C851]/60 rounded px-2 py-1 text-xs text-white outline-none"
      autoFocus
    />
  );
}

// ─── Clip Card ────────────────────────────────────────────────────────
function ClipCard({ clip, onDelete, onRename, onPreview }: {
  clip: Clip;
  onDelete: () => void;
  onRename: (t: string) => void;
  onPreview: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const title = clip.title || clip.label || 'Untitled';
  const ct = CT[clip.contentType || 'vlog'] || CT.vlog;
  const st = clip.status ? STATUS[clip.status] : null;
  const dur = clip.duration || Math.max(0, (clip.end || 0) - (clip.start || 0));

  return (
    <div className="bg-[#161616] rounded-2xl border border-[#222] hover:border-[#333] transition-all overflow-hidden flex flex-col group/card">
      {/* Thumbnail */}
      <div className="relative bg-[#111] overflow-hidden shrink-0" style={{ aspectRatio: '9/16', maxHeight: '196px' }}>
        {clip.thumbnailPath ? (
          <img src={`localfile://${clip.thumbnailPath}`} alt={title}
            className="absolute inset-0 w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#111]">
            <div className="w-7 h-7 text-[#2a2a2a]"><Icon.Film /></div>
          </div>
        )}

        {/* Hover: Preview button */}
        <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover/card:opacity-100">
          <button onClick={onPreview}
            className="w-11 h-11 bg-white/10 hover:bg-[#00C851] text-white rounded-full flex items-center justify-center transition-colors border border-white/10"
            title="Preview">
            <div className="w-4 h-4 ml-0.5"><Icon.Play /></div>
          </button>
        </div>

        {/* Top badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm"
            style={{ backgroundColor: ct.color + '28', color: ct.color, border: `1px solid ${ct.color}40` }}>
            {ct.label}
          </span>
        </div>
        {st && (
          <div className="absolute top-2 right-2">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm"
              style={{ backgroundColor: st.color + '28', color: st.color, border: `1px solid ${st.color}40` }}>
              {st.label}
            </span>
          </div>
        )}

        {/* Bottom strip */}
        <div className="absolute bottom-0 left-0 right-0 px-2.5 py-1.5 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end">
          {dur > 0 && <span className="text-[9px] font-mono text-white/50">{Math.round(dur)}s</span>}
          {clip.score > 0 && <span className="text-[10px] font-bold text-[#00C851]">{Math.round(clip.score * 100)}%</span>}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {renaming
          ? <RenameInput value={title} onSave={v => { setRenaming(false); onRename(v); }} onCancel={() => setRenaming(false)} />
          : <p className="text-[11px] font-semibold text-white leading-snug line-clamp-2 cursor-text hover:text-[#00C851] transition-colors"
              title="Double-click to rename" onDoubleClick={() => setRenaming(true)}>{title}</p>
        }
        {clip.start > 0 && (
          <p className="text-[9px] text-[#555] font-mono -mt-1">{fmt(clip.start)} – {fmt(clip.end)}</p>
        )}

        {/* Micro score bars */}
        <div className="flex flex-col gap-1 mt-0.5">
          <ScoreBar label="Speech" value={clip.speechDensity ?? clip.score * 0.9 + 0.05} color="#3B82F6" icon={<Icon.Mic />} />
          <ScoreBar label="Motion" value={clip.motionScore ?? clip.score * 0.8 + 0.1} color="#F59E0B" icon={<Icon.Activity />} />
        </div>

        <div className="flex gap-1.5 mt-auto pt-1">
          <button onClick={onPreview}
            className="flex-1 h-7 flex items-center justify-center gap-1.5 text-[10px] bg-[#00C851]/10 text-[#00C851] rounded-lg hover:bg-[#00C851]/20 transition-colors font-semibold">
            <div className="w-2.5 h-2.5"><Icon.Eye /></div> Preview
          </button>
          <button onClick={() => setRenaming(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1c1c1c] text-[#666] hover:text-white transition-colors"
            title="Rename">
            <div className="w-3.5 h-3.5"><Icon.Pencil /></div>
          </button>
          {confirmDel
            ? <button onClick={() => { setConfirmDel(false); onDelete(); }}
                className="px-2 h-7 text-[10px] bg-red-900/60 text-red-300 rounded-lg hover:bg-red-800 font-semibold transition-colors">Delete?</button>
            : <button onClick={() => { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1c1c1c] text-[#666] hover:text-red-400 hover:bg-red-900/20 transition-colors" title="Delete">
                <div className="w-3.5 h-3.5"><Icon.Trash /></div>
              </button>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Library Sidebar ──────────────────────────────────────────────────
function LibraryPanel({ runs, selectedRunId, onSelect, onDeleteRun, onRefresh, onClose }: {
  runs: LibraryRun[];
  selectedRunId: string | null;
  onSelect: (run: LibraryRun) => void;
  onDeleteRun: (runId: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <aside className="w-56 shrink-0 flex flex-col h-full border-r border-[#1e1e1e] bg-[#0d0d0d]">
      <div className="flex items-center justify-between px-3 py-3 border-b border-[#1e1e1e]">
        <div>
          <p className="text-[10px] font-bold text-[#666] uppercase tracking-widest">History</p>
          <p className="text-[9px] text-[#3a3a3a] mt-0.5">{runs.length} extraction{runs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={onRefresh} className="w-6 h-6 flex items-center justify-center text-[#333] hover:text-[#666] transition-colors" title="Refresh">
            <div className="w-3.5 h-3.5"><Icon.Refresh /></div>
          </button>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-[#333] hover:text-[#666] transition-colors" title="Collapse">
            <div className="w-3.5 h-3.5"><Icon.ChevronLeft /></div>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {runs.length === 0
          ? <div className="p-6 text-center"><p className="text-xs text-[#333]">No history yet</p></div>
          : runs.map(run => {
              const isSelected = run.runId === selectedRunId;
              const name = run.sourceVideo || 'Untitled Video';
              const thumbClip = run.clips.find(c => c.thumbnailPath);
              return (
                <div key={run.runId}
                  className={`group/run relative border-b border-[#141414] transition-colors ${isSelected ? 'bg-[#181818] border-l-2 border-l-[#00C851]' : 'hover:bg-[#121212]'}`}>
                  <button onClick={() => onSelect(run)} className="w-full text-left px-3 py-2.5 flex gap-2.5 items-center">
                    <div className="w-8 h-11 rounded-md overflow-hidden bg-[#1a1a1a] shrink-0 border border-[#242424] relative">
                      {thumbClip?.thumbnailPath
                        ? <img src={`localfile://${thumbClip.thumbnailPath}`} alt="" className="absolute inset-0 w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        : <div className="absolute inset-0 flex items-center justify-center"><div className="w-3.5 h-3.5 text-[#2a2a2a]"><Icon.Film /></div></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-[#ccc] leading-tight truncate" title={name}>
                        {name.length > 22 ? name.slice(0, 20) + '…' : name}
                      </p>
                      <p className="text-[9px] text-[#3a3a3a] mt-0.5">{formatRelative(run.timestamp)}</p>
                      <p className="text-[9px] text-[#00C851] mt-1">{run.clips.length} clip{run.clips.length !== 1 ? 's' : ''}</p>
                    </div>
                  </button>

                  <div className="absolute top-2 right-1.5">
                    {confirmId === run.runId
                      ? <button onClick={() => { setConfirmId(null); onDeleteRun(run.runId); }}
                          className="text-[9px] bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded font-semibold">Delete?</button>
                      : <button onClick={e => { e.stopPropagation(); setConfirmId(run.runId); setTimeout(() => setConfirmId(null), 3000); }}
                          className="w-5 h-5 flex items-center justify-center text-[#444] hover:text-red-400 transition-colors" title="Delete run">
                          <div className="w-3 h-3"><Icon.Trash /></div>
                        </button>
                    }
                  </div>
                </div>
              );
            })
        }
      </div>
    </aside>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────
export default function ClipExtractor({ onClipCreated, onNavigateToEditor }: { onClipCreated?: () => void; onNavigateToEditor?: (clip: Clip) => void } = {}) {
  const [videoPath, setVideoPath]         = useState<string | null>(() => localStorage.getItem('clipex:videoPath'));
  const [processing, setProcessing]       = useState(false);
  const [progress, setProgress]           = useState({ percent: 0, label: '' });
  const [clips, setClips]                 = useState<Clip[]>(() => { try { return JSON.parse(localStorage.getItem('clipex:clips') || '[]'); } catch { return []; } });
  const [error, setError]                 = useState('');
  const [library, setLibrary]             = useState<LibraryRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(() => localStorage.getItem('clipex:runId'));
  const [showLibrary, setShowLibrary]     = useState(true);
  const [previewClip, setPreviewClip]     = useState<Clip | null>(null);

  useEffect(() => { if (videoPath) localStorage.setItem('clipex:videoPath', videoPath); }, [videoPath]);
  useEffect(() => { localStorage.setItem('clipex:clips', JSON.stringify(clips)); }, [clips]);

  const loadLibrary = useCallback(async () => {
    try {
      const result = await (window as any).electronAPI.scanLibrary();
      if (!result?.runs) return;
      setLibrary(result.runs);

      const needsThumb = result.runs.flatMap((r: LibraryRun) =>
        r.clips.filter((c: Clip & { needsThumbnail?: boolean; thumbPath?: string }) =>
          c.needsThumbnail && c.filePath && c.thumbPath
        ).map((c: Clip & { needsThumbnail?: boolean; thumbPath?: string }) => ({
          runId: r.runId, clipPath: c.clipPath, filePath: c.filePath!, thumbPath: c.thumbPath!,
        }))
      );

      const queue = [...needsThumb];
      const worker = async () => {
        while (queue.length > 0) {
          const item = queue.shift()!;
          try {
            const res = await (window as any).electronAPI.generateThumbnail(item.filePath, item.thumbPath);
            if (res?.success && res.thumbPath) {
              setLibrary(prev => prev.map(run =>
                run.runId !== item.runId ? run : {
                  ...run,
                  clips: run.clips.map(c =>
                    c.clipPath === item.clipPath ? { ...c, thumbnailPath: res.thumbPath, needsThumbnail: false } : c
                  ),
                }
              ));
            }
          } catch {}
        }
      };
      worker(); worker();
    } catch {}
  }, []);

  const [savedPlans, setSavedPlans] = useState<VideoPlanSummary[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  useEffect(() => {
    (window.electronAPI as any).listVideoPlans?.().then((r: any) => {
      if (r?.plans) setSavedPlans(r.plans);
    }).catch(() => {});
  }, []);

  // Load history on mount so existing clips show without needing an extraction first
  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  useEffect(() => {
    const cleanup = window.electronAPI.onProgress(d => setProgress(d));
    return cleanup;
  }, []);

  const handleNewExtraction = async () => {
    const result = await window.electronAPI.selectVideo();
    if (!result.cancelled && result.filePath) {
      setVideoPath(result.filePath);
      setClips([]);
      setSelectedRunId(null);
      localStorage.removeItem('clipex:runId');
    }
  };

  const handleExtract = async () => {
    if (!videoPath) return;
    setProcessing(true);
    setError('');
    setProgress({ percent: 0, label: 'Starting…' });

    // Build Drop Zone context from selected plan
    const selectedPlan = savedPlans.find(p => p.id === selectedPlanId);
    const dropZones = selectedPlan?.timeline
      .filter(e => e.type === 'dropzone')
      .map(e => ({ label: e.label, timestamp: e.timestamp, endTimestamp: e.endTimestamp })) ?? [];

    try {
      const result = await window.electronAPI.extractClips(videoPath, {
        outputFormat: '9x16',
        contentType: 'vlog',
        numClips: 5,
        autoTrack: true,
        ...(dropZones.length > 0 ? { planContext: { topic: selectedPlan!.topic, dropZones } } : {}),
      });

      if (result.success) {
        const raw: Clip[] = (result as any).data?.clips || [{
          start: 0, end: 0, score: 0.99, duration: 0,
          title: videoPath.split('/').pop()?.split('.')[0] || 'Clip',
          filePath: (result as any).outputPath,
        }];
        const enriched = raw.map(c => ({
          ...c,
          title: c.title || c.label || 'Untitled',
          thumbnailPath: c.thumbnailPath ||
            (c.filePath ? (c.filePath as string).replace(/\/[^/]+\.mp4$/, '/thumbnail.jpg') : undefined),
        }));
        setClips(enriched);
        enriched.forEach(() => onClipCreated?.());
        const runId = (result as any).runId || String(Date.now());
        setSelectedRunId(runId);
        localStorage.setItem('clipex:runId', runId);
        setTimeout(loadLibrary, 3000);
      } else {
        setError(result.error || 'Extraction failed');
      }
    } catch {
      setError('Extraction failed. Make sure Python and ffmpeg are installed.');
    }
    setProcessing(false);
  };

  const handleSelectRun = (run: LibraryRun) => {
    setSelectedRunId(run.runId);
    setClips(run.clips as Clip[]);
    setVideoPath(run.sourceVideo || null);
    localStorage.setItem('clipex:runId', run.runId);
    localStorage.setItem('clipex:clips', JSON.stringify(run.clips));
    if (run.sourceVideo) localStorage.setItem('clipex:videoPath', run.sourceVideo);
  };

  const handleDeleteRun  = async (runId: string) => {
    await (window as any).electronAPI.deleteRun(runId);
    if (selectedRunId === runId) { setClips([]); setSelectedRunId(null); localStorage.removeItem('clipex:runId'); }
    loadLibrary();
  };

  const handleDeleteClip = async (clip: Clip) => {
    if (!clip.clipPath) return;
    await (window as any).electronAPI.deleteClip(clip.clipPath);
    setClips(prev => prev.filter(c => c.clipPath !== clip.clipPath));
    loadLibrary();
  };

  const handleRenameClip = async (clip: Clip, newTitle: string) => {
    if (!clip.specPath || newTitle === clip.title) return;
    await (window as any).electronAPI.renameClip(clip.specPath, newTitle);
    setClips(prev => prev.map(c => c.clipPath === clip.clipPath ? { ...c, title: newTitle } : c));
  };

  const handleTrimApplied = (clip: Clip, start: number, end: number) => {
    const dur = end - start;
    setClips(prev => prev.map(c => c.clipPath === clip.clipPath
      ? { ...c, duration: dur, start: c.start + start, end: c.start + end }
      : c
    ));
  };

  const selectedRun = library.find(r => r.runId === selectedRunId);
  const videoName = (selectedRun?.sourceVideo || videoPath?.split('/').pop()?.split('.')[0] || '').slice(0, 44);

  return (
    <div className="flex h-full overflow-hidden bg-[#0f0f0f]">

      {/* Preview Modal */}
      {previewClip && (
        <ClipPreviewModal
          clip={previewClip}
          onClose={() => setPreviewClip(null)}
          onOpenInEditor={(clip) => { setPreviewClip(null); onNavigateToEditor?.(clip); }}
        />
      )}

      {/* Collapsible history panel */}
      {showLibrary && (
        <LibraryPanel
          runs={library}
          selectedRunId={selectedRunId}
          onSelect={handleSelectRun}
          onDeleteRun={handleDeleteRun}
          onRefresh={loadLibrary}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {/* Main panel */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="shrink-0 border-b border-[#1a1a1a] px-5 py-3.5 flex items-center gap-3">
          {!showLibrary && (
            <button onClick={() => setShowLibrary(true)}
              className="w-7 h-7 flex items-center justify-center text-[#444] hover:text-white transition-colors rounded-lg border border-[#222] hover:border-[#333]"
              title="Show history">
              <div className="w-3.5 h-3.5"><Icon.ChevronRight /></div>
            </button>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white">Clip Extractor</h1>
            {videoName && (
              <p className="text-[10px] text-[#00C851] mt-0.5 truncate font-medium">
                ● {videoName}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleNewExtraction}
              className="flex items-center gap-1.5 text-xs bg-[#1a1a1a] border border-[#282828] text-[#777] px-3 py-1.5 rounded-lg hover:text-white hover:border-[#383838] transition-colors">
              <div className="w-3 h-3"><Icon.Plus /></div>
              New Extraction
            </button>

            {videoPath && (
              <button onClick={handleExtract} disabled={processing}
                className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors ${
                  processing
                    ? 'bg-[#00C851]/10 text-[#00C851] border border-[#00C851]/30 cursor-not-allowed'
                    : 'bg-[#00C851] text-black hover:bg-[#00b548]'
                }`}>
                {processing ? (
                  <><div className="w-3 h-3"><Icon.Loader /></div>Processing ({progress.percent}%)</>
                ) : (
                  <><div className="w-3 h-3"><Icon.Bolt /></div>Extract Clips</>
                )}
              </button>
            )}
          </div>
        </div>


          {videoPath && savedPlans.length > 0 && (
            <div className="mb-3 px-1">
              <div className="flex items-center gap-2 bg-[#0f0f0f] border border-[#222] rounded-xl px-3 py-2.5">
                <svg className="w-3.5 h-3.5 text-[#00C851] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <select
                  value={selectedPlanId}
                  onChange={e => setSelectedPlanId(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-[#888] focus:outline-none cursor-pointer appearance-none"
                >
                  <option value="">No Video Plan linked (standard extraction)</option>
                  {savedPlans.map(p => (
                    <option key={p.id} value={p.id}>
                      🟢 {p.topic} — {p.timeline.filter(e => e.type === 'dropzone').length} Drop Zones
                    </option>
                  ))}
                </select>
              </div>
              {selectedPlanId && (
                <p className="text-[10px] text-[#00C851]/70 mt-1 px-1">
                  Drop Zone timestamps will guide clip scoring — moments matching your planned hooks score highest.
                </p>
              )}
            </div>
          )}

          {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Hero Progress */}
          {processing && (
            <div className="flex flex-col items-center justify-center min-h-[450px] bg-[#111] rounded-2xl border flex-1 border-[#222] relative overflow-hidden mb-5 backdrop-blur-3xl">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[#00C851]/10 blur-[120px] rounded-full mix-blend-screen animate-pulse" />
              <div className="relative flex items-center justify-center w-48 h-48 mb-8">
                <div className="absolute inset-0 rounded-full border-t border-[#00C851]/40 animate-[spin_4s_linear_infinite]" />
                <div className="absolute inset-2 rounded-full border-r border-[#00C851]/20 animate-[spin_3s_linear_infinite_reverse]" />
                <div className="absolute inset-4 rounded-full border border-[#222]" />
                <div className="flex flex-col items-center justify-center z-10 w-full h-full rounded-full bg-[#0a0a0a] shadow-[inset_0_0_20px_rgba(0,198,81,0.05)] border border-[#00C851]/10">
                  <span className="text-3xl font-bold bg-gradient-to-br from-white to-[#aaa] bg-clip-text text-transparent">{progress.percent}%</span>
                  <div className="w-5 h-5 text-[#00C851] mt-1 animate-pulse"><Icon.Brain /></div>
                </div>
              </div>
              <div className="text-center z-10 flex flex-col items-center">
                <p className="text-lg font-semibold text-white mb-2">
                  {progress.percent < 15 ? 'Transcribing & Analyzing...' :
                   progress.percent < 35 ? 'Detecting Viral Hooks...' :
                   progress.percent < 60 ? 'Reframing Subjects...' :
                   progress.percent < 85 ? 'Drafting AI Overlays...' : 'Rendering Subtitles...'}
                </p>
                <div className="flex items-center justify-center gap-2 bg-[#1a1a1a] border border-[#222] px-3 py-1.5 rounded-full">
                  <div className="w-3 h-3"><Icon.Sparkles /></div>
                  <p className="text-xs text-[#00C851] font-mono tracking-widest uppercase truncate max-w-[200px]">{progress.label || 'Processing…'}</p>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2 mb-4">{error}</p>}

          {/* Drop zone */}
          {!videoPath && !processing && clips.length === 0 && (
            <button onClick={handleNewExtraction}
              className="w-full border-2 border-dashed border-[#222] rounded-2xl p-16 flex flex-col items-center justify-center hover:border-[#00C851]/30 hover:bg-[#00C851]/3 transition-all group">
              <div className="w-10 h-10 text-[#2a2a2a] group-hover:text-[#444] transition-colors mb-4"><Icon.Upload /></div>
              <p className="text-sm font-semibold text-[#555] group-hover:text-white transition-colors">Start a new extraction</p>
              <p className="text-xs text-[#333] mt-1">Select a long-form video to get AI-generated clips</p>
            </button>
          )}

          {/* Clips grid */}
          {clips.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-white">{clips.length} Clip{clips.length !== 1 ? 's' : ''}</h2>
                  <p className="text-[10px] text-[#3a3a3a]">Click a clip to preview · Double-click title to rename</p>
                </div>
                <button onClick={loadLibrary}
                  className="w-6 h-6 flex items-center justify-center text-[#3a3a3a] hover:text-[#00C851] transition-colors" title="Refresh">
                  <div className="w-4 h-4"><Icon.Refresh /></div>
                </button>
              </div>

              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                {clips.map((clip, i) => (
                  <ClipCard
                    key={`${clip.clipPath || clip.title}-${i}`}
                    clip={clip}
                    onDelete={() => handleDeleteClip(clip)}
                    onRename={t => handleRenameClip(clip, t)}
                    onPreview={() => setPreviewClip(clip)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Video loaded — prominent ready state */}
          {clips.length === 0 && videoPath && !processing && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-full max-w-sm bg-[#0d1f13] border border-[#00C851]/30 rounded-2xl px-6 py-8 flex flex-col items-center gap-3 shadow-[0_0_40px_rgba(0,200,81,0.06)]">
                <div className="w-12 h-12 rounded-full bg-[#00C851]/10 border border-[#00C851]/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#00C851]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.9L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Video loaded</p>
                  <p className="text-xs text-[#00C851]/80 mt-0.5 font-medium truncate max-w-[240px]">{videoName}</p>
                </div>
                <p className="text-xs text-[#555] mt-1">Hit <span className="text-white font-semibold">Extract Clips</span> to begin AI analysis</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
