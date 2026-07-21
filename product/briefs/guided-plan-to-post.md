# Guided Plan-to-Post

Status: approved for implementation planning

Last updated: 2026-07-21

## User outcome

A barber can take one saved video plan through clip extraction, optional editing,
and scheduling without hunting for the same file, reselecting the plan, or
rewriting the starting context.

## Problem

The studio already contains the necessary tools, but they operate as separate
surfaces. A saved plan can be selected later in Clips, and a clip can open in
the editor, yet the user must navigate and reselect context manually. A
successful edit exposes the output in Finder rather than continuing to a
prepared scheduling draft. The Scheduler begins with empty media and caption
fields.

That turns the core barber workflow into several avoidable context switches:
idea and script → recorded video → selected clip → finished post.

## Audience and quality bar

- Primary audience: a working barber who needs to turn a planned video into an
  Instagram-ready post between client appointments.
- Good outcome: the active plan and chosen media remain obvious, editable, and
  recoverable at every handoff.
- Avoid: a forced wizard, automatic posting, hidden scheduling, or claims that
  the feature has been validated by customer usage when that evidence is not
  yet recorded.

## In scope

1. A saved Video Planner plan has a clear **Create from this plan** action.
2. That action opens Clips with the exact plan selected and its topic, Drop
   Zones, and strategy context visible before extraction.
3. A chosen clip and a successful Video Editor export offer **Schedule this
   clip/video** actions.
4. Scheduler opens a draft with the selected media, available thumbnail, an
   editable caption seed, and Instagram selected by default.
5. The user still chooses the date, time, caption, and final Schedule action.
6. Cancelling, changing pages, failing an export, or encountering missing media
   does not create a scheduled post or silently publish anything.

## Out of scope

- New AI generation, new social-platform integrations, automatic publishing,
  multi-post campaign generation, calendar recommendations, or changes to the
  bundled Python media pipeline.
- Claiming analytics or customer-validation results that the project does not
  currently record.

## Acceptance criteria

- Saving or selecting an existing plan makes **Create from this plan** available.
- Continuing from a plan lands in Clips with that same plan preselected; its
  Drop Zones and strategy brief are the values passed to clip extraction.
- The user can intentionally clear or replace the selected plan before running
  extraction.
- From a clip preview, scheduling uses the selected clip's exact media path and
  never creates a post until the Scheduler form is confirmed.
- From a successful editor export, scheduling uses the exported file rather
  than the original source clip.
- A scheduler draft prepopulates media and a safe editable caption seed, but
  never bypasses date/time selection or confirmation.
- If a handed-off file no longer exists, the user sees a clear recovery state
  and can choose another file; no malformed queue item is saved.
- Direct navigation to Planner, Clips, Editor, or Scheduler without a handoff
  still works as it does today and does not show stale content from an earlier
  flow.
- No action in this feature posts to Instagram or any other network without the
  existing explicit posting action.

## Evidence and assumption boundary

This is a source-backed priority decision, not a customer-validated finding.
The current source shows a saved-plan-only action in Video Planner, plan-aware
clip extraction, a clip-to-editor handoff, an editor export that ends in Finder,
and an empty Scheduler draft. No product feedback file, usage cohort, or open
product issue currently identifies a different priority.

The implementation must keep this distinction in any UI copy or release notes.

## Pilot proof

Before release, verify on a packaged desktop build that one recorded video can
follow this path:

1. save a plan with Drop Zones;
2. continue into Clips and confirm the chosen plan context;
3. extract or select a clip;
4. edit and export the clip;
5. open a prefilled scheduling draft for the exported file;
6. cancel once and confirm no queue item exists; then save once and confirm one
   local scheduled item exists;
7. confirm no external post was sent by this path.
