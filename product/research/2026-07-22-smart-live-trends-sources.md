# Smart Live Trends source research

Date: 2026-07-22

## Google Trends

Google documents a Trends API alpha with normalized query data, geographic
breakdowns, aggregation controls, and a rolling five-year window. Access is
limited to approved alpha testers, so it is not a dependable prerequisite for
the first desktop implementation.

Google also publishes a public daily-search RSS feed. A single bounded request
to `https://trends.google.com/trending/rss?geo=US` returned current items with a
title, approximate traffic, publication time, and Google Trends link during
discovery. The first implementation may use this broad public signal while
keeping query-specific API alpha support deferred.

Official references:

- <https://developers.google.com/search/apis/trends>
- <https://developers.google.com/search/blog/2025/07/trends-api>

## Instagram

Meta's Instagram API supports connected professional accounts and hashtagged
media discovery when the account, application, token, and permissions are
eligible. It is not a universal Explore/trending feed. The desktop app already
stores synchronized professional-account credentials in Electron main for
publishing and analytics; trend discovery must separately prove that the token
can access the hashtag endpoints before showing any Instagram result.

Meta's official version-support table showed the repository's former Graph API
v18.0 pin had expired on 2026-01-26. The implementation now centralizes on the
supported v23.0 surface so publishing, analytics, and authorized hashtag
discovery cannot silently drift across separate version constants. A real
connected account must still prove its permissions at runtime; permission
failure remains a truthful source error rather than a live result.

Official reference:

- <https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api>
- <https://developers.facebook.com/docs/graph-api/changelog/versions>

## TikTok

TikTok Creative Center exposes public discovery views for trend categories, but
TikTok's programmatic Research API is restricted to qualifying researchers and
organizations. No approved commercial trend-data credential or feed is present
in this repository. The desktop app must therefore show TikTok as unavailable
instead of scraping Creative Center pages or reverse-engineering private APIs.

Official references:

- <https://ads.tiktok.com/help/article/how-to-use-trends>
- <https://developers.tiktok.com/products/research-api/>

## Product implication

Source availability is not all-or-nothing. Google may supply broad live search
signals now; Instagram may add authorized hashtag media when permissions allow;
the 6FB Content Planner remains personal planned content; and TikTok remains an
explicitly unavailable adapter until an approved data route exists. Curated
starters are useful only when labelled as offline inspiration.
