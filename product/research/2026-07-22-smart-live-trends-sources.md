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

## YouTube

The YouTube Data API supports public video search using an API key. Search can
be restricted to videos, recent publication time, region, relevance language,
safe-search level, result count, and view-count order. Private user data is not
needed for this read-only discovery scope, so OAuth is explicitly deferred.

The initial desktop design used a user-supplied key, but the official developer
policy review rejected that as a release architecture. The API client must use
credentials assigned to the developer and its API project. A compliant client
must also present the required YouTube terms/privacy consent and branding, and
must not derive a custom barber-fit metric or ranking from YouTube API data
without the applicable approved permission. The desktop key adapter therefore
must not ship. The remediated client calls a fixed authenticated 6FB backend
only after explicit current-version consent, shows official branding and policy
links, and presents validated response fields as unranked references. The
separately owned backend is implemented and locally verified on isolated branch
`codex/youtube-trends-proxy`; deployment configuration and an authenticated
staging response still require separate proof.

Official references:

- <https://developers.google.com/youtube/v3/getting-started>
- <https://developers.google.com/youtube/v3/docs/search/list>
- <https://developers.google.com/youtube/v3/guides/authentication>
- <https://docs.cloud.google.com/docs/authentication/api-keys-best-practices>
- <https://developers.google.com/youtube/terms/developer-policies>
- <https://developers.google.com/youtube/terms/developer-policies-guide>

## Product implication

Source availability is not all-or-nothing. Google may supply broad live search
signals now; Instagram may add authorized hashtag media when permissions allow;
the 6FB Content Planner remains personal planned content; and YouTube is a
connectable official public-video source rather than an unavailable placeholder.
Curated starters are useful only when labelled as offline inspiration.
