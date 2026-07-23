import type { ContentBrain } from '../src/types/content-strategy';
import { createHash } from 'node:crypto';
import type {
  TrendFeed,
  TrendIdea,
  TrendSourceId,
  TrendSourceState,
  TrendSourceStatus,
  YouTubeReference,
  YouTubeReferenceSection,
} from '../src/types/trends';
import {
  MAX_GOOGLE_RSS_BYTES,
  createIdeaStarters,
  dedupeTrendIdeas,
  mapContentPlannerToTrends,
  mapInstagramMediaToTrends,
  parseYouTubeBackendResponse,
  parseGoogleTrendsRss,
  rankTrendIdeas,
} from './trend-intelligence.mts';
import { INSTAGRAM_GRAPH_ORIGIN } from './instagram-graph.mts';

const GOOGLE_TRENDS_RSS = 'https://trends.google.com/trending/rss?geo=US';
const CONTENT_PLANNER_BRIEF = 'https://content.6fbmentorship.com/api/me/today-brief';
const SIXFB_YOUTUBE_TRENDS = 'https://content.6fbmentorship.com/apps/content/api/studio/youtube-trends';
const ATTEMPT_TIMEOUT_MS = 5_000;
const AGGREGATE_TIMEOUT_MS = 8_000;
const FRESH_CACHE_MS = 10 * 60_000;
const STALE_CACHE_MS = 24 * 60 * 60_000;
const CIRCUIT_FAILURE_LIMIT = 3;
const CIRCUIT_OPEN_MS = 5 * 60_000;
const MAX_JSON_BYTES = 512 * 1024;
export const MIN_USEFUL_BARBER_FIT = 20;

type RequestFn = (url: string, init: RequestInit, timeoutMs: number) => Promise<Response>;
type UnknownRecord = Record<string, unknown>;

export interface SmartTrendServiceInput {
  contentBrain?: ContentBrain | null;
  contentPlannerToken?: string;
  instagramAccessToken?: string;
  instagramUserId?: string;
  youtubeBackendToken?: string;
  youtubeConsent?: boolean;
}

interface SourceResult {
  ideas: TrendIdea[];
  status: TrendSourceStatus;
}

interface CacheEntry {
  ideas: TrendIdea[];
  state: TrendSourceState;
  message: string;
  checkedAt: number;
}

interface YouTubeCacheEntry {
  results: YouTubeReference[];
  state: TrendSourceState;
  message: string;
  checkedAt: number;
  sourceCheckedAt: string | null;
  servedAt: string;
}

interface CircuitEntry {
  failures: number;
  openUntil: number;
}

interface ServiceOptions {
  request: RequestFn;
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
}

class SourceRequestError extends Error {
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    status?: number,
    retryAfterMs?: number,
  ) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function isTransientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function retryAfterMs(response: Response) {
  const raw = response.headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, Math.min(2_000, seconds * 1_000));
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.min(2_000, parsed - Date.now()));
}

async function readLimitedText(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new SourceRequestError('Source response exceeded the size limit.');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SourceRequestError('Source response exceeded the size limit.');
    }
    output += decoder.decode(value, { stream: true });
  }
  return output + decoder.decode();
}

async function readLimitedJson(response: Response) {
  const text = await readLimitedText(response, MAX_JSON_BYTES);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SourceRequestError('Source returned malformed data.');
  }
}

function sourceLabel(sourceId: TrendSourceId) {
  switch (sourceId) {
    case 'google-trends': return 'Google Trends';
    case 'instagram': return 'Instagram';
    case 'youtube': return 'YouTube';
    case 'content-planner': return 'Your plan';
    default: return 'Idea starters';
  }
}

function status(
  sourceId: TrendSourceId,
  state: TrendSourceState,
  message: string,
  checkedAt?: string,
): TrendSourceStatus {
  return { sourceId, sourceLabel: sourceLabel(sourceId), state, message, checkedAt };
}

function staleIdeas(ideas: TrendIdea[]) {
  return ideas.map(idea => idea.evidenceState === 'live'
    ? { ...idea, evidenceState: 'cached' as const }
    : idea);
}

function credentialScope(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function buildInstagramHashtags(brain?: ContentBrain | null) {
  const candidates = ['barber', 'barbershop', ...(brain?.contentPillars ?? [])];
  const hashtags: string[] = [];
  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (normalized.length < 2 || normalized.length > 30 || hashtags.includes(normalized)) continue;
    hashtags.push(normalized);
    if (hashtags.length === 2) break;
  }
  return hashtags;
}

export class SmartTrendService {
  private readonly request: RequestFn;
  private readonly now: () => number;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly youtubeCache = new Map<string, YouTubeCacheEntry>();
  private readonly youtubeExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly circuits = new Map<string, CircuitEntry>();
  private readonly inFlight = new Map<string, Promise<TrendFeed>>();

  constructor(options: ServiceOptions) {
    this.request = options.request;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? (delayMs => new Promise(resolve => setTimeout(resolve, delayMs)));
  }

  fetch(input: SmartTrendServiceInput): Promise<TrendFeed> {
    const scope = [
      input.instagramUserId ?? 'no-instagram',
      input.instagramAccessToken ? credentialScope(input.instagramAccessToken) : 'no-instagram-token',
      input.contentPlannerToken ? credentialScope(input.contentPlannerToken) : 'no-planner-token',
      input.youtubeBackendToken ? credentialScope(input.youtubeBackendToken) : 'no-6fb-token',
      input.youtubeConsent ? 'youtube-consented' : 'youtube-not-consented',
    ].join(':');
    const existing = this.inFlight.get(scope);
    if (existing) return existing;
    const pending = this.fetchOnce(input).finally(() => { this.inFlight.delete(scope); });
    this.inFlight.set(scope, pending);
    return pending;
  }

  clearYouTubeCache() {
    this.youtubeCache.clear();
    for (const timer of this.youtubeExpiryTimers.values()) clearTimeout(timer);
    this.youtubeExpiryTimers.clear();
    for (const key of this.circuits.keys()) {
      if (key.startsWith('youtube-backend:')) this.circuits.delete(key);
    }
  }

  private deleteYouTubeCacheEntry(cacheKey: string) {
    this.youtubeCache.delete(cacheKey);
    const timer = this.youtubeExpiryTimers.get(cacheKey);
    if (timer) clearTimeout(timer);
    this.youtubeExpiryTimers.delete(cacheKey);
  }

  private storeYouTubeCacheEntry(cacheKey: string, entry: YouTubeCacheEntry) {
    this.deleteYouTubeCacheEntry(cacheKey);
    this.youtubeCache.set(cacheKey, entry);

    const schedule = () => {
      const remaining = entry.checkedAt + STALE_CACHE_MS - this.now();
      if (remaining <= 0) {
        if (this.youtubeCache.get(cacheKey) === entry) this.deleteYouTubeCacheEntry(cacheKey);
        return;
      }
      const timer = setTimeout(() => {
        if (this.youtubeCache.get(cacheKey) !== entry) return;
        schedule();
      }, remaining);
      timer.unref?.();
      this.youtubeExpiryTimers.set(cacheKey, timer);
    };
    schedule();
  }

  private async fetchOnce(input: SmartTrendServiceInput): Promise<TrendFeed> {
    const fetchedAt = new Date(this.now()).toISOString();
    const [google, youtube, instagram, planner] = await Promise.all([
      this.fromCachedOrFetch('google-trends', 'google-trends:US', () => this.fetchGoogle(fetchedAt)),
      input.youtubeBackendToken && input.youtubeConsent
        ? this.fetchYouTubeReferences(input.youtubeBackendToken)
        : Promise.resolve<YouTubeReferenceSection>({
            results: [],
            status: status(
              'youtube',
              'not-connected',
              input.youtubeBackendToken
                ? 'Enable YouTube inspiration in Settings before requesting references.'
                : 'Sign in to 6FB and enable YouTube inspiration in Settings.',
            ),
          }),
      input.instagramAccessToken && input.instagramUserId
        ? this.fromCachedOrFetch(
            'instagram',
            `instagram:${input.instagramUserId}:${credentialScope(input.instagramAccessToken)}`,
            () => this.fetchInstagram(input, fetchedAt),
          )
        : Promise.resolve<SourceResult>({
            ideas: [],
            status: status('instagram', 'not-connected', 'Connect an eligible Instagram professional account in Settings.'),
          }),
      input.contentPlannerToken
        ? this.fromCachedOrFetch(
            'content-planner',
            `content-planner:${credentialScope(input.contentPlannerToken)}`,
            () => this.fetchContentPlanner(input.contentPlannerToken!, fetchedAt),
            false,
            false,
          )
        : Promise.resolve<SourceResult>({
            ideas: [],
            status: status('content-planner', 'not-connected', 'Sign in to your 6FB account to include your content plan.'),
          }),
    ]);

    const liveIdeas = rankTrendIdeas(
      [...google.ideas, ...instagram.ideas],
      input.contentBrain,
      6,
    );
    const plannedIdeas = planner.ideas.slice(0, 2);
    const usefulLiveIdeas = liveIdeas.filter(idea => (idea.barberFitScore ?? 0) >= MIN_USEFUL_BARBER_FIT);
    const broadLiveIdeas = liveIdeas.filter(idea => (idea.barberFitScore ?? 0) < MIN_USEFUL_BARBER_FIT);
    let ideas = usefulLiveIdeas.length > 0 || plannedIdeas.length > 0
      ? dedupeTrendIdeas([...usefulLiveIdeas, ...plannedIdeas, ...broadLiveIdeas], 8)
      : broadLiveIdeas.length > 0
        ? dedupeTrendIdeas([...createIdeaStarters(4), ...broadLiveIdeas.slice(0, 2)], 6)
        : createIdeaStarters(6);
    const fitAwareStatus = (result: SourceResult) => {
      const hasLive = liveIdeas.some(idea => idea.sourceId === result.status.sourceId);
      const hasUseful = usefulLiveIdeas.some(idea => idea.sourceId === result.status.sourceId);
      if (!hasLive || hasUseful) return result.status;
      return {
        ...result.status,
        message: `${result.status.message ?? 'Current source signals.'} No signal cleared barber fit ${MIN_USEFUL_BARBER_FIT}.`,
      };
    };
    const sources = [
      fitAwareStatus(google),
      fitAwareStatus(instagram),
      planner.status,
    ];

    if (ideas.length === 0) {
      ideas = createIdeaStarters(6);
    }

    return { ideas, sources, youtube, fetchedAt };
  }

  private async fromCachedOrFetch(
    sourceId: Exclude<TrendSourceId, 'youtube' | 'idea-starter'>,
    cacheKey: string,
    loader: () => Promise<SourceResult>,
    allowStale = true,
    reuseFresh = true,
  ): Promise<SourceResult> {
    const now = this.now();
    const existing = this.cache.get(cacheKey);
    if (reuseFresh && existing && now - existing.checkedAt <= FRESH_CACHE_MS) {
      const checkedAt = new Date(existing.checkedAt).toISOString();
      return {
        ideas: existing.ideas,
        status: status(
          sourceId,
          existing.state,
          `${existing.message} Reused a recent successful response to protect the source.`,
          checkedAt,
        ),
      };
    }

    const circuit = this.circuits.get(cacheKey);
    if (circuit && circuit.openUntil > now) {
      return this.staleOrError(sourceId, allowStale ? existing : undefined, 'Temporarily paused after repeated source failures.');
    }

    try {
      const result = await loader();
      this.circuits.set(cacheKey, { failures: 0, openUntil: 0 });
      this.cache.set(cacheKey, {
        ideas: result.ideas,
        state: result.status.state,
        message: result.status.message ?? 'Source checked successfully.',
        checkedAt: now,
      });
      return result;
    } catch (error) {
      const previous = this.circuits.get(cacheKey) ?? { failures: 0, openUntil: 0 };
      const failures = previous.failures + 1;
      this.circuits.set(cacheKey, {
        failures,
        openUntil: failures >= CIRCUIT_FAILURE_LIMIT ? now + CIRCUIT_OPEN_MS : 0,
      });
      const message = error instanceof SourceRequestError ? error.message : 'Source request failed.';
      return this.staleOrError(sourceId, allowStale ? existing : undefined, message);
    }
  }

  private staleOrError(sourceId: TrendSourceId, existing: CacheEntry | undefined, message: string): SourceResult {
    if (existing?.ideas.length && this.now() - existing.checkedAt <= STALE_CACHE_MS) {
      const checkedAt = new Date(existing.checkedAt).toISOString();
      return {
        ideas: staleIdeas(existing.ideas),
        status: status(sourceId, 'cached', `${message} Showing the last successful result.`, checkedAt),
      };
    }
    return { ideas: [], status: status(sourceId, 'error', message, new Date(this.now()).toISOString()) };
  }

  private async requestWithRetry(url: string, init: RequestInit = {}) {
    const startedAt = this.now();
    let lastError: SourceRequestError | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const elapsed = this.now() - startedAt;
      const remaining = AGGREGATE_TIMEOUT_MS - elapsed;
      if (remaining <= 0) break;
      try {
        const response = await this.request(url, init, Math.min(ATTEMPT_TIMEOUT_MS, remaining));
        if (response.ok) return response;
        const error = new SourceRequestError(
          response.status === 401 || response.status === 403
            ? 'Source authorization is unavailable.'
            : response.status === 429
              ? 'Source rate limit reached.'
              : `Source returned ${response.status}.`,
          response.status,
          retryAfterMs(response),
        );
        if (!isTransientStatus(response.status) || attempt === 1) throw error;
        lastError = error;
      } catch (error) {
        const normalized = error instanceof SourceRequestError
          ? error
          : new SourceRequestError('Source could not be reached.');
        if ((normalized.status && !isTransientStatus(normalized.status)) || attempt === 1) throw normalized;
        lastError = normalized;
      }

      const baseDelay = lastError?.retryAfterMs ?? 250 * (2 ** attempt);
      const remainingAfterAttempt = AGGREGATE_TIMEOUT_MS - (this.now() - startedAt);
      const delay = Math.min(baseDelay, Math.max(0, remainingAfterAttempt - 1));
      if (delay > 0) await this.sleep(delay);
    }
    throw lastError ?? new SourceRequestError('Source request timed out.');
  }

  private async requestOnce(url: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await this.request(url, init, ATTEMPT_TIMEOUT_MS);
    } catch {
      throw new SourceRequestError('Source could not be reached.');
    }
    if (!response.ok) {
      throw new SourceRequestError(
        response.status === 401 || response.status === 403
          ? '6FB sign-in or YouTube access is unavailable.'
          : response.status === 429
            ? 'YouTube inspiration is temporarily rate limited.'
            : `YouTube inspiration returned ${response.status}.`,
        response.status,
      );
    }
    return response;
  }

  private async fetchGoogle(fetchedAt: string): Promise<SourceResult> {
    const response = await this.requestWithRetry(GOOGLE_TRENDS_RSS, {
      headers: { Accept: 'application/rss+xml, application/xml;q=0.9' },
    });
    const xml = await readLimitedText(response, MAX_GOOGLE_RSS_BYTES);
    if (!/<rss\b[^>]*>[\s\S]*<channel\b[^>]*>/i.test(xml)) {
      throw new SourceRequestError('Google Trends returned malformed data.');
    }
    const ideas = parseGoogleTrendsRss(xml, fetchedAt, 8);
    return {
      ideas,
      status: ideas.length
        ? status('google-trends', 'live', `${ideas.length} current US search signal${ideas.length === 1 ? '' : 's'}.`, fetchedAt)
        : status('google-trends', 'empty', 'Google Trends returned no usable current signals.', fetchedAt),
    };
  }

  private async fetchContentPlanner(token: string, fetchedAt: string): Promise<SourceResult> {
    const response = await this.requestWithRetry(CONTENT_PLANNER_BRIEF, {
      headers: { Authorization: `Bearer ${token}`, Cookie: `auth_token=${token}` },
    });
    const payload = await readLimitedJson(response);
    const payloadRecord = asRecord(payload);
    const data = asRecord(payloadRecord?.data) ?? payloadRecord;
    const hasToday = Boolean(data && Object.prototype.hasOwnProperty.call(data, 'today'));
    const hasWeek = Boolean(data && Object.prototype.hasOwnProperty.call(data, 'week'));
    if (!data || (!hasToday && !hasWeek) || (hasWeek && !Array.isArray(data.week))) {
      throw new SourceRequestError('Content Planner returned malformed data.');
    }
    const ideas = mapContentPlannerToTrends(payload, fetchedAt, 4);
    return {
      ideas,
      status: ideas.length
        ? status('content-planner', 'connected', `${ideas.length} topic${ideas.length === 1 ? '' : 's'} from your plan.`, fetchedAt)
        : status('content-planner', 'empty', 'Your connected plan has no usable topics right now.', fetchedAt),
    };
  }

  private async fetchYouTubeReferences(token: string): Promise<YouTubeReferenceSection> {
    const cacheKey = `youtube-backend:${credentialScope(token)}`;
    const now = this.now();
    let cached = this.youtubeCache.get(cacheKey);
    if (cached && now - cached.checkedAt >= STALE_CACHE_MS) {
      this.deleteYouTubeCacheEntry(cacheKey);
      cached = undefined;
    }
    if (cached && now - cached.checkedAt <= FRESH_CACHE_MS) {
      return {
        results: cached.results,
        sourceCheckedAt: cached.sourceCheckedAt,
        servedAt: cached.servedAt,
        status: status('youtube', cached.state, `${cached.message} Reused a recent 6FB response.`, cached.sourceCheckedAt ?? undefined),
      };
    }

    const circuit = this.circuits.get(cacheKey);
    if (circuit && circuit.openUntil > now) {
      if (cached?.results.length && now - cached.checkedAt <= STALE_CACHE_MS) {
        return {
          results: cached.results,
          sourceCheckedAt: cached.sourceCheckedAt,
          servedAt: cached.servedAt,
          status: status('youtube', 'cached', 'YouTube inspiration is temporarily paused. Showing the last 6FB response.', cached.sourceCheckedAt ?? undefined),
        };
      }
      return { results: [], status: status('youtube', 'error', 'YouTube inspiration is temporarily paused after repeated failures.') };
    }

    try {
      const response = await this.requestOnce(SIXFB_YOUTUBE_TRENDS, {
        redirect: 'error',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'X-Client': '6fb-content-studio' },
      });
      const parsed = parseYouTubeBackendResponse(await readLimitedJson(response));
      if (!parsed) throw new SourceRequestError('6FB returned malformed YouTube reference data.');
      const state: TrendSourceState = parsed.results.length ? 'live' : 'empty';
      const message = parsed.results.length
        ? 'Public YouTube references from 6FB.'
        : '6FB returned no YouTube references.';
      this.circuits.set(cacheKey, { failures: 0, openUntil: 0 });
      this.storeYouTubeCacheEntry(cacheKey, {
        results: parsed.results,
        state,
        message,
        checkedAt: now,
        sourceCheckedAt: parsed.sourceCheckedAt,
        servedAt: parsed.servedAt,
      });
      return {
        results: parsed.results,
        sourceCheckedAt: parsed.sourceCheckedAt,
        servedAt: parsed.servedAt,
        status: status('youtube', state, message, parsed.sourceCheckedAt ?? undefined),
      };
    } catch (error) {
      const previous = this.circuits.get(cacheKey) ?? { failures: 0, openUntil: 0 };
      const failures = previous.failures + 1;
      this.circuits.set(cacheKey, {
        failures,
        openUntil: failures >= CIRCUIT_FAILURE_LIMIT ? now + CIRCUIT_OPEN_MS : 0,
      });
      const message = error instanceof SourceRequestError ? error.message : 'YouTube inspiration could not be reached.';
      if (cached?.results.length && now - cached.checkedAt <= STALE_CACHE_MS) {
        return {
          results: cached.results,
          sourceCheckedAt: cached.sourceCheckedAt,
          servedAt: cached.servedAt,
          status: status('youtube', 'cached', `${message} Showing the last 6FB response.`, cached.sourceCheckedAt ?? undefined),
        };
      }
      return { results: [], status: status('youtube', 'error', message, new Date(now).toISOString()) };
    }
  }

  private async fetchInstagram(input: SmartTrendServiceInput, fetchedAt: string): Promise<SourceResult> {
    const token = input.instagramAccessToken!;
    const userId = input.instagramUserId!;
    const ideas: TrendIdea[] = [];

    for (const hashtag of buildInstagramHashtags(input.contentBrain)) {
      const lookup = new URL(`${INSTAGRAM_GRAPH_ORIGIN}/ig_hashtag_search`);
      lookup.searchParams.set('user_id', userId);
      lookup.searchParams.set('q', hashtag);
      lookup.searchParams.set('access_token', token);
      const lookupResponse = await this.requestWithRetry(lookup.toString());
      const lookupPayload = await readLimitedJson(lookupResponse);
      const lookupRecord = asRecord(lookupPayload);
      if (!lookupRecord || !Array.isArray(lookupRecord.data)) {
        throw new SourceRequestError('Instagram returned malformed hashtag data.');
      }
      const lookupData = lookupRecord.data as Array<{ id?: unknown }>;
      const hashtagId = typeof lookupData[0]?.id === 'string' ? lookupData[0].id : '';
      if (!/^\d+$/.test(hashtagId)) continue;

      const media = new URL(`${INSTAGRAM_GRAPH_ORIGIN}/${hashtagId}/recent_media`);
      media.searchParams.set('user_id', userId);
      media.searchParams.set('fields', 'id,caption,media_type,like_count,comments_count,timestamp,permalink');
      media.searchParams.set('limit', '12');
      media.searchParams.set('access_token', token);
      const mediaResponse = await this.requestWithRetry(media.toString());
      const mediaPayload = await readLimitedJson(mediaResponse);
      const mediaRecord = asRecord(mediaPayload);
      if (!mediaRecord || !Array.isArray(mediaRecord.data)) {
        throw new SourceRequestError('Instagram returned malformed media data.');
      }
      ideas.push(...mapInstagramMediaToTrends(mediaPayload, hashtag, fetchedAt, 4));
    }

    const ranked = rankTrendIdeas(ideas, input.contentBrain, 6);
    return {
      ideas: ranked,
      status: ranked.length
        ? status('instagram', 'live', `${ranked.length} recent authorized hashtag signal${ranked.length === 1 ? '' : 's'}.`, fetchedAt)
        : status('instagram', 'empty', 'Instagram returned no usable recent hashtag signals.', fetchedAt),
    };
  }
}
