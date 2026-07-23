# Approve source-backed Smart Live Trends

Date: 2026-07-22

## Decision

Implement Smart Live Trends with truthful evidence states and authorized source
adapters. Google Trends public RSS may supply current broad search signals;
Instagram may supply recent hashtag-media signals only when the connected
professional account has the required Graph API access. The 6FB Content
Planner remains a separate planned-content source. TikTok has no approved
source and is removed. YouTube is allowed only as a separate reference-only
section backed by the authenticated 6FB server contract.

Do not use unofficial Instagram or YouTube scraping, reverse-engineered private
endpoints, or AI output as proof that a topic is trending.

## Reasoning

The product value is timely, relevant idea selection with evidence a barber can
understand. A source label that overstates freshness or access would be worse
than an honestly labelled starter. Official policy review found that neither an
embedded shared key nor a user-supplied project key is a compliant release path
for this installed client. The approved client design therefore uses the
existing 6FB sign-in token, explicit versioned consent, accessible policy links,
official unmodified branding, and a narrow 6FB-owned backend. YouTube fields
remain reference-only and cannot enter the existing barber-fit pipeline.

## Release boundary

Approval covers Google, eligible Instagram, connected-plan, starter, and the
described Mac YouTube client scope. It does not approve or claim the backend,
merge, tag, release, updater publication, social action, or external outreach.
