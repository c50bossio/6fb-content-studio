# Desktop SSO handoff

## Goal

Let a signed-in 6FB member connect the Mac app without re-entering a password.

## Flow

1. Electron reserves a high localhost port, generates state and a PKCE verifier, and opens Content Playbook authorization in the default browser.
2. Content Playbook uses the existing Hub SSO path when its browser session is absent, then creates a short-lived, single-use `OAuthNonce` record.
3. The browser receives only the opaque nonce plus public PKCE challenge at `http://127.0.0.1:<port>/callback`.
4. Electron validates the callback state, exchanges the code with the verifier over HTTPS, and stores the scoped Content Playbook session token in its main process only.

## Security invariants

- No hub token, content token, password, or cookie is included in a URL or renderer event.
- The callback listener binds only to `127.0.0.1`, accepts one request, expires after five minutes, and rejects invalid state/host/code values.
- The backend marks the nonce consumed conditionally, so replay races fail.
- PKCE prevents a captured localhost redirect from being redeemed by a different process.
