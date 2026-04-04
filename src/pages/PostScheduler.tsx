import { useState, useEffect } from 'react';

interface ScheduledPost {
  id: string;
  caption: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video' | 'carousel';
  hashtags: string[];
  scheduledFor: string;
  timezone: string;
  status: 'scheduled' | 'published' | 'failed' | 'cancelled';
  createdAt: string;
}

const MEDIA_ICONS: Record<string, string> = {
  video: '▶',
  image: '🖼',
  carousel: '🎠',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  published: 'text-6fb-green border-6fb-green/30 bg-6fb-green/10',
  failed: 'text-red-400 border-red-500/30 bg-red-500/10',
  cancelled: 'text-white/30 border-white/10 bg-white/5',
};

function groupByDate(posts: ScheduledPost[]): Record<string, ScheduledPost[]> {
  return posts.reduce((acc, post) => {
    const date = new Date(post.scheduledFor).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(post);
    return acc;
  }, {} as Record<string, ScheduledPost[]>);
}

export default function PostScheduler() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(false);

  const api = (window as any).electronAPI;
  const isElectron = !!api?.getScheduledQueue;

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    setError('');
    if (!isElectron) {
      // Browser mock
      setPosts([
        { id: '1', caption: 'This is how we price booth rent in Miami 🔥 #barbershop #6figures', mediaUrls: [], mediaType: 'video', hashtags: ['barbershop'], scheduledFor: new Date(Date.now() + 86400000).toISOString(), timezone: 'America/New_York', status: 'scheduled', createdAt: new Date().toISOString() },
        { id: '2', caption: '5 things every shop owner needs to know about hiring ✂️', mediaUrls: [], mediaType: 'carousel', hashtags: ['barber'], scheduledFor: new Date(Date.now() + 172800000).toISOString(), timezone: 'America/New_York', status: 'scheduled', createdAt: new Date().toISOString() },
      ]);
      setConfigured(true);
      setLoading(false);
      return;
    }

    try {
      const config = await api.getPublishingConfig() as { configured: boolean };
      setConfigured(config.configured);
      if (!config.configured) { setLoading(false); return; }

      const result = await api.getScheduledQueue() as { success: boolean; posts?: ScheduledPost[]; error?: string };
      if (result.success && result.posts) {
        setPosts(result.posts);
      } else {
        setError(result.error || 'Failed to load queue');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const grouped = groupByDate(posts.filter(p => p.status === 'scheduled'));
  const publishedCount = posts.filter(p => p.status === 'published').length;
  const failedCount = posts.filter(p => p.status === 'failed').length;

  if (!configured && !loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-6fb-card border border-6fb-border flex items-center justify-center mb-2">
          <svg className="w-6 h-6 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Publishing Bridge Not Connected</h2>
        <p className="text-sm text-6fb-text-muted max-w-sm">
          Go to <strong className="text-white">Settings → Publishing Bridge</strong> and add your Content Generator API key and email to connect the scheduler.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-6fb-bg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-6fb-border flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white">Publishing Queue</h1>
          <p className="text-xs text-6fb-text-muted mt-0.5">
            Posts are published automatically via the Content Generator cron
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-4 px-4 py-2 bg-6fb-card border border-6fb-border rounded-xl text-xs">
            <span className="text-white/50">{posts.filter(p => p.status === 'scheduled').length} <span className="text-blue-400 font-semibold">Scheduled</span></span>
            <span className="text-white/50">{publishedCount} <span className="text-6fb-green font-semibold">Published</span></span>
            {failedCount > 0 && <span className="text-white/50">{failedCount} <span className="text-red-400 font-semibold">Failed</span></span>}
          </div>
          <button
            onClick={loadQueue}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center bg-6fb-card border border-6fb-border rounded-lg hover:border-6fb-green/30 text-white/60 hover:text-white transition-all disabled:opacity-40"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-6 h-6 border-2 border-6fb-green border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-6fb-text-muted">Loading queue from Content Generator...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={loadQueue} className="text-xs text-6fb-green hover:text-green-300 transition-colors">Retry</button>
          </div>
        ) : posts.filter(p => p.status === 'scheduled').length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-6fb-card border border-6fb-border flex items-center justify-center text-2xl">📅</div>
            <div>
              <p className="text-white font-semibold mb-1">Queue is Empty</p>
              <p className="text-xs text-6fb-text-muted max-w-xs">
                Push content from the <strong className="text-white">Clip Extractor</strong>, <strong className="text-white">Carousel Studio</strong>, or <strong className="text-white">Blog Writer</strong> using the Schedule button.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, datePosts]) => (
              <div key={date}>
                <h3 className="text-xs font-bold text-6fb-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-6fb-border" />
                  {date}
                  <div className="h-px flex-1 bg-6fb-border" />
                </h3>
                <div className="space-y-2">
                  {datePosts.map(post => (
                    <div key={post.id} className="flex items-start gap-3 p-3 bg-6fb-card border border-6fb-border rounded-xl hover:border-white/20 transition-colors group">
                      {/* Media Type Icon */}
                      <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-6fb-border flex items-center justify-center text-base shrink-0">
                        {MEDIA_ICONS[post.mediaType] || '📄'}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white line-clamp-2 leading-snug">{post.caption}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-white/40">
                            {new Date(post.scheduledFor).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${STATUS_COLORS[post.status]}`}>
                            {post.status}
                          </span>
                          <span className="text-[9px] text-white/20 capitalize">{post.mediaType}</span>
                        </div>
                      </div>

                      {/* Instagram Icon */}
                      <div className="shrink-0 text-white/20 group-hover:text-white/50 transition-colors">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Published History */}
            {publishedCount > 0 && (
              <div>
                <h3 className="text-xs font-bold text-6fb-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-6fb-border" />
                  Recently Published ({publishedCount})
                  <div className="h-px flex-1 bg-6fb-border" />
                </h3>
                <div className="space-y-2">
                  {posts.filter(p => p.status === 'published').slice(0, 5).map(post => (
                    <div key={post.id} className="flex items-center gap-3 p-3 bg-6fb-card/50 border border-6fb-border/50 rounded-xl opacity-60">
                      <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-6fb-border/50 flex items-center justify-center text-base">
                        {MEDIA_ICONS[post.mediaType]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/70 line-clamp-1">{post.caption}</p>
                        <p className="text-[10px] text-6fb-green mt-0.5">✓ Published {new Date(post.scheduledFor).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
