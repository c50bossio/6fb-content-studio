import assert from 'node:assert/strict';
import test from 'node:test';
import { INSTAGRAM_GRAPH_ORIGIN } from '../electron/instagram-graph.mts';
import { MIN_USEFUL_BARBER_FIT, SmartTrendService } from '../electron/smart-trend-service.mts';
import type { TrendFeed, TrendSourceId } from '../src/types/trends.ts';

const BASE_TIME = Date.parse('2026-07-22T18:00:00.000Z');
const GOOGLE_URL_PART = 'trends.google.com/trending/rss';
const PLANNER_URL_PART = 'content.6fbmentorship.com/api/me/today-brief';
const YOUTUBE_URL_PART = 'content.6fbmentorship.com/apps/content/api/studio/youtube-trends';

function googleRss(title = 'Barber pricing and client retention') {
  return googleRssItems([title]);
}

function googleRssItems(titles: string[]) {
  return `<?xml version="1.0"?>
    <rss xmlns:ht="https://trends.google.com/trending/rss"><channel>
      ${titles.map((title, index) => `<item>
        <title>${title}</title>
        <link>https://trends.google.com/trending?geo=US&item=${index}</link>
        <pubDate>Wed, 22 Jul 2026 17:00:00 GMT</pubDate>
        <ht:approx_traffic>20K+</ht:approx_traffic>
      </item>`).join('')}
    </channel></rss>`;
}

function response(body: string, status = 200, headers: HeadersInit = {}) {
  return new Response(body, { status, headers });
}

function jsonResponse(value: unknown, status = 200) {
  return response(JSON.stringify(value), status, { 'content-type': 'application/json' });
}

function plannerPayload(topic: string) {
  return { data: { today: { topic }, week: [] } };
}

function youtubePayload() {
  return {
    results: [{
      videoId: 'AbCdEfGhI12',
      title: 'Barber pricing that builds client trust',
      channelTitle: 'Barber Business',
      publishedAt: '2026-07-21T16:00:00Z',
      url: 'https://www.youtube.com/watch?v=AbCdEfGhI12',
      thumbnailUrl: 'https://i.ytimg.com/vi/AbCdEfGhI12/hqdefault.jpg',
    }],
    sourceCheckedAt: '2026-07-22T17:55:00.000Z',
    servedAt: '2026-07-22T18:00:00.000Z',
  };
}

function source(feed: TrendFeed, sourceId: TrendSourceId) {
  const result = feed.sources.find(item => item.sourceId === sourceId);
  assert.ok(result, `Expected ${sourceId} source status`);
  return result;
}

function authorization(init: RequestInit) {
  return new Headers(init.headers).get('authorization');
}

test('Google success returns source-backed live evidence with deterministic request bounds', async () => {
  const calls: Array<{ url: string; init: RequestInit; timeoutMs: number }> = [];
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async (url, init, timeoutMs) => {
      calls.push({ url, init, timeoutMs });
      return response(googleRss());
    },
  });

  const feed = await service.fetch({});

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.includes(GOOGLE_URL_PART), true);
  assert.equal(calls[0].timeoutMs, 5_000);
  assert.equal(new Headers(calls[0].init.headers).get('accept'), 'application/rss+xml, application/xml;q=0.9');
  assert.equal(feed.fetchedAt, '2026-07-22T18:00:00.000Z');
  assert.equal(source(feed, 'google-trends').state, 'live');
  assert.equal(feed.ideas.some(idea => idea.sourceId === 'google-trends' && idea.evidenceState === 'live'), true);
});

test('all-zero live fit excludes unrelated signals and returns only useful starters', async () => {
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async () => response(googleRss('FIFA team of the tournament 2026')),
  });

  const feed = await service.fetch({});

  assert.equal(MIN_USEFUL_BARBER_FIT, 20);
  assert.equal(feed.ideas.length, 6);
  assert.equal(feed.ideas.every(idea => idea.evidenceState === 'idea-starter'), true);
  assert.equal(feed.ideas.some(idea => idea.sourceId === 'google-trends'), false);
  assert.match(source(feed, 'google-trends').message ?? '', /no signal cleared barber fit 20/i);
});

test('a direct barber-domain Google signal survives even when its additive fit score is below the threshold', async () => {
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async () => response(googleRss('Barber Battle 2026')),
  });

  const feed = await service.fetch({});
  const directSignal = feed.ideas.find(idea => idea.sourceId === 'google-trends');

  assert.ok(directSignal);
  assert.equal(directSignal.title, 'Barber Battle 2026');
  assert.equal(directSignal.barberFitScore, 10);
  assert.doesNotMatch(source(feed, 'google-trends').message ?? '', /no signal cleared barber fit/i);
});

test('consented 6FB account makes one backend request and keeps YouTube reference-only', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async (url, init) => {
      calls.push({ url, init });
      if (url.includes(GOOGLE_URL_PART)) return response(googleRss());
      if (url.includes(YOUTUBE_URL_PART)) return jsonResponse(youtubePayload());
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const token = 'sixfb-account-token';
  const feed = await service.fetch({ youtubeBackendToken: token, youtubeConsent: true });
  const youtubeCall = calls.find(call => call.url.includes(YOUTUBE_URL_PART));
  assert.ok(youtubeCall);
  const url = new URL(youtubeCall.url);
  assert.equal(url.search, '');
  assert.equal(new Headers(youtubeCall.init.headers).get('authorization'), `Bearer ${token}`);
  assert.equal(new Headers(youtubeCall.init.headers).get('x-client'), '6fb-content-studio');
  assert.equal(youtubeCall.init.redirect, 'error');
  assert.equal(calls.filter(call => call.url.includes(YOUTUBE_URL_PART)).length, 1);
  assert.equal(calls.some(call => call.url.includes(token)), false);
  assert.equal(feed.youtube.status.state, 'live');
  assert.equal(feed.youtube.status.message, 'Public YouTube references from 6FB.');
  assert.equal(Object.prototype.hasOwnProperty.call(feed.youtube, 'count'), false);
  assert.deepEqual(feed.youtube.results, youtubePayload().results);
  assert.equal(feed.youtube.sourceCheckedAt, youtubePayload().sourceCheckedAt);
  assert.equal(feed.youtube.servedAt, youtubePayload().servedAt);
  assert.equal(feed.ideas.some(idea => idea.sourceId === 'youtube'), false);
  assert.equal(JSON.stringify(feed.youtube).includes('barberFitScore'), false);
  assert.equal(JSON.stringify(feed).includes(token), false);
});

test('unknown YouTube source freshness stays null and is never replaced by receipt time', async () => {
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    request: async url => url.includes(GOOGLE_URL_PART)
      ? response(googleRss())
      : jsonResponse({ ...youtubePayload(), sourceCheckedAt: null }),
  });

  const feed = await service.fetch({ youtubeBackendToken: 'sixfb-token', youtubeConsent: true });

  assert.equal(feed.youtube.sourceCheckedAt, null);
  assert.equal(feed.youtube.servedAt, youtubePayload().servedAt);
  assert.equal(feed.youtube.status.checkedAt, undefined);
});

test('expired YouTube payload is evicted and subsequent failures cannot reuse it', async () => {
  let now = BASE_TIME;
  let failYouTube = false;
  let youtubeCalls = 0;
  const service = new SmartTrendService({
    now: () => now,
    sleep: async () => {},
    request: async url => {
      if (url.includes(GOOGLE_URL_PART)) return response(googleRss());
      youtubeCalls += 1;
      if (failYouTube) throw new Error('offline');
      return jsonResponse(youtubePayload());
    },
  });

  const initial = await service.fetch({ youtubeBackendToken: 'sixfb-token', youtubeConsent: true });
  assert.equal(initial.youtube.results.length, 1);

  now += 24 * 60 * 60_000;
  failYouTube = true;
  const expired = await service.fetch({ youtubeBackendToken: 'sixfb-token', youtubeConsent: true });
  assert.equal(expired.youtube.results.length, 0);
  assert.equal(expired.youtube.status.state, 'error');

  const nextFailure = await service.fetch({ youtubeBackendToken: 'sixfb-token', youtubeConsent: true });
  assert.equal(nextFailure.youtube.results.length, 0);
  assert.equal(nextFailure.youtube.status.state, 'error');
  assert.equal(youtubeCalls, 3);
});

test('YouTube backend 429, 5xx, and network failures each make exactly one desktop attempt', async t => {
  const cases: Array<{ name: string; request: () => Promise<Response> }> = [
    { name: '429', request: async () => response('', 429) },
    { name: '5xx', request: async () => response('', 503) },
    { name: 'network', request: async () => { throw new Error('offline'); } },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      let youtubeCalls = 0;
      const service = new SmartTrendService({
        now: () => BASE_TIME,
        sleep: async () => { assert.fail('YouTube desktop requests must not retry or sleep'); },
        request: async url => {
          if (url.includes(GOOGLE_URL_PART)) return response(googleRss());
          youtubeCalls += 1;
          return scenario.request();
        },
      });
      const feed = await service.fetch({ youtubeBackendToken: 'sixfb-token', youtubeConsent: true });
      assert.equal(youtubeCalls, 1);
      assert.equal(feed.youtube.status.state, 'error');
      assert.equal(feed.youtube.results.length, 0);
    });
  }
});

test('missing credentials make zero authenticated calls and report optional sources as not connected', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async (url, init) => {
      calls.push({ url, init });
      return response(googleRss());
    },
  });

  const feed = await service.fetch({});

  assert.equal(calls.length, 1);
  assert.equal(calls.every(call => !authorization(call.init)), true);
  assert.equal(calls.every(call => !call.url.includes('access_token=')), true);
  assert.equal(calls.some(call => call.url.includes(PLANNER_URL_PART) || call.url.includes('graph.instagram.com')), false);
  assert.equal(source(feed, 'instagram').state, 'not-connected');
  assert.equal(feed.youtube.status.state, 'not-connected');
  assert.equal(source(feed, 'content-planner').state, 'not-connected');
});

test('missing sign-in or missing consent makes zero YouTube backend calls', async t => {
  for (const input of [
    { youtubeConsent: true },
    { youtubeBackendToken: 'sixfb-token', youtubeConsent: false },
  ]) {
    await t.test(JSON.stringify(input), async () => {
      const calls: string[] = [];
      const service = new SmartTrendService({
        now: () => BASE_TIME,
        request: async url => { calls.push(url); return response(googleRss()); },
      });
      const feed = await service.fetch(input);
      assert.equal(calls.some(url => url.includes(YOUTUBE_URL_PART)), false);
      assert.equal(feed.youtube.status.state, 'not-connected');
    });
  }
});

test('transient 429 retries once, honors bounded retry-after, and never exceeds two attempts', async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async delay => { sleeps.push(delay); },
    request: async () => {
      calls += 1;
      if (calls === 1) return response('', 429, { 'retry-after': '1' });
      return response(googleRss('Barber booking trends'));
    },
  });

  const feed = await service.fetch({});

  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [1_000]);
  assert.equal(source(feed, 'google-trends').state, 'live');
});

test('401 and 403 are terminal and do not retry', async t => {
  for (const statusCode of [401, 403]) {
    await t.test(String(statusCode), async () => {
      let calls = 0;
      const service = new SmartTrendService({
        now: () => BASE_TIME,
        sleep: async () => { assert.fail('terminal authorization failures must not sleep'); },
        request: async () => {
          calls += 1;
          return response('', statusCode);
        },
      });

      const feed = await service.fetch({});

      assert.equal(calls, 1);
      assert.equal(source(feed, 'google-trends').state, 'error');
      assert.match(source(feed, 'google-trends').message ?? '', /authorization/i);
    });
  }
});

test('malformed authenticated JSON fails without retrying the successful HTTP request', async () => {
  let googleCalls = 0;
  let plannerCalls = 0;
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async (url) => {
      if (url.includes(GOOGLE_URL_PART)) {
        googleCalls += 1;
        return response(googleRss());
      }
      if (url.includes(PLANNER_URL_PART)) {
        plannerCalls += 1;
        return response('{malformed');
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const feed = await service.fetch({ contentPlannerToken: 'planner-token' });

  assert.equal(googleCalls, 1);
  assert.equal(plannerCalls, 1);
  assert.equal(source(feed, 'content-planner').state, 'error');
  assert.match(source(feed, 'content-planner').message ?? '', /malformed/i);
});

test('wrong-shape 200 responses are errors, while valid empty source shapes stay empty', async () => {
  const calls: string[] = [];
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async url => {
      calls.push(url);
      if (url.includes(GOOGLE_URL_PART)) return response('<html>sign in</html>');
      if (url.includes(PLANNER_URL_PART)) return jsonResponse({ ok: true });
      if (url.includes('/12345/media')) return jsonResponse({ items: [] });
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const feed = await service.fetch({
    contentPlannerToken: 'planner-token',
    instagramAccessToken: 'instagram-token',
    instagramUserId: '12345',
  });

  assert.equal(calls.length, 3, 'successful malformed responses must not be retried');
  assert.equal(source(feed, 'google-trends').state, 'error');
  assert.equal(source(feed, 'content-planner').state, 'error');
  assert.equal(source(feed, 'instagram').state, 'error');
  assert.match(source(feed, 'google-trends').message ?? '', /malformed/i);
  assert.match(source(feed, 'content-planner').message ?? '', /malformed/i);
  assert.match(source(feed, 'instagram').message ?? '', /malformed/i);
});

test('declared oversized responses fail closed without reading or retrying', async () => {
  let calls = 0;
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async () => {
      calls += 1;
      return response('<rss><channel /></rss>', 200, { 'content-length': String(512 * 1024 + 1) });
    },
  });

  const feed = await service.fetch({});

  assert.equal(calls, 1);
  assert.equal(source(feed, 'google-trends').state, 'error');
  assert.match(source(feed, 'google-trends').message ?? '', /size limit/i);
});

test('exhausted 5xx and network failures retry exactly once and surface errors', async t => {
  const cases: Array<{ name: string; request: () => Promise<Response> }> = [
    { name: '5xx', request: async () => response('', 503) },
    { name: 'network', request: async () => { throw new Error('offline'); } },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      let calls = 0;
      const sleeps: number[] = [];
      const service = new SmartTrendService({
        now: () => BASE_TIME,
        sleep: async delay => { sleeps.push(delay); },
        request: async () => {
          calls += 1;
          return scenario.request();
        },
      });

      const feed = await service.fetch({});

      assert.equal(calls, 2);
      assert.deepEqual(sleeps, [250]);
      assert.equal(source(feed, 'google-trends').state, 'error');
    });
  }
});

test('attempt timeouts are bounded and retry only once', async () => {
  const timeouts: number[] = [];
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async (_url, _init, timeoutMs) => {
      timeouts.push(timeoutMs);
      throw new DOMException('timed out', 'TimeoutError');
    },
  });

  const feed = await service.fetch({});

  assert.deepEqual(timeouts, [5_000, 5_000]);
  assert.equal(source(feed, 'google-trends').state, 'error');
});

test('authorized Instagram reads bounded recent account media and returns live evidence', async () => {
  const instagramCalls: string[] = [];
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async url => {
      if (url.includes(GOOGLE_URL_PART)) return response(googleRss());
      if (url.includes('/12345/media')) {
        instagramCalls.push(url);
        return jsonResponse({ data: [{
          id: 'barber_media',
          media_type: 'VIDEO',
          caption: 'Barber pricing consultation',
          timestamp: '2026-07-22T17:30:00Z',
          permalink: 'https://www.instagram.com/reel/barber_media/',
          like_count: 100,
          comments_count: 10,
        }] });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const feed = await service.fetch({ instagramAccessToken: 'ig-token', instagramUserId: '12345' });

  assert.equal(instagramCalls.length, 1);
  assert.equal(INSTAGRAM_GRAPH_ORIGIN, 'https://graph.instagram.com/v23.0');
  assert.equal(instagramCalls.every(url => url.startsWith(`${INSTAGRAM_GRAPH_ORIGIN}/`)), true);
  assert.equal(instagramCalls[0].includes('/12345/media'), true);
  assert.equal(instagramCalls[0].includes('limit=12'), true);
  assert.equal(source(feed, 'instagram').state, 'live');
  assert.equal(feed.ideas.some(idea => idea.sourceId === 'instagram' && idea.evidenceState === 'live'), true);
  assert.equal(feed.ideas.some(idea => idea.sourceUrl?.includes('access_token')), false);
});

test('direct barber-domain account signals survive a full Google feed alongside planned topics', async () => {
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async url => {
      if (url.includes(GOOGLE_URL_PART)) {
        return response(googleRssItems(Array.from({ length: 8 }, (_, index) => `Barber pricing retention ${index}`)));
      }
      if (url.includes('/12345/media')) {
        return jsonResponse({ data: [{
          id: 'account_media', media_type: 'VIDEO', caption: 'Weekly chair recap',
          timestamp: '2026-07-22T17:30:00Z', permalink: 'https://www.instagram.com/reel/account_media/',
          like_count: 10, comments_count: 2,
        }] });
      }
      if (url.includes(PLANNER_URL_PART)) return jsonResponse({ data: { today: { topic: 'Plan a better rebooking system' }, week: [] } });
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const feed = await service.fetch({
    contentPlannerToken: 'planner-token',
    instagramAccessToken: 'ig-token',
    instagramUserId: '12345',
  });

  assert.equal(feed.ideas.some(idea => idea.sourceId === 'instagram'), true);
  assert.equal(feed.ideas.some(idea => idea.sourceId === 'content-planner'), true);
  assert.equal(feed.ideas.some(idea => idea.sourceId === 'google-trends'), true);
});

test('low-fit authorized account media is withheld while the live source status stays truthful', async () => {
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async url => {
      if (url.includes(GOOGLE_URL_PART)) return response(googleRss('FIFA team of the tournament 2026'));
      if (url.includes('/12345/media')) {
        return jsonResponse({ data: [{
          id: 'personal_media', media_type: 'IMAGE', caption: 'Thankful for family and health',
          timestamp: '2026-07-22T17:30:00Z', permalink: 'https://www.instagram.com/p/personal_media/',
          like_count: 500, comments_count: 40,
        }] });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const feed = await service.fetch({ instagramAccessToken: 'ig-token', instagramUserId: '12345' });

  assert.equal(source(feed, 'instagram').state, 'live');
  assert.match(source(feed, 'instagram').message ?? '', /no signal cleared barber fit 20/i);
  assert.equal(feed.ideas.some(idea => idea.sourceId === 'instagram'), false);
  assert.equal(feed.ideas.every(idea => idea.evidenceState === 'idea-starter'), true);
});

test('Instagram permission failure is terminal and capped at one request', async () => {
  let instagramCalls = 0;
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async url => {
      if (url.includes(GOOGLE_URL_PART)) return response(googleRss());
      if (url.includes('graph.instagram.com')) {
        instagramCalls += 1;
        return response('', 403);
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const feed = await service.fetch({ instagramAccessToken: 'ig-token', instagramUserId: '12345' });

  assert.equal(instagramCalls, 1);
  assert.equal(source(feed, 'instagram').state, 'error');
  assert.match(source(feed, 'instagram').message ?? '', /authorization/i);
});

test('fresh cache stays live, failed refresh becomes cached, and expired stale data is withheld', async () => {
  let now = BASE_TIME;
  let calls = 0;
  let fail = false;
  const service = new SmartTrendService({
    now: () => now,
    sleep: async () => {},
    request: async () => {
      calls += 1;
      if (fail) throw new Error('offline');
      return response(googleRss('Fresh barber pricing signal'));
    },
  });

  const initial = await service.fetch({});
  assert.equal(calls, 1);
  assert.equal(source(initial, 'google-trends').state, 'live');

  now += 10 * 60_000;
  const fresh = await service.fetch({});
  assert.equal(calls, 1);
  assert.equal(source(fresh, 'google-trends').state, 'live');
  assert.match(source(fresh, 'google-trends').message ?? '', /reused/i);
  assert.equal(fresh.ideas.some(idea => idea.sourceId === 'google-trends' && idea.evidenceState === 'live'), true);

  now += 1;
  fail = true;
  const stale = await service.fetch({});
  assert.equal(calls, 3);
  assert.equal(source(stale, 'google-trends').state, 'cached');
  assert.equal(stale.ideas.some(idea => idea.sourceId === 'google-trends' && idea.evidenceState === 'cached'), true);
  assert.match(source(stale, 'google-trends').message ?? '', /last successful result/i);

  now = BASE_TIME + 24 * 60 * 60_000 + 1;
  const expired = await service.fetch({});
  assert.equal(calls, 5);
  assert.equal(source(expired, 'google-trends').state, 'error');
  assert.equal(expired.ideas.some(idea => idea.sourceId === 'google-trends'), false);
});

test('personal plan topics are never reused from cache, including across midnight', async () => {
  let now = Date.parse('2026-07-22T23:59:00.000Z');
  let failPlanner = false;
  const service = new SmartTrendService({
    now: () => now,
    sleep: async () => {},
    request: async url => {
      if (url.includes(GOOGLE_URL_PART)) return response(googleRss());
      if (url.includes(PLANNER_URL_PART)) {
        if (failPlanner) throw new Error('planner offline');
        return jsonResponse(plannerPayload('Today only: consultation systems'));
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const initial = await service.fetch({ contentPlannerToken: 'planner-token' });
  assert.equal(initial.ideas.some(idea => idea.title === 'Today only: consultation systems'), true);
  assert.equal(source(initial, 'content-planner').state, 'connected');

  now = Date.parse('2026-07-23T00:01:00.000Z');
  failPlanner = true;
  const failedRefresh = await service.fetch({ contentPlannerToken: 'planner-token' });
  assert.equal(source(failedRefresh, 'content-planner').state, 'error');
  assert.equal(failedRefresh.ideas.some(idea => idea.sourceId === 'content-planner'), false);
  assert.equal(failedRefresh.ideas.some(idea => idea.title === 'Today only: consultation systems'), false);
});

test('empty successful responses are cached as a ten-minute source cooldown', async () => {
  let now = BASE_TIME;
  let calls = 0;
  const service = new SmartTrendService({
    now: () => now,
    sleep: async () => {},
    request: async () => {
      calls += 1;
      return response('<rss><channel></channel></rss>');
    },
  });

  const first = await service.fetch({});
  assert.equal(calls, 1);
  assert.equal(source(first, 'google-trends').state, 'empty');

  now += 10 * 60_000;
  const cooledDown = await service.fetch({});
  assert.equal(calls, 1);
  assert.equal(source(cooledDown, 'google-trends').state, 'empty');
  assert.match(source(cooledDown, 'google-trends').message ?? '', /reused/i);

  now += 1;
  await service.fetch({});
  assert.equal(calls, 2);
});

test('circuit opens after three failed fetches and suppresses the fourth source request', async () => {
  let now = BASE_TIME;
  let calls = 0;
  const service = new SmartTrendService({
    now: () => now,
    sleep: async () => {},
    request: async () => {
      calls += 1;
      throw new Error('offline');
    },
  });

  for (let index = 0; index < 3; index += 1) {
    const feed = await service.fetch({});
    assert.equal(source(feed, 'google-trends').state, 'error');
  }
  assert.equal(calls, 6);

  const open = await service.fetch({});
  assert.equal(calls, 6);
  assert.equal(source(open, 'google-trends').state, 'error');
  assert.match(source(open, 'google-trends').message ?? '', /temporarily paused/i);

  now += 5 * 60_000 + 1;
  await service.fetch({});
  assert.equal(calls, 8);
});

test('authenticated planner requests stay partitioned by account credential', async () => {
  let googleCalls = 0;
  const plannerCalls: string[] = [];
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async (url, init) => {
      if (url.includes(GOOGLE_URL_PART)) {
        googleCalls += 1;
        return response(googleRss());
      }
      if (url.includes(PLANNER_URL_PART)) {
        const token = authorization(init);
        assert.ok(token);
        plannerCalls.push(token);
        return jsonResponse(plannerPayload(token === 'Bearer account-a' ? 'Account A plan' : 'Account B plan'));
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const accountA = await service.fetch({ contentPlannerToken: 'account-a' });
  const accountB = await service.fetch({ contentPlannerToken: 'account-b' });
  const accountAAgain = await service.fetch({ contentPlannerToken: 'account-a' });

  assert.equal(googleCalls, 1);
  assert.deepEqual(plannerCalls, ['Bearer account-a', 'Bearer account-b', 'Bearer account-a']);
  assert.equal(accountA.ideas.some(idea => idea.title === 'Account A plan'), true);
  assert.equal(accountA.ideas.some(idea => idea.title === 'Account B plan'), false);
  assert.equal(accountB.ideas.some(idea => idea.title === 'Account B plan'), true);
  assert.equal(accountB.ideas.some(idea => idea.title === 'Account A plan'), false);
  assert.equal(accountAAgain.ideas.some(idea => idea.title === 'Account A plan'), true);
});

test('same-account calls share one flight while different accounts remain isolated', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const calls: Array<{ url: string; token: string | null }> = [];
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async (url, init) => {
      const token = authorization(init);
      calls.push({ url, token });
      await gate;
      if (url.includes(GOOGLE_URL_PART)) return response(googleRss());
      if (url.includes(PLANNER_URL_PART)) {
        return jsonResponse(plannerPayload(token === 'Bearer account-a' ? 'Account A plan' : 'Account B plan'));
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const accountAFirst = service.fetch({ contentPlannerToken: 'account-a' });
  const accountASecond = service.fetch({ contentPlannerToken: 'account-a' });
  const accountB = service.fetch({ contentPlannerToken: 'account-b' });

  assert.strictEqual(accountAFirst, accountASecond);
  assert.notStrictEqual(accountAFirst, accountB);
  assert.equal(calls.filter(call => call.token === 'Bearer account-a').length, 1);
  assert.equal(calls.filter(call => call.token === 'Bearer account-b').length, 1);

  release();
  const [feedAFirst, feedASecond, feedB] = await Promise.all([accountAFirst, accountASecond, accountB]);

  assert.strictEqual(feedAFirst, feedASecond);
  assert.equal(feedAFirst.ideas.some(idea => idea.title === 'Account A plan'), true);
  assert.equal(feedB.ideas.some(idea => idea.title === 'Account B plan'), true);
});

test('all unavailable sources return only truthful idea starters', async () => {
  let calls = 0;
  const service = new SmartTrendService({
    now: () => BASE_TIME,
    sleep: async () => {},
    request: async () => {
      calls += 1;
      throw new Error('offline');
    },
  });

  const feed = await service.fetch({});

  assert.equal(calls, 2);
  assert.equal(feed.ideas.length, 6);
  assert.equal(feed.ideas.every(idea => idea.sourceId === 'idea-starter' && idea.evidenceState === 'idea-starter'), true);
  assert.equal(source(feed, 'google-trends').state, 'error');
  assert.equal(source(feed, 'instagram').state, 'not-connected');
  assert.equal(source(feed, 'content-planner').state, 'not-connected');
  assert.equal(feed.youtube.status.state, 'not-connected');
});
