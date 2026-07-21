---
type: setup
title: 6FB Content Studio - workspace setup
description: The one-time setup decisions for this folder app.
timestamp: 2026-07-21
---

# 6FB Content Studio - Setup

This is the reviewable build spec for the folder app. Edit this first when the
workspace shape changes.

## Plain-English purpose
A lightweight human-and-agent operating workspace for planning, building, verifying, and releasing 6FB Content Studio while leaving the Electron, React, Python, and packaging runtime structure untouched.

## Type
- Kind: workspace
- Layout: canonical simple workspace

## Agent entry contract
- Canonical instructions: `AGENTS.md`
- Claude compatibility router: `CLAUDE.md`
- Human or unknown-agent start: `README.md`

## Approval
- Status: approved
- Rule: change `draft` to `approved` only after the human explicitly approves this plan.

## Suggested work areas
| Workspace | Purpose | Routes |
|-----------|---------|--------|
| `product` | Own product direction, barber workflow requirements, roadmap, decisions, and acceptance criteria. | product work |
| `engineering` | Own implementation plans, architecture notes, change evidence, and QA for the existing src/, electron/, python/, and scripts/ runtime. | engineering work |
| `delivery` | Own macOS and Windows release checklists, packaging evidence, version notes, and handoffs without storing generated build artifacts. | delivery work |

## AI rules
- Route every task to one workspace before doing the work.
- Do not invent facts. If a fact is missing, mark it unknown or ask.
- Keep durable decisions and current truth in the relevant `notes.md`.
- At the end of a session, before stepping away, and after a significant decision, update `PROGRESS.md`.
- Keep the root `AGENTS.md` short. Put detail inside the workspace `CONTEXT.md` files.
- Keep secrets, private contact details, payment details, and account passwords out of your notes and workspace files.
- The one exception: a revocable API key or access token (never a password) may live in the gitignored .env file, and never gets pasted into a note.
- Ask before deleting, publishing, sending, deploying, or changing anything outward-facing.
- Never move or rename src/, electron/, python/, scripts/, assets/, public/, .github/, out/, release/, or existing build configuration as part of folder-app organization.
- Treat production publishing, tags, GitHub Releases, secrets, social posting, and external API calls as explicit human approval gates.
- Keep credentials and customer content out of tracked workspace notes; generated artifacts remain in their existing ignored output directories.

## Change policy
Edit this file deliberately. From the repository root, re-run the folder-app
workspace doctor. This requires the folder-app skill to be installed and
`FOLDER_APP_SKILL_DIR` to point to the directory containing
`workspace_doctor.py`:

```bash
python3 "$FOLDER_APP_SKILL_DIR/workspace_doctor.py" .
```
