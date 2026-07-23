import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesktopSsoRequest, callbackCode, validDesktopSession } from '../electron/desktop-sso.mts';

test('desktop SSO request uses a high loopback port, PKCE, and unpredictable state', () => {
  const request = createDesktopSsoRequest('https://content.6fbmentorship.com/apps/content/api/auth/desktop/authorize', 51234);
  const url = new URL(request.authorizeUrl);
  assert.equal(url.searchParams.get('port'), '51234');
  assert.equal(url.searchParams.get('state'), request.state);
  assert.match(request.verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.match(url.searchParams.get('code_challenge') ?? '', /^[A-Za-z0-9_-]{43,128}$/);
});

test('desktop SSO rejects callbacks with a state, host, or code mismatch', () => {
  const state = 's'.repeat(43);
  assert.equal(callbackCode(`http://127.0.0.1:51234/callback?state=${state}&code=opaque.code`, state), 'opaque.code');
  assert.equal(callbackCode('http://localhost:51234/callback?state=' + state + '&code=opaque.code', state), null);
  assert.equal(callbackCode(`http://127.0.0.1:51234/callback?state=${'x'.repeat(43)}&code=opaque.code`, state), null);
  assert.equal(callbackCode(`http://127.0.0.1:51234/callback?state=${state}&code=bad%20code`, state), null);
});

test('desktop SSO never forwards malformed session data to the renderer', () => {
  assert.equal(validDesktopSession({ token: 't'.repeat(32), email: 'owner@6fb.test' }), true);
  assert.equal(validDesktopSession({ token: 'short', email: 'owner@6fb.test' }), false);
  assert.equal(validDesktopSession({ token: 't'.repeat(32), email: 42 }), false);
});
