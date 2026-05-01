import React, { useState, useEffect } from 'react';
import type { Page } from '../App';
import type { StudioStats } from '../hooks/useStudioStats';

interface DashboardProps {
  onNavigate: (page: Page) => void;
  stats: StudioStats;
  hasBrandProfile?: boolean;
}

// ─── SVG Icons ────────────────────────────────────────────────────
const Icons = {
  Scissors: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
      <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>
      <line x1="8.12" y1="8.12" x2="12" y2="12"/>
    </svg>
  ),
  Carousel: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="5" y="3" width="14" height="18" rx="2"/>
      <line x1="1" y1="6" x2="1" y2="18"/><line x1="23" y1="6" x2="23" y2="18"/>
    </svg>
  ),
  VideoEdit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  BarChart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  Video: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  Brand: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/>
      <circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/>
      <path d="M12 22V12c0-5.5-7-7-7-7"/>
    </svg>
  ),
  Blog: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
  ),
};

const TOOLS: {
  page: Page;
  Icon: () => React.ReactElement;
  title: string;
  description: string;
  color: string;
  ready: boolean;
}[] = [
  {
    page: 'clips',
    Icon: Icons.Scissors,
    title: 'Clip Extractor',
    description: 'Upload a long video, find the strongest moments, and render vertical clips.',
    color: '#8B5CF6',
    ready: true,
  },
  {
    page: 'carousel',
    Icon: Icons.Carousel,
    title: 'Carousel Generator',
    description: 'Turn an idea, transcript, or clip into a brand-aligned Instagram deck.',
    color: '#00C851',
    ready: true,
  },
  {
    page: 'blog',
    Icon: Icons.Blog,
    title: 'Blog Post Writer',
    description: 'Turn transcripts into SEO-ready drafts that keep your voice intact.',
    color: '#3B82F6',
    ready: true,
  },
  {
    page: 'brand',
    Icon: Icons.Brand,
    title: 'Brand Studio',
    description: 'Define your visual identity. Colors, fonts, logo, and tone of voice.',
    color: '#F59E0B',
    ready: true,
  },
  {
    page: 'editor',
    Icon: Icons.VideoEdit,
    title: 'Video Editor',
    description: 'Preview, trim, and fine-tune finished clips before posting.',
    color: '#EC4899',
    ready: true,
  },
  {
    page: 'schedule',
    Icon: Icons.Calendar,
    title: 'Post Scheduler',
    description: 'Queue finished clips and posts through your connected 6FB tools.',
    color: '#EF4444',
    ready: true,
  },
];

const STATS = [
  { label: 'Clips Created',     key: 'clipsCreated'     as const, Icon: Icons.Scissors  },
  { label: 'Carousels Made',    key: 'carouselsMade'    as const, Icon: Icons.Carousel  },
  { label: 'Blog Posts Written', key: 'blogPostsWritten' as const, Icon: Icons.Blog      },
  { label: 'Videos Rendered',   key: 'videosRendered'   as const, Icon: Icons.Video     },
];

export default function Dashboard({ onNavigate, stats, hasBrandProfile }: DashboardProps) {
  // Today's Play state
  const [hasContentToken, setHasContentToken] = useState(false);
  const [briefLoading, setBriefLoading]       = useState(false);
  const [todayBrief, setTodayBrief]           = useState<{
    today: { topic: string; pillar: string | null; hookIdea: string | null; bestPostingTime: string | null; postId?: string } | null;
    week: { day: string; status: string }[];
  } | null>(null);
  const [todayPostId, setTodayPostId]         = useState<string | null>(null);
  const [playDone, setPlayDone]               = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await window.electronAPI.getAllSettings();
        const token = settings?.contentPlannerToken;
        if (!token || cancelled) return;
        setHasContentToken(true);
        setBriefLoading(true);
        const result = await window.electronAPI.fetchTodayBrief();
        if (cancelled) return;
        if (result.success && result.data) {
          setTodayBrief(result.data as any);
          const postId = (result.data as any)?.today?.id;
          if (postId) setTodayPostId(postId);
        }
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setBriefLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePlayAction = async (action: 'complete' | 'skip') => {
    if (!todayPostId) return;
    try {
      await (window.electronAPI as any).completeTodayPlay(todayPostId, action);
      setPlayDone(true);
    } catch { /* ignore */ }
  };

  const hasAnyOutput = stats.clipsCreated > 0 || stats.carouselsMade > 0 || stats.blogPostsWritten > 0 || stats.videosRendered > 0;
  const firstRunSteps = [
    { step: '1', title: 'Brand', body: hasBrandProfile === false ? 'Add your colors, logo, and tone.' : 'Brand profile is ready.', page: 'brand' as Page, done: hasBrandProfile !== false },
    { step: '2', title: 'Source Video', body: 'Choose a 3-20 minute talking-head or shop video.', page: 'clips' as Page, done: false },
    { step: '3', title: 'Publish Path', body: 'Preview the best clip, then schedule or export it.', page: 'schedule' as Page, done: false },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Brand Profile Setup Nudge */}
      {hasBrandProfile === false && (
        <div 
          onClick={() => onNavigate('brand')}
          className="mb-8 p-4 rounded-xl cursor-pointer hover:scale-[1.01] transition-all bg-6fb-card border border-6fb-border flex items-center gap-4 group"
          style={{ backgroundImage: 'linear-gradient(to right, rgba(245, 158, 11, 0.05), transparent)' }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#F59E0B]/20 text-[#F59E0B]">
            <Icons.Brand />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white mb-0.5">Action Required: Set up your Brand Profile</h3>
            <p className="text-xs text-6fb-text-secondary">
              Configure your colors, fonts, and logo so the AI can automatically style your clips and carousels.
            </p>
          </div>
          <div className="text-[#F59E0B] opacity-0 group-hover:opacity-100 transition-opacity">
            →
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">
          {hasAnyOutput ? 'Welcome back' : 'Start with one strong video'}
        </h1>
        <p className="text-sm text-6fb-text-secondary">
          A focused workspace for planning, extracting, and packaging content for your shop.
        </p>
      </div>

      {/* First-run workflow */}
      {!hasAnyOutput && (
        <div className="mb-8 border-y border-6fb-border py-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs font-bold text-6fb-green uppercase tracking-wider mb-1">Recommended first run</p>
              <h2 className="text-lg font-bold text-white">Build one usable post before exploring every tool.</h2>
            </div>
            <button
              onClick={() => onNavigate(hasBrandProfile === false ? 'brand' : 'clips')}
              className="shrink-0 rounded-lg bg-6fb-green px-3 py-2 text-xs font-bold text-black hover:bg-6fb-green-hover transition-colors"
            >
              {hasBrandProfile === false ? 'Set Brand' : 'Extract Clips'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {firstRunSteps.map(item => (
              <button
                key={item.step}
                onClick={() => onNavigate(item.page)}
                className="text-left rounded-lg border border-white/5 bg-black/20 p-3 hover:border-6fb-green/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${item.done ? 'bg-6fb-green text-black' : 'bg-white/10 text-6fb-text-secondary'}`}>
                    {item.step}
                  </span>
                  <span className="text-sm font-bold text-white">{item.title}</span>
                </div>
                <p className="text-xs text-6fb-text-secondary leading-relaxed">{item.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Today's Play Widget */}
      {!hasContentToken ? (
        <div
          onClick={() => onNavigate('settings')}
          className="mb-6 p-3 rounded-xl cursor-pointer bg-6fb-card border border-6fb-border flex items-center gap-3 hover:border-[#8B5CF6]/30 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#8B5CF6]/10 text-[#8B5CF6] flex-shrink-0">
            <Icons.Play />
          </div>
          <p className="text-xs text-6fb-text-secondary">
            Connect your Content Planner in Settings to see today's play →
          </p>
        </div>
      ) : briefLoading ? (
        <div className="mb-6 bg-6fb-card rounded-xl border border-6fb-border p-5 animate-pulse">
          <div className="h-3 bg-[#333] rounded w-1/3 mb-3" />
          <div className="h-5 bg-[#333] rounded w-2/3 mb-2" />
          <div className="h-3 bg-[#333] rounded w-1/2" />
        </div>
      ) : todayBrief ? (
        <div className="mb-6 bg-6fb-card rounded-xl border border-[#8B5CF6]/20 p-5" style={{ backgroundImage: 'linear-gradient(135deg, rgba(139,92,246,0.05) 0%, transparent 100%)' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 text-[#8B5CF6]"><Icons.Play /></div>
              <span className="text-xs font-bold text-[#8B5CF6] uppercase tracking-wider">Today's Play</span>
            </div>
            {todayBrief.today?.bestPostingTime && (
              <span className="text-[10px] bg-[#8B5CF6]/10 text-[#8B5CF6] rounded px-2 py-0.5">
                Best time: {todayBrief.today.bestPostingTime}
              </span>
            )}
          </div>

          {todayBrief.today ? (
            <>
              {/* Pillar pill */}
              {todayBrief.today.pillar && (
                <span
                  className="inline-block text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 mb-2"
                  style={{
                    backgroundColor: todayBrief.today.pillar.includes('skill') ? 'rgba(139,92,246,0.15)' :
                                     todayBrief.today.pillar.includes('person') ? 'rgba(0,200,81,0.15)' : 'rgba(59,130,246,0.15)',
                    color: todayBrief.today.pillar.includes('skill') ? '#8B5CF6' :
                           todayBrief.today.pillar.includes('person') ? '#00C851' : '#3B82F6',
                  }}
                >
                  {todayBrief.today.pillar}
                </span>
              )}
              {/* Topic */}
              <p className="text-white font-bold text-base mb-1">{todayBrief.today.topic}</p>
              {/* Hook */}
              {todayBrief.today.hookIdea && (
                <p className="text-xs text-6fb-text-secondary mb-3 line-clamp-1">{todayBrief.today.hookIdea}</p>
              )}
              {/* Week progress dots */}
              {todayBrief.week.length > 0 && (
                <div className="flex gap-1.5 mb-4">
                  {todayBrief.week.map((p, i) => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: p.status === 'completed' ? '#00C851' :
                                         p.status === 'skipped' ? '#555' : '#333',
                      }}
                      title={`${p.day}: ${p.status}`}
                    />
                  ))}
                </div>
              )}
              {/* Actions */}
              {playDone ? (
                <p className="text-xs text-6fb-green">Done! Play marked in your Content Planner.</p>
              ) : todayPostId ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePlayAction('complete')}
                    className="flex-1 text-xs font-bold py-2 rounded-lg bg-6fb-green/10 text-6fb-green hover:bg-6fb-green/20 transition-colors"
                  >
                    Mark Complete
                  </button>
                  <button
                    onClick={() => handlePlayAction('skip')}
                    className="text-xs py-2 px-4 rounded-lg bg-[#333]/50 text-6fb-text-secondary hover:bg-[#444]/50 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-6fb-text-muted">Open Content Planner to mark this complete.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-6fb-text-secondary">Rest day — no play scheduled today.</p>
          )}
        </div>
      ) : null}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {STATS.map(({ label, key, Icon }) => (
          <div key={key} className="bg-6fb-card rounded-xl border border-6fb-border p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-6fb-text-muted text-xs">{label}</span>
              <div className="w-4 h-4 text-6fb-text-muted"><Icon /></div>
            </div>
            <p className="text-2xl font-bold text-white">{stats[key]}</p>
          </div>
        ))}
      </div>

      {/* Tools Grid */}
      <h2 className="text-xs sm:text-sm font-bold text-[#555] uppercase tracking-widest mb-4">Your Tools</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TOOLS.map(tool => (
          <button
            key={tool.page}
            onClick={() => tool.ready && onNavigate(tool.page)}
            className={`text-left rounded-xl border p-5 transition-all relative overflow-hidden ${
              tool.ready
                ? 'hover:scale-[1.015] hover:shadow-xl cursor-pointer'
                : 'opacity-40 cursor-not-allowed'
            }`}
            style={{
              background: `linear-gradient(135deg, ${tool.color}14 0%, #1a1a1a 100%)`,
              borderColor: tool.ready ? `${tool.color}30` : '#222',
            }}
          >
            {/* Icon */}
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center p-2"
                style={{ backgroundColor: `${tool.color}20`, color: tool.color }}
              >
                <tool.Icon />
              </div>
              {!tool.ready && (
                <span className="text-[9px] bg-[#222] rounded px-2 py-1 text-[#555] uppercase font-bold tracking-wide">
                  Coming Soon
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold text-white mb-1">{tool.title}</h3>
            <p className="text-xs text-6fb-text-secondary leading-relaxed">{tool.description}</p>

            {/* Subtle corner glow */}
            {tool.ready && (
              <div
                className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-10 pointer-events-none"
                style={{ background: tool.color, filter: 'blur(20px)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Status bar */}
      <div className="mt-6 bg-6fb-card rounded-xl border border-6fb-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-6fb-green animate-pulse" />
          <span className="text-xs text-6fb-text-secondary">macOS runtime bundled - ready for pilot students</span>
        </div>
        <span className="text-[10px] text-6fb-text-muted">Claude supported</span>
      </div>
    </div>
  );
}
