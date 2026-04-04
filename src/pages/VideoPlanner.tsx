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

interface PlanSection {
  title: string;
  timestamp: string;
  duration: string;
  notes: string;
  keyPoints: string[];
}

interface VideoPlan {
  id: string;
  topic: string;
  perspective: string;
  videoType: string;
  targetLength: string;
  hook: { timestamp: string; duration: string; script: string };
  intro: { timestamp: string; duration: string; script: string };
  sections: PlanSection[];
  cta: { timestamp: string; duration: string; script: string };
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
  { value: 'tutorial',      label: 'Tutorial / How-To' },
  { value: 'talking-head',  label: 'Talking Head / Face-Forward' },
  { value: 'podcast',       label: 'Podcast / Interview' },
  { value: 'vlog',          label: 'Vlog / Behind the Scenes' },
  { value: 'educational',   label: 'Educational / Deep Dive' },
  { value: 'reaction',      label: 'Reaction / Commentary' },
];

const TARGET_LENGTHS = [
  { value: '5-10',   label: '5–10 minutes',           sections: 2 },
  { value: '15-20',  label: '15–20 minutes',           sections: 3 },
  { value: '30-45',  label: '30–45 minutes',           sections: 4 },
  { value: '60+',    label: '60+ minutes (Long-form)', sections: 6 },
];

// Barber-niche trending topics for when Content Manager isn't connected
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

// ── Claude-powered plan generator ─────────────────────────────────────────

async function generatePlanWithClaude(
  topic: string,
  perspective: string,
  videoType: string,
  targetLength: string
): Promise<VideoPlan> {
  const lengthMeta = TARGET_LENGTHS.find(l => l.value === targetLength) ?? TARGET_LENGTHS[1];
  const perspLabel  = PERSPECTIVES.find(p => p.value === perspective)?.label ?? perspective;
  const typeLabel   = VIDEO_TYPES.find(t => t.value === videoType)?.label ?? videoType;

  const prompt = `You are a YouTube/Instagram content strategist specializing in the barber & barbershop niche.

Create a detailed video plan for a ${lengthMeta.label} ${typeLabel} video on this topic:
"${topic}"
Perspective: ${perspLabel}

Return ONLY valid JSON in exactly this structure (no markdown, no extra text):
{
  "hook": {
    "timestamp": "0:00",
    "duration": "30 sec",
    "script": "Exact hook script — the first thing said on camera. Must be attention-grabbing, pattern-interrupting. State the core value or surprising claim immediately."
  },
  "intro": {
    "timestamp": "0:30",
    "duration": "1 min",
    "script": "Brief intro script — who you are and exactly what viewers will learn. Keep it tight."
  },
  "sections": [
    {
      "title": "Section title",
      "timestamp": "1:30",
      "duration": "X min",
      "notes": "Director's note — what energy/style for this section (sit down, stand up, show hands, use b-roll, etc.)",
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ],
  "cta": {
    "timestamp": "X:XX",
    "duration": "1 min",
    "script": "Exact CTA script — follow, subscribe, comment, or DM call. Specific and natural."
  },
  "recordingTips": [
    "Tip about setup, energy, or delivery specific to this video type and topic"
  ]
}

Generate exactly ${lengthMeta.sections} sections. Make the content specific to the barber niche and the given perspective. Key points should be punchy, actionable, quotable — things that could become great clips.`;

  const response = await (window.electronAPI as any).generateVideoPlan?.({ prompt });
  if (response?.success && response.plan) return response.plan;

  // Fallback: construct a plan locally so the UI always works
  return buildFallbackPlan(topic, perspective, videoType, targetLength);
}

function buildFallbackPlan(
  topic: string, perspective: string, videoType: string, targetLength: string
): VideoPlan {
  const lengthMeta = TARGET_LENGTHS.find(l => l.value === targetLength) ?? TARGET_LENGTHS[1];
  const sections: PlanSection[] = Array.from({ length: lengthMeta.sections }, (_, i) => ({
    title: `Section ${i + 1} — [Fill in your key point]`,
    timestamp: `${2 + i * 5}:00`,
    duration: `${Math.round(parseInt(targetLength) / lengthMeta.sections) || 5} min`,
    notes: 'Stay natural, speak directly to camera, use hands to demonstrate if applicable.',
    keyPoints: ['Add your first key point here', 'Add your second key point here', 'Add a story or example'],
  }));

  return {
    id: Date.now().toString(),
    topic, perspective, videoType, targetLength,
    hook:  { timestamp: '0:00', duration: '30 sec', script: `Start with a bold statement about ${topic} that stops the scroll.` },
    intro: { timestamp: '0:30', duration: '1 min', script: `"In this video I'm going to show you exactly how to ${topic}. Stick with me — this changed everything for my business."` },
    sections,
    cta:   { timestamp: `${parseInt(targetLength.split('-')[1] || targetLength) - 1}:00`, duration: '1 min', script: 'If this helped you, drop a comment below telling me your biggest takeaway. And follow for more real talk about building your barber business.' },
    recordingTips: [
      'Record in one take if possible — natural delivery > perfect delivery',
      'Use a 3-point lighting setup or sit near a large window',
      'Keep energy slightly higher than feels natural — it compresses on camera',
    ],
    createdAt: new Date().toISOString(),
  };
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
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [fetchingTrending, setFetchingTrending] = useState(false);
  const [showTrending, setShowTrending] = useState(false);
  const [activeSection, setActiveSection] = useState<number | null>(null);

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
      if (result?.topics?.length) {
        setTrendingTopics(result.topics);
      } else {
        setTrendingTopics(FALLBACK_TRENDING);
      }
    } catch {
      setTrendingTopics(FALLBACK_TRENDING);
    }
    setShowTrending(true);
    setFetchingTrending(false);
  }

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setPlan(null);
    try {
      const generated = await generatePlanWithClaude(topic, perspective, videoType, targetLength);
      generated.id = Date.now().toString();
      generated.topic = topic;
      generated.perspective = perspective;
      generated.videoType = videoType;
      generated.targetLength = targetLength;
      generated.createdAt = new Date().toISOString();
      setPlan(generated);
    } catch (err) {
      console.error(err);
    }
    setGenerating(false);
  }

  async function handleSave() {
    if (!plan) return;
    setSaving(true);
    try {
      await (window.electronAPI as any).saveVideoPlan?.(plan);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      loadSavedPlans();
    } catch { /* no-op */ }
    setSaving(false);
  }

  return (
    <div className="h-full flex flex-col bg-6fb-bg">
      {/* Header */}
      <div className="px-6 py-5 border-b border-6fb-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Video Planner</h1>
          <p className="text-xs text-6fb-text-secondary mt-0.5">Structure your long-form video before you record. Better plan = better clips.</p>
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
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

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
                  placeholder="e.g. How I doubled my prices without losing clients"
                  className="flex-1 bg-6fb-card border border-6fb-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-6fb-text-muted focus:outline-none focus:border-6fb-green/50 transition-colors"
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                />
                <button
                  onClick={fetchTrending}
                  disabled={fetchingTrending}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-6fb-card border border-6fb-border text-xs font-semibold text-6fb-text-secondary hover:text-white hover:border-6fb-green/40 transition-all whitespace-nowrap disabled:opacity-50"
                >
                  {fetchingTrending ? (
                    <span className="w-3 h-3 border border-6fb-green border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                    </svg>
                  )}
                  Pull Trending
                </button>
              </div>

              {/* Trending Topics Dropdown */}
              {showTrending && trendingTopics.length > 0 && (
                <div className="mt-2 bg-6fb-card border border-6fb-border rounded-xl overflow-hidden shadow-xl">
                  <div className="px-3 py-2 border-b border-6fb-border">
                    <span className="text-[10px] text-6fb-text-muted uppercase font-semibold tracking-wider">Trending in your niche</span>
                  </div>
                  {trendingTopics.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => { setTopic(t); setShowTrending(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-6fb-text-secondary hover:text-white hover:bg-white/5 transition-colors border-b border-6fb-border/30 last:border-0"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Row: Perspective + Video Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-6fb-text-secondary uppercase tracking-wider mb-2">
                  Your Perspective
                </label>
                <select
                  value={perspective}
                  onChange={e => setPerspective(e.target.value)}
                  className="w-full bg-6fb-card border border-6fb-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-6fb-green/50 transition-colors appearance-none cursor-pointer"
                >
                  {PERSPECTIVES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-6fb-text-secondary uppercase tracking-wider mb-2">
                  Video Type
                </label>
                <select
                  value={videoType}
                  onChange={e => setVideoType(e.target.value)}
                  className="w-full bg-6fb-card border border-6fb-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-6fb-green/50 transition-colors appearance-none cursor-pointer"
                >
                  {VIDEO_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Target Length */}
            <div>
              <label className="block text-xs font-semibold text-6fb-text-secondary uppercase tracking-wider mb-2">
                Target Video Length
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TARGET_LENGTHS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setTargetLength(l.value)}
                    className={`py-3 px-2 rounded-xl border text-xs font-semibold text-center transition-all ${
                      targetLength === l.value
                        ? 'bg-6fb-green/10 border-6fb-green text-6fb-green'
                        : 'bg-6fb-card border-6fb-border text-6fb-text-secondary hover:border-6fb-green/30 hover:text-white'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || generating}
              className="w-full py-4 rounded-xl bg-6fb-green text-black font-bold text-sm transition-all hover:bg-6fb-green/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Building your plan...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                  Generate Video Plan
                </>
              )}
            </button>

            {/* Tip */}
            <p className="text-[11px] text-6fb-text-muted text-center">
              The plan will structure your hook, sections, and CTA with timestamps. Record your video to this plan and the Clip Extractor will find the best moments naturally.
            </p>
          </div>
        ) : (
          /* ── PLAN OUTPUT ── */
          <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">

            {/* Plan header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-white leading-tight">{plan.topic}</h2>
                <div className="flex items-center gap-2 mt-1">
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const fullText = [
                      `VIDEO PLAN: ${plan.topic}`,
                      `${VIDEO_TYPES.find(t => t.value === plan.videoType)?.label} — ${TARGET_LENGTHS.find(l => l.value === plan.targetLength)?.label}`,
                      `Perspective: ${PERSPECTIVES.find(p => p.value === plan.perspective)?.label}`,
                      '',
                      `[HOOK — ${plan.hook.timestamp}, ${plan.hook.duration}]`,
                      `"${plan.hook.script}"`,
                      '',
                      `[INTRO — ${plan.intro.timestamp}, ${plan.intro.duration}]`,
                      `"${plan.intro.script}"`,
                      '',
                      ...plan.sections.flatMap((s, i) => [
                        `[SECTION ${i+1}: ${s.title} — ${s.timestamp}, ${s.duration}]`,
                        ...(s.notes ? [`Note: ${s.notes}`] : []),
                        ...s.keyPoints.map(p => `• ${p}`),
                        '',
                      ]),
                      `[CALL TO ACTION — ${plan.cta.timestamp}, ${plan.cta.duration}]`,
                      `"${plan.cta.script}"`,
                      ...(plan.recordingTips?.length ? ['', 'RECORDING TIPS:', ...plan.recordingTips.map(t => `→ ${t}`)] : []),
                    ].join('\n');
                    navigator.clipboard.writeText(fullText);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-6fb-text-secondary hover:text-white bg-6fb-card border border-6fb-border hover:border-6fb-green/30 transition-all"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy All
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    saved
                      ? 'bg-6fb-green/10 text-6fb-green border border-6fb-green/30'
                      : 'bg-6fb-card border border-6fb-border text-6fb-text-secondary hover:text-white hover:border-6fb-green/30'
                  }`}
                >
                  {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Plan'}
                </button>
                <button
                  onClick={() => setPlan(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-6fb-text-secondary hover:text-white bg-6fb-card border border-6fb-border hover:border-6fb-border/80 transition-all"
                >
                  New Plan
                </button>
              </div>
            </div>

            {/* Hook */}
            <PlanBlock
              label="HOOK"
              color="#f59e0b"
              timestamp={plan.hook.timestamp}
              duration={plan.hook.duration}
              content={plan.hook.script}
              type="script"
            />

            {/* Intro */}
            <PlanBlock
              label="INTRO"
              color="#06b6d4"
              timestamp={plan.intro.timestamp}
              duration={plan.intro.duration}
              content={plan.intro.script}
              type="script"
            />

            {/* Sections */}
            {plan.sections.map((section, i) => (
              <div
                key={i}
                className={`bg-6fb-card border rounded-xl overflow-hidden transition-all cursor-pointer ${
                  activeSection === i ? 'border-6fb-green/30' : 'border-6fb-border hover:border-6fb-border/80'
                }`}
                onClick={() => setActiveSection(activeSection === i ? null : i)}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-[10px] font-bold text-6fb-text-muted bg-6fb-border/50 px-2 py-0.5 rounded uppercase tracking-wide">
                    Section {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-white flex-1">{section.title}</span>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-6fb-text-muted">{section.timestamp}</span>
                    <span className="text-[10px] text-6fb-text-muted">·</span>
                    <span className="text-[10px] text-6fb-text-muted">{section.duration}</span>
                    <button
                      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(`[${section.title}]\n${section.keyPoints.map(p => `• ${p}`).join('\n')}`); }}
                      className="ml-1 p-1 rounded text-6fb-text-muted hover:text-white hover:bg-white/5 transition-colors"
                      title="Copy section"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                    <svg className={`w-3.5 h-3.5 text-6fb-text-muted transition-transform ${activeSection === i ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>
                {activeSection === i && (
                  <div className="px-4 pb-4 space-y-3 border-t border-6fb-border/40">
                    {section.notes && (
                      <p className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2 mt-3 italic">
                        🎬 {section.notes}
                      </p>
                    )}
                    <ul className="space-y-1.5 mt-2">
                      {section.keyPoints.map((pt, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-6fb-text-secondary">
                          <span className="w-1 h-1 rounded-full bg-6fb-green mt-2 shrink-0" />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {/* CTA */}
            <PlanBlock
              label="CALL TO ACTION"
              color="#00c851"
              timestamp={plan.cta.timestamp}
              duration={plan.cta.duration}
              content={plan.cta.script}
              type="script"
            />

            {/* Recording Tips */}
            {plan.recordingTips?.length > 0 && (
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">Recording Tips</p>
                <ul className="space-y-1.5">
                  {plan.recordingTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-6fb-text-secondary">
                      <span className="text-blue-400 shrink-0">→</span>
                      {tip}
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

// ── Plan Block Sub-Component ───────────────────────────────────────────────

function PlanBlock({
  label, color, timestamp, duration, content, type
}: {
  label: string; color: string; timestamp: string; duration: string; content: string; type: 'script' | 'points';
}) {
  const { copy, copied } = useCopy();
  return (
    <div className="bg-6fb-card border border-6fb-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-6fb-border/40">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-6fb-text-muted">{timestamp}</span>
          <span className="text-[10px] text-6fb-text-muted">·</span>
          <span className="text-[10px] text-6fb-text-muted">{duration}</span>
          <button
            onClick={() => copy(content)}
            className="ml-1 p-1 rounded text-6fb-text-muted hover:text-white hover:bg-white/5 transition-colors"
            title="Copy"
          >
            {copied ? (
              <svg className="w-3 h-3 text-6fb-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm text-6fb-text-secondary leading-relaxed italic">"{content}"</p>
      </div>
    </div>
  );
}
