# Smart Live Trends

Status: compliant Mac client and authenticated backend implemented locally;
deployment, authenticated staging, merge, and release remain separate gates

## User problem

The Video Planner currently labels a fixed list of generic prompts as
"Trending in your niche" whenever the connected Content Planner cannot return a
plan. A barber cannot tell whether an idea reflects current outside interest, a
personal schedule, cached data, or a generic starter.

## Outcome

Replace the ambiguous picker with a source-backed idea finder that helps a
barber identify a timely topic while preserving a useful, honestly labelled
offline path.

## Smallest useful scope

- Fetch current US Google Trends daily-search signals from Google's public RSS
  feed when the user explicitly presses **Find live trends**.
- When an authorized Instagram professional account is connected, request a
  small, fixed set of recent hashtag-media signals through the official
  Instagram Graph API. Publishing access alone must not be described as trend
  discovery access.
- Keep the connected 6FB Content Planner's today/week topics, but label them
  **Your plan** rather than trends.
- Show public YouTube videos only in a dedicated branded inspiration/reference
  section supplied by an authenticated 6FB-owned backend. Require explicit
  versioned consent, keep required policy links accessible, and do not accept
  user-supplied API keys or scrape YouTube pages.
- Preserve validated YouTube result order and display fields exactly. A YouTube
  reference may open only its original URL; it cannot fill the topic, enter AI
  generation, or receive barber-fit scoring/ranking.
- Rank live ideas with a deterministic barber-fit score using the saved Content
  Brain. Broad signals remain visibly broad; ranking must never convert an
  unrelated trend into fabricated barber evidence.
- A live signal needs a barber-fit score of at least 20 to count as useful. If
  every live signal is below that threshold and no personal plan exists, lead
  with labelled Idea starters and retain at most two broad live signals for
  optional inspiration. Current-but-irrelevant data must not suppress utility.
- Fall back to timeless **Idea starters** with no live badge when no live or
  planned idea is available.

## Source and state language

Each idea has exactly one source and one evidence state:

- **Live** — returned by an authorized source during the current request or
  reused from a successful response less than ten minutes old.
- **Cached** — previously live data reused after a source error and still within
  the documented 24-hour stale limit.
- **Your plan** — a connected 6FB Content Planner topic; not trend evidence.
- **Idea starter** — curated offline inspiration; not trend evidence.

Each source also reports one of live, cached, connected plan, not connected,
unavailable, empty, or error. YouTube reports independently in its reference
section and cannot block Google, Instagram, the plan, or starters.

## Interaction

1. The barber presses **Find live trends**.
2. The control exposes a loading state and prevents duplicate requests.
3. Results show source, evidence state, freshness/traffic evidence when
   available, barber-fit score, and a short "why now" explanation.
4. Selecting an idea fills the existing Video Topic field and closes the picker.
5. A subsequent press performs an explicit refresh unless a very recent
   successful live-source response is reused to protect Google, Instagram, or
   Instagram.
   Personal-plan topics are always refreshed so “today” cannot cross a date
   boundary from cache.

## Safety and privacy

- Network access occurs only in Electron main through the typed preload bridge.
- Tokens never enter renderer results, logs, URLs returned to the renderer, or
  tracked evidence.
- One click has a fixed source/request cap, hard timeouts, at most one bounded
  transient retry, response-size caps, schema validation, and a per-source
  circuit after repeated failures.
- The exact worst case is 13 network attempts: two Google attempts, one 6FB YouTube backend
  attempts, two Content Planner attempts, and up to eight Instagram attempts
  across two fixed hashtag lookup/media pairs. A missing optional connection
  issues zero requests to that source; Google remains an automatic source.
  Open circuits issue zero requests to their affected source.
- There is no polling, scheduler, bulk sync, posting, or social mutation.
- Malformed, oversized, empty, rate-limited, slow, and failed responses degrade
  independently and cannot relabel fallback content as live.

## Acceptance criteria

1. The old fallback is never rendered under "Trending in your niche" and no
   stale year appears in a starter.
2. Live Google ideas identify Google Trends, include freshness or traffic
   evidence, and link only to an allowlisted HTTPS Google Trends URL.
3. Instagram ideas appear only after an authorized successful response; absent
   or insufficient permissions produce a truthful source status.
4. YouTube references appear only after current consent, 6FB sign-in, and a
   validated backend response. Missing sign-in or consent makes zero YouTube
   calls; 429, 5xx, and network failures make no second desktop attempt.
5. Planned and starter ideas remain useful but cannot receive live/cached
   styling or claims.
6. Duplicate and malformed ideas are removed; titles, URLs, idea list sizes, and
   payload sizes are capped.
7. An all-zero live feed cannot suppress barber-specific Idea starters; broad
   live signals remain labelled and unmodified rather than receiving invented
   relevance.
8. Empty, offline, timeout, 429, 5xx, malformed payload, and stale-cache paths
   are covered by executable tests.
9. The picker and every result remain keyboard accessible, expose loading/error
   status to assistive technology, preserve the 44 px target floor, and pass at
   375, 768, and 1440 px without horizontal scroll or clipping.
10. Choosing any returned idea continues into the existing planner without
   changing generation, saving, or Plan-to-Clips behavior.

## Explicitly deferred

- Google Trends API alpha credentials and query-specific historical analysis.
- YouTube OAuth, user-supplied API keys, private-channel data, subscriptions,
  comments, and publishing.
- AI-written transformations of source claims.
- Background refresh, notifications, posting, and performance-learning loops.
