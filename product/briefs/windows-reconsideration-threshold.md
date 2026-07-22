# Proposal: Windows reconsideration threshold

Date: 2026-07-22

Status: pending explicit owner approval

## Proposed decision

Use a provisional evidence gate to decide when Windows deserves a fresh
business, signing, certification, and support review. Reconsider Windows when
either the standard adoption gate or the direct-demand override is met.

### Standard adoption gate

All of the following must be true:

1. at least 20 verified Mac activations from mature eligible invitations have
   been recorded;
2. the verified Mac activation rate is at least 50% across mature eligible
   invitations;
3. outcome coverage is at least 80% across mature eligible invitations;
4. at least 10 activated participants are eligible for four-week review;
5. the four-week retained creator rate is at least 50%;
6. at least 5 qualified Windows pilot commitments were recorded in the most
   recent rolling 30-day window;
7. the rolling 30-day critical-blocker participant rate is measured and no more
   than 20%; and
8. no data-loss or security incident remains unresolved.

### Direct-demand override

At least 10 qualified Windows pilot commitments in a rolling 30-day window may
open the Windows business review before the Mac cohort reaches maturity. The
override may be evaluated at any weekly snapshot and is explicitly exempt from
the standard gate's 30-day Mac-pilot age and 10-Mac-activation review
prerequisites. The same unresolved data-loss and security incident guardrail
still applies.

## What the gate authorizes

Crossing either gate authorizes only a bounded reconsideration package:

- obtain the current Windows code-signing and support-cost estimate;
- rerun the manual, non-publishing Windows preflight on exact current `main`;
- identify the committed Windows pilot cohort;
- compare the committed cohort's expected value and available support capacity
  with the current signing, certification, and support-cost estimate; and
- return for explicit approval of signing spend and a signed release-candidate
  certification plan.

It does not authorize Azure setup, certificate purchase, a Windows release job,
a tag, a GitHub Release change, updater publication, or customer distribution.

## Why these thresholds

This is a bottom-up pilot review trigger, not an industry benchmark or evidence
of product-market fit. Twenty verified activations creates a small but
non-trivial Mac cohort; a 50% activation floor and 80% outcome-coverage floor
prevent selection and missing-data false greens. Requiring 10 mature
participants and 50% four-week retention demands some evidence of repeat value,
not downloads, but the estimate remains noisy: at the minimum sample it is only
5 retained people. Every review must report retained count and rate together.
Five current Windows commitments supplies platform-specific demand, while the
10-person override recognizes unusually strong direct demand. The blocker
guardrails prevent platform expansion while the core Mac experience is unstable.

Confidence is low until the first pilot checkpoint because no historical cohort,
invitation-capacity baseline, signing-cost estimate, support-capacity estimate,
or central usage dataset exists. Hold a health review after 30 days and defer a
standard-gate decision until at least 10 verified activations exist. The
direct-demand override remains separately reviewable at each weekly snapshot.
Any revision must be prospective, evidence-backed, explicitly approved, and
recorded before evaluating the next window.

## Metric source

Definitions, exclusions, privacy rules, and cadence are controlled by
`product/briefs/mac-adoption-measurement.md`. Aggregate observations belong in
`product/research/`; participant identities remain in an owner-controlled
source outside the repository.

## Alternatives not selected

- GitHub downloads alone: rejected because internal certification,
  redownloads, and updater checks contaminate the counts.
- Mac adoption alone: rejected because it does not establish demand for
  Windows.
- Any single Windows request: rejected because it is anecdotal and does not
  justify signing and support obligations.
- Automatic Windows publication at the threshold: rejected because product
  demand, signing, certification, and public release are separate approval
  gates.
