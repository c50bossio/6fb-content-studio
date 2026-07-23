# Settings and connections

## Outcome

Make Settings feel like a barber-facing setup surface: show the signed-in 6FB
account and its active connections first, and keep technical maintenance controls
available without making them compete with the daily workflow.

## Acceptance criteria

- A signed-in user can confirm their 6FB account, Content Planner connection,
  and Instagram state without scrolling through diagnostics.
- A signed-out user can start browser SSO without entering a password in the
  desktop app; the existing password fallback remains available.
- YouTube inspiration consent remains visible and operational after sign-in.
- API keys, runtime health, storage, version information, and reset remain
  available through an explicit Advanced section.
- Disconnect and Reset retain their existing confirmations/behaviour; no
  credentials, tokens, or account data are exposed in new UI text.
