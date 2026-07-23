# Smart Live Trends implementation plan

## Runtime design

- Add shared trend types for renderer/preload/main contracts.
- Keep deterministic parsing, validation, deduplication, relevance scoring, and
  starter construction in a side-effect-free module with unit tests.
- Add one `fetch-smart-trends` IPC handler. It reads Content Brain and stored
  account credentials in main, calls source adapters behind bounded fetches,
  then returns sanitized trend ideas and source statuses.
- Google adapter: public US daily-trends RSS, one request plus at most one retry,
  512 KiB body limit, Google-host URL allowlist, fixed result cap.
- Instagram adapter: up to two validated barber/content-pillar hashtags, one
  hashtag lookup and one recent-media lookup per tag, with a fixed total cap.
  Any permissions failure affects only Instagram.
- Content Planner adapter: reuse the authenticated today/week response as
  planned ideas. It is never scored or labelled as live trend evidence.
- YouTube reference adapter: use only the authenticated 6FB backend endpoint.
  Require current versioned consent and 6FB sign-in before the first request;
  make one five-second desktop attempt with no retry; preserve validated backend
  order, titles, channels, dates, URLs, and thumbnails; never score, rank,
  deduplicate, transform, or select these references as planner topics.
- Per-live-source in-memory cache: fresh responses may be reused for ten minutes;
  previously live Google or Instagram responses and validated 6FB YouTube references up to 24 hours old may be
  shown as cached after a failed refresh. Content Planner topics are refreshed
  on every explicit click and omitted on failure rather than reused as a stale
  plan. Three consecutive failures open that source circuit for five minutes.
- One click issues at most 13 attempts: Google 2, YouTube backend 1,
  Content Planner 2, and Instagram 8 across two fixed hashtag lookup/media
  pairs. A missing optional credential issues no request to that source;
  Google remains automatic. Open circuits issue no request to their affected
  source.

## Renderer design

- Replace string arrays and implicit `briefData` state with typed ideas and
  source status.
- Button copy becomes **Find live trends**.
- Result cards expose source/state, evidence, fit score, and why-now copy.
- The empty/error path shows timeless Idea starters and a source-status summary.
- If no live idea reaches barber fit 20 and no personal plan exists, lead with
  Idea starters and keep no more than two broad live signals at the end.
- Use a request generation ref so an older result cannot overwrite a newer
  request during a renderer refresh/remount boundary.

## Verification

1. Pure unit coverage for RSS/JSON validation, URL sanitization, deduplication,
   relevance scoring, current/cache/starter state, and malformed/empty input.
2. IPC parity and static contracts for timeouts, request/retry caps, circuit,
   response-size cap, no raw renderer token, versioned YouTube consent, zero
   calls without sign-in/consent, and no desktop retry for backend failures.
3. Browser-preview interaction proof for live, fallback, empty, error, and
   selecting a result.
4. Full `npm test` and workspace validators.
5. Responsive screenshots and automated layout/console/network gates at 375,
   768, and 1440 px, followed by independent review.
