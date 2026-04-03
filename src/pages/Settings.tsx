import { useState, useEffect } from 'react';

interface SixFBAccount {
  email: string | null;
  igUsername: string | null;
  igTokenExpiresAt: string | null;
  connected: boolean;
}

interface SystemHealth {
  deps: {
    python: boolean;
    ffmpeg: boolean;
    mediapipe: boolean;
    clipExtractor: boolean;
  };
  paths: {
    userData: string;
    ixClipExtractor: string;
  };
  apiKeys: {
    claude: boolean;
    openai: boolean;
  };
}

export default function Settings() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetConfirm, setResetConfirm] = useState(false);

  // 6FB Account
  const [account, setAccount] = useState<SixFBAccount | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const api = (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => Promise<unknown>> }).electronAPI;
  const isElectron = !!api?.checkSystemHealth;

  useEffect(() => {
    if (isElectron) {
      (api.checkSystemHealth() as Promise<SystemHealth>).then((h) => {
        setHealth(h);
        setLoading(false);
      }).catch(() => setLoading(false));
      (api.get6FBAccount() as Promise<SixFBAccount>).then(setAccount).catch(() => {});
    } else {
      setHealth({
        deps: { python: false, ffmpeg: false, mediapipe: false, clipExtractor: false },
        paths: { userData: '~/Library/Application Support/6fb-content-studio', ixClipExtractor: '~/clawd/projects/ix-social-media-manager/tools/clip_extractor' },
        apiKeys: { claude: true, openai: false },
      });
      setLoading(false);
    }
  }, []);

  const handleLogin6FB = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const result = await api.login6FB({ email: loginEmail, password: loginPassword }) as { success: boolean; error?: string };
      if (result.success) {
        setLoginEmail('');
        setLoginPassword('');
        const acc = await api.get6FBAccount() as SixFBAccount;
        setAccount(acc);
      } else {
        setLoginError(result.error || 'Login failed');
      }
    } catch { setLoginError('Connection error'); }
    setLoginLoading(false);
  };

  const handleSyncInstagram = async () => {
    setSyncLoading(true);
    setSyncMsg('');
    try {
      const result = await api.syncInstagramCredentials() as { success: boolean; username?: string; error?: string };
      if (result.success) {
        setSyncMsg(`Connected as @${result.username}`);
        const acc = await api.get6FBAccount() as SixFBAccount;
        setAccount(acc);
      } else {
        setSyncMsg(result.error || 'Sync failed');
      }
    } catch { setSyncMsg('Connection error'); }
    setSyncLoading(false);
  };

  const handleDisconnect6FB = async () => {
    await api.disconnect6FB();
    setAccount(null);
    setSyncMsg('');
  };

  const handleDeleteKey = async (provider: string) => {
    if (!isElectron) return;
    await api.deleteApiKey(provider);
    const h = await api.checkSystemHealth() as SystemHealth;
    setHealth(h);
  };

  const handleReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    if (isElectron) {
      await api.resetApp();
      window.location.reload();
    }
  };

  const StatusDot = ({ ok }: { ok: boolean }) => (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-6fb-green' : 'bg-red-500'}`} />
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
      <p className="text-6fb-text-muted mb-8">Manage your API keys, check system health, and configure the studio.</p>

      {/* API Keys Section */}
      <section className="mb-8">
        <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-6fb-green shrink-0">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          API Keys
        </h2>
        <div className="bg-6fb-card border border-6fb-border rounded-xl p-5 space-y-4">
          {/* Claude */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot ok={health?.apiKeys.claude ?? false} />
              <div>
                <p className="text-sm font-medium text-white">Claude (Anthropic)</p>
                <p className="text-xs text-6fb-text-muted">
                  {health?.apiKeys.claude ? 'Key configured' : 'Not configured'}
                </p>
              </div>
            </div>
            {health?.apiKeys.claude && (
              <button
                onClick={() => handleDeleteKey('claude')}
                className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors"
              >
                Remove
              </button>
            )}
          </div>

          {/* OpenAI */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot ok={health?.apiKeys.openai ?? false} />
              <div>
                <p className="text-sm font-medium text-white">OpenAI</p>
                <p className="text-xs text-6fb-text-muted">
                  {health?.apiKeys.openai ? 'Key configured' : 'Not configured'}
                </p>
              </div>
            </div>
            {health?.apiKeys.openai && (
              <button
                onClick={() => handleDeleteKey('openai')}
                className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </section>

      {/* System Health Section */}
      <section className="mb-8">
        <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-6fb-green shrink-0">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          System Health
        </h2>
        <div className="bg-6fb-card border border-6fb-border rounded-xl p-5 space-y-3">
          {loading ? (
            <p className="text-sm text-6fb-text-muted animate-pulse">Checking system...</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <StatusDot ok={health?.deps.python ?? false} />
                <div>
                  <p className="text-sm text-white">Python 3.10+</p>
                  <p className="text-xs text-6fb-text-muted">Required for clip extraction</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusDot ok={health?.deps.ffmpeg ?? false} />
                <div>
                  <p className="text-sm text-white">FFmpeg</p>
                  <p className="text-xs text-6fb-text-muted">Required for video processing</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusDot ok={health?.deps.mediapipe ?? false} />
                <div>
                  <p className="text-sm text-white">MediaPipe</p>
                  <p className="text-xs text-6fb-text-muted">Face tracking & pose estimation</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusDot ok={health?.deps.clipExtractor ?? false} />
                <div>
                  <p className="text-sm text-white">IX Clip Extractor</p>
                  <p className="text-xs text-6fb-text-muted truncate max-w-md">
                    {health?.paths.ixClipExtractor}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {health && !health.deps.python && (
          <p className="text-xs text-amber-400 mt-3 px-2">
            Install Python: <code className="bg-[#1e1e1e] px-1.5 py-0.5 rounded text-6fb-green">brew install python@3.11</code>
          </p>
        )}
        {health && !health.deps.ffmpeg && (
          <p className="text-xs text-amber-400 mt-1 px-2">
            Install FFmpeg: <code className="bg-[#1e1e1e] px-1.5 py-0.5 rounded text-6fb-green">brew install ffmpeg</code>
          </p>
        )}
        {health && !health.deps.mediapipe && (
          <p className="text-xs text-amber-400 mt-1 px-2">
            Install MediaPipe: <code className="bg-[#1e1e1e] px-1.5 py-0.5 rounded text-6fb-green">pip3 install mediapipe</code>
          </p>
        )}
      </section>

      {/* Storage Section */}
      <section className="mb-8">
        <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-6fb-green shrink-0">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Storage
        </h2>
        <div className="bg-6fb-card border border-6fb-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">App Data</p>
              <p className="text-xs text-6fb-text-muted truncate max-w-md">
                {health?.paths.userData || '~/Library/Application Support/6fb-content-studio'}
              </p>
            </div>
            <button
              onClick={() => isElectron && api.openPath(health?.paths.userData || '')}
              className="text-xs text-6fb-green hover:text-green-300 px-3 py-1.5 rounded-lg border border-6fb-green/20 hover:border-6fb-green/40 transition-colors"
            >
              Open Folder
            </button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="mb-8">
        <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-6fb-green shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          About
        </h2>
        <div className="bg-6fb-card border border-6fb-border rounded-xl p-5 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-6fb-text-muted">Version</span>
            <span className="text-sm text-white font-mono">1.1.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-6fb-text-muted">Platform</span>
            <span className="text-sm text-white font-mono">{isElectron ? 'Electron Desktop' : 'Browser (Dev Mode)'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-6fb-text-muted">Engine</span>
            <span className="text-sm text-white font-mono">IX v2.0</span>
          </div>
        </div>
      </section>

      {/* 6FB Account Section */}
      <section className="mb-8">
        <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-6fb-green shrink-0">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          6FB Account
        </h2>
        <div className="bg-6fb-card border border-6fb-border rounded-xl p-5">
          {!account?.connected ? (
            <div className="space-y-3">
              <p className="text-xs text-6fb-text-muted mb-3">Sign in with your Content Manager account to sync your Instagram credentials automatically.</p>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="Email"
                className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-white text-sm placeholder-6fb-text-muted focus:outline-none focus:border-6fb-green transition-colors"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="Password"
                onKeyDown={e => e.key === 'Enter' && handleLogin6FB()}
                className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-white text-sm placeholder-6fb-text-muted focus:outline-none focus:border-6fb-green transition-colors"
              />
              {loginError && <p className="text-xs text-red-400">{loginError}</p>}
              <button
                onClick={handleLogin6FB}
                disabled={loginLoading || !loginEmail.trim() || !loginPassword.trim()}
                className="w-full bg-6fb-green hover:bg-6fb-green-hover disabled:bg-6fb-border disabled:text-6fb-text-muted text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {loginLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">{account.email}</p>
                  <p className="text-xs text-6fb-text-muted">Connected to Content Manager</p>
                </div>
                <button onClick={handleDisconnect6FB} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors">
                  Disconnect
                </button>
              </div>
              <div className="border-t border-6fb-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">Instagram</p>
                    <p className="text-xs text-6fb-text-muted">
                      {account.igUsername ? `@${account.igUsername}` : 'Not synced'}
                      {account.igTokenExpiresAt && (
                        <span className="ml-2 text-6fb-text-muted/60">
                          · expires {new Date(account.igTokenExpiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={handleSyncInstagram}
                    disabled={syncLoading}
                    className="text-xs bg-6fb-green/10 text-6fb-green px-3 py-1.5 rounded-lg hover:bg-6fb-green/20 transition-colors font-medium border border-6fb-green/20 disabled:opacity-50"
                  >
                    {syncLoading ? 'Syncing...' : account.igUsername ? 'Re-sync' : 'Sync Instagram'}
                  </button>
                </div>
                {syncMsg && <p className={`text-xs mt-2 ${syncMsg.startsWith('Connected') ? 'text-6fb-green' : 'text-red-400'}`}>{syncMsg}</p>}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <h2 className="text-base sm:text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Danger Zone
        </h2>
        <div className="bg-6fb-card border border-red-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Reset App</p>
              <p className="text-xs text-6fb-text-muted">Remove all settings, API keys, and local data</p>
            </div>
            <button
              onClick={handleReset}
              className={`text-xs px-4 py-2 rounded-lg font-medium transition-all ${
                resetConfirm
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'text-red-400 border border-red-500/20 hover:border-red-500/40'
              }`}
            >
              {resetConfirm ? 'Confirm Reset' : 'Reset'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
