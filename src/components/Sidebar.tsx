import React from 'react';
import type { Page } from '../App';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const NavIcons: Record<string, () => React.ReactElement> = {
  dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  clips: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  carousel: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="5" y="3" width="14" height="18" rx="2"/><line x1="1" y1="6" x2="1" y2="18"/><line x1="23" y1="6" x2="23" y2="18"/>
    </svg>
  ),
  brand: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/>
      <circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/>
      <path d="M12 22V12c0-5.5-7-7-7-7"/>
    </svg>
  ),
  editor: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  schedule: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  analytics: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  blog: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
    </svg>
  ),
};

const GLOBAL_ITEMS: { page: Page; label: string; ready: boolean }[] = [
  { page: 'brand',     label: 'Brand Studio',   ready: true  },
  { page: 'analytics', label: 'Analytics',      ready: false },
  { page: 'schedule',  label: 'Scheduler',      ready: false },
];

const ENGINE_ITEMS: { page: Page; label: string; ready: boolean; subtitle?: string }[] = [
  { page: 'clips',     label: 'Clips',          ready: true  },
  { page: 'carousel',  label: 'Carousel',       ready: true  },
  { page: 'blog',      label: 'Blog Writer',    ready: true  },
  { page: 'editor',    label: 'Video Editor',   ready: false },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-[220px] h-full bg-6fb-card border-r border-6fb-border flex flex-col pt-4 shrink-0">
      <button onClick={() => onNavigate('dashboard')} className="px-5 mb-6 text-left hover:opacity-80 transition-opacity">
        <div className="flex items-center gap-3">
          <img src="/6fb-logo.png" alt="6FB" className="w-9 h-9 rounded-lg object-contain" />
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Content Studio</h1>
            <p className="text-[10px] text-6fb-text-muted">by 6FB Mentorship</p>
          </div>
        </div>
      </button>

      <nav className="flex-1 px-3 space-y-0.5">
        {/* Dashboard */}
        <button
          onClick={() => onNavigate('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all mb-3 ${
            currentPage === 'dashboard' ? 'bg-6fb-green/10 text-6fb-green' : 'text-6fb-text-secondary hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="shrink-0"><NavIcons.dashboard /></span>
          <span>Dashboard</span>
        </button>

        {/* Content Engines Pipeline */}
        <div className="mb-4">
          {ENGINE_ITEMS.map(item => {
            const active = currentPage === item.page;
            const IconComp = NavIcons[item.page];
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                  active ? 'bg-6fb-green/10 text-6fb-green' : 'text-6fb-text-secondary hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="shrink-0"><IconComp /></span>
                <span>{item.label}</span>
                {item.subtitle && !item.ready ? null : item.subtitle ? (
                  <span className="ml-auto text-[9px] border border-blue-500/20 text-blue-400 bg-blue-500/10 rounded px-1.5 py-0.5 uppercase font-bold tracking-wide">
                    {item.subtitle}
                  </span>
                ) : null}
                {!item.ready && (
                  <span className="ml-auto text-[9px] bg-6fb-border rounded px-1.5 py-0.5 text-6fb-text-muted uppercase font-bold tracking-wide">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="h-[1px] bg-6fb-border/50 mx-3 my-4"></div>

        {/* Global Strategy Tools */}
        <div>
          {GLOBAL_ITEMS.map(item => {
            const active = currentPage === item.page;
            const IconComp = NavIcons[item.page];
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                  active ? 'bg-6fb-green/10 text-6fb-green' : 'text-6fb-text-secondary hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="shrink-0"><IconComp /></span>
                <span>{item.label}</span>
                {!item.ready && (
                  <span className="ml-auto text-[9px] bg-6fb-border rounded px-1.5 py-0.5 text-6fb-text-muted uppercase font-bold tracking-wide">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="px-4 py-4 border-t border-6fb-border">
        <button
          onClick={() => onNavigate('settings')}
          className={`flex items-center gap-2.5 text-xs transition-colors w-full ${
            currentPage === 'settings' ? 'text-6fb-green' : 'text-6fb-text-muted hover:text-white'
          }`}
        >
          <NavIcons.settings />
          <span>Settings</span>
        </button>
        <p className="text-[9px] text-6fb-text-muted mt-2.5">v1.1.0</p>
      </div>
    </aside>
  );
}
