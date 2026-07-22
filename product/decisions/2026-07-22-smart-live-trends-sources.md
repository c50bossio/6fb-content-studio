# Approve source-backed Smart Live Trends

Date: 2026-07-22

## Decision

Implement Smart Live Trends with truthful evidence states and authorized source
adapters. Google Trends public RSS may supply current broad search signals;
Instagram may supply recent hashtag-media signals only when the connected
professional account has the required Graph API access; the 6FB Content Planner
remains a separate planned-content source. TikTok remains visibly unavailable
until an approved commercial data route exists.

Do not use unofficial Instagram or TikTok scraping, reverse-engineered private
endpoints, or AI output as proof that a topic is trending.

## Reasoning

The product value is timely, relevant idea selection with evidence a barber can
understand. A source label that overstates freshness or access would be worse
than an honestly labelled starter. Source adapters keep the user experience
useful now while allowing approved APIs to be added without rewriting the
planner.

## Release boundary

Approval covers local implementation and verification. It does not approve a
merge, tag, release, updater publication, social action, or external outreach.
