import { useEffect, useMemo, useState } from 'react';
import type {
  ContentIntent,
  ContentStrategyBrief,
  PackageVariant,
  StrategyScoreBreakdown,
} from '../types/content-strategy';

interface PlanSection {
  type: 'hook' | 'body' | 'payoff';
  timerange: string;
  instruction: string;
  scriptIdea: string;
}

interface ShootPlan {
  title: string;
  sections: PlanSection[];
  strategyBrief?: ContentStrategyBrief;
}

interface PlaybookTopic {
  id: string;
  title: string;
  pillar: string | null;
  contentType: string;
  scheduledFor: string;
}

interface Props {
  onPlanCreated?: () => void;
  hasClaudeKey?: boolean;
}

const DURATIONS = ['1 Minute', '3 Minutes', '5 Minutes', '10 Minutes', '20+ Minutes'];
const FORMATS = ['Vlog', 'Tutorial', 'Podcast', 'Talking Head', 'Interview', 'Behind the Scenes', 'Product Review', 'Listicle'];
const INTENTS: { value: ContentIntent; label: string; desc: string }[] = [
  { value: 'education', label: 'Education', desc: 'Promise a clear business or skill outcome.' },
  { value: 'entertainment', label: 'Entertainment', desc: 'Trade attention for story, tension, or surprise.' },
  { value: 'hybrid', label: 'Hybrid', desc: 'Teach through a story with a strong payoff.' },
];

const emptyScore: StrategyScoreBreakdown = {
  audienceClarity: 0,
  outcomeValue: 0,
  novelty: 0,
  emotionalTrigger: 0,
  packagingStrength: 0,
  retentionPath: 0,
  total: 0,
};

const scoreLabels: [keyof StrategyScoreBreakdown, string][] = [
  ['audienceClarity', 'Audience'],
  ['outcomeValue', 'Outcome'],
  ['novelty', 'Novelty'],
  ['emotionalTrigger', 'Emotion'],
  ['packagingStrength', 'Package'],
  ['retentionPath', 'Retention'],
];

function makeBriefId() {
  return `brief_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeScore(score?: Partial<StrategyScoreBreakdown>): StrategyScoreBreakdown {
  const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 0;
  const normalized = {
    audienceClarity: numeric(score?.audienceClarity),
    outcomeValue: numeric(score?.outcomeValue),
    novelty: numeric(score?.novelty),
    emotionalTrigger: numeric(score?.emotionalTrigger),
    packagingStrength: numeric(score?.packagingStrength),
    retentionPath: numeric(score?.retentionPath),
    total: typeof score?.total === 'number' ? Math.max(0, Math.min(100, score.total)) : 0,
    rationale: score?.rationale || '',
  };
  if (!normalized.total) {
    normalized.total = Math.round((
      normalized.audienceClarity +
      normalized.outcomeValue +
      normalized.novelty +
      normalized.emotionalTrigger +
      normalized.packagingStrength +
      normalized.retentionPath
    ) / 60 * 100);
  }
  return normalized;
}

function normalizePackages(packages?: PackageVariant[]): PackageVariant[] {
  if (!Array.isArray(packages)) return [];
  return packages.slice(0, 3).map((pkg) => ({
    title: pkg.title || '',
    thumbnailText: pkg.thumbnailText || '',
    firstLineCaption: pkg.firstLineCaption || '',
    shortCaption: pkg.shortCaption || '',
    hashtags: Array.isArray(pkg.hashtags) ? pkg.hashtags.slice(0, 8) : [],
    platformAngle: pkg.platformAngle || '',
  }));
}

function persistStrategyBrief(brief: ContentStrategyBrief) {
  localStorage.setItem('contentStrategy:lastBrief', JSON.stringify(brief));
  localStorage.setItem(`contentStrategy:brief:${brief.id}`, JSON.stringify(brief));
}

export default function ContentPlanner({ onPlanCreated, hasClaudeKey }: Props) {
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('3 Minutes');
  const [format, setFormat] = useState('Talking Head');
  const [perspective, setPerspective] = useState('Shop Owner');

  const [intent, setIntent] = useState<ContentIntent>('education');
  const [audience, setAudience] = useState('Barbershop owners who want to scale beyond the chair');
  const [viewerOutcome, setViewerOutcome] = useState('');
  const [promise, setPromise] = useState('');
  const [curiosityGap, setCuriosityGap] = useState('');
  const [proofAsset, setProofAsset] = useState('');
  const [payoff, setPayoff] = useState('');
  const [positioning, setPositioning] = useState('Do it better by making the business lesson more concrete and barber-specific.');

  const [useRag, setUseRag] = useState(false);
  const [targetLocation, setTargetLocation] = useState('');
  const [playbookTopics, setPlaybookTopics] = useState<PlaybookTopic[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<ShootPlan | null>(null);
  const [strategyBrief, setStrategyBrief] = useState<ContentStrategyBrief | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const api = window.electronAPI as typeof window.electronAPI & { fetchPlaybookTopics: () => Promise<PlaybookTopic[] | { posts?: PlaybookTopic[] }> };
    if (api.fetchPlaybookTopics) {
      api.fetchPlaybookTopics()
        .then((result) => {
          const topics = Array.isArray(result) ? result : result?.posts;
          if (Array.isArray(topics)) {
            setPlaybookTopics(topics.map((t: any) => ({
              id: t.id || t.postId || t.topicId,
              title: t.title || t.topicTitle,
              pillar: t.pillar || null,
              contentType: t.contentType || 'general',
              scheduledFor: t.scheduledFor || t.scheduledDay || '',
            })).filter(t => t.id && t.title));
          }
        })
        .catch(() => {});
    }
  }, []);

  const strategyReady = useMemo(() => {
    return Boolean(topic.trim() && audience.trim() && viewerOutcome.trim() && promise.trim() && curiosityGap.trim() && payoff.trim());
  }, [audience, curiosityGap, payoff, promise, topic, viewerOutcome]);

  const buildStrategyDraft = (): ContentStrategyBrief => ({
    id: makeBriefId(),
    intent,
    audience: audience.trim(),
    viewerOutcome: viewerOutcome.trim(),
    promise: promise.trim(),
    curiosityGap: curiosityGap.trim(),
    proofAsset: proofAsset.trim(),
    payoff: payoff.trim(),
    positioning: positioning.trim(),
    packageVariants: [],
    scoreBreakdown: emptyScore,
    createdAt: new Date().toISOString(),
    source: 'planner',
  });

  const normalizeStrategyBrief = (incoming: Partial<ContentStrategyBrief> | undefined, draft: ContentStrategyBrief): ContentStrategyBrief => ({
    ...draft,
    ...incoming,
    id: incoming?.id || draft.id,
    intent: incoming?.intent || draft.intent,
    audience: incoming?.audience || draft.audience,
    viewerOutcome: incoming?.viewerOutcome || draft.viewerOutcome,
    promise: incoming?.promise || draft.promise,
    curiosityGap: incoming?.curiosityGap || draft.curiosityGap,
    proofAsset: incoming?.proofAsset || draft.proofAsset,
    payoff: incoming?.payoff || draft.payoff,
    positioning: incoming?.positioning || draft.positioning,
    packageVariants: normalizePackages(incoming?.packageVariants as PackageVariant[]),
    scoreBreakdown: normalizeScore(incoming?.scoreBreakdown),
    createdAt: incoming?.createdAt || draft.createdAt,
    source: incoming?.source || 'planner',
  });

  const handlePlaybookPick = (playbook: PlaybookTopic) => {
    setTopic(playbook.title);
    setAudience(playbook.pillar
      ? `Barbershop owners focused on ${playbook.pillar.toLowerCase()}`
      : 'Barbershop owners and high-level barbers');
    setViewerOutcome(`Know exactly how to apply "${playbook.title}" in their shop this week.`);
    setPromise(`A practical 6FB breakdown of ${playbook.title.toLowerCase()}.`);
    setCuriosityGap('Most barbers approach this backwards, and the hidden cost is bigger than they think.');
    setProofAsset(playbook.pillar ? `Use a real ${playbook.pillar.toLowerCase()} example, number, or client story.` : 'Use a real shop example, number, or client story.');
    setPayoff('They leave with one decision or action they can take before their next appointment.');
    setIntent(playbook.contentType?.toLowerCase().includes('behind') ? 'hybrid' : 'education');
  };

  const handleCopy = async () => {
    if (!plan) return;

    const activeBrief = plan.strategyBrief || strategyBrief;
    let text = `# ${plan.title.toUpperCase()}\n\n`;
    if (activeBrief) {
      text += `AUDIENCE: ${activeBrief.audience}\n`;
      text += `OUTCOME: ${activeBrief.viewerOutcome}\n`;
      text += `PROMISE: ${activeBrief.promise}\n`;
      text += `PAYOFF: ${activeBrief.payoff}\n\n`;
      activeBrief.packageVariants.forEach((pkg, idx) => {
        text += `PACKAGE ${idx + 1}: ${pkg.title}\n`;
        text += `THUMBNAIL: ${pkg.thumbnailText}\n`;
        text += `CAPTION: ${pkg.shortCaption}\n\n`;
      });
      text += `-------------------------------------------\n\n`;
    }
    plan.sections.forEach(sec => {
      text += `[${sec.timerange}] - ${sec.type.toUpperCase()}`;
      if (sec.type === 'hook' || sec.type === 'payoff') text += `  (AI DROP ZONE)`;
      text += `\n`;
      text += `DIRECTION: ${sec.instruction}\n`;
      text += `SCRIPT: "${sec.scriptIdea}"\n\n`;
      text += `-------------------------------------------\n\n`;
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleGenerate = async () => {
    if (!strategyReady) return;
    setLoading(true);
    setError('');
    setPlan(null);

    const draft = buildStrategyDraft();

    try {
      const result = await window.electronAPI.generateVideoPlan({
        topic, type: format, duration, perspective, useRag, targetLocation, strategyBrief: draft,
      });

      if (result.success && result.data) {
        const data = result.data as ShootPlan;
        const finalBrief = normalizeStrategyBrief(data.strategyBrief, draft);
        persistStrategyBrief(finalBrief);
        const finalPlan = { ...data, strategyBrief: finalBrief };
        setPlan(finalPlan);
        setStrategyBrief(finalBrief);
        onPlanCreated?.();
      } else {
        setError(result.error || 'Failed to generate shoot plan.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const activeBrief = plan?.strategyBrief || strategyBrief;

  return (
    <div className="h-full flex flex-col pt-10 pb-16 overflow-y-auto w-full max-w-[1280px] mx-auto px-6 hide-scrollbar">
      <div className="w-full flex-1 grid grid-cols-12 gap-8 items-start">
        <div className="col-span-4 sticky top-10">
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Video Planner</h2>
          <p className="text-sm text-6fb-text-muted mb-6 leading-relaxed">
            Build the idea, package, and shoot blueprint before recording so extraction has a stronger target.
          </p>

          <div className="bg-6fb-card border border-6fb-border rounded-xl p-5 shadow-sm mb-5">
            <h3 className="text-xs font-bold text-6fb-text-secondary uppercase tracking-wider mb-4">Idea</h3>
            <div className="space-y-4">
              {playbookTopics.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-6fb-text-muted uppercase tracking-wider mb-2 ml-1">From Playbook</label>
                  <div className="flex flex-wrap gap-1.5">
                    {playbookTopics.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handlePlaybookPick(t)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-6fb-green/10 text-6fb-green border border-6fb-green/20 hover:bg-6fb-green/20 hover:border-6fb-green/40 transition-all truncate max-w-[200px]"
                        title={t.title}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-6fb-text-secondary mb-1.5 ml-1">Core Topic</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Why barbers fail when they open a suite"
                  className="w-full h-20 bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-6fb-green/50 focus:ring-1 focus:ring-6fb-green/50 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-6fb-text-secondary mb-2 ml-1">Content Intent</label>
                <div className="grid grid-cols-3 gap-2">
                  {INTENTS.map(item => (
                    <button
                      key={item.value}
                      onClick={() => setIntent(item.value)}
                      className={`px-2 py-2 rounded-lg border text-left transition-all ${
                        intent === item.value ? 'border-6fb-green bg-6fb-green/10 text-white' : 'border-6fb-border bg-6fb-bg text-6fb-text-muted hover:text-white'
                      }`}
                      title={item.desc}
                    >
                      <span className="block text-[11px] font-bold">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-6fb-text-secondary mb-1.5 ml-1">Creator Perspective</label>
                <input
                  type="text"
                  value={perspective}
                  onChange={(e) => setPerspective(e.target.value)}
                  placeholder="e.g. Shop owner hiring barbers"
                  className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-6fb-green/50 focus:ring-1 focus:ring-6fb-green/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-6fb-text-secondary mb-1.5 ml-1">Format</label>
                  <select value={format} onChange={(e) => setFormat(e.target.value)}
                    className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-6fb-green/50 appearance-none">
                    {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-6fb-text-secondary mb-1.5 ml-1">Duration</label>
                  <select value={duration} onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-6fb-green/50 appearance-none">
                    {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-6fb-card border border-6fb-border rounded-xl p-5 shadow-sm mb-5">
            <h3 className="text-xs font-bold text-6fb-text-secondary uppercase tracking-wider mb-4">Growth Brief</h3>
            <div className="space-y-3">
              {[
                ['Target Audience', audience, setAudience, 'e.g. first-time shop owners trying to hire'],
                ['Viewer Outcome', viewerOutcome, setViewerOutcome, 'What will they be able to do after watching?'],
                ['Promise', promise, setPromise, 'The clear reason to click'],
                ['Curiosity Gap', curiosityGap, setCuriosityGap, 'What do they need to resolve?'],
                ['Proof Asset', proofAsset, setProofAsset, 'Number, story, mistake, demo, or client example'],
                ['Payoff', payoff, setPayoff, 'The final satisfying answer'],
                ['Positioning', positioning, setPositioning, 'First, better, different, or more'],
              ].map(([label, value, setter, placeholder]) => (
                <div key={label as string}>
                  <label className="block text-[10px] font-bold text-6fb-text-muted uppercase tracking-wider mb-1 ml-1">{label as string}</label>
                  <input
                    value={value as string}
                    onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                    placeholder={placeholder as string}
                    className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-6fb-green/50 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-6fb-card border border-6fb-border rounded-xl p-5 shadow-sm mb-5">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-semibold text-6fb-text flex items-center gap-1.5 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-6fb-green" />
                6FB Knowledge Engine
              </label>
              <button
                onClick={() => setUseRag(!useRag)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-6fb-green/20 ${useRag ? 'bg-6fb-green' : 'bg-white/10'}`}
              >
                <span className="sr-only">Use RAG</span>
                <span aria-hidden="true" className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useRag ? 'translate-x-2' : '-translate-x-2'}`} />
              </button>
            </div>
            {useRag && (
              <div className="animate-fade-in pl-1">
                <label className="block text-[10px] font-medium text-6fb-text-secondary mb-1">Target Market</label>
                <input
                  type="text"
                  value={targetLocation}
                  onChange={(e) => setTargetLocation(e.target.value)}
                  placeholder="e.g. Miami, FL or 33132"
                  className="w-full bg-black/40 border border-6fb-border/60 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-6fb-green/50 transition-all"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={!strategyReady || loading || !hasClaudeKey}
            className={`w-full py-3 rounded-lg font-bold text-sm tracking-wide transition-all shadow-lg ${
              !strategyReady || loading || !hasClaudeKey
                ? 'bg-white/5 text-white/30 cursor-not-allowed shadow-none'
                : 'bg-6fb-green text-[#052614] hover:bg-[#00e25b] hover:shadow-6fb-green/20'
            }`}
          >
            {loading ? 'Architecting Plan...' : !hasClaudeKey ? 'Missing API Key' : 'Generate Strategy Blueprint'}
          </button>

          {!strategyReady && (
            <p className="mt-3 text-[10px] text-6fb-text-muted text-center">Fill the topic, audience, outcome, promise, curiosity gap, and payoff.</p>
          )}
          {error && <p className="mt-4 text-xs text-red-400 font-medium text-center bg-red-400/10 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="col-span-8 min-h-[500px]">
          {!plan && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center bg-6fb-card border border-6fb-border rounded-xl border-dashed">
              <div className="w-16 h-16 text-6fb-border mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full opacity-50">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No Blueprint Created</h3>
              <p className="text-sm text-6fb-text-muted max-w-sm">Start with the audience promise, then generate the package and shoot structure.</p>
            </div>
          )}

          {loading && (
            <div className="min-h-[420px] w-full flex flex-col items-center justify-center text-center bg-6fb-card border border-6fb-border rounded-xl relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-6fb-green/10 via-transparent to-transparent animate-pulse" style={{ animationDuration: '3s' }} />
              <div className="relative flex items-center justify-center w-24 h-24 mb-6">
                <div className="absolute inset-0 border-[1.5px] border-6fb-green/30 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
                <div className="absolute w-16 h-16 border-[1.5px] border-6fb-green/20 border-t-6fb-green border-r-6fb-green rounded-full animate-spin shadow-[0_0_15px_rgba(0,200,81,0.3)]" style={{ animationDuration: '1.5s' }} />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white animate-pulse">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div className="relative z-10 px-8">
                <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Engineering the Package</h3>
                <p className="text-sm font-semibold text-6fb-green">Scoring idea, hook, and retention path</p>
              </div>
            </div>
          )}

          {plan && !loading && (
            <div className="bg-[#121212] rounded-xl border border-6fb-border shadow-2xl overflow-hidden pb-8">
              <div className="bg-gradient-to-b from-[#1a1a1a] to-[#121212] px-8 py-6 border-b border-6fb-border/50 flex justify-between items-start gap-4">
                <div>
                  <strong className="text-[10px] uppercase tracking-[0.2em] font-bold text-6fb-green/80 flex items-center gap-2 mb-2">
                    <div className="w-1 h-1 rounded-full bg-6fb-green animate-pulse" /> Strategy Blueprint
                  </strong>
                  <h2 className="text-2xl font-black text-white tracking-tight">{plan.title}</h2>
                  {activeBrief && <p className="text-xs text-6fb-text-muted mt-2 max-w-2xl">{activeBrief.promise}</p>}
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#222] hover:bg-[#333] border border-6fb-border transition-colors text-sm font-semibold text-white shrink-0"
                >
                  {copied ? <span className="text-6fb-green">Copied</span> : 'Copy Package'}
                </button>
              </div>

              {activeBrief && (
                <div className="px-6 pt-6 grid grid-cols-12 gap-4">
                  <div className="col-span-5 bg-6fb-card border border-6fb-border/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-black uppercase tracking-wider text-white">Idea Score</h3>
                      <span className="text-2xl font-black text-6fb-green">{activeBrief.scoreBreakdown.total}</span>
                    </div>
                    <div className="space-y-2">
                      {scoreLabels.map(([key, label]) => (
                        <div key={key} className="flex items-center gap-3">
                          <span className="w-20 text-[10px] text-6fb-text-muted uppercase tracking-wider">{label}</span>
                          <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-6fb-green rounded-full" style={{ width: `${Math.min(100, Number(activeBrief.scoreBreakdown[key] || 0) * 10)}%` }} />
                          </div>
                          <span className="w-6 text-right text-[10px] text-white">{Number(activeBrief.scoreBreakdown[key] || 0)}</span>
                        </div>
                      ))}
                    </div>
                    {activeBrief.scoreBreakdown.rationale && <p className="mt-4 text-xs text-6fb-text-muted leading-relaxed">{activeBrief.scoreBreakdown.rationale}</p>}
                  </div>

                  <div className="col-span-7 bg-6fb-card border border-6fb-border/50 rounded-xl p-5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white mb-4">Packaging Lab</h3>
                    <div className="space-y-3">
                      {activeBrief.packageVariants.length === 0 ? (
                        <p className="text-xs text-6fb-text-muted">No package variants returned. The shoot blueprint is still usable.</p>
                      ) : activeBrief.packageVariants.map((pkg, idx) => (
                        <div key={`${pkg.title}-${idx}`} className="rounded-lg border border-white/5 bg-black/25 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{pkg.title}</p>
                              <p className="text-[10px] text-6fb-green mt-1 uppercase tracking-wider">{pkg.thumbnailText}</p>
                            </div>
                            <span className="text-[10px] text-6fb-text-muted shrink-0">P{idx + 1}</span>
                          </div>
                          <p className="text-[11px] text-6fb-text-muted mt-2 leading-relaxed">{pkg.shortCaption}</p>
                          {pkg.hashtags.length > 0 && <p className="text-[10px] text-[#666] mt-2 font-mono">{pkg.hashtags.join(' ')}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="px-6 pt-6">
                <div className="space-y-4">
                  {plan.sections.map((sec, idx) => {
                    const isDropZone = sec.type === 'hook' || sec.type === 'payoff';
                    return (
                      <div
                        key={idx}
                        className={`relative rounded-xl p-5 border transition-all ${
                          isDropZone
                            ? 'bg-[linear-gradient(135deg,rgba(0,200,81,0.03)_0%,transparent_100%)] border-6fb-green/30 shadow-[0_4px_24px_rgba(0,200,81,0.02)]'
                            : 'bg-6fb-card border-6fb-border/50'
                        }`}
                      >
                        {isDropZone && (
                          <div className="absolute -top-2.5 -right-2.5">
                            <span className="bg-6fb-green text-[#052614] text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md shadow-[0_0_12px_rgba(0,200,81,0.4)]">
                              AI Drop Zone
                            </span>
                          </div>
                        )}
                        <div className="flex items-start gap-4">
                          <div className={`shrink-0 text-xs font-mono font-bold mt-0.5 ${isDropZone ? 'text-6fb-green' : 'text-6fb-text-muted'}`}>
                            {sec.timerange}
                          </div>
                          <div className="flex-1">
                            <h4 className={`text-xs font-black uppercase tracking-wider mb-2 ${isDropZone ? 'text-white' : 'text-6fb-text-secondary'}`}>
                              {sec.type}
                            </h4>
                            <p className="text-[13px] leading-relaxed text-white/90 mb-3 font-medium">
                              {sec.instruction}
                            </p>
                            <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                              <p className="text-xs text-6fb-text-muted font-mono leading-relaxed">
                                <span className="text-white/40 mr-2">{"//"}</span>{sec.scriptIdea}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
