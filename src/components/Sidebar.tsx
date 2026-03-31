type Page = 'dashboard' | 'clips' | 'carousel' | 'editor' | 'schedule' | 'analytics' | 'settings';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const NAV_ITEMS: { page: Page; icon: string; label: string; ready: boolean }[] = [
  { page: 'dashboard', icon: '🏠', label: 'Dashboard', ready: true },
  { page: 'clips', icon: '✂️', label: 'Clip Extractor', ready: true },
  { page: 'carousel', icon: '🎠', label: 'Carousel', ready: true },
  { page: 'editor', icon: '🎬', label: 'Video Editor', ready: false },
  { page: 'schedule', icon: '📅', label: 'Scheduler', ready: false },
  { page: 'analytics', icon: '📊', label: 'Analytics', ready: false },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-[220px] h-full bg-6fb-card border-r border-6fb-border flex flex-col pt-4 shrink-0">
      {/* Logo */}
      <div className="px-5 mb-8">
        <div className="flex items-center gap-3">
          <img src="/6fb-logo.png" alt="6FB" className="w-9 h-9 rounded-lg object-contain" />
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Content Studio</h1>
            <p className="text-[10px] text-6fb-text-muted">by 6FB Mentorship</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const active = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-6fb-green/10 text-6fb-green'
                  : 'text-6fb-text-secondary hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
              {!item.ready && (
                <span className="ml-auto text-[9px] bg-6fb-border rounded px-1.5 py-0.5 text-6fb-text-muted uppercase font-bold">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-5 py-4 border-t border-6fb-border">
        <button
          onClick={() => onNavigate('settings')}
          className={`flex items-center gap-2 text-xs transition-colors ${
            currentPage === 'settings' ? 'text-6fb-green' : 'text-6fb-text-muted hover:text-white'
          }`}
        >
          <span>⚙️</span>
          <span>Settings</span>
        </button>
        <p className="text-[9px] text-6fb-text-muted mt-2">v1.0.0 — Phase 2</p>
      </div>
    </aside>
  );
}
