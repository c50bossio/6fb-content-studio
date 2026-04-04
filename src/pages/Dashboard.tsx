import React from 'react';
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
    description: 'Upload a long video. AI selects the best moments and reframes to 9:16.',
    color: '#8B5CF6',
    ready: true,
  },
  {
    page: 'carousel',
    Icon: Icons.Carousel,
    title: 'Carousel Generator',
    description: 'Create professional Instagram carousels with AI. Brand-aligned slide decks.',
    color: '#00C851',
    ready: true,
  },
  {
    page: 'blog',
    Icon: Icons.Blog,
    title: 'Blog Post Writer',
    description: 'Transform video transcripts into SEO-ready blog posts with auto-images.',
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
    description: 'Remotion-powered editing. Add captions, transitions, music, effects.',
    color: '#EC4899',
    ready: false,
  },
  {
    page: 'schedule',
    Icon: Icons.Calendar,
    title: 'Post Scheduler',
    description: 'Connect Instagram, TikTok, YouTube. Schedule & batch upload content.',
    color: '#EF4444',
    ready: false,
  },
];

const STATS = [
  { label: 'Clips Created',     key: 'clipsCreated'     as const, Icon: Icons.Scissors  },
  { label: 'Carousels Made',    key: 'carouselsMade'    as const, Icon: Icons.Carousel  },
  { label: 'Blog Posts Written', key: 'blogPostsWritten' as const, Icon: Icons.Blog      },
  { label: 'Videos Rendered',   key: 'videosRendered'   as const, Icon: Icons.Video     },
];

export default function Dashboard({ onNavigate, stats, hasBrandProfile }: DashboardProps) {
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
        <h1 className="text-3xl font-bold text-white mb-1">Welcome back</h1>
        <p className="text-sm text-6fb-text-secondary">
          Your local AI content studio. Everything runs on your machine.
        </p>
      </div>

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
          <span className="text-xs text-6fb-text-secondary">All systems local — zero server costs</span>
        </div>
        <span className="text-[10px] text-6fb-text-muted">Powered by IX</span>
      </div>
    </div>
  );
}
