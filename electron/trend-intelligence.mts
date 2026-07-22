import type { ContentBrain } from '../src/types/content-strategy.ts';
import type { TrendEvidenceState, TrendIdea } from '../src/types/trends.ts';

export const MAX_TREND_TITLE_LENGTH = 120;
export const MAX_TREND_IDEAS = 12;
export const MAX_GOOGLE_RSS_BYTES = 512 * 1024;
export const TREND_FRESH_CACHE_MS = 10 * 60 * 1000;
export const TREND_STALE_CACHE_MS = 24 * 60 * 60 * 1000;

const GOOGLE_TRENDS_HOSTS = ['trends.google.com'] as const;
const INSTAGRAM_HOSTS = ['instagram.com', 'www.instagram.com'] as const;
const SENSITIVE_QUERY_KEY = /(?:access[_-]?token|api[_-]?key|auth|secret|signature|^key$|^token$)/i;
const ALLOWED_INSTAGRAM_MEDIA_TYPES = new Set(['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM']);

const STARTER_TITLES = [
  'How to raise your prices without losing your best clients',
  'Booth rent versus commission: what changes for a barber',
  'The consultation habit that builds repeat clientele',
  'What every new barber should know before taking a first client',
  'A behind-the-chair routine that saves time on every service',
  'How to turn one haircut into a week of useful content',
  'The tools worth upgrading first in a barber setup',
  'How shop owners can coach consistency without micromanaging',
] as const;

const FIT_STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'before', 'best', 'for', 'from', 'how', 'into', 'most',
  'that', 'the', 'their', 'this', 'through', 'versus', 'what', 'when', 'where', 'which', 'who', 'why', 'with',
  'without', 'your',
]);

const BARBER_DOMAIN_TOKENS = new Set([
  'barber', 'barbershop', 'beard', 'booth', 'booking', 'chair', 'client', 'clipper', 'commission', 'consultation',
  'content', 'cut', 'fade', 'grooming', 'hair', 'haircut', 'lineup', 'pricing', 'razor', 'retention', 'shop', 'suite',
  'taper', 'trimmer',
]);

const EVIDENCE_PRIORITY: Record<TrendEvidenceState, number> = {
  live: 0,
  cached: 1,
  'your-plan': 2,
  'idea-starter': 3,
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function clampLimit(limit: number | undefined, maximum = MAX_TREND_IDEAS) {
  if (!Number.isFinite(limit)) return maximum;
  return Math.max(0, Math.min(maximum, Math.floor(limit as number)));
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const numeric = code[1]?.toLowerCase() === 'x'
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 0x10ffff) return '';
    try {
      return String.fromCodePoint(numeric);
    } catch {
      return '';
    }
  });
}

export function sanitizeTrendTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const withoutCdata = value.replace(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/, '$1');
  const cleaned = decodeEntities(withoutCdata)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  const characters = Array.from(cleaned);
  if (characters.length <= MAX_TREND_TITLE_LENGTH) return cleaned;
  return `${characters.slice(0, MAX_TREND_TITLE_LENGTH - 1).join('').trimEnd()}…`;
}

export function sanitizeTrendUrl(value: unknown, allowedHosts: readonly string[]): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  try {
    const url = new URL(decodeEntities(value.trim()));
    const allowed = new Set(allowedHosts.map(host => host.toLowerCase()));
    if (url.protocol !== 'https:' || !allowed.has(url.hostname.toLowerCase())) return null;
    if (url.username || url.password || (url.port && url.port !== '443')) return null;
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEY.test(key)) return null;
    }
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function extractXmlTag(block: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'))?.[1] ?? null;
}

function safeIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function safeTimestamp(value: string) {
  return safeIsoDate(value) ?? value;
}

function slug(value: string) {
  return value.toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'idea';
}

function sanitizeTraffic(value: unknown): string | undefined {
  const cleaned = sanitizeTrendTitle(value);
  if (!cleaned || !/^(?:\d+(?:[,.]\d+)*)\s*[kmb]?\+?$/i.test(cleaned)) return undefined;
  return `${cleaned.replace(/\s+/g, '')} searches`;
}

function dedupeKey(title: string) {
  return title.toLowerCase().normalize('NFKC').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function parseGoogleTrendsRss(xml: string, fetchedAt: string, limit = 8): TrendIdea[] {
  if (typeof xml !== 'string' || new TextEncoder().encode(xml).byteLength > MAX_GOOGLE_RSS_BYTES) return [];
  const resultLimit = clampLimit(limit);
  const observedAt = safeTimestamp(fetchedAt);
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  const parsed: TrendIdea[] = [];

  for (const [index, match] of items.entries()) {
    if (parsed.length >= resultLimit) break;
    const block = match[1];
    const title = sanitizeTrendTitle(extractXmlTag(block, 'title'));
    const sourceUrl = sanitizeTrendUrl(extractXmlTag(block, 'link'), GOOGLE_TRENDS_HOSTS);
    if (!title || !sourceUrl) continue;
    const trafficEvidence = sanitizeTraffic(extractXmlTag(block, 'ht:approx_traffic'));
    const publishedAt = safeIsoDate(decodeEntities(extractXmlTag(block, 'pubDate') ?? ''));
    parsed.push({
      id: `google-trends:${slug(title)}:${index}`,
      title,
      sourceId: 'google-trends',
      sourceLabel: 'Google Trends',
      evidenceState: 'live',
      sourceUrl,
      observedAt,
      publishedAt,
      trafficEvidence,
      whyNow: trafficEvidence
        ? `Google Trends reports ${trafficEvidence} for this broad US search signal.`
        : 'Current broad US search signal from Google Trends.',
    });
  }

  return dedupeTrendIdeas(parsed, resultLimit);
}

function normalizeHashtag(value: string) {
  const hashtag = value.trim().replace(/^#+/, '').toLowerCase();
  return /^[a-z0-9_]{2,64}$/.test(hashtag) ? hashtag : null;
}

function safeCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER)
    : undefined;
}

function instagramTraffic(record: UnknownRecord) {
  const likes = safeCount(record.like_count);
  const comments = safeCount(record.comments_count);
  const parts: string[] = [];
  if (likes !== undefined) parts.push(`${likes.toLocaleString('en-US')} likes`);
  if (comments !== undefined) parts.push(`${comments.toLocaleString('en-US')} comments`);
  return parts.length ? parts.join(' · ') : undefined;
}

export function mapInstagramMediaToTrends(
  payload: unknown,
  hashtagValue: string,
  fetchedAt: string,
  limit = 6,
): TrendIdea[] {
  const hashtag = normalizeHashtag(hashtagValue);
  if (!hashtag) return [];
  const payloadRecord = asRecord(payload);
  const media = Array.isArray(payload) ? payload : payloadRecord?.data;
  if (!Array.isArray(media)) return [];
  const resultLimit = clampLimit(limit);
  const observedAt = safeTimestamp(fetchedAt);
  const ideas: TrendIdea[] = [];

  for (const raw of media) {
    if (ideas.length >= resultLimit) break;
    const record = asRecord(raw);
    if (!record) continue;
    const id = typeof record.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(record.id) ? record.id : null;
    const mediaType = typeof record.media_type === 'string' ? record.media_type.toUpperCase() : '';
    const publishedAt = safeIsoDate(record.timestamp);
    const sourceUrl = sanitizeTrendUrl(record.permalink, INSTAGRAM_HOSTS);
    const title = sanitizeTrendTitle(record.caption);
    if (!id || !ALLOWED_INSTAGRAM_MEDIA_TYPES.has(mediaType) || !publishedAt || !sourceUrl || !title) continue;
    const trafficEvidence = instagramTraffic(record);
    ideas.push({
      id: `instagram:${id}`,
      title,
      sourceId: 'instagram',
      sourceLabel: `Instagram #${hashtag}`,
      evidenceState: 'live',
      sourceUrl,
      observedAt,
      publishedAt,
      trafficEvidence,
      whyNow: trafficEvidence
        ? `Recent Instagram #${hashtag} media with ${trafficEvidence}.`
        : `Recent Instagram #${hashtag} media from the authorized Graph API response.`,
    });
  }

  return dedupeTrendIdeas(ideas, resultLimit);
}

function unwrapContentPlannerPayload(payload: unknown) {
  const record = asRecord(payload);
  return asRecord(record?.data) ?? record;
}

export function mapContentPlannerToTrends(payload: unknown, fetchedAt: string, limit = 8): TrendIdea[] {
  const data = unwrapContentPlannerPayload(payload);
  if (!data) return [];
  const observedAt = safeTimestamp(fetchedAt);
  const ideas: TrendIdea[] = [];
  const today = asRecord(data.today);
  const todayTitle = sanitizeTrendTitle(today?.topic);
  if (todayTitle) {
    ideas.push({
      id: `content-planner:today:${slug(todayTitle)}`,
      title: todayTitle,
      sourceId: 'content-planner',
      sourceLabel: '6FB Content Planner',
      evidenceState: 'your-plan',
      observedAt,
      whyNow: 'Scheduled as today’s topic in your 6FB Content Planner.',
    });
  }

  if (Array.isArray(data.week)) {
    for (const [index, raw] of data.week.entries()) {
      const entry = asRecord(raw);
      const title = sanitizeTrendTitle(entry?.topic);
      if (!title) continue;
      const day = sanitizeTrendTitle(entry?.day);
      ideas.push({
        id: `content-planner:week:${day ? slug(day) : index}:${slug(title)}`,
        title,
        sourceId: 'content-planner',
        sourceLabel: '6FB Content Planner',
        evidenceState: 'your-plan',
        observedAt,
        whyNow: day
          ? `Scheduled for ${day} in your 6FB Content Planner.`
          : 'Scheduled in your 6FB Content Planner week plan.',
      });
    }
  }

  return dedupeTrendIdeas(ideas, clampLimit(limit));
}

export function createIdeaStarters(limit = 8): TrendIdea[] {
  return STARTER_TITLES.slice(0, clampLimit(limit)).map((title, index) => ({
    id: `idea-starter:${index}:${slug(title)}`,
    title,
    sourceId: 'idea-starter',
    sourceLabel: 'Idea starters',
    evidenceState: 'idea-starter',
    whyNow: 'Timeless barber-specific inspiration; no live trend evidence.',
  }));
}

function preferIdea(candidate: TrendIdea, current: TrendIdea) {
  const stateDifference = EVIDENCE_PRIORITY[candidate.evidenceState] - EVIDENCE_PRIORITY[current.evidenceState];
  if (stateDifference !== 0) return stateDifference < 0;
  return (candidate.barberFitScore ?? -1) > (current.barberFitScore ?? -1);
}

export function dedupeTrendIdeas(ideas: readonly TrendIdea[], limit = MAX_TREND_IDEAS): TrendIdea[] {
  const byTitle = new Map<string, TrendIdea>();
  for (const idea of ideas) {
    const title = sanitizeTrendTitle(idea.title);
    if (!title) continue;
    const key = dedupeKey(title);
    if (!key) continue;
    const candidate = { ...idea, title };
    const current = byTitle.get(key);
    if (!current || preferIdea(candidate, current)) byTitle.set(key, candidate);
  }
  return [...byTitle.values()].slice(0, clampLimit(limit));
}

function canonicalFitToken(value: string) {
  const token = value.toLowerCase();
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 4) return token.slice(0, -1);
  return token;
}

function fitTokens(value: string) {
  return new Set(value.toLowerCase().normalize('NFKC')
    .split(/[^a-z0-9]+/)
    .map(canonicalFitToken)
    .filter(token => token.length > 2 && !FIT_STOPWORDS.has(token)));
}

function addContextWeights(weights: Map<string, number>, values: readonly string[], weight: number) {
  for (const value of values) {
    for (const token of fitTokens(value)) weights.set(token, Math.max(weights.get(token) ?? 0, weight));
  }
}

export function scoreBarberFit(title: string, brain?: ContentBrain | null): number {
  const titleTokens = fitTokens(title);
  let score = 0;
  for (const token of titleTokens) {
    if (BARBER_DOMAIN_TOKENS.has(token)) score += 10;
  }

  if (brain) {
    const weights = new Map<string, number>();
    addContextWeights(weights, brain.contentPillars ?? [], 12);
    addContextWeights(weights, brain.offers ?? [], 9);
    addContextWeights(weights, brain.proofAssets ?? [], 7);
    addContextWeights(weights, [brain.audience ?? '', brain.positioning ?? ''], 6);
    addContextWeights(weights, brain.preferredPhrases ?? [], 5);
    addContextWeights(weights, brain.exampleHooks ?? [], 4);
    for (const token of titleTokens) score += weights.get(token) ?? 0;
  }

  return Math.max(0, Math.min(100, score));
}

export function rankTrendIdeas(
  ideas: readonly TrendIdea[],
  brain?: ContentBrain | null,
  limit = MAX_TREND_IDEAS,
): TrendIdea[] {
  const scored = ideas.map(idea => {
    if (idea.evidenceState === 'live' || idea.evidenceState === 'cached') {
      return { ...idea, barberFitScore: scoreBarberFit(idea.title, brain) };
    }
    const { barberFitScore: _ignored, ...unscored } = idea;
    return unscored;
  });

  return dedupeTrendIdeas(scored, MAX_TREND_IDEAS)
    .sort((first, second) => {
      const evidenceDifference = EVIDENCE_PRIORITY[first.evidenceState] - EVIDENCE_PRIORITY[second.evidenceState];
      if (evidenceDifference !== 0) return evidenceDifference;
      const scoreDifference = (second.barberFitScore ?? -1) - (first.barberFitScore ?? -1);
      if (scoreDifference !== 0) return scoreDifference;
      const firstTime = Date.parse(first.publishedAt ?? '') || 0;
      const secondTime = Date.parse(second.publishedAt ?? '') || 0;
      return secondTime - firstTime;
    })
    .slice(0, clampLimit(limit));
}
