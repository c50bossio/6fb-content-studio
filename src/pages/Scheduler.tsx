import { useState, useEffect } from 'react';

interface ScheduledPost {
  id: string;
  platform: 'instagram' | 'tiktok' | 'youtube';
  caption: string;
  mediaPath: string;
  scheduledAt: string;
  status: 'scheduled' | 'due' | 'posted' | 'failed';
  createdAt: string;
  postedAt?: string;
}

interface LibraryClip {
  clipId: string;
  title: string;
  filePath: string | null;
  thumbnailPath: string | null;
  contentType: string;
}

const PLATFORMS = [
  { id: 'instagram' as const, name: 'Instagram', abbr: 'IG', color: 'from-pink-500/20 to-purple-500/20', border: 'border-pink-500/20', text: 'text-pink-400', badge: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  { id: 'tiktok'    as const, name: 'TikTok',    abbr: 'TT', color: 'from-cyan-500/20 to-blue-500/20',   border: 'border-cyan-500/20',   text: 'text-cyan-400',   badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { id: 'youtube'   as const, name: 'YouTube',   abbr: 'YT', color: 'from-red-500/20 to-orange-500/20',  border: 'border-red-500/20',    text: 'text-red-400',    badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PLATFORM_URLS: Record<string, string> = {
  instagram: 'https://www.instagram.com/',
  tiktok: 'https://www.tiktok.com/upload',
  youtube: 'https://studio.youtube.com/',
};

export default function Scheduler() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<'calendar' | 'queue'>('calendar');

  // New post form
  const [newPlatform, setNewPlatform] = useState<'instagram' | 'tiktok' | 'youtube'>('instagram');
  const [newCaption, setNewCaption] = useState('');
  const [newMediaPath, setNewMediaPath] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('12:00');

  // Library picker
  const [libraryClips, setLibraryClips] = useState<LibraryClip[]>([]);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);

  useEffect(() => {
    loadPosts();
    const cleanup = window.electronAPI.onPostDue?.(() => loadPosts());
    return () => { cleanup?.(); };
  }, []);

  useEffect(() => {
    if (showModal) loadLibrary();
  }, [showModal]);

  const loadPosts = async () => {
    try {
      const result = await window.electronAPI.getScheduledPosts();
      if (result && Array.isArray(result)) setPosts(result as ScheduledPost[]);
    } catch { setPosts([]); }
  };

  const loadLibrary = async () => {
    setLibraryLoading(true);
    try {
      const result = await window.electronAPI.scanLibrary() as { runs: { clips: LibraryClip[] }[] };
      const clips = result.runs
        .flatMap(r => r.clips)
        .filter(c => c.filePath)
        .slice(0, 12);
      setLibraryClips(clips);
    } catch { setLibraryClips([]); }
    setLibraryLoading(false);
  };

  const handleSelectMedia = async () => {
    const result = await window.electronAPI.selectVideo();
    if (!result.cancelled && result.filePath) setNewMediaPath(result.filePath);
  };

  const handlePickFromLibrary = (clip: LibraryClip) => {
    if (clip.filePath) setNewMediaPath(clip.filePath);
    setShowLibraryPicker(false);
  };

  const handleAddPost = async () => {
    if (!newCaption.trim() || !newDate) return;
    const post: ScheduledPost = {
      id: Date.now().toString(),
      platform: newPlatform,
      caption: newCaption,
      mediaPath: newMediaPath,
      scheduledAt: new Date(`${newDate}T${newTime}`).toISOString(),
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };
    try { await window.electronAPI.saveScheduledPost({ ...post }); } catch {}
    setPosts(prev => [...prev, post].sort((a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    ));
    setNewCaption('');
    setNewMediaPath('');
    setNewDate('');
    setNewTime('12:00');
    setShowModal(false);
  };

  const handleDeletePost = async (id: string) => {
    try { await window.electronAPI.deleteScheduledPost(id); } catch {}
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const handlePostNow = async (post: ScheduledPost) => {
    try {
      const result = await window.electronAPI.postToSocial(post.platform, { caption: post.caption, mediaPath: post.mediaPath });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: result.success ? 'posted' as const : 'failed' as const } : p));
    } catch {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'failed' as const } : p));
    }
  };

  const handleMarkPosted = async (postId: string) => {
    try { await window.electronAPI.markPostAsPosted(postId); } catch {}
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, status: 'posted' as const, postedAt: new Date().toISOString() } : p
    ));
  };

  const handleCopyCaption = (caption: string) => navigator.clipboard.writeText(caption);

  const getWeekDays = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  };

  const weekDays = getWeekDays();
  const getPostsForDay = (date: Date) => posts.filter(p => new Date(p.scheduledAt).toDateString() === date.toDateString());
  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  const statusBadge = (status: ScheduledPost['status']) => {
    switch (status) {
      case 'scheduled': return 'bg-6fb-green/10 text-6fb-green border-6fb-green/20';
      case 'due':       return 'bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse';
      case 'posted':    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'failed':    return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
  };

  const platformAbbr = (platform: ScheduledPost['platform']) =>
    PLATFORMS.find(p => p.id === platform)?.abbr || 'NA';
  const platformBadge = (platform: ScheduledPost['platform']) =>
    PLATFORMS.find(p => p.id === platform)?.badge || '';

  return (
    <div className="p-8 max-w-5xl mx-auto animate-page-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">Scheduler</h1>
            <span className="px-2.5 py-1 bg-orange-500/10 text-orange-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-orange-500/20">
              Beta
            </span>
          </div>
          <p className="text-sm text-6fb-text-secondary">Plan and schedule content across platforms.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-6fb-green hover:bg-6fb-green-hover text-white font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 text-sm"
        >
          <span>+</span> New Post
        </button>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-6fb-card rounded-lg border border-6fb-border p-1 flex gap-1">
          {(['calendar', 'queue'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                view === v ? 'bg-6fb-green/10 text-6fb-green' : 'text-6fb-text-muted hover:text-white'
              }`}
            >
              {v === 'calendar' ? 'Calendar' : 'Queue'}
            </button>
          ))}
        </div>

        {view === 'calendar' && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className="w-8 h-8 rounded-lg border border-6fb-border text-6fb-text-muted hover:text-white hover:border-6fb-text-muted transition-colors flex items-center justify-center text-sm"
            >
              ‹
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-6fb-text-secondary hover:text-white transition-colors px-2"
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className="w-8 h-8 rounded-lg border border-6fb-border text-6fb-text-muted hover:text-white hover:border-6fb-text-muted transition-colors flex items-center justify-center text-sm"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="grid grid-cols-7 gap-2 animate-fade-in">
          {weekDays.map((day, i) => {
            const dayPosts = getPostsForDay(day);
            const today = isToday(day);
            return (
              <div
                key={i}
                className={`bg-6fb-card rounded-xl border p-3 min-h-[180px] ${today ? 'border-6fb-green/40' : 'border-6fb-border'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${today ? 'text-6fb-green' : 'text-6fb-text-muted'}`}>
                    {DAYS[i]}
                  </p>
                  <p className={`text-lg font-bold ${today ? 'text-6fb-green' : 'text-white'}`}>{day.getDate()}</p>
                </div>
                <div className="space-y-2">
                  {dayPosts.map(post => (
                    <div key={post.id} className="bg-6fb-bg rounded-lg p-2 border border-6fb-border/50">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${platformBadge(post.platform)}`}>
                          {platformAbbr(post.platform)}
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${statusBadge(post.status)}`}>
                          {post.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-6fb-text-secondary line-clamp-2">{post.caption}</p>
                      <p className="text-[9px] text-6fb-text-muted mt-1">
                        {new Date(post.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                  {dayPosts.length === 0 && (
                    <p className="text-[10px] text-6fb-text-muted/50 text-center py-4">No posts</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Queue View */}
      {view === 'queue' && (
        <div className="space-y-3 animate-fade-in">
          {posts.length === 0 ? (
            <div className="bg-6fb-card rounded-xl border border-6fb-border p-12 text-center">
              <div className="w-10 h-10 mx-auto mb-4 text-6fb-text-muted/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <p className="text-sm text-6fb-text-secondary mb-1">No posts scheduled</p>
              <p className="text-xs text-6fb-text-muted">Click "New Post" to get started</p>
            </div>
          ) : (
            posts.map(post => {
              const platform = PLATFORMS.find(p => p.id === post.platform)!;
              return (
                <div
                  key={post.id}
                  className={`bg-gradient-to-r ${platform.color} rounded-xl border ${platform.border} p-4 flex items-center gap-4`}
                >
                  <span className={`text-xs font-black px-2 py-1 rounded border ${platform.badge} shrink-0`}>
                    {platform.abbr}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white">{platform.name}</p>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${statusBadge(post.status)}`}>
                        {post.status}
                      </span>
                    </div>
                    <p className="text-xs text-6fb-text-secondary truncate">{post.caption}</p>
                    <p className="text-[10px] text-6fb-text-muted mt-1">
                      {new Date(post.scheduledAt).toLocaleString([], {
                        weekday: 'short', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {(post.status === 'scheduled' || post.status === 'due') && (
                      <>
                        <button
                          onClick={() => handleCopyCaption(post.caption)}
                          className="text-xs bg-white/5 text-6fb-text-secondary px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors font-medium border border-6fb-border"
                        >
                          Copy
                        </button>
                        <a
                          href={PLATFORM_URLS[post.platform]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-white/5 text-6fb-text-secondary px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors font-medium border border-6fb-border"
                        >
                          Open {platform.name}
                        </a>
                      </>
                    )}
                    {post.status === 'due' && (
                      <button
                        onClick={() => handleMarkPosted(post.id)}
                        className="text-xs bg-6fb-green/10 text-6fb-green px-3 py-1.5 rounded-lg hover:bg-6fb-green/20 transition-colors font-medium border border-6fb-green/20"
                      >
                        Mark Posted
                      </button>
                    )}
                    {post.status === 'scheduled' && (
                      <button
                        onClick={() => handlePostNow(post)}
                        className="text-xs bg-6fb-green/10 text-6fb-green px-3 py-1.5 rounded-lg hover:bg-6fb-green/20 transition-colors font-medium border border-6fb-green/20"
                      >
                        Post Now
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="text-xs text-6fb-text-muted hover:text-red-400 px-2 py-1.5 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Platform Connect Cards */}
      <div className="mt-8">
        <h2 className="text-sm font-bold text-6fb-text-muted uppercase tracking-wider mb-3">Connected Platforms</h2>
        <div className="grid grid-cols-3 gap-3">
          {PLATFORMS.map(p => (
            <div key={p.id} className={`bg-6fb-card rounded-xl border ${p.border} p-4 flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-black px-2 py-1 rounded border ${p.badge}`}>{p.abbr}</span>
                <div>
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-[10px] text-6fb-text-muted">Not connected</p>
                </div>
              </div>
              <span className="text-[9px] bg-6fb-border rounded px-2 py-1 text-6fb-text-muted uppercase font-bold">Soon</span>
            </div>
          ))}
        </div>
      </div>

      {/* New Post Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-6fb-card border border-6fb-border rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Schedule Post</h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg bg-6fb-bg border border-6fb-border flex items-center justify-center text-6fb-text-muted hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Platform */}
            <label className="text-[10px] font-bold text-6fb-text-muted uppercase tracking-wider mb-2 block">Platform</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setNewPlatform(p.id)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                    newPlatform === p.id
                      ? 'border-6fb-green bg-6fb-green/10 text-6fb-green'
                      : 'border-6fb-border text-6fb-text-secondary hover:border-6fb-text-muted'
                  }`}
                >
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${p.badge}`}>{p.abbr}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>

            {/* Caption */}
            <label className="text-[10px] font-bold text-6fb-text-muted uppercase tracking-wider mb-2 block">Caption</label>
            <textarea
              value={newCaption}
              onChange={e => setNewCaption(e.target.value)}
              placeholder="Write your caption..."
              rows={3}
              className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-white text-sm placeholder-6fb-text-muted focus:outline-none focus:border-6fb-green transition-colors resize-none mb-4"
            />

            {/* Media — file picker + library */}
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-6fb-text-muted uppercase tracking-wider">Media</label>
              {libraryClips.length > 0 && (
                <button
                  onClick={() => setShowLibraryPicker(v => !v)}
                  className={`text-[10px] font-semibold transition-colors ${showLibraryPicker ? 'text-6fb-green' : 'text-6fb-text-muted hover:text-white'}`}
                >
                  {showLibraryPicker ? 'Hide Library' : 'Pick from Library'}
                </button>
              )}
            </div>

            {/* Library Picker */}
            {showLibraryPicker && (
              <div className="mb-3 bg-6fb-bg border border-6fb-border rounded-xl p-3 animate-fade-in">
                <p className="text-[10px] text-6fb-text-muted uppercase tracking-wider font-bold mb-2">Recent Clips</p>
                {libraryLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-5 h-5 border-2 border-6fb-border border-t-6fb-green rounded-full animate-spin" />
                  </div>
                ) : libraryClips.length === 0 ? (
                  <p className="text-xs text-6fb-text-muted text-center py-3">No clips extracted yet</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {libraryClips.map((clip, i) => (
                      <button
                        key={i}
                        onClick={() => handlePickFromLibrary(clip)}
                        className={`rounded-lg border overflow-hidden text-left transition-all hover:border-6fb-green/50 group ${
                          newMediaPath === clip.filePath ? 'border-6fb-green' : 'border-6fb-border'
                        }`}
                      >
                        {clip.thumbnailPath ? (
                          <img
                            src={`localfile://${clip.thumbnailPath}`}
                            alt={clip.title}
                            className="w-full h-14 object-cover"
                          />
                        ) : (
                          <div className="w-full h-14 bg-6fb-card flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-6fb-text-muted">
                              <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                          </div>
                        )}
                        <div className="p-1.5">
                          <p className="text-[9px] text-6fb-text-secondary truncate font-medium group-hover:text-white transition-colors">{clip.title}</p>
                          <p className="text-[8px] text-6fb-text-muted uppercase">{clip.contentType}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected or browse */}
            {!newMediaPath ? (
              <button
                onClick={handleSelectMedia}
                className="w-full border border-dashed border-6fb-border rounded-lg p-3 text-xs text-6fb-text-secondary hover:border-6fb-green/50 hover:text-white transition-all mb-4"
              >
                Browse for a file
              </button>
            ) : (
              <div className="bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 flex items-center justify-between mb-4">
                <p className="text-xs text-white truncate max-w-[300px]">{newMediaPath.split('/').pop()}</p>
                <button onClick={() => setNewMediaPath('')} className="text-xs text-6fb-text-muted hover:text-red-400 ml-2 shrink-0">✕</button>
              </div>
            )}

            {/* Date / Time */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="text-[10px] font-bold text-6fb-text-muted uppercase tracking-wider mb-2 block">Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-6fb-green transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-6fb-text-muted uppercase tracking-wider mb-2 block">Time</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-6fb-green transition-colors"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-6fb-border text-6fb-text-secondary py-2.5 rounded-lg text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPost}
                disabled={!newCaption.trim() || !newDate}
                className="flex-1 bg-6fb-green hover:bg-6fb-green-hover disabled:bg-6fb-border disabled:text-6fb-text-muted text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
