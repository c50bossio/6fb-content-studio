import { useState, useEffect } from 'react';
import InstagramPostModal from '../components/InstagramPostModal';

// ─── Types ───────────────────────────────────────────────────────────
interface ScheduledPost {
  id: string;
  platform: 'instagram' | 'tiktok' | 'youtube';
  caption: string;
  mediaPath: string;
  scheduledAt: string;
  status: 'scheduled' | 'due' | 'posted' | 'failed';
  createdAt: string;
  postedAt?: string;
  thumbnailPath?: string;
  mediaType?: 'reel' | 'carousel';
}

interface LibraryClip {
  clipId: string;
  title: string;
  filePath: string | null;
  thumbnailPath: string | null;
  contentType: string;
}

// ─── Constants ───────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'instagram' as const, name: 'Instagram', abbr: 'IG',
    color: '#ee2a7b', bg: 'rgba(238,42,123,0.1)', border: 'rgba(238,42,123,0.25)',
    gradient: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)' },
  { id: 'tiktok' as const, name: 'TikTok', abbr: 'TT',
    color: '#69C9D0', bg: 'rgba(105,201,208,0.1)', border: 'rgba(105,201,208,0.25)',
    gradient: 'linear-gradient(135deg, #69C9D0, #EE1D52)' },
  { id: 'youtube' as const, name: 'YouTube', abbr: 'YT',
    color: '#FF0000', bg: 'rgba(255,0,0,0.1)', border: 'rgba(255,0,0,0.25)',
    gradient: 'linear-gradient(135deg, #FF0000, #FF4500)' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── Helpers ─────────────────────────────────────────────────────────
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const fmt12 = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const getStreak = (posts: ScheduledPost[]) => {
  const posted = [...posts]
    .filter(p => p.status === 'posted' && p.postedAt)
    .sort((a, b) => new Date(b.postedAt!).getTime() - new Date(a.postedAt!).getTime());
  if (!posted.length) return 0;
  let streak = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  let check = new Date(today);
  for (let i = 0; i < 365; i++) {
    const found = posted.some(p => isSameDay(new Date(p.postedAt!), check));
    if (found) { streak++; check.setDate(check.getDate() - 1); }
    else break;
  }
  return streak;
};

// ─── Post Chip (calendar cell) ────────────────────────────────────────
function PostChip({ post, onClick }: { post: ScheduledPost; onClick: () => void }) {
  const pl = PLATFORMS.find(p => p.id === post.platform)!;
  const isDue = post.status === 'due';
  const isPosted = post.status === 'posted';
  return (
    <button onClick={onClick}
      className="w-full text-left rounded-lg overflow-hidden border transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{ borderColor: isPosted ? '#00C85140' : isDue ? '#F59E0B60' : pl.border }}>
      <div className="flex items-center gap-1.5 px-1.5 py-1"
        style={{ background: isPosted ? 'rgba(0,200,81,0.07)' : pl.bg }}>
        {post.thumbnailPath && (
          <img src={`localfile://${post.thumbnailPath}`} alt=""
            className="w-5 h-7 rounded object-cover shrink-0 border border-white/5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[8px] font-black" style={{ color: pl.color }}>{pl.abbr}</span>
            {isDue && <span className="text-[7px] text-amber-400 font-bold animate-pulse">DUE</span>}
            {isPosted && <span className="text-[7px] text-[#00C851] font-bold">✓</span>}
          </div>
          <p className="text-[9px] text-white/70 truncate leading-tight">{post.caption}</p>
          <p className="text-[8px] text-white/30 mt-0.5">{fmt12(post.scheduledAt)}</p>
        </div>
      </div>
    </button>
  );
}

// ─── Post Detail Modal ────────────────────────────────────────────────
function PostDetailModal({ post, onClose, onDelete, onMarkPosted, onPostNow }: {
  post: ScheduledPost;
  onClose: () => void;
  onDelete: () => void;
  onMarkPosted: () => void;
  onPostNow: () => void;
}) {
  const pl = PLATFORMS.find(p => p.id === post.platform)!;
  const canPost = post.status === 'scheduled' || post.status === 'due';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-80 bg-[#111] border border-[#222] rounded-2xl overflow-hidden shadow-2xl">
        {/* Thumbnail */}
        <div className="relative h-36 bg-[#0a0a0a]">
          {post.thumbnailPath ? (
            <img src={`localfile://${post.thumbnailPath}`} alt=""
              className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1e1e1e" strokeWidth={1} className="w-10 h-10">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded border"
                style={{ color: pl.color, borderColor: pl.border, background: pl.bg }}>
                {pl.abbr}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                post.status === 'posted' ? 'text-[#00C851] border-[#00C85140]' :
                post.status === 'due' ? 'text-amber-400 border-amber-400/30 animate-pulse' :
                post.status === 'failed' ? 'text-red-400 border-red-400/30' :
                'text-[#666] border-[#333]'
              }`}>
                {post.status === 'scheduled' ? 'Scheduled' : post.status === 'posted' ? '✓ Posted' :
                 post.status === 'due' ? '⏰ Due Now' : '✕ Failed'}
              </span>
            </div>
          </div>
          <button onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-bold text-white mb-1">
              {new Date(post.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' · '}{fmt12(post.scheduledAt)}
            </p>
            <p className="text-xs text-[#555] leading-relaxed line-clamp-3">{post.caption}</p>
          </div>

          {canPost && (
            <div className="flex flex-col gap-2">
              <button onClick={onPostNow}
                className="w-full py-2 rounded-xl text-xs font-bold text-white"
                style={{ background: post.platform === 'instagram'
                  ? 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)'
                  : pl.gradient }}>
                Post Now
              </button>
              {post.status === 'due' && (
                <button onClick={onMarkPosted}
                  className="w-full py-2 rounded-xl text-xs font-semibold border border-[#00C851]/30 text-[#00C851] hover:bg-[#00C851]/10 transition-colors">
                  Mark as Posted
                </button>
              )}
            </div>
          )}

          <button onClick={onDelete}
            className="w-full py-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors">
            Delete post
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Post Modal ───────────────────────────────────────────────────
function NewPostModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (post: Omit<ScheduledPost, 'id' | 'createdAt'>) => void;
}) {
  const [platform, setPlatform] = useState<'instagram' | 'tiktok' | 'youtube'>('instagram');
  const [caption, setCaption] = useState('');
  const [mediaPath, setMediaPath] = useState('');
  const [thumbnailPath, setThumbnailPath] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('12:00');
  const [clips, setClips] = useState<LibraryClip[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.electronAPI.scanLibrary() as { runs: { clips: LibraryClip[] }[] };
        setClips(r.runs.flatMap(run => run.clips).filter(c => c.filePath).slice(0, 12));
      } catch {}
    })();
  }, []);

  const pickFile = async () => {
    const r = await window.electronAPI.selectVideo();
    if (!r.cancelled && r.filePath) setMediaPath(r.filePath);
  };

  const handleSave = () => {
    if (!caption.trim() || !date) return;
    onSave({
      platform, caption, mediaPath, thumbnailPath,
      scheduledAt: new Date(`${date}T${time}`).toISOString(),
      status: 'scheduled',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[440px] bg-[#111] border border-[#222] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1c1c1c]">
          <h2 className="text-sm font-bold text-white">Schedule Post</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[#444] hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Platform */}
          <div>
            <p className="text-[10px] font-bold text-[#444] uppercase tracking-wider mb-2">Platform</p>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map(pl => (
                <button key={pl.id} onClick={() => setPlatform(pl.id)}
                  className="py-2 rounded-xl border text-xs font-bold transition-all"
                  style={platform === pl.id
                    ? { background: pl.bg, color: pl.color, borderColor: pl.border }
                    : { background: 'transparent', color: '#555', borderColor: '#222' }}>
                  {pl.name}
                </button>
              ))}
            </div>
          </div>

          {/* Caption */}
          <div>
            <p className="text-[10px] font-bold text-[#444] uppercase tracking-wider mb-2">Caption</p>
            <textarea value={caption} onChange={e => setCaption(e.target.value)}
              placeholder="Write your caption…" rows={3}
              className="w-full bg-black border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#333] resize-none focus:outline-none focus:border-[#00C851]/40 transition-colors" />
          </div>

          {/* Media */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-[#444] uppercase tracking-wider">Media (optional)</p>
              {clips.length > 0 && (
                <button onClick={() => setShowPicker(v => !v)}
                  className="text-[10px] text-[#555] hover:text-[#00C851] transition-colors">
                  {showPicker ? 'Hide library' : 'Pick from library'}
                </button>
              )}
            </div>

            {showPicker && (
              <div className="mb-3 border border-[#1e1e1e] rounded-xl p-3 bg-black/30">
                <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto">
                  {clips.map((clip, i) => (
                    <button key={i} onClick={() => { setMediaPath(clip.filePath!); if (clip.thumbnailPath) setThumbnailPath(clip.thumbnailPath); setShowPicker(false); }}
                      className={`rounded-lg overflow-hidden border transition-all ${mediaPath === clip.filePath ? 'border-[#00C851]' : 'border-[#1e1e1e] hover:border-[#333]'}`}>
                      {clip.thumbnailPath ? (
                        <img src={`localfile://${clip.thumbnailPath}`} alt="" className="w-full aspect-square object-cover" />
                      ) : (
                        <div className="w-full aspect-square bg-[#141414] flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={1.5} className="w-4 h-4">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mediaPath ? (
              <div className="flex items-center gap-2 bg-black border border-[#2a2a2a] rounded-xl px-3 py-2">
                {thumbnailPath && <img src={`localfile://${thumbnailPath}`} alt="" className="w-8 h-10 rounded object-cover shrink-0" />}
                <p className="text-xs text-white flex-1 truncate">{mediaPath.split('/').pop()}</p>
                <button onClick={() => { setMediaPath(''); setThumbnailPath(''); }} className="text-[#444] hover:text-red-400 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button onClick={pickFile}
                className="w-full border border-dashed border-[#222] rounded-xl p-3 text-xs text-[#444] hover:border-[#333] hover:text-white transition-all">
                Browse for file
              </button>
            )}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-[#444] uppercase tracking-wider mb-2">Date</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-black border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00C851]/40 transition-colors" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#444] uppercase tracking-wider mb-2">Time</p>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full bg-black border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00C851]/40 transition-colors" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[#222] text-xs text-[#555] hover:text-white hover:border-[#333] transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!caption.trim() || !date}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-black disabled:opacity-40 transition-colors"
              style={{ background: '#00C851' }}>
              Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Scheduler Page ──────────────────────────────────────────────
export default function Scheduler() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [view, setView] = useState<'month' | 'week' | 'queue'>('month');
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [igPostTarget, setIgPostTarget] = useState<ScheduledPost | null>(null);

  useEffect(() => {
    loadPosts();
    const cleanup = window.electronAPI.onPostDue?.(() => loadPosts());
    return () => { cleanup?.(); };
  }, []);

  const loadPosts = async () => {
    try {
      const r = await window.electronAPI.getScheduledPosts();
      if (Array.isArray(r)) setPosts(r as ScheduledPost[]);
    } catch { setPosts([]); }
  };

  const handleSavePost = async (data: Omit<ScheduledPost, 'id' | 'createdAt'>) => {
    const post: ScheduledPost = { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() };
    try { await window.electronAPI.saveScheduledPost({ ...post }); } catch {}
    setPosts(prev => [...prev, post].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()));
  };

  const handleDelete = async (id: string) => {
    try { await window.electronAPI.deleteScheduledPost(id); } catch {}
    setPosts(prev => prev.filter(p => p.id !== id));
    setSelectedPost(null);
  };

  const handleMarkPosted = async (id: string) => {
    try { await window.electronAPI.markPostAsPosted(id); } catch {}
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'posted', postedAt: new Date().toISOString() } : p));
    setSelectedPost(null);
  };

  const handlePostNow = (post: ScheduledPost) => {
    if (post.platform === 'instagram' && post.mediaPath) {
      setIgPostTarget(post);
      setSelectedPost(null);
    } else {
      // Non-IG: open in browser
      const urls: Record<string, string> = { tiktok: 'https://www.tiktok.com/upload', youtube: 'https://studio.youtube.com/' };
      (window as any).electronAPI.openPath(urls[post.platform] || 'https://www.instagram.com/');
    }
  };

  // ── Computed ──
  const streak = getStreak(posts);
  const now = new Date();
  const thisWeekPosts = posts.filter(p => {
    const d = new Date(p.scheduledAt);
    const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    return d >= start && d < end;
  });
  const upcoming = posts.filter(p => p.status !== 'posted').length;
  const due = posts.filter(p => p.status === 'due').length;

  // ── Month grid ──
  const getMonthData = () => {
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = d.getFullYear(); const month = d.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i));
    return { cells, year, month };
  };

  // ── Week days ──
  const getWeekDays = () => {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  };

  const { cells, year, month } = getMonthData();
  const weekDays = getWeekDays();
  const getPostsForDay = (day: Date) => posts.filter(p => isSameDay(new Date(p.scheduledAt), day));

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0f0f0f]">

      {/* Instagram post modal (triggered by "Post Now" for IG) */}
      {igPostTarget && igPostTarget.mediaPath && (
        <InstagramPostModal
          type="reel"
          filePath={igPostTarget.mediaPath}
          defaultCaption={igPostTarget.caption}
          onClose={() => setIgPostTarget(null)}
        />
      )}

      {/* New post modal */}
      {showNewModal && <NewPostModal onClose={() => setShowNewModal(false)} onSave={handleSavePost} />}

      {/* Post detail modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onDelete={() => handleDelete(selectedPost.id)}
          onMarkPosted={() => handleMarkPosted(selectedPost.id)}
          onPostNow={() => handlePostNow(selectedPost)}
        />
      )}

      {/* Header */}
      <div className="shrink-0 border-b border-[#1a1a1a] px-5 py-3.5 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-sm font-bold text-white">Content Calendar</h1>
          <p className="text-[10px] text-[#444] mt-0.5">Plan and schedule your posts</p>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4">
          {streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <span className="text-base">🔥</span>
              <div>
                <p className="text-sm font-bold text-amber-400 leading-none">{streak}</p>
                <p className="text-[8px] text-amber-400/60">day streak</p>
              </div>
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-bold text-white">{thisWeekPosts.length}</p>
            <p className="text-[8px] text-[#444]">this week</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-[#00C851]">{upcoming}</p>
            <p className="text-[8px] text-[#444]">upcoming</p>
          </div>
          {due > 0 && (
            <div className="text-center">
              <p className="text-sm font-bold text-amber-400 animate-pulse">{due}</p>
              <p className="text-[8px] text-[#444]">due now</p>
            </div>
          )}
        </div>

        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl text-black"
          style={{ background: '#00C851' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-3 h-3">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Post
        </button>
      </div>

      {/* View tabs + nav */}
      <div className="shrink-0 border-b border-[#1a1a1a] px-5 py-2 flex items-center gap-3">
        <div className="flex bg-[#141414] rounded-lg border border-[#1e1e1e] p-0.5">
          {(['month', 'week', 'queue'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold capitalize transition-all ${
                view === v ? 'bg-[#222] text-white' : 'text-[#444] hover:text-[#888]'
              }`}>
              {v}
            </button>
          ))}
        </div>

        {/* Month navigation */}
        {view === 'month' && (
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setMonthOffset(o => o - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#1e1e1e] text-[#444] hover:text-white hover:border-[#333] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <p className="text-xs font-semibold text-white w-28 text-center">{MONTH_NAMES[month]} {year}</p>
            <button onClick={() => setMonthOffset(o => o + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#1e1e1e] text-[#444] hover:text-white hover:border-[#333] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            {monthOffset !== 0 && (
              <button onClick={() => setMonthOffset(0)} className="text-[10px] text-[#444] hover:text-white transition-colors">Today</button>
            )}
          </div>
        )}

        {/* Week navigation */}
        {view === 'week' && (
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setWeekOffset(o => o - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#1e1e1e] text-[#444] hover:text-white hover:border-[#333] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button onClick={() => setWeekOffset(0)} className="text-[10px] text-[#444] hover:text-white transition-colors px-1">This Week</button>
            <button onClick={() => setWeekOffset(o => o + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#1e1e1e] text-[#444] hover:text-white hover:border-[#333] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">

        {/* ── Month View ── */}
        {view === 'month' && (
          <div>
            {/* Day labels */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map(d => (
                <p key={d} className="text-[9px] font-bold text-[#333] uppercase tracking-widest text-center py-1">{d}</p>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const dayPosts = getPostsForDay(day);
                const today = isSameDay(day, now);
                const isPast = day < new Date(now.getFullYear(), now.getMonth(), now.getDate());
                return (
                  <div key={i}
                    className={`min-h-[90px] rounded-xl border p-1.5 transition-colors ${
                      today ? 'border-[#00C851]/40 bg-[#00C851]/5' :
                      isPast ? 'border-[#141414] bg-[#0a0a0a]/50' :
                      'border-[#1a1a1a] bg-[#111] hover:border-[#222]'
                    }`}>
                    <p className={`text-[10px] font-bold mb-1 text-right ${today ? 'text-[#00C851]' : isPast ? 'text-[#333]' : 'text-[#555]'}`}>
                      {day.getDate()}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {dayPosts.slice(0, 3).map(post => (
                        <PostChip key={post.id} post={post} onClick={() => setSelectedPost(post)} />
                      ))}
                      {dayPosts.length > 3 && (
                        <p className="text-[8px] text-[#444] text-center">+{dayPosts.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Week View ── */}
        {view === 'week' && (
          <div className="grid grid-cols-7 gap-2 h-full">
            {weekDays.map((day, i) => {
              const dayPosts = getPostsForDay(day);
              const today = isSameDay(day, now);
              return (
                <div key={i} className={`rounded-xl border p-2.5 flex flex-col min-h-[400px] ${today ? 'border-[#00C851]/40 bg-[#00C851]/5' : 'border-[#1a1a1a] bg-[#111]'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-[9px] font-bold uppercase tracking-wider ${today ? 'text-[#00C851]' : 'text-[#444]'}`}>{DAY_LABELS[i]}</p>
                    <p className={`text-sm font-bold ${today ? 'text-[#00C851]' : 'text-[#555]'}`}>{day.getDate()}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    {dayPosts.map(post => (
                      <PostChip key={post.id} post={post} onClick={() => setSelectedPost(post)} />
                    ))}
                    {dayPosts.length === 0 && (
                      <button onClick={() => setShowNewModal(true)}
                        className="flex-1 flex items-center justify-center text-[10px] text-[#222] hover:text-[#444] transition-colors rounded-lg border border-dashed border-[#1a1a1a] hover:border-[#2a2a2a]">
                        +
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Queue View ── */}
        {view === 'queue' && (
          <div>
            {posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1e1e1e" strokeWidth={1} className="w-10 h-10 mb-4">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p className="text-sm text-[#444]">No posts scheduled</p>
                <p className="text-xs text-[#2a2a2a] mt-1">Click "New Post" to get started</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-w-2xl mx-auto">
                {/* Group by date */}
                {Object.entries(
                  posts.reduce((acc: Record<string, ScheduledPost[]>, p) => {
                    const key = new Date(p.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                    (acc[key] = acc[key] || []).push(p);
                    return acc;
                  }, {})
                ).map(([dateLabel, dayPosts]) => (
                  <div key={dateLabel}>
                    <p className="text-[10px] font-bold text-[#333] uppercase tracking-wider mb-2 mt-4 first:mt-0">{dateLabel}</p>
                    {dayPosts.map(post => {
                      const pl = PLATFORMS.find(p => p.id === post.platform)!;
                      return (
                        <button key={post.id} onClick={() => setSelectedPost(post)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#1a1a1a] bg-[#111] hover:border-[#2a2a2a] transition-colors mb-1.5 text-left">
                          {post.thumbnailPath ? (
                            <img src={`localfile://${post.thumbnailPath}`} alt="" className="w-10 h-14 rounded-lg object-cover shrink-0 border border-[#222]" />
                          ) : (
                            <div className="w-10 h-14 rounded-lg shrink-0 flex items-center justify-center border border-[#1e1e1e]"
                              style={{ background: pl.bg }}>
                              <span className="text-[8px] font-black" style={{ color: pl.color }}>{pl.abbr}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[9px] font-bold" style={{ color: pl.color }}>{pl.name}</span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                                post.status === 'posted' ? 'text-[#00C851] border-[#00C85140]' :
                                post.status === 'due' ? 'text-amber-400 border-amber-400/30' :
                                'text-[#444] border-[#222]'
                              }`}>
                                {post.status === 'due' ? '⏰ Due' : post.status === 'posted' ? '✓ Posted' : fmt12(post.scheduledAt)}
                              </span>
                            </div>
                            <p className="text-xs text-[#666] truncate">{post.caption}</p>
                          </div>
                          <svg viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2} className="w-3 h-3 shrink-0">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
