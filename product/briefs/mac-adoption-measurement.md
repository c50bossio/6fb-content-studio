# Mac pilot adoption measurement

Status: proposed; pending explicit owner approval

Last updated: 2026-07-22

## Decision supported

Determine whether the macOS arm64 pilot demonstrates repeat product value and
whether verified Windows demand justifies opening a separate Windows signing,
certification, and support decision.

This measurement plan does not authorize telemetry, Windows signing spend, a
Windows tag, or public Windows distribution.

## Current evidence boundary

- The public v1.5.46 release is available for macOS arm64 only.
- The application calculates output counts from local app data for its Analytics
  screen, but it does not send those counts to a central usage service.
- No pilot cohort, direct-feedback dataset, or centrally queryable active-user
  source is recorded in this repository.
- GitHub asset download counts include internal release verification,
  redownloads, and updater traffic. They are distribution indicators, not
  activated-user or retention evidence.

## Measurement source

Use an owner-controlled pilot roster outside this repository for participant
deduplication and weekly check-ins. Store only aggregate counts and sanitized
evidence references in `product/research/`; never commit names, email addresses,
customer content, device identifiers, credentials, or raw support conversations.

Until that roster exists and reviewed check-ins are recorded, adoption and
Windows demand remain **not measured**, not zero.

## Core outcome

A core outcome is one of the following completed in the signed public Mac app:

- a clip-extraction run that produces at least one usable clip;
- a saved carousel or blog draft;
- a Guided Plan-to-Post handoff that reaches a local scheduling draft; or
- a local scheduled item saved after explicit confirmation.

Opening the app, downloading an installer, checking for an update, or viewing a
screen is not a core outcome. External social posting is never required for
activation or retention.

## KPI definitions

### Cohort and snapshot rules

Classify invitation eligibility before observing an outcome. One person may
enter the cohort once. An eligible invitation must be delivered to an external
barber, shop owner, suite owner, or educator who intends to try a core content
workflow, has access to an Apple Silicon Mac, and receives the current signed
public-build link. Exclude the owner, project contributors, release certifiers,
internal QA, duplicates, and invitations proven undelivered.

Store delivery and evidence timestamps in UTC in the owner-controlled roster.
At each snapshot, freeze the cohort and report:

- mature eligible invitations: delivered at least 168 hours earlier;
- open-window invitations: delivered less than 168 hours earlier; and
- exclusions with aggregate reason counts fixed before outcomes are reviewed.

Only mature eligible invitations enter the activation denominator. If that
denominator is zero, the activation rate is **not measured**. Nonresponse stays
in the mature denominator and is never silently excluded.

### 1. Verified Mac activation rate

`verified activations from mature eligible invitations / mature eligible Mac pilot invitations`

A participant is activated when, within seven days of invitation, they confirm
that the signed current public build launched and they complete at least one core
outcome. Confirmation may be an observed screen-share or a structured opt-in
check-in. A GitHub download alone does not qualify.

Only activations tied to the same frozen mature invitation cohort enter the
numerator. Report mature-cohort activations, denominator, rate, open-window
invitations, and open-window activations separately so the rate cannot exceed
100% and a small or immature cohort cannot be mistaken for strong adoption.

### 2. Four-week retained creator rate

`four-week retained creators / activated participants eligible for four-week review`

A participant becomes eligible exactly 672 hours after the activation timestamp.
Use four rolling UTC windows: W1 `[activation, activation + 168h)`, W2
`[+168h, +336h)`, W3 `[+336h, +504h)`, and W4 `[+504h, +672h)`. The core outcome
that established activation does not count toward retention; a later evidenced
outcome in W1 may count. A retained creator has at least one evidenced core
outcome in three of the four windows.

Use the same structured check-in or observed screen-share evidence standard for
every weekly outcome. Missing check-ins provide no outcome evidence and never
count as activity. Report retained count, eligible count, and rate together.

This is the primary value-realization KPI because it distinguishes repeat use
from installation curiosity.

### 3. Qualified Windows demand

Count distinct external people once in a rolling 30-day window who:

1. use Windows 10 or Windows 11 on x64 hardware as their primary content
   workstation;
2. cannot use the Mac-only pilot in their normal workflow for that reason; and
3. explicitly agree to try a signed Windows x64 pilot within 14 days of
   availability.

General interest, social reactions, duplicates, internal/test participants, and
people outside the frozen Windows 10/11 x64 demand cohort do not qualify. This
demand definition does not claim those systems are supported; compatibility and
minimum hardware are outputs of the later feasibility review.

## Drivers and guardrails

- Driver: median days from invitation to verified activation.
- Driver: core-outcome completion mix, reported as aggregate counts by outcome.
- Data-quality guardrail: outcome coverage, calculated as mature eligible
  invitations with a verified activation, a documented failed attempt, or an
  explicit declined/no-attempt response divided by mature eligible invitations.
  No response remains missing, not a successful or blocker-free outcome.
- Guardrail: rolling 30-day critical-blocker participant rate, calculated as
  distinct participants who attempted installation, launch, or a core workflow
  and encountered at least one critical blocker divided by all distinct
  participants with a documented attempt in the same window. A critical blocker
  is an observed or reproducible failure that prevents signed-app installation
  or launch, or prevents the participant's intended core outcome without a
  user-available recovery during that attempt; any data-loss or security
  incident is critical.
  Count each participant once per snapshot even if they report multiple issues.
  Resolved blockers still count for the 30-day experience window; unresolved
  status is reported separately. A zero denominator is **not measured**.
- Guardrail: unresolved data-loss or security incidents. Any such incident keeps
  Windows expansion closed regardless of KPI totals.

## Review cadence

- Update the aggregate scorecard weekly while the pilot is active.
- Hold a pilot-health review 30 days after the first external invitation even if
  the cohort is too small to evaluate the threshold.
- Hold the first standard-gate review only after both 30 days have elapsed and
  at least 10 verified Mac activations exist.
- Evaluate the direct-demand override at each weekly snapshot. It is exempt from
  the standard gate's Mac-pilot age and activation-count prerequisites.
- Recalculate retention only for fully elapsed four-week windows.
- Record changes to definitions or thresholds prospectively in a decision file;
  never redefine a metric retroactively to make a gate pass.

## Acceptance criteria

- Every reported KPI includes its formula, numerator, denominator where
  applicable, measurement window, snapshot time, and source owner.
- Each snapshot freezes invitation eligibility, mature/open-window counts, and
  aggregate exclusion reasons before calculating outcomes.
- Unknown values are labeled **not measured** rather than recorded as zero.
- Missing check-ins are never classified as activity or blocker-free attempts.
- GitHub downloads are shown only as distribution context and never added to
  verified activations.
- The repository contains no participant identity or private customer content.
- A Windows reconsideration result links the reviewed aggregate scorecard and
  states which gate passed or failed.
- Crossing a reconsideration threshold produces a business/signing decision;
  it never automatically publishes or authorizes a Windows release.

## Missing prerequisite

An owner-controlled pilot roster and weekly check-in process do not yet exist in
the recorded project evidence. They are required before any adoption KPI can be
reported as measured.
