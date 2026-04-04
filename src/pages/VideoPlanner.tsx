import React, { useState, useEffect, useCallback } from 'react';

// ── Copy hook ─────────────────────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);
  return { copy, copied };
}

// ── Types ──────────────────────────────────────────────────────────────────

type TimelineEventType = 'dropzone' | 'body';

interface TimelineEvent {
  type: TimelineEventType;
  label: string;        // e.g. "DROP ZONE 1: HOOK" or "Context & Story"
  timestamp: string;    // e.g. "0:00"
  endTimestamp: string; // e.g. "0:05"
  duration: string;     // e.g. "5 sec"
  script?: string;      // for dropzones — exact words to say
  notes?: string;       // for body sections — director notes
  keyPoints?: string[]; // for body sections — talking points
}

interface VideoPlan {
  id: string;
  topic: string;
  perspective: string;
  videoType: string;
  targetLength: string;
  timeline: TimelineEvent[];
  recordingTips: string[];
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PERSPECTIVES = [
  { value: 'barber',       label: 'Barber (Behind the Chair)' },
  { value: 'shop-owner',   label: 'Shop Owner / Manager' },
  { value: 'suite-owner',  label: 'Suite Owner / Independent' },
  { value: 'educator',     label: 'Educator / Mentor' },
  { value: 'general',      label: 'General / Lifestyle' },
];

const VIDEO_TYPES = [
  { value: 'talking-head', label: 'Talking Head / Face-Forward' },
  { value: 'vlog',         label: 'Vlog / Behind the Scenes' },
  { value: 'tutorial',     label: 'Tutorial / How-To' },
  { value: 'podcast',      label: 'Podcast / Interview' },
  { value: 'educational',  label: 'Educational / Deep Dive' },
  { value: 'reaction',     label: 'Reaction / Commentary' },
];

const TARGET_LENGTHS = [
  { value: '5-10',  label: '5–10 min',            dropZones: 2 },
  { value: '15-20', label: '15–20 min',            dropZones: 3 },
  { value: '30-45', label: '30–45 min',            dropZones: 4 },
  { value: '60+',   label: '60+ min (Long-form)',  dropZones: 5 },
];

const FALLBACK_TRENDING = [
  'How I price my cuts in 2025',
  'Booth rent vs commission — the truth',
  'My morning routine as a barber',
  'How I got to 500 clients',
  'Why most barbers stay broke',
  'Tools every barber needs in 2025',
  'How to raise your prices without losing clients',
  'Building a brand as a barber',
];

// ── Claude prompt ──────────────────────────────────────────────────────────

function buildPrompt(topic: string, perspective: string, videoType: string, targetLength: string) {
  const lengthMeta = TARGET_LENGTHS.find(l => l.value === targetLength) ?? TARGET_LENGTHS[1];
  const perspLabel = PERSPECTIVES.find(p => p.value === perspective)?.label ?? perspective;
  const typeLabel  = VIDEO_TYPES.find(t => t.value === videoType)?.label ?? videoType;

  return `You are a YouTube/Instagram content strategist specializing in the barber & barbershop niche.

Create a structured shoot plan for a ${lengthMeta.label} ${typeLabel} video on this topic:
"${topic}"
Perspective: ${perspLabel}

The plan must be a TIMELINE — a mix of "dropzone" events and "body" events.
- DROP ZONEs are short (5-10 sec) high-impact moments: HOOK, MID-HOOK, PAYOFF. These are the exact words to say on camera that will score highest in clip extraction.
- BODY sections are longer segments between drop zones where you deliver value.

Generate exactly ${lengthMeta.dropZones} drop zones (HOOK + ${lengthMeta.dropZones - 2} MID-HOOKs + PAYOFF), interleaved with body sections.

Return ONLY valid JSON, no markdown fences:
{
  "timeline": [
    {
      "type": "dropzone",
      "label": "DROP ZONE 1: HOOK",
      "timestamp": "0:00",
      "endTimestamp": "0:08",
      "duration": "8 sec",
      "script": "Exact words to say — must be a cold-open pattern interrupt. No 'Hey guys', no 'Today I want to talk about'. Start MID-THOUGHT with a bold claim."
    },
    {
      "type": "body",
      "label": "Context & Setup",
      "timestamp": "0:08",
      "endTimestamp": "3:00",
      "duration": "~3 min",
      "notes": "Director note — energy level, standing/sitting, use hands, show something on screen, etc.",
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "recordingTips": [
    "Specific tip about setup, lighting, or energy for this topic and format"
  ]
}

Rules:
- Scripts for drop zones must be EXACT words — punchy, quotable, standalone sentences
- MID-HOOKs should tease what's coming next ("Here's where most people get it wrong...")
- PAYOFF is the closing takeaway — a single memorable line they'll screenshot
- Key points in body sections should be quotable standalone sentences (future clips)
- Tailor everything specifically to the barber niche and the given perspective`;
}

// ── Fallback plan builder ──────────────────────────────────────────────────

function buildFallbackPlan(topic: string, perspective: string, videoType: string, targetLength: string): VideoPlan {
  const lengthMeta = TARGET_LENGTHS.find(l => l.value === targetLength) ?? TARGET_LENGTHS[1];

  const timeline: TimelineEvent[] = [
    { type: 'dropzone', label: 'DROP ZONE 1: HOOK', timestamp: '0:00', endTimestamp: '0:08', duration: '8 sec',
      script: `[Write your cold-open hook about "${topic}" here — one bold, surprising sentence that stops the scroll.]` },
    { type: 'body', label: 'Context & Setup', timestamp: '0:08', endTimestamp: '3:00', duration: '~3 min',
      notes: 'Face-forward, relaxed energy. Frame the problem or opportunity.',
      keyPoints: ['Add your first key point', 'Add your second key point', 'Add a story or example'] },
  ];

  for (let i = 2; i < lengthMeta.dropZones; i++) {
    const ts = `${i * 5}:00`;
    timeline.push({
      type: 'dropzone', label: `DROP ZONE ${i}: MID-HOOK`, timestamp: ts, endTimestamp: `${i * 5}:08`, duration: '8 sec',
      script: `[Transition hook — tease what's coming next in the video.]`
    });
    timeline.push({
      type: 'body', label: `Section ${i}`, timestamp: `${i * 5}:08`, endTimestamp: `${i * 5 + 5}:00`, duration: '~5 min',
      notes: 'Deliver your next key idea.',
      keyPoints: ['Add your key point here', 'Add supporting detail', 'Add an example']
    });
  }

  timeline.push({
    type: 'dropzone', label: `DROP ZONE ${lengthMeta.dropZones}: PAYOFF`, timestamp: `${lengthMeta.dropZones * 5}:00`, endTimestamp: `${lengthMeta.dropZones * 5}:08`, duration: '8 sec',
    script: `[Your single most memorable takeaway about "${topic}" — the line they'll screenshot.]`
  });

  return {
    id: Date.now().toString(), topic, perspective, videoType, targetLength,
    timeline,
    recordingTips: [
      'Record in one take — natural delivery beats perfect delivery',
      'Sit near a large window or use 3-point lighting',
      'Slightly higher energy than feels natural — compresses well on camera',
    ],
    createdAt: new Date().toISOString(),
  };
}

// ── Copy plan as text ──────────────────────────────────────────────────────

function planToText(plan: VideoPlan): string {
  const lines = [
    `VIDEO PLAN: ${plan.topic}`,
    `${VIDEO_TYPES.find(t => t.value === plan.videoType)?.label} — ${TARGET_LENGTHS.find(l => l.value === plan.targetLength)?.label}`,
    `Perspective: ${PERSPECTIVES.find(p => p.value === plan.perspective)?.label}`,
    '',
    ...plan.timeline.flatMap(e => {
      if (e.type === 'dropzone') {
        return [`[${e.label} — ${e.timestamp}-${e.endTimestamp}, ${e.duration}]`, `"${e.script}"`, ''];
      }
      return [
        `[${e.label} — ${e.timestamp}-${e.endTimestamp}, ${e.duration}]`,
        ...(e.notes ? [`  Note: ${e.notes}`] : []),
        ...(e.keyPoints?.map(p => `  • ${p}`) ?? []),
        '',
      ];
    }),
    ...(plan.recordingTips?.length ? ['RECORDING TIPS:', ...plan.recordingTips.map(t => `→ ${t}`)] : []),
  ];
  return lines.join('\n');
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function VideoPlanner() {
  const [topic, setTopic]               = useState('');
  const [perspective, setPerspective]   = useState('barber');
  const [videoType, setVideoType]       = useState('talking-head');
  const [targetLength, setTargetLength] = useState('15-20');
  const [generating, setGenerating]     = useState(false);
  const [plan, setPlan]                 = useState<VideoPlan | null>(null);
  const [savedPlans, setSavedPlans]     = useState<VideoPlan[]>([]);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [trendingTopics, setTrendingTopics]     = useState<string[]>([]);
  const [fetchingTrending, setFetchingTrending] = useState(false);
  const [showTrending, setShowTrending]         = useState(false);
  const [expandedBody, setExpandedBody]         = useState<number | null>(null);
  const { copy: copyAll, copied: copiedAll }    = useCopy();

  useEffect(() => { loadSavedPlans(); }, []);

  async function loadSavedPlans() {
    try {
      const result = await (window.electronAPI as any).listVideoPlans?.();
      if (result?.plans) setSavedPlans(result.plans);
    } catch { /* not wired yet */ }
  }

  async function fetchTrending() {
    setFetchingTrending(true);
    try {
      const result = await (window.electronAPI as any).getTrendingTopics?.();
      setTrendingTopics(result?.topics?.length ? result.topics : FALLBACK_TRENDING);
    } catch { setTrendingTopics(FALLBACK_TRENDING); }
    setShowTrending(true);
    setFetchingTrending(false);
  }

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setPlan(null);
    try {
      const prompt = buildPrompt(topic, perspective, videoType, targetLength);
      const response = await (window.electronAPI as any).generateVideoPlan?.({ prompt });
      const raw: Omit<VideoPlan, 'id' | 'topic' | 'perspective' | 'videoType' | 'targetLength' | 'createdAt'> =
        (response?.success && response.plan) ? response.plan : buildFallbackPlan(topic, perspective, videoType, targetLength);
      setPlan({ ...raw, id: Date.now().toString(), topic, perspective, videoType, targetLength, createdAt: new Date().toISOString() });
    } catch { setPlan(buildFallbackPlan(topic, perspective, videoType, targetLength)); }
    setGenerating(false);
  }

  async function handleSave() {
    if (!plan) return;
    setSaving(true);
    try {
      await (window.electronAPI as any).saveVideoPlan?.(plan);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      loadSavedPlans();
    } catch { /* no-op */ }
    setSaving(false);
  }

  return (
    <div className="h-full flex flex-col bg-6fb-bg">
      {/* Header */}
      <div className="px-6 py-5 border-b border-6fb-border flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white">Video Planner</h1>
          <p className="text-xs text-6fb-text-secondary mt-0.5">
            Structure your shoot before you record. Drop Zones = your best future clips.
          </p>
        </div>
        {savedPlans.length > 0 && (
          <span className="text-[10px] text-6fb-text-muted bg-6fb-border/50 px-2 py-1 rounded">
            {savedPlans.length} saved plan{savedPlans.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!plan ? (
          /* ── INPUT FORM ── */
          <div className="max-w-xl mx-auto px-6 py-8 space-y-6">

            {/* Topic */}
            <div>
              <label className="block text-xs font-semibold text-6fb-text-secondary uppercase tracking-wider mb-2">
                Video Topic
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={topic}
                  onChange={e => { setTopic(e.target.value); setShowTrending(false); }}
                  placeholder="e.g. Why most barbers fail in their first year"
                  className="flex-1 bg-6fb-card border border-6fb-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-6fb-text-muted focus:outline-none focus:border-6fb-green/50 transition-colors"
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                />
                <button
                  onClick={fetchTrending}
                  disabled={fetchingTrending}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-6fb-card border border-6fb-border text-xs font-semibold text-6fb-text-secondary hover:text-white hover:border-6fb-green/40 transition-all whitespace-nowrap disabled:opacity-50"
                >
                  {fetchingTrending
                    ? <span className="w-3 h-3 border border-6fb-green border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  }
                  Trending
                </button>
              </div>

              {showTrending && trendingTopics.length > 0 && (
                <div className="mt-2 bg-6fb-card border border-6fb-border rounded-xl overflow-hidden shadow-xl">
                  <div className="px-3 py-2 border-b border-6fb-border">
                    <span className="text-[10px] text-6fb-text-muted uppercase font-semibold tracking-wider">Trending in your niche</span>
                  </div>
                  {trendingTopics.map((t, i) => (
                    <button key={i} onClick={() => { setTopic(t); setShowTrending(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-6fb-text-secondary hover:text-white hover:bg-white/5 transition-colors border-b border-6fb-border/30 last:border-0">
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Perspective + Video Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-6fb-text-secondary uppercase tracking-wider mb-2">Perspective</label>
                <select value={perspective} onChange={e => setPerspective(e.target.value)}
                  className="w-full bg-6fb-card border border-6fb-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-6fb-green/50 transition-colors appearance-none cursor-pointer">
                  {PERSPECTIVES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-6fb-text-secondary uppercase tracking-wider mb-2">Video Type</label>
                <select value={videoType} onChange={e => setVideoType(e.target.value)}
                  className="w-full bg-6fb-card border border-6fb-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-6fb-green/50 transition-colors appearance-none cursor-pointer">
                  {VIDEO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Target Length */}
            <div>
              <label className="block text-xs font-semibold text-6fb-text-secondary uppercase tracking-wider mb-2">Target Length</label>
              <div className="grid grid-cols-4 gap-2">
                {TARGET_LENGTHS.map(l => (
                  <button key={l.value} onClick={() => setTargetLength(l.value)}
                    className={`py-3 px-2 rounded-xl border text-xs font-semibold text-center transition-all ${
                      targetLength === l.value
                        ? 'bg-6fb-green/10 border-6fb-green text-6fb-green'
                        : 'bg-6fb-card border-6fb-border text-6fb-text-secondary hover:border-6fb-green/30 hover:text-white'
                    }`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate */}
            <button onClick={handleGenerate} disabled={!topic.trim() || generating}
              className="w-full py-4 rounded-xl bg-6fb-green text-black font-bold text-sm transition-all hover:bg-6fb-green/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {generating ? (
                <><span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />Building shoot plan...</>
              ) : (
                <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" /></svg>Generate Shoot Plan</>
              )}
            </button>

            <p className="text-[11px] text-6fb-text-muted text-center">
              Record this video following the plan. The Clip Extractor will naturally find your best moments.
            </p>
          </div>
        ) : (
          /* ── TIMELINE OUTPUT ── */
          <div className="max-w-2xl mx-auto px-6 py-6">

            {/* Plan header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-white leading-tight">{plan.topic}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-6fb-text-muted bg-6fb-border/50 px-2 py-0.5 rounded">
                    {PERSPECTIVES.find(p => p.value === plan.perspective)?.label}
                  </span>
                  <span className="text-[10px] text-6fb-text-muted bg-6fb-border/50 px-2 py-0.5 rounded">
                    {VIDEO_TYPES.find(t => t.value === plan.videoType)?.label}
                  </span>
                  <span className="text-[10px] text-6fb-green bg-6fb-green/10 border border-6fb-green/20 px-2 py-0.5 rounded">
                    {TARGET_LENGTHS.find(l => l.value === plan.targetLength)?.label}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button onClick={() => copyAll(planToText(plan))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-6fb-card border border-6fb-border hover:border-6fb-green/30 transition-all"
                  style={{ color: copiedAll ? '#00c851' : '' }}>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  {copiedAll ? 'Copied!' : 'Copy All'}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${saved ? 'bg-6fb-green/10 text-6fb-green border-6fb-green/30' : 'bg-6fb-card border-6fb-border text-6fb-text-secondary hover:text-white hover:border-6fb-green/30'}`}>
                  {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => { setPlan(null); setExpandedBody(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-6fb-text-secondary hover:text-white bg-6fb-card border border-6fb-border transition-all">
                  New Plan
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              {plan.timeline.map((event, idx) => (
                event.type === 'dropzone'
                  ? <DropZoneBlock key={idx} event={event} />
                  : <BodyBlock key={idx} event={event} index={idx}
                      expanded={expandedBody === idx}
                      onToggle={() => setExpandedBody(expandedBody === idx ? null : idx)} />
              ))}
            </div>

            {/* Recording Tips */}
            {plan.recordingTips?.length > 0 && (
              <div className="mt-4 bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">Recording Tips</p>
                <ul className="space-y-1.5">
                  {plan.recordingTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-6fb-text-secondary">
                      <span className="text-blue-400 shrink-0">→</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Drop Zone Block ────────────────────────────────────────────────────────

function DropZoneBlock({ event }: { event: TimelineEvent }) {
  const { copy, copied } = useCopy();
  return (
    <div className="relative rounded-xl overflow-hidden border border-6fb-green/30 bg-6fb-green/[0.04]"
      style={{ boxShadow: '0 0 20px rgba(0,200,81,0.08)' }}>
      {/* Green left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-6fb-green rounded-l-xl" />
      <div className="pl-4 pr-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-6fb-green uppercase tracking-widest">
              🟢 {event.label}
            </span>
            <span className="text-[10px] text-6fb-text-muted">
              {event.timestamp}–{event.endTimestamp} · {event.duration}
            </span>
          </div>
          {event.script && (
            <p className="text-sm text-white font-medium mt-1.5 leading-relaxed">
              "{event.script}"
            </p>
          )}
        </div>
        <button onClick={() => copy(event.script ?? '')}
          className="shrink-0 p-1.5 rounded-lg text-6fb-text-muted hover:text-6fb-green hover:bg-6fb-green/10 transition-colors"
          title="Copy script">
          {copied
            ? <svg className="w-3.5 h-3.5 text-6fb-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
            : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          }
        </button>
      </div>
    </div>
  );
}

// ── Body Section Block ─────────────────────────────────────────────────────

function BodyBlock({ event, index, expanded, onToggle }: {
  event: TimelineEvent; index: number; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className={`rounded-xl border transition-all cursor-pointer ${expanded ? 'border-6fb-border/80' : 'border-6fb-border hover:border-6fb-border/80'} bg-6fb-card`}
      onClick={onToggle}>
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="text-xs text-6fb-text-muted shrink-0">⚪</span>
        <span className="text-sm font-medium text-white flex-1">{event.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-6fb-text-muted">{event.timestamp}–{event.endTimestamp}</span>
          <span className="text-[10px] text-6fb-text-muted">·</span>
          <span className="text-[10px] text-6fb-text-muted">{event.duration}</span>
          <svg className={`w-3.5 h-3.5 text-6fb-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 border-t border-6fb-border/40 space-y-2" onClick={e => e.stopPropagation()}>
          {event.notes && (
            <p className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2 mt-3 italic">
              🎬 {event.notes}
            </p>
          )}
          {event.keyPoints && event.keyPoints.length > 0 && (
            <ul className="space-y-1.5 mt-2">
              {event.keyPoints.map((pt, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-6fb-text-secondary">
                  <span className="w-1 h-1 rounded-full bg-6fb-green mt-2 shrink-0" />
                  {pt}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
