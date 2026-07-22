import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  ContentBrain,
  ContentIntent,
  ContentStrategyBrief,
  PackageVariant,
  StrategyContextSnapshot,
  StrategyInsights,
  StrategyScoreBreakdown,
} from '../types/content-strategy';
import type { TrendEvidenceState, TrendFeed, TrendSourceState } from '../types/trends';

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
  strategyBrief?: ContentStrategyBrief;
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

const INTENT_OPTIONS: { value: ContentIntent; label: string }[] = [
  { value: 'education', label: 'Education' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'hybrid', label: 'Hybrid' },
];

const DEFAULT_AUDIENCE = 'Barbers and barbershop owners';
const DEFAULT_POSITIONING = 'Practical, direct, barber-specific advice';

type BriefField = 'audience' | 'viewerOutcome' | 'promise' | 'curiosityGap' | 'proofAsset' | 'payoff' | 'positioning';
type BriefValues = Record<BriefField, string>;
type BriefTouchedState = Record<BriefField, boolean>;
type BriefSuggestions = Partial<Record<BriefField, string>>;

const BRIEF_FIELDS: BriefField[] = ['audience', 'viewerOutcome', 'promise', 'curiosityGap', 'proofAsset', 'payoff', 'positioning'];

const BRIEF_FIELD_LABELS: Record<BriefField, string> = {
  audience: 'Audience',
  viewerOutcome: 'Viewer outcome',
  promise: 'Promise',
  curiosityGap: 'Curiosity gap',
  proofAsset: 'Proof asset',
  payoff: 'Payoff',
  positioning: 'Positioning',
};

const EMPTY_TOUCHED_STATE: BriefTouchedState = {
  audience: false,
  viewerOutcome: false,
  promise: false,
  curiosityGap: false,
  proofAsset: false,
  payoff: false,
  positioning: false,
};

const TOPIC_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'your', 'you', 'how', 'why', 'what', 'when', 'from', 'into', 'about',
  'most', 'barber', 'barbers', 'barbershop', 'shop', 'their', 'they', 'them',
]);

const TREND_EVIDENCE_LABELS: Record<TrendEvidenceState, string> = {
  live: 'Live',
  cached: 'Cached',
  'your-plan': 'Your plan',
  'idea-starter': 'Idea starter',
};

const TREND_SOURCE_STATE_LABELS: Record<TrendSourceState, string> = {
  live: 'Live',
  cached: 'Cached',
  connected: 'Connected',
  'not-connected': 'Not connected',
  unavailable: 'Unavailable',
  empty: 'No results',
  error: 'Error',
};

function trendEvidenceClass(state: TrendEvidenceState) {
  if (state === 'live') return 'border-[#00C851]/40 bg-[#00C851]/10 text-[#67e892]';
  if (state === 'cached') return 'border-amber-400/40 bg-amber-400/10 text-amber-300';
  if (state === 'your-plan') return 'border-sky-400/40 bg-sky-400/10 text-sky-300';
  return 'border-6fb-border bg-white/5 text-6fb-text-secondary';
}

function trendSourceStateClass(state: TrendSourceState) {
  if (state === 'live') return 'text-[#67e892]';
  if (state === 'cached') return 'text-amber-300';
  if (state === 'connected') return 'text-sky-300';
  if (state === 'error') return 'text-red-300';
  return 'text-6fb-text-muted';
}

function formatTrendTime(value?: string) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatTrendTimestamp(value?: string) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const safeTrim = (value?: string | null) => (value ?? '').trim();
const cleanList = (items?: string[] | null) => (items ?? []).map(item => item.trim()).filter(Boolean);

function topicTokens(text: string) {
  return new Set(
    text.toLowerCase()
      .split(/[^a-z0-9]+/)
      .map(token => token.trim())
      .filter(token => token.length > 2 && !TOPIC_STOPWORDS.has(token))
  );
}

function selectContextItems(items: string[] | undefined, topic: string, limit = 2) {
  const cleaned = cleanList(items);
  const tokens = topicTokens(topic);

  return cleaned
    .map((item, index) => {
      const lower = item.toLowerCase();
      let score = 0;
      tokens.forEach(token => {
        if (lower.includes(token)) score += 2;
      });
      return { item, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(result => result.item);
}

function hasContentBrainContext(contentBrain?: ContentBrain | null) {
  if (!contentBrain) return false;
  return Boolean(
    safeTrim(contentBrain.audience) ||
    safeTrim(contentBrain.positioning) ||
    cleanList(contentBrain.offers).length ||
    cleanList(contentBrain.contentPillars).length ||
    cleanList(contentBrain.proofAssets).length ||
    cleanList(contentBrain.voiceRules).length ||
    cleanList(contentBrain.preferredPhrases).length ||
    cleanList(contentBrain.avoidedPhrases).length ||
    cleanList(contentBrain.exampleHooks).length
  );
}

function buildContextSnapshot(contentBrain: ContentBrain | null, topic: string): StrategyContextSnapshot {
  if (!contentBrain) {
    return { selectedPillars: [], selectedProofAssets: [], selectedOffers: [] };
  }

  return {
    selectedPillars: selectContextItems(contentBrain.contentPillars, topic, 2),
    selectedProofAssets: selectContextItems(contentBrain.proofAssets, topic, 2),
    selectedOffers: selectContextItems(contentBrain.offers, topic, 2),
    brainUpdatedAt: contentBrain.updatedAt,
  };
}

function isWeakBriefValue(field: BriefField, value: string) {
  const trimmed = safeTrim(value);
  if (!trimmed) return true;
  if (field === 'audience') return trimmed === DEFAULT_AUDIENCE;
  if (field === 'positioning') return trimmed === DEFAULT_POSITIONING;
  return false;
}

function buildBriefSuggestions(input: {
  topic: string;
  contentBrain: ContentBrain | null;
  contextSnapshot: StrategyContextSnapshot;
}): BriefSuggestions {
  const topicText = safeTrim(input.topic);
  const topPillar = input.contextSnapshot.selectedPillars[0];
  const topProof = input.contextSnapshot.selectedProofAssets[0];
  const suggestions: BriefSuggestions = {
    audience: safeTrim(input.contentBrain?.audience) || undefined,
    viewerOutcome: topicText ? `Know what to do next about ${topicText}` : undefined,
    promise: topicText || undefined,
    curiosityGap: topPillar
      ? `The ${topPillar.toLowerCase()} mistake most barbers overlook`
      : topicText
        ? `The part most barbers overlook before they act on ${topicText}`
        : undefined,
    proofAsset: topProof || undefined,
    payoff: topicText ? 'One clear next step viewers can use after watching' : undefined,
    positioning: safeTrim(input.contentBrain?.positioning) || undefined,
  };

  return Object.fromEntries(
    Object.entries(suggestions).filter(([, value]) => safeTrim(value).length > 0)
  ) as BriefSuggestions;
}

function getApplicableSuggestions(suggestions: BriefSuggestions, values: BriefValues, touched: BriefTouchedState) {
  return BRIEF_FIELDS.reduce<BriefSuggestions>((acc, field) => {
    const suggestion = suggestions[field];
    if (!suggestion || touched[field]) return acc;
    if (!isWeakBriefValue(field, values[field])) return acc;
    if (safeTrim(values[field]) === safeTrim(suggestion)) return acc;
    acc[field] = suggestion;
    return acc;
  }, {});
}

function mergeSuggestedBriefValues(values: BriefValues, suggestions: BriefSuggestions, touched: BriefTouchedState): BriefValues {
  return BRIEF_FIELDS.reduce<BriefValues>((acc, field) => {
    const suggestion = suggestions[field];
    acc[field] = !touched[field] && suggestion && isWeakBriefValue(field, values[field]) ? suggestion : values[field];
    return acc;
  }, { ...values });
}

function buildStrategyInsights(input: {
  topic: string;
  values: BriefValues;
  contextSnapshot: StrategyContextSnapshot;
  hasBrainContext: boolean;
}): StrategyInsights {
  const topicText = safeTrim(input.topic);
  const values = input.values;
  const gaps: string[] = [];
  const proof = safeTrim(values.proofAsset) || input.contextSnapshot.selectedProofAssets[0];

  if (!topicText) gaps.push('Add a focused video topic.');
  if (isWeakBriefValue('audience', values.audience)) {
    gaps.push(input.hasBrainContext ? 'Apply or refine the Brand Brain audience.' : 'Narrow the audience beyond the default.');
  }
  if (!safeTrim(values.viewerOutcome)) gaps.push('Define the viewer outcome.');
  if (!safeTrim(values.promise)) gaps.push('Write the promise before generating.');
  if (!safeTrim(values.curiosityGap)) gaps.push('Add a curiosity gap.');
  if (!proof) gaps.push('Add a proof asset or specific example.');
  if (!safeTrim(values.payoff)) gaps.push('Define the closing payoff.');

  const readiness = !topicText || gaps.length >= 4
    ? 'draft'
    : gaps.length === 0 && Boolean(proof)
      ? 'strong'
      : 'ready';

  const audience = safeTrim(values.audience) || DEFAULT_AUDIENCE;
  const topPillar = input.contextSnapshot.selectedPillars[0];
  const topOffer = input.contextSnapshot.selectedOffers[0];
  const whyShootThis = topicText
    ? `This is worth shooting because it gives ${audience} a specific next step on ${topicText}${proof ? ` backed by ${proof}` : ''}.`
    : undefined;
  const recommendedAngle = topicText
    ? [
        `Lead with ${topPillar || safeTrim(values.viewerOutcome) || 'the viewer outcome'}`,
        `prove it with ${proof || 'one real example'}`,
        topOffer ? `mention ${topOffer} only if it naturally fits` : '',
      ].filter(Boolean).join('; ') + '.'
    : undefined;

  return { readiness, gaps, whyShootThis, recommendedAngle };
}

function scoreFromInsights(insights: StrategyInsights, contextSnapshot: StrategyContextSnapshot): StrategyScoreBreakdown {
  const contextBonus = Math.min(
    12,
    (contextSnapshot.selectedPillars.length + contextSnapshot.selectedProofAssets.length + contextSnapshot.selectedOffers.length) * 3
  );
  const gapPenalty = insights.gaps.length * 7;
  const total = Math.max(35, Math.min(92, 68 + contextBonus - gapPenalty + (insights.readiness === 'strong' ? 8 : 0)));

  return {
    audienceClarity: Math.max(45, Math.min(90, total + (insights.gaps.some(gap => gap.includes('audience')) ? -8 : 4))),
    outcomeValue: Math.max(45, Math.min(90, total + (insights.gaps.some(gap => gap.includes('outcome')) ? -8 : 3))),
    novelty: Math.max(40, Math.min(85, total - 4 + contextBonus)),
    emotionalTrigger: Math.max(40, Math.min(85, total - (insights.gaps.some(gap => gap.includes('curiosity')) ? 10 : 2))),
    packagingStrength: Math.max(45, Math.min(92, total + (insights.gaps.some(gap => gap.includes('promise')) ? -10 : 5))),
    retentionPath: Math.max(45, Math.min(90, total + (insights.gaps.some(gap => gap.includes('payoff')) ? -8 : 2))),
    total,
    rationale: insights.whyShootThis || 'Local planner readiness score before generation.',
  };
}

const emptyScore = (rationale = 'Starter score until AI generation finishes.'): StrategyScoreBreakdown => ({
  audienceClarity: 70,
  outcomeValue: 70,
  novelty: 60,
  emotionalTrigger: 60,
  packagingStrength: 65,
  retentionPath: 65,
  total: 65,
  rationale,
});

const fallbackPackage = (topic: string, promise: string, viewerOutcome: string): PackageVariant[] => ([
  {
    title: promise || topic,
    thumbnailText: viewerOutcome || 'Clear result',
    firstLineCaption: promise || `Most barbers miss this: ${topic}`,
    shortCaption: viewerOutcome || 'Save this before your next shoot.',
    hashtags: ['#barber', '#barberlife', '#barbershop', '#contentstrategy'],
    platformAngle: 'Lead with the outcome, then prove it with one specific example.',
  },
]);

const jsonForPrompt = (value: unknown) => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');

function formatBrainUpdatedAt(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function contentBrainPromptBlock(contentBrain?: ContentBrain | null, contextSnapshot?: StrategyContextSnapshot) {
  if (!contentBrain && !contextSnapshot) return '';
  const selectedPillars = contextSnapshot?.selectedPillars ?? [];
  const selectedProofAssets = contextSnapshot?.selectedProofAssets ?? [];
  const selectedOffers = contextSnapshot?.selectedOffers ?? [];
  const sections = [
    safeTrim(contentBrain?.audience) && `Core audience: ${safeTrim(contentBrain?.audience)}`,
    safeTrim(contentBrain?.positioning) && `Positioning: ${safeTrim(contentBrain?.positioning)}`,
    selectedPillars.length && `Selected content pillars for this plan: ${selectedPillars.join('; ')}`,
    selectedProofAssets.length && `Selected proof assets to prefer: ${selectedProofAssets.join('; ')}`,
    selectedOffers.length && `Offers that may naturally support the plan: ${selectedOffers.join('; ')}`,
    cleanList(contentBrain?.voiceRules).length && `Voice rules: ${cleanList(contentBrain?.voiceRules).join('; ')}`,
    cleanList(contentBrain?.preferredPhrases).length && `Preferred phrases: ${cleanList(contentBrain?.preferredPhrases).join('; ')}`,
    cleanList(contentBrain?.avoidedPhrases).length && `Avoided phrases: ${cleanList(contentBrain?.avoidedPhrases).join('; ')}`,
    cleanList(contentBrain?.exampleHooks).length && `Example hooks in the user's style: ${cleanList(contentBrain?.exampleHooks).join(' | ')}`,
  ].filter(Boolean);

  if (!sections.length) return '';

  return `
Brand Brain context:
${sections.map(section => `- ${section}`).join('\n')}

Use this context to make the plan specific to the user's actual business. Do not force an offer or phrase if it does not fit the topic. Respect avoided phrases.`;
}

function buildStrategyBrief(input: {
  topic: string;
  intent: ContentIntent;
  audience: string;
  viewerOutcome: string;
  promise: string;
  curiosityGap: string;
  proofAsset: string;
  payoff: string;
  positioning: string;
  packageVariants?: PackageVariant[];
  scoreBreakdown?: StrategyScoreBreakdown;
  contextSnapshot?: StrategyContextSnapshot;
  strategyInsights?: StrategyInsights;
}): ContentStrategyBrief {
  const normalizedAudience = input.audience.trim() || DEFAULT_AUDIENCE;
  const normalizedViewerOutcome = input.viewerOutcome.trim() || `Understand ${input.topic} well enough to take action`;
  const normalizedPromise = input.promise.trim() || input.topic;
  const normalizedCuriosityGap = input.curiosityGap.trim() || 'What most people miss before they record';
  const normalizedProofAsset = input.proofAsset.trim() || 'Specific example, number, client story, or before/after';
  const normalizedPayoff = input.payoff.trim() || 'One memorable takeaway viewers can repeat';
  const normalizedPositioning = input.positioning.trim() || DEFAULT_POSITIONING;
  return {
    id: `strategy-${Date.now()}`,
    intent: input.intent,
    audience: normalizedAudience,
    viewerOutcome: normalizedViewerOutcome,
    promise: normalizedPromise,
    curiosityGap: normalizedCuriosityGap,
    proofAsset: normalizedProofAsset,
    payoff: normalizedPayoff,
    positioning: normalizedPositioning,
    packageVariants: input.packageVariants?.length
      ? input.packageVariants
      : fallbackPackage(input.topic, normalizedPromise, normalizedViewerOutcome),
    scoreBreakdown: input.scoreBreakdown || emptyScore(),
    createdAt: new Date().toISOString(),
    source: 'planner',
    contextSnapshot: input.contextSnapshot,
    strategyInsights: input.strategyInsights,
  };
}

// ── Claude prompt ──────────────────────────────────────────────────────────

function buildPrompt(topic: string, perspective: string, videoType: string, targetLength: string, strategyBrief: ContentStrategyBrief, contentBrain?: ContentBrain | null) {
  const lengthMeta = TARGET_LENGTHS.find(l => l.value === targetLength) ?? TARGET_LENGTHS[1];
  const perspLabel = PERSPECTIVES.find(p => p.value === perspective)?.label ?? perspective;
  const typeLabel  = VIDEO_TYPES.find(t => t.value === videoType)?.label ?? videoType;
  const strategyScaffold = {
    intent: strategyBrief.intent,
    audience: strategyBrief.audience,
    viewerOutcome: strategyBrief.viewerOutcome,
    promise: strategyBrief.promise,
    curiosityGap: 'A sharper curiosity gap if you can improve it',
    proofAsset: strategyBrief.proofAsset,
    payoff: strategyBrief.payoff,
    positioning: strategyBrief.positioning,
    packageVariants: [
      {
        title: 'Title variant',
        thumbnailText: '3-5 words',
        firstLineCaption: 'First line for caption',
        shortCaption: 'Short caption',
        hashtags: ['#barber', '#barberlife'],
        platformAngle: 'Platform-specific angle',
      },
    ],
    scoreBreakdown: {
      audienceClarity: 0,
      outcomeValue: 0,
      novelty: 0,
      emotionalTrigger: 0,
      packagingStrength: 0,
      retentionPath: 0,
      total: 0,
      rationale: 'Why this idea should or should not be shot',
    },
    contextSnapshot: strategyBrief.contextSnapshot,
    strategyInsights: {
      readiness: 'draft | ready | strong',
      gaps: ['Specific missing strategy detail, or empty array when strong'],
      whyShootThis: 'One sentence explaining why this is worth recording',
      recommendedAngle: 'One sentence describing the best angle for the shoot',
    },
  };

  return `You are a YouTube/Instagram content strategist specializing in the barber & barbershop niche.

Create a structured shoot plan for a ${lengthMeta.label} ${typeLabel} video on this topic:
"${topic}"
Perspective: ${perspLabel}

Strategy brief:
- Intent: ${strategyBrief.intent}
- Target audience: ${strategyBrief.audience}
- Viewer outcome: ${strategyBrief.viewerOutcome}
- Promise: ${strategyBrief.promise}
- Curiosity gap: ${strategyBrief.curiosityGap}
- Proof asset: ${strategyBrief.proofAsset}
- Payoff: ${strategyBrief.payoff}
- Positioning: ${strategyBrief.positioning}
${contentBrainPromptBlock(contentBrain, strategyBrief.contextSnapshot)}

Package the idea BEFORE the script. Generate title and thumbnail directions first, then build the timeline around that promise.
Before the timeline, evaluate whether the idea is worth shooting. Use the selected Brand Brain proof assets when relevant. Keep offers optional and natural, never forced.

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
  ],
  "strategyBrief": ${jsonForPrompt(strategyScaffold)}
}

Rules:
- Fill strategyBrief.strategyInsights with readiness, gaps, whyShootThis, and recommendedAngle
- Preserve strategyBrief.contextSnapshot unless you add a strictly better selected item from the provided Brand Brain context
- Scripts for drop zones must be EXACT words — punchy, quotable, standalone sentences
- MID-HOOKs should tease what's coming next ("Here's where most people get it wrong...")
- PAYOFF is the closing takeaway — a single memorable line they'll screenshot
- Key points in body sections should be quotable standalone sentences (future clips)
- Tailor everything specifically to the barber niche and the given perspective`;
}

// ── Fallback plan builder ──────────────────────────────────────────────────

function buildFallbackPlan(topic: string, perspective: string, videoType: string, targetLength: string, strategyBriefOverride?: ContentStrategyBrief): VideoPlan {
  const lengthMeta = TARGET_LENGTHS.find(l => l.value === targetLength) ?? TARGET_LENGTHS[1];
  const strategyBrief = strategyBriefOverride ?? buildStrategyBrief({
    topic,
    intent: 'hybrid',
    audience: DEFAULT_AUDIENCE,
    viewerOutcome: `Know what to do next about ${topic}`,
    promise: topic,
    curiosityGap: 'The part most barbers overlook before they record',
    proofAsset: 'Use one real client, price, retention, or before/after example',
    payoff: 'A single line viewers can save and repeat',
    positioning: 'Practical barber-business advice with a strong hook and complete payoff',
  });

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
    strategyBrief,
  };
}

// ── Copy plan as text ──────────────────────────────────────────────────────

function planToText(plan: VideoPlan): string {
  const strategyLines = plan.strategyBrief
    ? strategyBriefToText(plan.strategyBrief)
    : [];
  const lines = [
    `VIDEO PLAN: ${plan.topic}`,
    `${VIDEO_TYPES.find(t => t.value === plan.videoType)?.label} — ${TARGET_LENGTHS.find(l => l.value === plan.targetLength)?.label}`,
    `Perspective: ${PERSPECTIVES.find(p => p.value === plan.perspective)?.label}`,
    '',
    ...strategyLines,
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

function strategyBriefToText(brief: ContentStrategyBrief): string[] {
  const insights = brief.strategyInsights;
  const snapshot = brief.contextSnapshot;
  const lines = [
    'STRATEGY BRIEF:',
    insights?.readiness ? `Readiness: ${insights.readiness}` : '',
    insights?.whyShootThis ? `Why shoot this: ${insights.whyShootThis}` : '',
    insights?.recommendedAngle ? `Recommended angle: ${insights.recommendedAngle}` : '',
    brief.audience ? `Audience: ${brief.audience}` : '',
    brief.viewerOutcome ? `Viewer outcome: ${brief.viewerOutcome}` : '',
    brief.promise ? `Promise: ${brief.promise}` : '',
    brief.proofAsset ? `Proof: ${brief.proofAsset}` : '',
    brief.payoff ? `Payoff: ${brief.payoff}` : '',
    snapshot?.selectedPillars?.length ? `Selected pillars: ${snapshot.selectedPillars.join('; ')}` : '',
    snapshot?.selectedProofAssets?.length ? `Selected proof assets: ${snapshot.selectedProofAssets.join('; ')}` : '',
    snapshot?.selectedOffers?.length ? `Selected offers: ${snapshot.selectedOffers.join('; ')} (use only if natural)` : '',
    insights?.gaps?.length ? `Readiness gaps: ${insights.gaps.join('; ')}` : '',
  ].filter(line => line !== '');

  return [...lines, ''];
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function VideoPlanner({
  onCreateFromPlan,
}: {
  onCreateFromPlan?: (planId: string) => void;
} = {}) {
  const [topic, setTopic]               = useState('');
  const [perspective, setPerspective]   = useState('barber');
  const [videoType, setVideoType]       = useState('talking-head');
  const [targetLength, setTargetLength] = useState('15-20');
  const [intent, setIntent]             = useState<ContentIntent>('hybrid');
  const [audience, setAudience]         = useState(DEFAULT_AUDIENCE);
  const [viewerOutcome, setViewerOutcome] = useState('');
  const [promise, setPromise]           = useState('');
  const [curiosityGap, setCuriosityGap] = useState('');
  const [proofAsset, setProofAsset]     = useState('');
  const [payoff, setPayoff]             = useState('');
  const [positioning, setPositioning]   = useState(DEFAULT_POSITIONING);
  const [briefTouched, setBriefTouched] = useState<BriefTouchedState>(EMPTY_TOUCHED_STATE);
  const [generating, setGenerating]     = useState(false);
  const [plan, setPlan]                 = useState<VideoPlan | null>(null);
  const [savedPlans, setSavedPlans]     = useState<VideoPlan[]>([]);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [fetchingTrending, setFetchingTrending] = useState(false);
  const [showTrending, setShowTrending]         = useState(false);
  const [trendFeed, setTrendFeed]               = useState<TrendFeed | null>(null);
  const [trendError, setTrendError]             = useState<string | null>(null);
  const [expandedBody, setExpandedBody]         = useState<number | null>(null);
  const [contentBrain, setContentBrain]         = useState<ContentBrain | null>(null);
  const trendRequestId                          = useRef(0);
  const { copy: copyAll, copied: copiedAll }    = useCopy();

  const briefValues = useMemo<BriefValues>(() => ({
    audience,
    viewerOutcome,
    promise,
    curiosityGap,
    proofAsset,
    payoff,
    positioning,
  }), [audience, viewerOutcome, promise, curiosityGap, proofAsset, payoff, positioning]);

  const contextSnapshot = useMemo(
    () => buildContextSnapshot(contentBrain, topic),
    [contentBrain, topic]
  );

  const hasBrainContext = useMemo(
    () => hasContentBrainContext(contentBrain),
    [contentBrain]
  );

  const suggestedBriefValues = useMemo(
    () => buildBriefSuggestions({ topic, contentBrain, contextSnapshot }),
    [topic, contentBrain, contextSnapshot]
  );

  const applicableSuggestions = useMemo(
    () => getApplicableSuggestions(suggestedBriefValues, briefValues, briefTouched),
    [suggestedBriefValues, briefValues, briefTouched]
  );

  const previewBriefValues = useMemo(
    () => mergeSuggestedBriefValues(briefValues, suggestedBriefValues, briefTouched),
    [briefValues, suggestedBriefValues, briefTouched]
  );

  const strategyInsights = useMemo(
    () => buildStrategyInsights({ topic, values: previewBriefValues, contextSnapshot, hasBrainContext }),
    [topic, previewBriefValues, contextSnapshot, hasBrainContext]
  );

  const suggestionCount = Object.keys(applicableSuggestions).length;

  useEffect(() => {
    loadSavedPlans();
    (window.electronAPI as any).getContentBrain?.().then((brain: ContentBrain) => setContentBrain(brain)).catch(() => {});
  }, []);

  function markBriefTouched(field: BriefField) {
    setBriefTouched(prev => ({ ...prev, [field]: true }));
  }

  function applyStrategySuggestions() {
    if (applicableSuggestions.audience) setAudience(applicableSuggestions.audience);
    if (applicableSuggestions.viewerOutcome) setViewerOutcome(applicableSuggestions.viewerOutcome);
    if (applicableSuggestions.promise) setPromise(applicableSuggestions.promise);
    if (applicableSuggestions.curiosityGap) setCuriosityGap(applicableSuggestions.curiosityGap);
    if (applicableSuggestions.proofAsset) setProofAsset(applicableSuggestions.proofAsset);
    if (applicableSuggestions.payoff) setPayoff(applicableSuggestions.payoff);
    if (applicableSuggestions.positioning) setPositioning(applicableSuggestions.positioning);
  }

  async function loadSavedPlans() {
    try {
      const result = await (window.electronAPI as any).listVideoPlans?.();
      if (result?.plans) setSavedPlans(result.plans);
    } catch { /* not wired yet */ }
  }

  async function fetchTrending() {
    const requestId = ++trendRequestId.current;
    setFetchingTrending(true);
    setTrendError(null);
    setTrendFeed(null);
    setShowTrending(true);
    try {
      const result = await window.electronAPI.fetchSmartTrends();
      if (!result || !Array.isArray(result.ideas) || !Array.isArray(result.sources)) {
        throw new Error('Trend sources returned an invalid response.');
      }
      if (requestId !== trendRequestId.current) return;
      setTrendFeed(result);
    } catch {
      if (requestId !== trendRequestId.current) return;
      setTrendFeed(null);
      setTrendError('Trend sources could not be checked. You can retry or enter a topic manually.');
    } finally {
      if (requestId === trendRequestId.current) setFetchingTrending(false);
    }
  }

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setPlan(null);
    const generationValues = mergeSuggestedBriefValues(briefValues, applicableSuggestions, briefTouched);
    const generationInsights = buildStrategyInsights({
      topic,
      values: generationValues,
      contextSnapshot,
      hasBrainContext,
    });
    const strategyDraft = buildStrategyBrief({
      topic,
      intent,
      audience: generationValues.audience,
      viewerOutcome: generationValues.viewerOutcome,
      promise: generationValues.promise,
      curiosityGap: generationValues.curiosityGap,
      proofAsset: generationValues.proofAsset,
      payoff: generationValues.payoff,
      positioning: generationValues.positioning,
      contextSnapshot,
      strategyInsights: generationInsights,
      scoreBreakdown: scoreFromInsights(generationInsights, contextSnapshot),
    });
    try {
      const prompt = buildPrompt(topic, perspective, videoType, targetLength, strategyDraft, contentBrain);
      const response = await (window.electronAPI as any).generateVideoPlan?.({ prompt });
      const raw: Omit<VideoPlan, 'id' | 'topic' | 'perspective' | 'videoType' | 'targetLength' | 'createdAt'> & { strategyBrief?: Partial<ContentStrategyBrief> } =
        (response?.success && response.plan) ? response.plan : buildFallbackPlan(topic, perspective, videoType, targetLength, strategyDraft);
      const generatedInsights: StrategyInsights = {
        ...strategyDraft.strategyInsights!,
        ...raw.strategyBrief?.strategyInsights,
        readiness: raw.strategyBrief?.strategyInsights?.readiness || strategyDraft.strategyInsights!.readiness,
        gaps: raw.strategyBrief?.strategyInsights?.gaps || strategyDraft.strategyInsights!.gaps,
      };
      const generatedBrief: ContentStrategyBrief = {
        ...strategyDraft,
        ...raw.strategyBrief,
        id: strategyDraft.id,
        createdAt: strategyDraft.createdAt,
        source: 'planner' as const,
        contextSnapshot: raw.strategyBrief?.contextSnapshot || strategyDraft.contextSnapshot,
        strategyInsights: generatedInsights,
        packageVariants: raw.strategyBrief?.packageVariants?.length
          ? raw.strategyBrief.packageVariants
          : strategyDraft.packageVariants,
        scoreBreakdown: raw.strategyBrief?.scoreBreakdown || strategyDraft.scoreBreakdown,
      };
      const nextPlan = { ...raw, id: Date.now().toString(), topic, perspective, videoType, targetLength, createdAt: new Date().toISOString(), strategyBrief: generatedBrief };
      setPlan(nextPlan);
      localStorage.setItem('contentStrategy:lastBrief', JSON.stringify(generatedBrief));
    } catch {
      const fallback = buildFallbackPlan(topic, perspective, videoType, targetLength, strategyDraft);
      setPlan(fallback);
      if (fallback.strategyBrief) localStorage.setItem('contentStrategy:lastBrief', JSON.stringify(fallback.strategyBrief));
    }
    setGenerating(false);
  }

  async function handleSave(): Promise<string | null> {
    if (!plan) return null;
    setSaving(true);
    try {
      const result = await (window.electronAPI as any).saveVideoPlan?.(plan);
      if (!result?.success) return null;
      const savedPlanId = String(result.id ?? plan.id);
      if (savedPlanId !== plan.id) {
        setPlan(current => current ? { ...current, id: savedPlanId } : current);
      }
      if (plan.strategyBrief) localStorage.setItem('contentStrategy:lastBrief', JSON.stringify(plan.strategyBrief));
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      await loadSavedPlans();
      return savedPlanId;
    } catch {
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateFromPlan() {
    const savedPlanId = await handleSave();
    if (savedPlanId) onCreateFromPlan?.(savedPlanId);
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={topic}
                  onChange={e => { setTopic(e.target.value); setShowTrending(false); }}
                  placeholder="e.g. Build a loyal barber clientele"
                  className="min-w-0 flex-1 bg-6fb-card border border-6fb-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-6fb-text-muted focus:outline-none focus:border-6fb-green/50 transition-colors"
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                />
                <button
                  onClick={fetchTrending}
                  disabled={fetchingTrending}
                  aria-expanded={showTrending}
                  aria-controls="smart-trend-results"
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 px-4 py-3 rounded-xl bg-6fb-card border border-6fb-border text-xs font-semibold text-6fb-text-secondary hover:text-white hover:border-6fb-green/40 transition-all whitespace-nowrap disabled:opacity-50 sm:w-auto"
                >
                  {fetchingTrending
                    ? <span className="w-3 h-3 border border-6fb-green border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  }
                  {fetchingTrending ? 'Checking sources…' : 'Find live trends'}
                </button>
              </div>

              {showTrending && (
                <div
                  id="smart-trend-results"
                  className="mt-2 bg-6fb-card border border-6fb-border rounded-xl overflow-hidden shadow-xl"
                  onKeyDown={event => {
                    if (event.key === 'Escape') setShowTrending(false);
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 border-b border-6fb-border">
                    <div>
                      <h2 className="text-xs font-bold text-white">Topic intelligence</h2>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-6fb-text-muted">
                        Live signals, your plan, and offline starters are labelled separately.
                      </p>
                    </div>
                    {trendFeed && (
                      <span className="text-[10px] text-6fb-text-muted">
                        Checked {formatTrendTime(trendFeed.fetchedAt) ?? 'recently'}
                      </span>
                    )}
                  </div>

                  {fetchingTrending && !trendFeed && (
                    <div role="status" className="flex items-center gap-3 px-4 py-5 text-xs text-6fb-text-secondary">
                      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border border-6fb-green border-t-transparent" />
                      Checking Google Trends and your connected sources…
                    </div>
                  )}

                  {trendError && (
                    <div role="alert" className="px-4 py-3 border-b border-red-400/20 bg-red-400/5 text-xs leading-relaxed text-red-200">
                      {trendError}
                    </div>
                  )}

                  {trendFeed && (
                    <>
                      <div className="grid grid-cols-1 gap-px bg-6fb-border/60 sm:grid-cols-2" aria-label="Trend source status">
                        {trendFeed.sources.map(source => (
                          <div key={source.sourceId} className="min-w-0 bg-6fb-card px-3 py-2.5">
                            <div className="flex min-w-0 items-center justify-between gap-2">
                              <span className="truncate text-[10px] font-semibold text-6fb-text-secondary">{source.sourceLabel}</span>
                              <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide ${trendSourceStateClass(source.state)}`}>
                                {TREND_SOURCE_STATE_LABELS[source.state]}
                              </span>
                            </div>
                            {source.message && (
                              <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-6fb-text-muted">{source.message}</p>
                            )}
                            {formatTrendTimestamp(source.checkedAt) && (
                              <p className="mt-1 text-[9px] leading-relaxed text-6fb-text-muted">
                                Source checked {formatTrendTimestamp(source.checkedAt)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      <div aria-live="polite">
                        {trendFeed.ideas.map(idea => (
                          <div key={idea.id} className="border-b border-6fb-border/40 last:border-0">
                            <button
                              onClick={() => { setTopic(idea.title); setShowTrending(false); }}
                              className="group w-full px-4 pb-2 pt-3 text-left transition-colors hover:bg-white/5 focus-visible:bg-white/5"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${trendEvidenceClass(idea.evidenceState)}`}>
                                  {TREND_EVIDENCE_LABELS[idea.evidenceState]}
                                </span>
                                <span className="text-[10px] text-6fb-text-muted">{idea.sourceLabel}</span>
                                {typeof idea.barberFitScore === 'number' && (
                                  <span className="text-[10px] text-6fb-text-muted">Barber fit {idea.barberFitScore}/100</span>
                                )}
                              </div>
                              <span className="mt-1.5 block break-words text-sm font-semibold leading-snug text-6fb-text-secondary transition-colors group-hover:text-white">
                                {idea.title}
                              </span>
                              <span className="mt-1 block break-words text-[10px] leading-relaxed text-6fb-text-muted">
                                {idea.whyNow}
                              </span>
                              {formatTrendTimestamp(idea.publishedAt) && (
                                <span className="mt-1 block text-[10px] leading-relaxed text-6fb-text-muted">
                                  Published {formatTrendTimestamp(idea.publishedAt)}
                                </span>
                              )}
                            </button>
                            {idea.sourceUrl && (
                              <button
                                onClick={async () => {
                                  const opened = await window.electronAPI.openTrendSource(idea.sourceUrl!);
                                  if (!opened.success) setTrendError(opened.error ?? 'Could not open the trend source.');
                                }}
                                className="ml-4 min-h-[44px] px-0 pb-2 text-[10px] font-semibold text-6fb-green hover:text-white"
                                aria-label={`Open source for ${idea.title}`}
                              >
                                View source ↗
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Perspective + Video Type */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <StrategyCoachPanel
              hasBrainContext={hasBrainContext}
              contextSnapshot={contextSnapshot}
              insights={strategyInsights}
              applicableSuggestions={applicableSuggestions}
              suggestionCount={suggestionCount}
              onApplySuggestions={applyStrategySuggestions}
            />

            {/* Strategy Brief */}
            <div className="bg-6fb-card border border-6fb-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white">Growth Brief</p>
                  <p className="text-[10px] text-6fb-text-muted mt-0.5">Package the outcome before the shoot plan.</p>
                </div>
                <select value={intent} onChange={e => setIntent(e.target.value as ContentIntent)}
                  className="bg-[#0f0f0f] border border-6fb-border rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-6fb-green/50">
                  {INTENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input value={audience} onChange={e => { markBriefTouched('audience'); setAudience(e.target.value); }} placeholder="Target audience"
                  className="bg-[#0f0f0f] border border-6fb-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-6fb-text-muted focus:outline-none focus:border-6fb-green/50" />
                <input value={viewerOutcome} onChange={e => { markBriefTouched('viewerOutcome'); setViewerOutcome(e.target.value); }} placeholder="Viewer outcome"
                  className="bg-[#0f0f0f] border border-6fb-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-6fb-text-muted focus:outline-none focus:border-6fb-green/50" />
                <input value={promise} onChange={e => { markBriefTouched('promise'); setPromise(e.target.value); }} placeholder="Promise"
                  className="bg-[#0f0f0f] border border-6fb-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-6fb-text-muted focus:outline-none focus:border-6fb-green/50" />
                <input value={curiosityGap} onChange={e => { markBriefTouched('curiosityGap'); setCuriosityGap(e.target.value); }} placeholder="Curiosity gap"
                  className="bg-[#0f0f0f] border border-6fb-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-6fb-text-muted focus:outline-none focus:border-6fb-green/50" />
                <input value={proofAsset} onChange={e => { markBriefTouched('proofAsset'); setProofAsset(e.target.value); }} placeholder="Proof asset"
                  className="bg-[#0f0f0f] border border-6fb-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-6fb-text-muted focus:outline-none focus:border-6fb-green/50" />
                <input value={payoff} onChange={e => { markBriefTouched('payoff'); setPayoff(e.target.value); }} placeholder="Payoff"
                  className="bg-[#0f0f0f] border border-6fb-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-6fb-text-muted focus:outline-none focus:border-6fb-green/50" />
              </div>
              <input value={positioning} onChange={e => { markBriefTouched('positioning'); setPositioning(e.target.value); }} placeholder="Positioning"
                className="w-full bg-[#0f0f0f] border border-6fb-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-6fb-text-muted focus:outline-none focus:border-6fb-green/50" />
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
                {onCreateFromPlan && (
                  <button onClick={handleCreateFromPlan} disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-6fb-green text-black hover:bg-6fb-green/90 disabled:opacity-50 transition-all">
                    {saving ? 'Saving...' : 'Create from this plan'}
                  </button>
                )}
                <button onClick={() => { setPlan(null); setExpandedBody(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-6fb-text-secondary hover:text-white bg-6fb-card border border-6fb-border transition-all">
                  New Plan
                </button>
              </div>
            </div>

            {/* Timeline */}
            {plan.strategyBrief && <StrategyPackagePanel brief={plan.strategyBrief} />}

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

// ── Strategy Coach Panel ──────────────────────────────────────────────────

function StrategyCoachPanel({
  hasBrainContext,
  contextSnapshot,
  insights,
  applicableSuggestions,
  suggestionCount,
  onApplySuggestions,
}: {
  hasBrainContext: boolean;
  contextSnapshot: StrategyContextSnapshot;
  insights: StrategyInsights;
  applicableSuggestions: BriefSuggestions;
  suggestionCount: number;
  onApplySuggestions: () => void;
}) {
  const contextCount =
    contextSnapshot.selectedPillars.length +
    contextSnapshot.selectedProofAssets.length +
    contextSnapshot.selectedOffers.length;
  const suggestionLabels = BRIEF_FIELDS
    .filter(field => applicableSuggestions[field])
    .map(field => BRIEF_FIELD_LABELS[field]);
  const readinessClass = insights.readiness === 'strong'
    ? 'border-6fb-green/40 bg-6fb-green/10 text-6fb-green'
    : insights.readiness === 'ready'
      ? 'border-blue-400/30 bg-blue-500/10 text-blue-300'
      : 'border-amber-400/30 bg-amber-500/10 text-amber-300';
  const brainUpdatedLabel = formatBrainUpdatedAt(contextSnapshot.brainUpdatedAt);

  return (
    <div className="bg-6fb-card border border-6fb-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-white">Strategy Coach</p>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${readinessClass}`}>
              {insights.readiness}
            </span>
          </div>
          <p className="text-[10px] text-6fb-text-muted mt-0.5">
            {hasBrainContext
              ? `Using Brand Brain context${brainUpdatedLabel ? ` updated ${brainUpdatedLabel}` : ''}.`
              : 'No Brand Brain context saved yet.'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-white">{Math.max(0, 6 - insights.gaps.length)}/6</p>
          <p className="text-[9px] text-6fb-text-muted uppercase tracking-wider">ready</p>
        </div>
      </div>

      {insights.whyShootThis && (
        <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
          <p className="text-[10px] font-bold text-6fb-text-secondary uppercase tracking-wider mb-1">Why shoot this</p>
          <p className="text-xs text-white leading-relaxed">{insights.whyShootThis}</p>
          {insights.recommendedAngle && (
            <p className="text-[11px] text-6fb-text-muted leading-relaxed mt-1">{insights.recommendedAngle}</p>
          )}
        </div>
      )}

      {contextCount > 0 && (
        <div className="grid gap-2">
          <StrategyContextGroup label="Pillars" items={contextSnapshot.selectedPillars} />
          <StrategyContextGroup label="Proof" items={contextSnapshot.selectedProofAssets} />
          <StrategyContextGroup label="Offers" items={contextSnapshot.selectedOffers} />
        </div>
      )}

      {insights.gaps.length > 0 && (
        <div className="rounded-lg border border-amber-500/10 bg-amber-500/[0.04] px-3 py-2">
          <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wider mb-1">Readiness gaps</p>
          <div className="flex flex-wrap gap-1.5">
            {insights.gaps.slice(0, 4).map(gap => (
              <span key={gap} className="text-[10px] text-amber-100/80 bg-black/20 border border-amber-500/10 rounded-full px-2 py-1">
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[10px] text-6fb-text-muted leading-relaxed">
          {suggestionCount > 0
            ? `Can fill: ${suggestionLabels.join(', ')}`
            : 'Blank-field suggestions are up to date.'}
        </p>
        <button
          onClick={onApplySuggestions}
          disabled={suggestionCount === 0}
          className="shrink-0 px-3 py-1.5 rounded-lg border border-6fb-green/30 bg-6fb-green/10 text-[11px] font-semibold text-6fb-green hover:bg-6fb-green/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Apply suggestions
        </button>
      </div>
    </div>
  );
}

function StrategyContextGroup({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[9px] font-bold text-6fb-text-muted uppercase tracking-wider mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span key={`${label}-${item}`} className="text-[10px] text-6fb-text-secondary bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-1">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Strategy Package Panel ─────────────────────────────────────────────────

function StrategyPackagePanel({ brief }: { brief: ContentStrategyBrief }) {
  const score = brief.scoreBreakdown?.total ?? 0;
  const variants = brief.packageVariants?.slice(0, 3) ?? [];
  const insights = brief.strategyInsights;
  const insightGaps = insights?.gaps ?? [];
  const snapshot = brief.contextSnapshot;
  const selectedProofAssets = snapshot?.selectedProofAssets ?? [];
  const selectedPillars = snapshot?.selectedPillars ?? [];
  const readinessClass = insights?.readiness === 'strong'
    ? 'border-6fb-green/40 bg-6fb-green/10 text-6fb-green'
    : insights?.readiness === 'ready'
      ? 'border-blue-400/30 bg-blue-500/10 text-blue-300'
      : 'border-amber-400/30 bg-amber-500/10 text-amber-300';

  return (
    <div className="mb-4 rounded-xl border border-6fb-green/20 bg-6fb-green/[0.03] p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-[10px] font-bold text-6fb-green uppercase tracking-wider">Packaging Lab</p>
          <h3 className="text-sm font-semibold text-white mt-1">{brief.promise}</h3>
          <p className="text-xs text-6fb-text-muted mt-1">{brief.viewerOutcome}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-white">{Math.round(score)}</p>
          <p className="text-[10px] text-6fb-text-muted">Idea score</p>
          {insights?.readiness && (
            <span className={`inline-block mt-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${readinessClass}`}>
              {insights.readiness}
            </span>
          )}
        </div>
      </div>
      {insights && (insights.whyShootThis || insights.recommendedAngle || insightGaps.length > 0) && (
        <div className="mb-3 rounded-lg border border-white/5 bg-black/20 p-3">
          {insights.whyShootThis && (
            <p className="text-xs text-white leading-relaxed">{insights.whyShootThis}</p>
          )}
          {insights.recommendedAngle && (
            <p className="text-[11px] text-6fb-text-muted leading-relaxed mt-1">{insights.recommendedAngle}</p>
          )}
          {insightGaps.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {insightGaps.slice(0, 4).map(gap => (
                <span key={gap} className="text-[9px] text-amber-100/80 bg-amber-500/10 border border-amber-500/10 rounded-full px-2 py-0.5">
                  {gap}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {(selectedPillars.length > 0 || selectedProofAssets.length > 0) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {selectedPillars.map(item => (
            <span key={`pillar-${item}`} className="text-[9px] text-6fb-text-secondary bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-1">
              Pillar: {item}
            </span>
          ))}
          {selectedProofAssets.map(item => (
            <span key={`proof-${item}`} className="text-[9px] text-6fb-green bg-6fb-green/10 border border-6fb-green/20 rounded-full px-2 py-1">
              Proof: {item}
            </span>
          ))}
        </div>
      )}
      <div className="grid gap-2">
        {variants.map((variant, i) => (
          <div key={i} className="rounded-lg border border-white/5 bg-black/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] text-6fb-green font-bold">#{i + 1}</span>
              <p className="text-xs font-semibold text-white">{variant.title}</p>
            </div>
            <p className="text-[11px] text-6fb-text-secondary">Thumbnail: {variant.thumbnailText}</p>
            <p className="text-[11px] text-6fb-text-muted mt-1">{variant.platformAngle}</p>
          </div>
        ))}
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
