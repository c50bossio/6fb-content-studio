import assert from 'node:assert/strict';
import test from 'node:test';
import type { ContentBrain } from '../src/types/content-strategy.ts';
import type { TrendIdea, TrendSourceStatus } from '../src/types/trends.ts';
import {
  MAX_GOOGLE_RSS_BYTES,
  MAX_TREND_TITLE_LENGTH,
  TREND_FRESH_CACHE_MS,
  TREND_STALE_CACHE_MS,
  createIdeaStarters,
  dedupeTrendIdeas,
  mapContentPlannerToTrends,
  mapInstagramMediaToTrends,
  parseGoogleTrendsRss,
  rankTrendIdeas,
  sanitizeTrendTitle,
  sanitizeTrendUrl,
  scoreBarberFit,
} from '../electron/trend-intelligence.mts';

const FETCHED_AT = '2026-07-22T18:00:00.000Z';

test('source and cache contracts distinguish planned connectivity from live evidence', () => {
  const plannedStatus: TrendSourceStatus = {
    sourceId: 'content-planner',
    sourceLabel: '6FB Content Planner',
    state: 'connected',
  };
  assert.equal(plannedStatus.state, 'connected');
  assert.equal(TREND_FRESH_CACHE_MS, 10 * 60 * 1000);
  assert.equal(TREND_STALE_CACHE_MS, 24 * 60 * 60 * 1000);
});

test('trend titles remove markup, entities, controls, and cap Unicode length', () => {
  assert.equal(sanitizeTrendTitle('  Fresh &amp; <b>clean</b>\u0000 cuts  '), 'Fresh & clean cuts');
  const capped = sanitizeTrendTitle('a'.repeat(MAX_TREND_TITLE_LENGTH + 20));
  assert.equal(Array.from(capped ?? '').length, MAX_TREND_TITLE_LENGTH);
  assert.equal(capped?.endsWith('…'), true);
  assert.equal(sanitizeTrendTitle('<script></script>'), null);
  assert.equal(sanitizeTrendTitle({}), null);
});

test('source URLs require HTTPS, exact allowlisted hosts, and no credential material', () => {
  assert.equal(
    sanitizeTrendUrl('https://trends.google.com/trending?geo=US#top', ['trends.google.com']),
    'https://trends.google.com/trending?geo=US',
  );
  assert.equal(sanitizeTrendUrl('http://trends.google.com/trending', ['trends.google.com']), null);
  assert.equal(sanitizeTrendUrl('https://evil.trends.google.com/trending', ['trends.google.com']), null);
  assert.equal(sanitizeTrendUrl('https://user:pass@trends.google.com/trending', ['trends.google.com']), null);
  assert.equal(sanitizeTrendUrl('https://trends.google.com:444/trending', ['trends.google.com']), null);
  assert.equal(sanitizeTrendUrl('https://trends.google.com/trending?access_token=secret', ['trends.google.com']), null);
});

test('Google RSS parser returns sanitized, source-backed live ideas with evidence', () => {
  const xml = `<?xml version="1.0"?>
    <rss xmlns:ht="https://trends.google.com/trending/rss"><channel>
      <item>
        <title><![CDATA[Barber pricing &amp; retention]]></title>
        <link>https://trends.google.com/trending?geo=US</link>
        <pubDate>Wed, 22 Jul 2026 17:00:00 GMT</pubDate>
        <ht:approx_traffic>20K+</ht:approx_traffic>
      </item>
      <item>
        <title>Broad current event</title>
        <link>https://trends.google.com/trending?geo=US&amp;hours=24</link>
        <pubDate>not-a-date</pubDate>
        <ht:approx_traffic>unknown</ht:approx_traffic>
      </item>
      <item>
        <title>Injected link</title>
        <link>https://example.com/trending</link>
      </item>
    </channel></rss>`;
  const ideas = parseGoogleTrendsRss(xml, FETCHED_AT);
  assert.equal(ideas.length, 2);
  assert.deepEqual(
    {
      title: ideas[0].title,
      sourceId: ideas[0].sourceId,
      evidenceState: ideas[0].evidenceState,
      sourceUrl: ideas[0].sourceUrl,
      observedAt: ideas[0].observedAt,
      publishedAt: ideas[0].publishedAt,
      trafficEvidence: ideas[0].trafficEvidence,
    },
    {
      title: 'Barber pricing & retention',
      sourceId: 'google-trends',
      evidenceState: 'live',
      sourceUrl: 'https://trends.google.com/trending?geo=US',
      observedAt: FETCHED_AT,
      publishedAt: '2026-07-22T17:00:00.000Z',
      trafficEvidence: '20K+ searches',
    },
  );
  assert.equal(ideas[0].whyNow.includes('broad US search signal'), true);
  assert.equal(ideas[1].publishedAt, undefined);
  assert.equal(ideas[1].trafficEvidence, undefined);
});

test('Google RSS parser fails closed on oversized, malformed, empty, and capped input', () => {
  assert.deepEqual(parseGoogleTrendsRss('x'.repeat(MAX_GOOGLE_RSS_BYTES + 1), FETCHED_AT), []);
  assert.deepEqual(parseGoogleTrendsRss('<rss><item><title>No close tags', FETCHED_AT), []);
  const repeated = `<rss><channel>${Array.from({ length: 5 }, (_, index) => `
    <item><title>Topic ${index}</title><link>https://trends.google.com/trending?geo=US&amp;q=${index}</link></item>`).join('')}
    </channel></rss>`;
  assert.equal(parseGoogleTrendsRss(repeated, FETCHED_AT, 2).length, 2);
});

test('Instagram mapping accepts only validated official media and caps results', () => {
  const payload = {
    data: [
      {
        id: 'media_1',
        media_type: 'VIDEO',
        caption: 'Client retention habits for barbers',
        timestamp: '2026-07-22T16:00:00Z',
        permalink: 'https://www.instagram.com/reel/ABC123/',
        like_count: 1200,
        comments_count: 34,
      },
      {
        id: 'media_2', media_type: 'IMAGE', caption: 'Wrong host', timestamp: '2026-07-22T15:00:00Z',
        permalink: 'https://example.com/post/2',
      },
      {
        id: 'media_3', media_type: 'STORY', caption: 'Unsupported media', timestamp: '2026-07-22T15:00:00Z',
        permalink: 'https://instagram.com/p/3/',
      },
      {
        id: 'media_4', media_type: 'IMAGE', caption: '', timestamp: '2026-07-22T15:00:00Z',
        permalink: 'https://instagram.com/p/4/',
      },
    ],
  };
  const ideas = mapInstagramMediaToTrends(payload, '#Barber', FETCHED_AT, 1);
  assert.equal(ideas.length, 1);
  assert.deepEqual(
    {
      sourceId: ideas[0].sourceId,
      sourceLabel: ideas[0].sourceLabel,
      evidenceState: ideas[0].evidenceState,
      trafficEvidence: ideas[0].trafficEvidence,
      publishedAt: ideas[0].publishedAt,
    },
    {
      sourceId: 'instagram',
      sourceLabel: 'Instagram #barber',
      evidenceState: 'live',
      trafficEvidence: '1,200 likes · 34 comments',
      publishedAt: '2026-07-22T16:00:00.000Z',
    },
  );
  assert.equal(mapInstagramMediaToTrends(payload, 'bad tag!', FETCHED_AT).length, 0);
  assert.equal(mapInstagramMediaToTrends({ data: 'not-an-array' }, 'barber', FETCHED_AT).length, 0);
});

test('Content Planner mapping labels today and week topics as plans, never live evidence', () => {
  const ideas = mapContentPlannerToTrends({
    data: {
      today: { topic: 'Raise your barber prices' },
      week: [
        { day: 'Thursday', topic: 'Booth rent math' },
        { day: 'Friday', topic: 'raise your barber prices' },
        { day: 'Saturday', topic: null },
      ],
    },
  }, FETCHED_AT);
  assert.equal(ideas.length, 2);
  assert.equal(ideas.every(idea => idea.evidenceState === 'your-plan'), true);
  assert.equal(ideas.every(idea => idea.sourceId === 'content-planner'), true);
  assert.equal(ideas.every(idea => idea.barberFitScore === undefined), true);
  assert.equal(ideas[1].whyNow.includes('Thursday'), true);
});

test('idea starters are timeless, capped, and never carry live claims', () => {
  const starters = createIdeaStarters(3);
  assert.equal(starters.length, 3);
  assert.equal(starters.every(idea => idea.evidenceState === 'idea-starter'), true);
  assert.equal(starters.every(idea => idea.sourceUrl === undefined && idea.barberFitScore === undefined), true);
  assert.equal(starters.some(idea => /\b20\d{2}\b/.test(idea.title)), false);
  assert.equal(starters.every(idea => idea.whyNow.includes('no live trend evidence')), true);
});

test('deduplication normalizes punctuation and prefers stronger evidence without exceeding its cap', () => {
  const ideas: TrendIdea[] = [
    ...createIdeaStarters(2),
    {
      id: 'planned', title: 'How to raise your prices without losing your best clients!', sourceId: 'content-planner',
      sourceLabel: '6FB Content Planner', evidenceState: 'your-plan', whyNow: 'Planned.',
    },
    {
      id: 'live', title: 'HOW TO RAISE YOUR PRICES WITHOUT LOSING YOUR BEST CLIENTS', sourceId: 'google-trends',
      sourceLabel: 'Google Trends', evidenceState: 'live', whyNow: 'Live.',
    },
  ];
  const deduped = dedupeTrendIdeas(ideas, 2);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].id, 'live');
});

test('barber-fit scoring is deterministic and does not manufacture relevance for broad signals', () => {
  const brain: ContentBrain = {
    audience: 'Independent barbers and shop owners',
    positioning: 'Practical client retention systems',
    offers: ['Pricing workshop'],
    contentPillars: ['Client retention', 'Barber pricing'],
    proofAssets: ['Shop revenue case study'],
    voiceRules: [],
    preferredPhrases: ['behind the chair'],
    avoidedPhrases: [],
    exampleHooks: [],
  };
  const related = scoreBarberFit('Barber pricing and client retention', brain);
  const unrelated = scoreBarberFit('Meteor shower viewing time', brain);
  assert.equal(scoreBarberFit('Barber pricing and client retention', brain), related);
  assert.equal(related > unrelated, true);
  assert.equal(unrelated, 0);
});

test('ranking scores only live or cached ideas and keeps plan/starter claims unscored', () => {
  const [starter] = createIdeaStarters(1);
  const ideas: TrendIdea[] = [
    { id: 'broad', title: 'Meteor shower', sourceId: 'google-trends', sourceLabel: 'Google Trends', evidenceState: 'live', whyNow: 'Broad.' },
    { id: 'barber', title: 'Barber client retention', sourceId: 'instagram', sourceLabel: 'Instagram', evidenceState: 'cached', whyNow: 'Cached.' },
    { id: 'plan', title: 'Your scheduled topic', sourceId: 'content-planner', sourceLabel: '6FB Content Planner', evidenceState: 'your-plan', barberFitScore: 99, whyNow: 'Planned.' },
    starter,
  ];
  const ranked = rankTrendIdeas(ideas, null);
  assert.deepEqual(ranked.map(idea => idea.id), ['broad', 'barber', 'plan', starter.id]);
  assert.equal(ranked[0].barberFitScore, 0);
  assert.equal((ranked[1].barberFitScore ?? 0) > 0, true);
  assert.equal(ranked[2].barberFitScore, undefined);
  assert.equal(ranked[3].barberFitScore, undefined);
});
