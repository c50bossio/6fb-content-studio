import { createHash, randomBytes } from 'node:crypto';

export const DESKTOP_SSO_CALLBACK_HOST = '127.0.0.1';
export const DESKTOP_SSO_MIN_PORT = 49152;
export const DESKTOP_SSO_MAX_PORT = 65535;

export interface DesktopSsoRequest {
  state: string;
  verifier: string;
  authorizeUrl: string;
}

function base64Url(bytes: number) {
  return randomBytes(bytes).toString('base64url');
}

export function createDesktopSsoRequest(authorizeEndpoint: string, port: number): DesktopSsoRequest {
  if (!Number.isInteger(port) || port < DESKTOP_SSO_MIN_PORT || port > DESKTOP_SSO_MAX_PORT) {
    throw new Error('The desktop SSO callback port is invalid.');
  }
  const state = base64Url(32);
  const verifier = base64Url(64);
  const codeChallenge = createHash('sha256').update(verifier).digest('base64url');
  const url = new URL(authorizeEndpoint);
  url.searchParams.set('port', String(port));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  return { state, verifier, authorizeUrl: url.toString() };
}

export function callbackCode(value: string, expectedState: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' || url.hostname !== DESKTOP_SSO_CALLBACK_HOST || url.pathname !== '/callback') return null;
    const state = url.searchParams.get('state');
    const code = url.searchParams.get('code');
    if (!state || state !== expectedState || !code || code.length > 300 || !/^[A-Za-z0-9_.-]+$/.test(code)) return null;
    return code;
  } catch {
    return null;
  }
}

export function validDesktopSession(value: unknown): value is { token: string; email: string } {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.token === 'string' && record.token.length >= 32 && record.token.length <= 8_192 &&
    typeof record.email === 'string' && record.email.length > 3 && record.email.length <= 320;
}
