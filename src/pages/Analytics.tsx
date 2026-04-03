import { useState, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────
interface LocalStats {
  totalRuns: number;
  totalClips: number;
  postedClips: number;
  totalCarousels: number;
  totalBlogs: number;
  totalScheduled: number;
  postedScheduled: number;
}

interface IgAccount {
  username: string;
  followers_count: number;
  media_count: number;
  profile_picture_url?: string;
}

interface IgMedia {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  caption?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  thumbnail_url?: string;
  media_url?: string;
  insights?: { reach?: number; plays?: number; impressions?: number };
}

interface AnalyticsData {
  localStats: LocalStats;
  igConnected: boolean;
  account: IgAccount | null;
  media: IgMedia[];
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────
const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const relDate = (iso: string) => {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  if (d < 604800000) return `${Math.floor(d / 86400000)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── Stat Card ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1e1e1e] bg-[#111] p-5 flex flex-col gap-3"
      style={{ boxShadow: `0 0 40px ${color}08` }}>
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}14`, border: `1px solid ${color}25` }}>
          <div className="w-4.5 h-4.5" style={{ color }}>{icon}</div>
        </div>
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20"
          style={{ background: color, transform: 'translate(40%, -40%)' }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        <p className="text-xs text-[#555] mt-0.5">{label}</p>
        {sub && <p className="text-[10px] mt-1" style={{ color }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Media Card ─────────────────────────────────────────────────────────
function MediaCard({ item }: { item: IgMedia }) {
  const isReel = item.media_type === 'VIDEO';
  const isCarousel = item.media_type === 'CAROUSEL_ALBUM';
  const thumb = item.thumbnail_url || item.media_url;
  const reach = item.insights?.reach ?? 0;
  const plays = item.insights?.plays ?? 0;

  return (
    <div className="rounded-xl border border-[#1e1e1e] bg-[#111] overflow-hidden group hover:border-[#2a2a2a] transition-colors">
      {/* Thumbnail */}
      <div className="relative bg-[#0a0a0a]" style={{ aspectRatio: '9/16' }}>
        {thumb ? (
          <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth={1} className="w-8 h-8">
              <rect x="2" y="2" width="20" height="20" rx="2"/>
            </svg>
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm"
            style={isReel
              ? { background: 'rgba(238,42,123,0.2)', color: '#f050a0', border: '1px solid rgba(238,42,123,0.3)' }
              : isCarousel
              ? { background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }
              : { background: 'rgba(100,100,100,0.2)', color: '#888', border: '1px solid rgba(100,100,100,0.3)' }
            }>
            {isReel ? 'Reel' : isCarousel ? 'Carousel' : 'Post'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="p-2.5 flex flex-col gap-1.5">
        <p className="text-[9px] text-[#444]">{relDate(item.timestamp)}</p>
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5 text-red-400">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span className="text-[10px] text-[#666]">{fmt(item.like_count ?? 0)}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5 text-blue-400">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="text-[10px] text-[#666]">{fmt(item.comments_count ?? 0)}</span>
          </div>
          {reach > 0 && (
            <div className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5 text-[#00C851]">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <span className="text-[10px] text-[#666]">{fmt(reach)}</span>
            </div>
          )}
          {plays > 0 && (
            <div className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5 text-purple-400">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span className="text-[10px] text-[#666]">{fmt(plays)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Analytics Page ─────────────────────────────────────────────────
export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await (window as any).electronAPI.getAnalytics();
      setData(result);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0f0f0f]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1e1e1e] border-t-[#00C851] rounded-full animate-spin" />
          <p className="text-xs text-[#444]">Loading analytics…</p>
        </div>
      </div>
    );
  }

  const ls = data?.localStats;
  const account = data?.account;
  const media = data?.media ?? [];
  const igConnected = data?.igConnected ?? false;

  // Engagement rate for top post
  const topPost = [...media].sort((a, b) => ((b.like_count ?? 0) + (b.comments_count ?? 0)) - ((a.like_count ?? 0) + (a.comments_count ?? 0)))[0];
  const totalEngagement = media.reduce((s, m) => s + (m.like_count ?? 0) + (m.comments_count ?? 0), 0);
  const avgEngagement = media.length ? Math.round(totalEngagement / media.length) : 0;
  const totalReach = media.reduce((s, m) => s + (m.insights?.reach ?? 0), 0);
  const totalPlays = media.reduce((s, m) => s + (m.insights?.plays ?? 0), 0);

  return (
    <div className="h-full overflow-y-auto bg-[#0f0f0f]">
      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-white">Analytics</h1>
            <p className="text-xs text-[#444] mt-0.5">Studio output + Instagram performance</p>
          </div>
          <button onClick={load}
            className="flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-lg px-3 py-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-3 h-3">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* IG Profile Banner (if connected) */}
        {igConnected && account && (
          <div className="mb-6 rounded-2xl border border-[#1e1e1e] bg-[#111] p-4 flex items-center gap-4">
            {account.profile_picture_url ? (
              <img src={account.profile_picture_url} alt=""
                className="w-12 h-12 rounded-full border border-[#2a2a2a] object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth={1.5} className="w-5 h-5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-bold text-white">@{account.username}</p>
              <p className="text-xs text-[#555]">Connected Instagram account</p>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-lg font-bold text-white">{fmt(account.followers_count)}</p>
                <p className="text-[10px] text-[#444]">Followers</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{fmt(account.media_count)}</p>
                <p className="text-[10px] text-[#444]">Posts</p>
              </div>
              {totalReach > 0 && (
                <div>
                  <p className="text-lg font-bold text-[#00C851]">{fmt(totalReach)}</p>
                  <p className="text-[10px] text-[#444]">Total reach</p>
                </div>
              )}
              {totalPlays > 0 && (
                <div>
                  <p className="text-lg font-bold text-purple-400">{fmt(totalPlays)}</p>
                  <p className="text-[10px] text-[#444]">Reel plays</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* IG Not Connected */}
        {!igConnected && (
          <div className="mb-6 rounded-2xl border border-[#1e1e1e] bg-[#111] px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)' }}>
              <svg viewBox="0 0 24 24" fill="white" width="14" height="14">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Instagram not connected</p>
              <p className="text-xs text-[#555]">Go to Settings → 6FB Account → Sync Instagram to unlock reach & engagement data</p>
            </div>
          </div>
        )}

        {/* Instagram Performance Stats */}
        {igConnected && media.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <StatCard label="Avg engagement" value={fmt(avgEngagement)}
              sub="per post" color="#00C851"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
            />
            <StatCard label="Total reach" value={fmt(totalReach)}
              sub="last 12 posts" color="#3B82F6"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>}
            />
            <StatCard label="Reel plays" value={fmt(totalPlays)}
              sub="last 12 posts" color="#8B5CF6"
              icon={<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
            />
            <StatCard label="Best post" value={fmt((topPost?.like_count ?? 0) + (topPost?.comments_count ?? 0))}
              sub="engagement" color="#F59E0B"
              icon={<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
            />
          </div>
        )}

        {/* Studio Output Stats */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-[#444] uppercase tracking-widest mb-3">Studio Output</h2>
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Videos processed" value={ls?.totalRuns ?? 0}
              sub={`${ls?.totalClips ?? 0} clips extracted`} color="#00C851"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>}
            />
            <StatCard label="Carousels made" value={ls?.totalCarousels ?? 0}
              sub="ready to post" color="#3B82F6"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><line x1="1" y1="6" x2="1" y2="18"/><line x1="23" y1="6" x2="23" y2="18"/></svg>}
            />
            <StatCard label="Blog posts" value={ls?.totalBlogs ?? 0}
              sub="written" color="#8B5CF6"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
            />
            <StatCard label="Posts published" value={ls?.postedScheduled ?? 0}
              sub={`${ls?.totalScheduled ?? 0} scheduled`} color="#F59E0B"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            />
          </div>
        </div>

        {/* Recent Posts Grid */}
        {igConnected && media.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-[#444] uppercase tracking-widest mb-3">Recent Instagram Posts</h2>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
              {media.map(item => <MediaCard key={item.id} item={item} />)}
            </div>
          </div>
        )}

        {/* Empty state */}
        {igConnected && media.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 text-[#1e1e1e] mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-full h-full">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <p className="text-sm text-[#444]">No posts found</p>
            <p className="text-xs text-[#2a2a2a] mt-1">Post your first Reel or Carousel from the Studio</p>
          </div>
        )}
      </div>
    </div>
  );
}
