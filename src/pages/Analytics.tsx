import { useState, useEffect } from 'react';

interface AnalyticsData {
  counters: {
    clipsCreated: number;
    carouselsGenerated: number;
    videosRendered: number;
    postsScheduled: number;
  };
  activity: {
    date: string;
    clips: number;
    carousels: number;
    videos: number;
  }[];
  recentActions: {
    id: string;
    action: string;
    detail: string;
    timestamp: string;
  }[];
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const result = await window.electronAPI.getAnalytics();
      if (result) {
        setData(result as AnalyticsData);
      }
    } catch {
      // Browser fallback with mock data
      setData({
        counters: { clipsCreated: 0, carouselsGenerated: 0, videosRendered: 0, postsScheduled: 0 },
        activity: getLast7Days().map(date => ({
          date,
          clips: 0,
          carousels: 0,
          videos: 0,
        })),
        recentActions: [],
      });
    }
    setLoading(false);
  };

  const STAT_CARDS = [
    { key: 'clipsCreated', label: 'Clips Created', icon: '✂️', accent: 'from-purple-500/20 to-6fb-card', border: 'border-purple-500/20' },
    { key: 'carouselsGenerated', label: 'Carousels Made', icon: '🎠', accent: 'from-6fb-green/20 to-6fb-card', border: 'border-6fb-green/20' },
    { key: 'videosRendered', label: 'Videos Rendered', icon: '🎬', accent: 'from-blue-500/20 to-6fb-card', border: 'border-blue-500/20' },
    { key: 'postsScheduled', label: 'Posts Scheduled', icon: '📅', accent: 'from-orange-500/20 to-6fb-card', border: 'border-orange-500/20' },
  ];

  const CONTENT_TYPES = [
    { label: 'Clips', color: '#a855f7', key: 'clipsCreated' },
    { label: 'Carousels', color: '#00c851', key: 'carouselsGenerated' },
    { label: 'Videos', color: '#3b82f6', key: 'videosRendered' },
    { label: 'Posts', color: '#f97316', key: 'postsScheduled' },
  ];

  // Chart dimensions
  const chartW = 600;
  const chartH = 200;
  const barGap = 8;

  const activityData = data?.activity || [];
  const maxActivity = Math.max(
    1,
    ...activityData.map(d => d.clips + d.carousels + d.videos)
  );

  // Donut chart
  const counters = data?.counters;
  const total = counters
    ? counters.clipsCreated + counters.carouselsGenerated + counters.videosRendered + counters.postsScheduled
    : 0;

  const donutSegments = (() => {
    if (!counters || total === 0) return [];
    const values = [
      { value: counters.clipsCreated, color: '#a855f7' },
      { value: counters.carouselsGenerated, color: '#00c851' },
      { value: counters.videosRendered, color: '#3b82f6' },
      { value: counters.postsScheduled, color: '#f97316' },
    ];
    let offset = 0;
    return values.map(v => {
      const pct = (v.value / total) * 100;
      const seg = { pct, offset, color: v.color };
      offset += pct;
      return seg;
    });
  })();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-6fb-border border-t-6fb-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto animate-page-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <span className="px-2.5 py-1 bg-yellow-500/10 text-yellow-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-yellow-500/20">
            Local Data
          </span>
        </div>
        <p className="text-sm text-6fb-text-secondary">
          Track your content creation activity. All data stored locally.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {STAT_CARDS.map(stat => (
          <div
            key={stat.key}
            className={`bg-gradient-to-br ${stat.accent} rounded-xl border ${stat.border} p-4 transition-all hover:scale-[1.02]`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-6fb-text-muted">{stat.label}</span>
              <span className="text-lg">{stat.icon}</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {counters?.[stat.key as keyof typeof counters] ?? 0}
            </p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-[1fr_260px] gap-6 mb-8">
        {/* Activity Bar Chart */}
        <div className="bg-6fb-card rounded-2xl border border-6fb-border p-5">
          <h2 className="text-sm font-bold text-white mb-4">7-Day Activity</h2>

          <svg viewBox={`0 0 ${chartW} ${chartH + 30}`} className="w-full">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <g key={pct}>
                <line
                  x1={0}
                  y1={chartH - pct * chartH}
                  x2={chartW}
                  y2={chartH - pct * chartH}
                  stroke="#333333"
                  strokeWidth={0.5}
                  strokeDasharray="4 4"
                />
                <text
                  x={chartW + 4}
                  y={chartH - pct * chartH + 4}
                  fill="#555555"
                  fontSize={10}
                >
                  {Math.round(maxActivity * pct)}
                </text>
              </g>
            ))}

            {/* Bars */}
            {activityData.map((day, i) => {
              const totalDay = day.clips + day.carousels + day.videos;
              const barWidth = (chartW - barGap * activityData.length) / activityData.length;
              const x = i * (barWidth + barGap);
              const h = (totalDay / maxActivity) * chartH;

              // Stacked segments
              let yOffset = chartH;
              const segments = [
                { value: day.clips, color: '#a855f7' },
                { value: day.carousels, color: '#00c851' },
                { value: day.videos, color: '#3b82f6' },
              ];

              return (
                <g key={i}>
                  {/* Background bar */}
                  <rect
                    x={x}
                    y={0}
                    width={barWidth}
                    height={chartH}
                    fill="#1a1a1a"
                    rx={4}
                  />

                  {/* Stacked colored segments */}
                  {segments.map((seg, si) => {
                    const segH = (seg.value / maxActivity) * chartH;
                    yOffset -= segH;
                    return (
                      <rect
                        key={si}
                        x={x}
                        y={yOffset}
                        width={barWidth}
                        height={segH}
                        fill={seg.color}
                        opacity={0.7}
                        rx={si === segments.length - 1 ? 4 : 0}
                      />
                    );
                  })}

                  {/* Total label on top */}
                  {totalDay > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={chartH - h - 6}
                      textAnchor="middle"
                      fill="white"
                      fontSize={11}
                      fontWeight={600}
                    >
                      {totalDay}
                    </text>
                  )}

                  {/* Day label */}
                  <text
                    x={x + barWidth / 2}
                    y={chartH + 18}
                    textAnchor="middle"
                    fill="#555555"
                    fontSize={10}
                  >
                    {formatDayLabel(day.date)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4">
            {[
              { label: 'Clips', color: '#a855f7' },
              { label: 'Carousels', color: '#00c851' },
              { label: 'Videos', color: '#3b82f6' },
            ].map(leg => (
              <div key={leg.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: leg.color, opacity: 0.7 }} />
                <span className="text-[10px] text-6fb-text-muted">{leg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-6fb-card rounded-2xl border border-6fb-border p-5 flex flex-col items-center">
          <h2 className="text-sm font-bold text-white mb-4 self-start">Content Mix</h2>

          <div className="relative w-40 h-40 mb-4">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {/* Background ring */}
              <circle cx={50} cy={50} r={38} fill="none" stroke="#333333" strokeWidth={12} />

              {/* Segments */}
              {total > 0 ? (
                donutSegments.map((seg, i) => (
                  <circle
                    key={i}
                    cx={50}
                    cy={50}
                    r={38}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={12}
                    strokeDasharray={`${(seg.pct / 100) * 238.76} 238.76`}
                    strokeDashoffset={-(seg.offset / 100) * 238.76}
                    strokeLinecap="round"
                    opacity={0.8}
                  />
                ))
              ) : (
                <circle cx={50} cy={50} r={38} fill="none" stroke="#222222" strokeWidth={12} />
              )}
            </svg>

            {/* Center number */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold text-white">{total}</p>
              <p className="text-[9px] text-6fb-text-muted uppercase tracking-wider">Total</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-2 w-full">
            {CONTENT_TYPES.map(ct => (
              <div key={ct.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ct.color }} />
                  <span className="text-[11px] text-6fb-text-secondary">{ct.label}</span>
                </div>
                <span className="text-[11px] font-mono text-white">
                  {counters?.[ct.key as keyof typeof counters] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-6fb-card rounded-2xl border border-6fb-border p-5">
        <h2 className="text-sm font-bold text-white mb-4">Recent Activity</h2>

        {(!data?.recentActions || data.recentActions.length === 0) ? (
          <div className="text-center py-8">
            <span className="text-3xl mb-2 block opacity-30">📊</span>
            <p className="text-xs text-6fb-text-muted">
              No activity yet. Create clips, carousels, or schedule posts to see history here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.recentActions.slice(0, 10).map(action => (
              <div
                key={action.id}
                className="flex items-center gap-3 bg-6fb-bg rounded-lg p-3 border border-6fb-border/50"
              >
                <div className="w-8 h-8 rounded-lg bg-6fb-border/50 flex items-center justify-center">
                  <span className="text-sm">
                    {action.action.includes('clip') ? '✂️'
                      : action.action.includes('carousel') ? '🎠'
                      : action.action.includes('video') ? '🎬'
                      : '📱'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-white font-medium">{action.action}</p>
                  <p className="text-[10px] text-6fb-text-muted">{action.detail}</p>
                </div>
                <p className="text-[10px] text-6fb-text-muted">
                  {formatRelativeTime(action.timestamp)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString([], { weekday: 'short' });
}

function formatRelativeTime(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
