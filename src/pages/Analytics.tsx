import { useEffect, useMemo, useState } from 'react';
import type { ContentStrategyBrief, PackageVariant } from '../types/content-strategy';

interface ClipRecord {
  id: string;
  title: string;
  score: number;
  strategyLabel?: string;
  packageVariant?: PackageVariant | null;
  strategyBrief?: ContentStrategyBrief | null;
  sourceVideo: string;
  runId: string;
  createdAt: number;
}

interface MetricsRecord {
  views: number;
  saves: number;
  shares: number;
  comments: number;
  retentionPct: number;
  clickThroughPct: number;
  updatedAt: string;
}

const emptyMetrics: MetricsRecord = {
  views: 0,
  saves: 0,
  shares: 0,
  comments: 0,
  retentionPct: 0,
  clickThroughPct: 0,
  updatedAt: '',
};

function metricsKey() {
  return 'contentStrategy:clipMetrics';
}

function loadMetrics(): Record<string, MetricsRecord> {
  try {
    const raw = localStorage.getItem(metricsKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMetrics(metrics: Record<string, MetricsRecord>) {
  localStorage.setItem(metricsKey(), JSON.stringify(metrics));
}

function predictedScore(score: number) {
  if (!Number.isFinite(score)) return 0;
  return score <= 1 ? Math.round(score * 100) : Math.round(score);
}

function actualScore(metrics?: MetricsRecord) {
  if (!metrics) return 0;
  const engagement = (metrics.views * 0.05) + (metrics.saves * 3) + (metrics.shares * 5) + (metrics.comments * 2);
  const quality = (metrics.retentionPct * 0.35) + (metrics.clickThroughPct * 2);
  return Math.min(100, Math.round((engagement / 20) + quality));
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Analytics() {
  const [clips, setClips] = useState<ClipRecord[]>([]);
  const [metrics, setMetrics] = useState<Record<string, MetricsRecord>>(() => loadMetrics());
  const [selectedClipId, setSelectedClipId] = useState('');
  const selectedClip = clips.find(c => c.id === selectedClipId) || clips[0] || null;
  const selectedMetrics = selectedClip ? metrics[selectedClip.id] || emptyMetrics : emptyMetrics;

  useEffect(() => {
    async function load() {
      try {
        const result = await window.electronAPI.scanLibrary() as { runs?: any[] };
        const flattened = (result.runs || []).flatMap(run => (run.clips || []).map((clip: any, idx: number) => ({
          id: String(clip.clipId || `${run.runId}-${idx}`),
          title: clip.title || clip.label || 'Untitled Clip',
          score: predictedScore(Number(clip.score || 0)),
          strategyLabel: clip.strategyLabel || '',
          packageVariant: clip.packageVariant || null,
          strategyBrief: clip.strategyBrief || run.strategyBrief || null,
          sourceVideo: run.sourceVideo || 'Unknown video',
          runId: run.runId,
          createdAt: Number(run.timestamp) || Date.now(),
        })));
        setClips(flattened);
        if (!selectedClipId && flattened[0]) setSelectedClipId(flattened[0].id);
      } catch {
        setClips([]);
      }
    }
    load();
  }, []);

  const rows = useMemo(() => clips.map(clip => {
    const actual = actualScore(metrics[clip.id]);
    return {
      clip,
      predicted: predictedScore(clip.score),
      actual,
      delta: actual ? actual - predictedScore(clip.score) : 0,
      hasMetrics: Boolean(metrics[clip.id]?.updatedAt),
    };
  }).sort((a, b) => (b.hasMetrics ? b.delta : -999) - (a.hasMetrics ? a.delta : -999)), [clips, metrics]);

  const withMetrics = rows.filter(row => row.hasMetrics);
  const topPerformer = withMetrics[0];
  const underperformer = [...withMetrics].sort((a, b) => a.delta - b.delta)[0];

  const updateMetric = (key: keyof MetricsRecord, value: string) => {
    if (!selectedClip) return;
    const numeric = Math.max(0, Number(value) || 0);
    const next = {
      ...metrics,
      [selectedClip.id]: {
        ...selectedMetrics,
        [key]: numeric,
        updatedAt: new Date().toISOString(),
      },
    };
    setMetrics(next);
    saveMetrics(next);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0f0f0f] px-6 py-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Content Analytics</h1>
          <p className="text-sm text-6fb-text-muted mt-1">Track predicted quality against real performance signals.</p>
        </div>

        <div className="grid grid-cols-12 gap-5 mb-6">
          <div className="col-span-4 bg-6fb-card border border-6fb-border rounded-xl p-5">
            <p className="text-[10px] font-bold text-6fb-text-muted uppercase tracking-widest mb-2">Tracked Clips</p>
            <p className="text-3xl font-black text-white">{clips.length}</p>
            <p className="text-xs text-6fb-text-muted mt-1">{withMetrics.length} with entered metrics</p>
          </div>
          <div className="col-span-4 bg-6fb-card border border-6fb-border rounded-xl p-5">
            <p className="text-[10px] font-bold text-6fb-text-muted uppercase tracking-widest mb-2">Best Overperformer</p>
            <p className="text-sm font-bold text-white truncate">{topPerformer?.clip.title || 'No metrics yet'}</p>
            <p className="text-xs text-6fb-green mt-1">{topPerformer ? `+${Math.max(0, topPerformer.delta)} vs prediction` : 'Enter metrics to compare'}</p>
          </div>
          <div className="col-span-4 bg-6fb-card border border-6fb-border rounded-xl p-5">
            <p className="text-[10px] font-bold text-6fb-text-muted uppercase tracking-widest mb-2">Needs Review</p>
            <p className="text-sm font-bold text-white truncate">{underperformer?.clip.title || 'No metrics yet'}</p>
            <p className="text-xs text-red-400 mt-1">{underperformer ? `${underperformer.delta} vs prediction` : 'No underperformers yet'}</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-5 bg-6fb-card border border-6fb-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-6fb-border">
              <p className="text-xs font-bold text-white">Clip Predictions</p>
            </div>
            <div className="max-h-[620px] overflow-y-auto">
              {rows.length === 0 ? (
                <div className="p-6 text-center text-sm text-6fb-text-muted">Extract clips first to start tracking performance.</div>
              ) : rows.map(row => (
                <button
                  key={row.clip.id}
                  onClick={() => setSelectedClipId(row.clip.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#1a1a1a] transition-colors ${
                    selectedClip?.id === row.clip.id ? 'bg-[#00C851]/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{row.clip.title}</p>
                      <p className="text-[10px] text-[#666] mt-1 truncate">{row.clip.sourceVideo} · {formatDate(row.clip.createdAt)}</p>
                      {row.clip.strategyLabel && <p className="text-[10px] text-6fb-green mt-1">{row.clip.strategyLabel}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-white">{row.predicted}</p>
                      <p className={`text-[10px] mt-1 ${row.hasMetrics ? row.delta >= 0 ? 'text-6fb-green' : 'text-red-400' : 'text-[#555]'}`}>
                        {row.hasMetrics ? `${row.delta >= 0 ? '+' : ''}${row.delta}` : 'pending'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-7 bg-6fb-card border border-6fb-border rounded-xl p-5">
            {selectedClip ? (
              <>
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-6fb-green uppercase tracking-widest mb-1">Selected Clip</p>
                    <h2 className="text-lg font-bold text-white truncate">{selectedClip.title}</h2>
                    {selectedClip.strategyBrief && <p className="text-xs text-6fb-text-muted mt-1">{selectedClip.strategyBrief.promise}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center shrink-0">
                    <div className="rounded-lg bg-black/30 border border-white/5 px-3 py-2">
                      <p className="text-[10px] text-[#666] uppercase tracking-widest">Predicted</p>
                      <p className="text-xl font-black text-white">{predictedScore(selectedClip.score)}</p>
                    </div>
                    <div className="rounded-lg bg-black/30 border border-white/5 px-3 py-2">
                      <p className="text-[10px] text-[#666] uppercase tracking-widest">Actual</p>
                      <p className="text-xl font-black text-6fb-green">{actualScore(selectedMetrics)}</p>
                    </div>
                  </div>
                </div>

                {selectedClip.packageVariant && (
                  <div className="rounded-xl border border-[#00C851]/20 bg-[#00C851]/5 p-4 mb-5">
                    <p className="text-[10px] font-bold text-[#00C851] uppercase tracking-widest mb-2">Package Tested</p>
                    <p className="text-sm font-bold text-white">{selectedClip.packageVariant.title}</p>
                    <p className="text-xs text-6fb-text-muted mt-1">{selectedClip.packageVariant.shortCaption}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    ['views', 'Views'],
                    ['saves', 'Saves'],
                    ['shares', 'Shares'],
                    ['comments', 'Comments'],
                    ['retentionPct', 'Retention %'],
                    ['clickThroughPct', 'CTR %'],
                  ].map(([key, label]) => (
                    <label key={key} className="block">
                      <span className="block text-[10px] font-bold text-[#666] uppercase tracking-widest mb-1">{label}</span>
                      <input
                        type="number"
                        min="0"
                        value={selectedMetrics[key as keyof MetricsRecord] || ''}
                        onChange={e => updateMetric(key as keyof MetricsRecord, e.target.value)}
                        className="w-full bg-[#0f0f0f] border border-[#222] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00C851]/50"
                      />
                    </label>
                  ))}
                </div>

                <div className="rounded-xl border border-[#222] bg-black/20 p-4">
                  <p className="text-xs font-bold text-white mb-2">Pattern Read</p>
                  <p className="text-xs text-6fb-text-muted leading-relaxed">
                    {actualScore(selectedMetrics) === 0
                      ? 'Enter post metrics after publishing. The app will compare actual engagement against the predicted strategy score.'
                      : actualScore(selectedMetrics) >= predictedScore(selectedClip.score)
                        ? 'This clip is beating its prediction. Reuse its hook type, package angle, and proof moment in the next planner brief.'
                        : 'This clip is below prediction. Review the package promise, first seven seconds, and whether the payoff was clear without extra context.'}
                  </p>
                </div>
              </>
            ) : (
              <div className="h-full min-h-[360px] flex items-center justify-center text-center">
                <p className="text-sm text-6fb-text-muted">No clips available yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
