# Decision: prioritize Guided Plan-to-Post

Date: 2026-07-21

## Decision

Prioritize a narrow Guided Plan-to-Post workflow as the next product cycle:
saved plan → plan-aware clip extraction → optional edit → prepared scheduling
draft.

## Why

Recent shipped work already improves plan context in clip extraction. The
remaining friction is at the visible handoffs: Video Planner only saves or
copies the plan, the application routes tools independently, Video Editor ends
in Finder after export, and Scheduler starts with an empty draft. Completing
those handoffs converts existing capabilities into one usable barber outcome.

## Tradeoffs

- This is a product-flow investment, not a new generation feature.
- It intentionally stops at a scheduling draft; automatic publishing would add
  external side effects and a different approval boundary.
- There is no recorded barber-feedback or usage evidence favoring this over all
  other ideas. The decision is based on current source and recent release
  direction and should be revisited when direct feedback is available.

## Alternatives not selected

- New dashboard work: useful discoverability work, but it would not repair the
  underlying handoffs.
- Analytics expansion: current persistent render tracking is incomplete, so it
  cannot yet provide a stronger product signal.
- More standalone generators: would add another surface before completing the
  primary create-to-schedule path.

## Decision rule for implementation

Preserve user control at every boundary. The feature may prefill a local
scheduling draft, but it must never create a queue item or post externally
without the user's explicit confirmation.
