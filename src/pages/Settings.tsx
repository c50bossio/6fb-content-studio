import { useState, useEffect } from 'react';

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

interface PublishingConfig {
  apiKey: string;
  userEmail: string;
  blobToken: string;
  configured: boolean;
}

export default function Settings() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetConfirm, setResetConfirm] = useState(false);

  // Publishing Bridge state
  const [pubConfig, setPubConfig] = useState<PublishingConfig>({ apiKey: '', userEmail: '', blobToken: '', configured: false });
  const [pubSaveStatus, setPubSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const api = (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => Promise<unknown>> }).electronAPI;
  const isElectron = !!api?.checkSystemHealth;

  useEffect(() => {
    if (isElectron) {
      (api.checkSystemHealth() as Promise<SystemHealth>).then((h) => {
        setHealth(h);
        setLoading(false);
      }).catch(() => setLoading(false));
      // Load publishing bridge config
      (api.getPublishingConfig() as Promise<PublishingConfig>).then((cfg) => {
        if (cfg) setPubConfig(cfg);
      }).catch(() => {});
    } else {
      // Browser mock
      setHealth({
        deps: { python: false, ffmpeg: false, mediapipe: false, clipExtractor: false },
        paths: { userData: '~/Library/Application Support/6fb-content-studio', ixClipExtractor: '~/clawd/projects/ix-social-media-manager/tools/clip_extractor' },
        apiKeys: { claude: true, openai: false },
      });
      setLoading(false);
    }
  }, []);

  const handleSavePublishingConfig = async () => {
    if (!isElectron) return;
    setPubSaveStatus('saving');
    try {
      await api.savePublishingConfig({ apiKey: pubConfig.apiKey, userEmail: pubConfig.userEmail, blobToken: pubConfig.blobToken });
      setPubSaveStatus('saved');
      setTimeout(() => setPubSaveStatus('idle'), 2500);
    } catch {
      setPubSaveStatus('error');
      setTimeout(() => setPubSaveStatus('idle'), 2500);
    }
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

  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const handleTestNotification = async () => {
    if (!isElectron) return;
    try {
      await api.notifyClipComplete({ clipCount: 2, title: 'Test Clip' });
      setNotificationStatus('sent');
      setTimeout(() => setNotificationStatus('idle'), 3000);
    } catch {
      setNotificationStatus('error');
      setTimeout(() => setNotificationStatus('idle'), 3000);
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

      {/* Notifications Section */}
      <section className="mb-8">
        <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-6fb-green shrink-0">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Notifications
        </h2>
        <div className="bg-6fb-card border border-6fb-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">macOS Push Notifications</p>
              <p className="text-xs text-6fb-text-muted">Get notified when your clips finish rendering</p>
            </div>
            <button
              id="test-notification-btn"
              onClick={handleTestNotification}
              disabled={!isElectron}
              className={`text-xs font-semibold px-4 py-2 rounded-lg border transition-all disabled:opacity-40 ${
                notificationStatus === 'sent'
                  ? 'border-6fb-green/40 bg-6fb-green/10 text-6fb-green'
                  : notificationStatus === 'error'
                  ? 'border-red-500/40 bg-red-500/10 text-red-400'
                  : 'border-6fb-border text-white hover:border-6fb-green/40 hover:text-6fb-green'
              }`}
            >
              {notificationStatus === 'sent' ? '✓ Notification Sent!' : notificationStatus === 'error' ? '✗ Failed' : 'Send Test Notification'}
            </button>
          </div>
          <div className="border-t border-6fb-border pt-4">
            <p className="text-xs text-6fb-text-muted mb-1">Discord User ID <span className="text-[#444]">(optional — for DM alerts via 6FB Mentorship)</span></p>
            <div className="flex gap-2">
              <input
                id="discord-user-id-input"
                type="text"
                placeholder="e.g. 123456789012345678"
                className="flex-1 bg-[#161616] border border-6fb-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#444] focus:outline-none focus:border-6fb-green/50 transition-colors font-mono"
                onChange={e => isElectron && (window as any).electronAPI.saveApiKey?.('discordUserId', e.target.value)}
              />
            </div>
            <p className="text-[10px] text-[#333] mt-1">Find your User ID: Discord → Settings → Advanced → Developer Mode → right-click your name</p>
          </div>
        </div>
      </section>

      {/* Publishing Bridge Section */}
      <section className="mb-8">
        <h2 className="text-base sm:text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-6fb-green shrink-0">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Publishing Bridge
          <span className={`ml-auto text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${pubConfig.configured ? 'bg-6fb-green/10 border border-6fb-green/30 text-6fb-green' : 'bg-white/5 border border-white/10 text-white/40'}`}>
            {pubConfig.configured ? '● Connected' : '○ Not Connected'}
          </span>
        </h2>
        <div className="bg-6fb-card border border-6fb-border rounded-xl p-5 space-y-4">
          <p className="text-xs text-6fb-text-muted">Connect to the 6FB Content Generator to push clips, carousels, and blog captions directly into your social scheduling queue.</p>
          
          <div>
            <label className="block text-xs font-medium text-6fb-text-secondary mb-1.5">Content Generator API Key</label>
            <input
              type="password"
              value={pubConfig.apiKey}
              onChange={e => setPubConfig(c => ({ ...c, apiKey: e.target.value }))}
              placeholder="EXTERNAL_API_KEY from content generator"
              className="w-full bg-[#161616] border border-6fb-border rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-6fb-green/50 font-mono transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-6fb-text-secondary mb-1.5">Your Account Email</label>
            <input
              type="email"
              value={pubConfig.userEmail}
              onChange={e => setPubConfig(c => ({ ...c, userEmail: e.target.value }))}
              placeholder="email@example.com"
              className="w-full bg-[#161616] border border-6fb-border rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-6fb-green/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-6fb-text-secondary mb-1.5">Vercel Blob Token</label>
            <input
              type="password"
              value={pubConfig.blobToken}
              onChange={e => setPubConfig(c => ({ ...c, blobToken: e.target.value }))}
              placeholder="vercel_blob_rw_..."
              className="w-full bg-[#161616] border border-6fb-border rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] focus:outline-none focus:border-6fb-green/50 font-mono transition-colors"
            />
          </div>

          <button
            onClick={handleSavePublishingConfig}
            disabled={!isElectron || pubSaveStatus === 'saving'}
            className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
              pubSaveStatus === 'saved' ? 'bg-6fb-green text-black' :
              pubSaveStatus === 'error' ? 'bg-red-600 text-white' :
              'bg-6fb-green/10 border border-6fb-green/30 text-6fb-green hover:bg-6fb-green/20'
            } disabled:opacity-40`}
          >
            {pubSaveStatus === 'saving' ? 'Saving...' : pubSaveStatus === 'saved' ? '✓ Saved!' : pubSaveStatus === 'error' ? '✗ Error' : 'Save Publishing Config'}
          </button>
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
