import { useState, useEffect, type FormEvent } from 'react';

const YOUTUBE_POLICY_LINKS = [
  { label: '6FB Privacy', url: 'https://6fbmentorship.com/privacy' },
  { label: '6FB Terms', url: 'https://6fbmentorship.com/terms' },
  { label: 'YouTube Terms', url: 'https://www.youtube.com/t/terms' },
  { label: 'Google Privacy', url: 'https://policies.google.com/privacy' },
] as const;

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
    ffprobe: boolean;
    mediapipe: boolean;
    clipExtractor: boolean;
  };
  paths: {
    userData: string;
    clipExtractor: string;
    pipelineScript?: string;
    binaryPath?: string;
    toolsDir?: string;
    ffmpegPath?: string;
    ffprobePath?: string;
    pythonPath?: string;
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  // API Keys
  const [account, setAccount] = useState<SixFBAccount | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [browserLoginLoading, setBrowserLoginLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [youtubeConsentAccepted, setYouTubeConsentAccepted] = useState(false);
  const [youtubeConsentSaving, setYouTubeConsentSaving] = useState(false);
  const [youtubeMsg, setYouTubeMsg] = useState('');
  const [appVersion, setAppVersion] = useState('...');
  const [openAIKey, setOpenAIKey] = useState('');
  const [openAIKeyError, setOpenAIKeyError] = useState('');
  const [savingOpenAIKey, setSavingOpenAIKey] = useState(false);

  const api = (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => Promise<unknown>> }).electronAPI;
  const isElectron = !!api?.checkSystemHealth;

  useEffect(() => {
    if (isElectron) {
      (api.getAppVersion() as Promise<string>).then(setAppVersion).catch(() => setAppVersion('1.x.x'));
      (api.checkSystemHealth() as Promise<SystemHealth>).then((h) => {
        setHealth(h);
        setLoading(false);
      }).catch(() => setLoading(false));
      (api.get6FBAccount() as Promise<SixFBAccount>).then(setAccount).catch(() => {});
      (api.getYouTubeTrendsConsent() as Promise<{ accepted: boolean }>).then(result => {
        setYouTubeConsentAccepted(result.accepted);
      }).catch(() => {});
      const onBrowserLoginComplete = api.on6FBBrowserLoginComplete as unknown as ((callback: (result: { success: boolean; email?: string; error?: string }) => void) => () => void) | undefined;
      const unsubscribe = onBrowserLoginComplete?.((result) => {
        setBrowserLoginLoading(false);
        if (result.success) {
          setLoginError('');
          (api.get6FBAccount() as Promise<SixFBAccount>).then(setAccount).catch(() => {});
        } else {
          setLoginError(result.error || 'Browser sign-in failed.');
        }
      });
      return () => unsubscribe?.();
    } else {
      setHealth({
        deps: { python: false, ffmpeg: false, ffprobe: false, mediapipe: false, clipExtractor: false },
        paths: { userData: '~/Library/Application Support/6fb-content-studio', clipExtractor: 'Bundled with packaged app' },
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

  const handleBrowserLogin = async () => {
    setBrowserLoginLoading(true);
    setLoginError('');
    try {
      const result = await api.start6FBBrowserLogin() as { success: boolean; error?: string };
      if (!result.success) {
        setBrowserLoginLoading(false);
        setLoginError(result.error || 'Could not open browser sign-in.');
      }
    } catch {
      setBrowserLoginLoading(false);
      setLoginError('Could not open browser sign-in.');
    }
  };

  const handleCancelBrowserLogin = async () => {
    await api.cancel6FBBrowserLogin();
    setBrowserLoginLoading(false);
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
    try {
      const h = await api.checkSystemHealth() as SystemHealth;
      setHealth(h);
    } catch {
      // The mutation already succeeded; a health-refresh failure must not undo it.
    }
  };

  const handleYouTubeConsent = async (accepted: boolean) => {
    setYouTubeConsentSaving(true);
    setYouTubeMsg('');
    try {
      const result = await api.setYouTubeTrendsConsent(accepted) as { success: boolean; error?: string };
      if (!result.success) {
        setYouTubeMsg(result.error || 'Could not update YouTube inspiration consent.');
      } else {
        setYouTubeConsentAccepted(accepted);
        setYouTubeMsg(accepted
          ? 'YouTube inspiration enabled for Find live trends.'
          : 'YouTube discovery disabled and its local cache cleared.');
      }
    } catch {
      setYouTubeMsg('Could not update YouTube inspiration consent.');
    }
    setYouTubeConsentSaving(false);
  };

  const handleSaveOpenAIKey = async (event: FormEvent) => {
    event.preventDefault();
    const key = openAIKey.trim();
    if (!key.startsWith('sk-') || key.length < 20) {
      setOpenAIKeyError('Enter a valid OpenAI API key beginning with sk-.');
      return;
    }
    setSavingOpenAIKey(true);
    setOpenAIKeyError('');
    try {
      const result = await api.saveApiKey('openai', key) as { success: boolean; error?: string };
      if (!result.success) {
        setOpenAIKeyError(result.error || 'The OpenAI API key could not be saved.');
        return;
      }
      setOpenAIKey('');
      setHealth(await api.checkSystemHealth() as SystemHealth);
    } catch {
      setOpenAIKeyError('The OpenAI API key could not be saved.');
    } finally {
      setSavingOpenAIKey(false);
    }
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
  const hasBundledRuntime = !!(health?.paths.binaryPath || health?.paths.pipelineScript);

  const accountAndConnections = (
    <section className="mb-8" aria-labelledby="account-connections-heading">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="account-connections-heading" className="flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-6fb-green" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            Account & connections
          </h2>
          <p className="mt-1 text-xs text-6fb-text-muted">Connect once to bring your plan and professional accounts into Content Studio.</p>
        </div>
        {account?.connected && <span className="inline-flex items-center gap-2 text-xs font-semibold text-6fb-green"><StatusDot ok /> Connected</span>}
      </div>
      <div className="rounded-xl border border-6fb-border bg-6fb-card p-5">
        {!account?.connected ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-white">Sign in to 6FB</p>
              <p className="mt-1 text-xs leading-relaxed text-6fb-text-muted">Use the browser where you are already signed in. Content Studio will return here when the connection is complete.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleBrowserLogin()}
              disabled={browserLoginLoading || loginLoading}
              className="min-h-11 w-full rounded-lg bg-6fb-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-6fb-green-hover disabled:bg-6fb-border disabled:text-6fb-text-muted"
            >
              {browserLoginLoading ? 'Waiting for browser sign-in...' : 'Sign in with 6FB'}
            </button>
            {browserLoginLoading && (
              <button type="button" onClick={() => void handleCancelBrowserLogin()} className="min-h-11 w-full rounded-lg text-xs text-6fb-text-muted transition-colors hover:text-white">
                Cancel browser sign-in
              </button>
            )}
            <details className="rounded-lg border border-6fb-border bg-6fb-bg/40 px-3">
              <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold text-6fb-text-secondary">Use email and password instead</summary>
              <form className="space-y-3 border-t border-6fb-border py-3" onSubmit={event => { event.preventDefault(); void handleLogin6FB(); }}>
                <input type="email" autoComplete="username" value={loginEmail} onChange={event => setLoginEmail(event.target.value)} placeholder="Email" className="min-h-11 w-full rounded-lg border border-6fb-border bg-6fb-bg px-3 py-2 text-sm text-white placeholder-6fb-text-muted focus:border-6fb-green focus:outline-none" />
                <input type="password" autoComplete="current-password" value={loginPassword} onChange={event => setLoginPassword(event.target.value)} placeholder="Password" className="min-h-11 w-full rounded-lg border border-6fb-border bg-6fb-bg px-3 py-2 text-sm text-white placeholder-6fb-text-muted focus:border-6fb-green focus:outline-none" />
                <button type="submit" disabled={loginLoading || !loginEmail.trim() || !loginPassword.trim()} className="min-h-11 w-full rounded-lg border border-6fb-green/30 px-4 py-2 text-sm font-semibold text-6fb-green transition-colors hover:border-6fb-green disabled:cursor-not-allowed disabled:opacity-50">
                  {loginLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            </details>
            {loginError && <p role="alert" className="text-xs text-red-400">{loginError}</p>}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-white">{account.email}</p>
                <p className="mt-1 text-xs text-6fb-text-muted">Your 6FB account is connected.</p>
              </div>
              <button onClick={handleDisconnect6FB} className="min-h-11 self-start rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 transition-colors hover:border-red-500/40 hover:text-red-300 sm:self-auto">
                Disconnect account
              </button>
            </div>
            <div className="border-t border-6fb-border pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-6fb-text-muted">Connected tools</h3>
              <div className="mt-3 grid gap-3">
                <div className="flex items-start gap-3 rounded-lg bg-6fb-bg/50 p-3">
                  <span className="mt-1"><StatusDot ok /></span>
                  <div>
                    <p className="text-sm font-medium text-white">Content Planner</p>
                    <p className="mt-1 text-xs leading-relaxed text-6fb-text-muted">Daily briefs and your week plan are ready to use as topic suggestions.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 rounded-lg border border-6fb-border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="mt-1"><StatusDot ok={Boolean(account.igUsername)} /></span>
                    <div>
                      <p className="text-sm font-medium text-white">Instagram</p>
                      <p className="mt-1 text-xs text-6fb-text-muted">
                        {account.igUsername ? `Connected as @${account.igUsername}` : 'Connect a professional Instagram account to unlock reach and engagement analytics.'}
                        {account.igTokenExpiresAt && <span className="text-6fb-text-muted/60"> · expires {new Date(account.igTokenExpiresAt).toLocaleDateString()}</span>}
                      </p>
                    </div>
                  </div>
                  <button onClick={handleSyncInstagram} disabled={syncLoading} className="min-h-11 rounded-lg border border-6fb-green/20 bg-6fb-green/10 px-3 py-1.5 text-xs font-medium text-6fb-green transition-colors hover:bg-6fb-green/20 disabled:opacity-50">
                    {syncLoading ? 'Syncing...' : account.igUsername ? 'Re-sync Instagram' : 'Sync Instagram'}
                  </button>
                </div>
                {syncMsg && <p role="status" className={`text-xs ${syncMsg.startsWith('Connected') ? 'text-6fb-green' : 'text-red-400'}`}>{syncMsg}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  const youtubeInspiration = (
    <section className="mb-8" aria-labelledby="youtube-inspiration-heading">
      <h2 id="youtube-inspiration-heading" className="mb-4 flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-6fb-green" aria-hidden="true">
          <path d="m10 8 6 4-6 4V8Z"/><rect x="3" y="5" width="18" height="14" rx="4"/>
        </svg>
        YouTube inspiration
      </h2>
      <div className="space-y-4 rounded-xl border border-6fb-border bg-6fb-card p-5">
        <div className="flex items-start gap-3">
          <span className="mt-1"><StatusDot ok={Boolean(account?.connected && youtubeConsentAccepted)} /></span>
          <div>
            <p className="text-sm font-medium text-white">{account?.connected ? youtubeConsentAccepted ? 'Enabled for this policy version' : 'Consent required' : '6FB sign-in required'}</p>
            <p className="mt-1 text-xs leading-relaxed text-6fb-text-muted">When you press Find live trends, 6FB may request public YouTube videos as inspiration references. Content Studio never connects to your private YouTube account.</p>
          </div>
        </div>
        {!youtubeConsentAccepted ? (
          <label className={`relative flex min-h-[44px] items-start gap-3 rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${account?.connected ? 'cursor-pointer border-6fb-border text-6fb-text-secondary hover:border-6fb-green/40' : 'cursor-not-allowed border-6fb-border/60 text-6fb-text-muted'}`}>
            <input type="checkbox" checked={false} disabled={!account?.connected || youtubeConsentSaving} onChange={event => { if (event.target.checked) void handleYouTubeConsent(true); }} className="absolute inset-0 h-full w-full cursor-inherit opacity-0" />
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-6fb-text-muted bg-6fb-bg" aria-hidden="true" />
            <span>I agree to enable public YouTube inspiration under the linked 6FB, YouTube, and Google terms and privacy policies.</span>
          </label>
        ) : (
          <button type="button" onClick={() => void handleYouTubeConsent(false)} disabled={youtubeConsentSaving} className="min-h-[44px] w-full rounded-lg border border-red-500/20 px-4 text-xs font-semibold text-red-300 transition-colors hover:border-red-500/40 hover:text-red-200 disabled:opacity-50 sm:w-auto">
            {youtubeConsentSaving ? 'Updating…' : 'Disable YouTube discovery'}
          </button>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="YouTube inspiration policies">
          {YOUTUBE_POLICY_LINKS.map(link => (
            <button key={link.url} type="button" onClick={() => void api.openTrendSource(link.url)} className="min-h-[44px] rounded-lg border border-6fb-border px-3 text-left text-xs font-semibold text-6fb-text-secondary transition-colors hover:border-6fb-green/40 hover:text-white">{link.label} ↗</button>
          ))}
        </div>
        {youtubeMsg && <p className={`text-xs ${youtubeMsg.startsWith('YouTube inspiration enabled') ? 'text-6fb-green' : 'text-amber-300'}`} role="status">{youtubeMsg}</p>}
      </div>
    </section>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
      <p className="text-6fb-text-muted mb-8">Manage your connected accounts and the tools that support your content workflow.</p>

      {accountAndConnections}
      {youtubeInspiration}

      <section className="mb-8" aria-labelledby="advanced-settings-heading">
        <button
          type="button"
          onClick={() => setShowAdvanced(current => !current)}
          aria-expanded={showAdvanced}
          aria-controls="advanced-settings-content"
          className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-6fb-border bg-6fb-card px-5 text-left transition-colors hover:border-6fb-green/40"
        >
          <span>
            <span id="advanced-settings-heading" className="block text-sm font-semibold text-white">Advanced settings</span>
            <span className="mt-1 block text-xs text-6fb-text-muted">API keys, storage, runtime health, app details, and reset.</span>
          </span>
          <span className="text-sm text-6fb-green" aria-hidden="true">{showAdvanced ? '−' : '+'}</span>
        </button>
      </section>

      {showAdvanced && <div id="advanced-settings-content">

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
                  {health?.apiKeys.claude ? 'Ready for clip, carousel, and blog generation' : 'Required for production AI generation'}
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

          <div className="border-t border-6fb-border pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <StatusDot ok={health?.apiKeys.openai ?? false} />
                <div>
                  <p className="text-sm font-medium text-white">OpenAI</p>
                  <p className="text-xs text-6fb-text-muted">
                    {health?.apiKeys.openai ? 'Ready for ChatGPT-powered Thumbnail Maker generation' : 'Required for Thumbnail Maker generation'}
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
            {!health?.apiKeys.openai && (
              <form onSubmit={handleSaveOpenAIKey} className="mt-4 pl-5 sm:pl-6">
                <label htmlFor="openai-api-key" className="mb-2 block text-xs font-semibold text-6fb-text-muted">OpenAI API key</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="openai-api-key"
                    type="password"
                    autoComplete="new-password"
                    value={openAIKey}
                    onChange={event => { setOpenAIKey(event.target.value); setOpenAIKeyError(''); }}
                    placeholder="sk-proj-..."
                    className="min-w-0 flex-1 rounded-lg border border-6fb-border bg-6fb-bg px-3 py-2 text-sm text-white placeholder:text-6fb-text-muted focus:border-6fb-green focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={savingOpenAIKey || !openAIKey.trim()}
                    className="rounded-lg bg-6fb-green px-4 py-2 text-xs font-bold text-black hover:bg-6fb-green-hover disabled:cursor-wait disabled:opacity-50"
                  >
                    {savingOpenAIKey ? 'Saving...' : 'Save key'}
                  </button>
                </div>
                {openAIKeyError && <p role="alert" className="mt-2 text-xs text-red-400">{openAIKeyError}</p>}
                <p className="mt-2 text-[11px] text-6fb-text-muted">Stored locally. API usage is billed separately from a ChatGPT subscription.</p>
              </form>
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
              <div className="flex items-center gap-3 pb-3 border-b border-6fb-border">
                <StatusDot ok={!!(health?.paths.binaryPath || health?.paths.pipelineScript)} />
                <div>
                  <p className="text-sm text-white">Bundled Extraction Runtime</p>
                  <p className="text-xs text-6fb-text-muted truncate max-w-md">
                    {health?.paths.binaryPath || health?.paths.pipelineScript || 'Not found'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusDot ok={hasBundledRuntime || (health?.deps.python ?? false)} />
                <div>
                  <p className="text-sm text-white">Python Runtime</p>
                  <p className="text-xs text-6fb-text-muted">Bundled in the signed app for students</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusDot ok={hasBundledRuntime || (health?.deps.ffmpeg ?? false)} />
                <div>
                  <p className="text-sm text-white">FFmpeg</p>
                  <p className="text-xs text-6fb-text-muted">Required for video processing and clip rendering</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusDot ok={hasBundledRuntime || (health?.deps.ffprobe ?? false)} />
                <div>
                  <p className="text-sm text-white">FFprobe</p>
                  <p className="text-xs text-6fb-text-muted">Required for video metadata</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusDot ok={hasBundledRuntime || (health?.deps.mediapipe ?? false)} />
                <div>
                  <p className="text-sm text-white">MediaPipe</p>
                  <p className="text-xs text-6fb-text-muted">Face tracking & pose estimation</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusDot ok={hasBundledRuntime || (health?.deps.clipExtractor ?? false)} />
                <div>
                  <p className="text-sm text-white">Clip Extractor Tools</p>
                  <p className="text-xs text-6fb-text-muted truncate max-w-md">
                    {health?.paths.clipExtractor}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {health && !hasBundledRuntime && !health.deps.python && (
          <p className="text-xs text-amber-400 mt-3 px-2">
            Install Python: <code className="bg-[#1e1e1e] px-1.5 py-0.5 rounded text-6fb-green">brew install python@3.11</code>
          </p>
        )}
        {health && !hasBundledRuntime && !health.deps.ffmpeg && (
          <p className="text-xs text-amber-400 mt-1 px-2">
            Install FFmpeg: <code className="bg-[#1e1e1e] px-1.5 py-0.5 rounded text-6fb-green">brew install ffmpeg</code>
          </p>
        )}
        {health && !hasBundledRuntime && !health.deps.ffprobe && (
          <p className="text-xs text-amber-400 mt-1 px-2">
            Install FFprobe: <code className="bg-[#1e1e1e] px-1.5 py-0.5 rounded text-6fb-green">brew install ffmpeg</code>
          </p>
        )}
        {health && !hasBundledRuntime && !health.deps.mediapipe && (
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
            <span className="text-sm text-white font-mono">{appVersion}</span>
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
      </div>}
    </div>
  );
}
