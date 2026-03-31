type Page = 'dashboard' | 'clips' | 'carousel' | 'editor' | 'schedule' | 'analytics';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

const TOOLS = [
  {
    page: 'clips' as Page,
    icon: '✂️',
    title: 'Clip Extractor',
    description: 'Upload a long video, AI selects the best moments, face-track reframe to 9:16.',
    accent: 'from-purple-500/20 to-6fb-card',
    border: 'border-purple-500/20',
    ready: true,
  },
  {
    page: 'carousel' as Page,
    icon: '🎠',
    title: 'Carousel Generator',
    description: 'Create professional Instagram carousels with AI. Educational or product style.',
    accent: 'from-6fb-green/20 to-6fb-card',
    border: 'border-6fb-green/20',
    ready: true,
  },
  {
    page: 'editor' as Page,
    icon: '🎬',
    title: 'Video Editor',
    description: 'Remotion-powered editing. Add captions, transitions, music, effects.',
    accent: 'from-blue-500/20 to-6fb-card',
    border: 'border-blue-500/20',
    ready: false,
  },
  {
    page: 'schedule' as Page,
    icon: '📅',
    title: 'Post Scheduler',
    description: 'Connect Instagram, TikTok, YouTube. Schedule & batch upload content.',
    accent: 'from-orange-500/20 to-6fb-card',
    border: 'border-orange-500/20',
    ready: false,
  },
  {
    page: 'analytics' as Page,
    icon: '📊',
    title: 'Content Analytics',
    description: 'Track performance across platforms. AI recommendations on what works.',
    accent: 'from-yellow-500/20 to-6fb-card',
    border: 'border-yellow-500/20',
    ready: false,
  },
];

export default function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Welcome back 👋</h1>
        <p className="text-sm text-6fb-text-secondary">
          Your local AI content studio. Everything runs on your machine.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Clips Created', value: '0', icon: '✂️' },
          { label: 'Carousels Made', value: '0', icon: '🎠' },
          { label: 'Videos Rendered', value: '0', icon: '🎬' },
        ].map((stat, i) => (
          <div key={i} className="bg-6fb-card rounded-xl border border-6fb-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-6fb-text-muted text-xs">{stat.label}</span>
              <span className="text-lg">{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tools Grid */}
      <h2 className="text-lg font-bold text-white mb-4">Your Tools</h2>
      <div className="grid grid-cols-2 gap-4">
        {TOOLS.map(tool => (
          <button
            key={tool.page}
            onClick={() => tool.ready && onNavigate(tool.page)}
            className={`text-left bg-gradient-to-br ${tool.accent} rounded-xl border ${tool.border} p-5 transition-all ${
              tool.ready
                ? 'hover:scale-[1.02] hover:shadow-lg cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{tool.icon}</span>
              {!tool.ready && (
                <span className="text-[9px] bg-6fb-border rounded px-2 py-1 text-6fb-text-muted uppercase font-bold">
                  Phase 2
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white mb-1">{tool.title}</h3>
            <p className="text-xs text-6fb-text-secondary leading-relaxed">{tool.description}</p>
          </button>
        ))}
      </div>

      {/* Status */}
      <div className="mt-8 bg-6fb-card rounded-xl border border-6fb-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-6fb-green animate-pulse" />
          <span className="text-xs text-6fb-text-secondary">All systems local — zero server costs</span>
        </div>
        <span className="text-[10px] text-6fb-text-muted">Powered by IX</span>
      </div>
    </div>
  );
}
