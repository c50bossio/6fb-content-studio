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

export default function Settings() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetConfirm, setResetConfirm] = useState(false);

  const api = (window as unknown as { electronAPI: Record<string, (...args: unknown[]) => Promise<unknown>> }).electronAPI;
  const isElectron = !!api?.checkSystemHealth;

  useEffect(() => {
    if (isElectron) {
      (api.checkSystemHealth() as Promise<SystemHealth>).then((h) => {
        setHealth(h);
        setLoading(false);
      }).catch(() => setLoading(false));
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
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
      <p className="text-6fb-text-muted mb-8">Manage your API keys, check system health, and configure the studio.</p>

      {/* API Keys Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-6fb-green">🔑</span> API Keys
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
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-6fb-green">🩺</span> System Health
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
            💡 Install Python: <code className="bg-6fb-surface px-1.5 py-0.5 rounded text-6fb-green">brew install python@3.11</code>
          </p>
        )}
        {health && !health.deps.ffmpeg && (
          <p className="text-xs text-amber-400 mt-1 px-2">
            💡 Install FFmpeg: <code className="bg-6fb-surface px-1.5 py-0.5 rounded text-6fb-green">brew install ffmpeg</code>
          </p>
        )}
        {health && !health.deps.mediapipe && (
          <p className="text-xs text-amber-400 mt-1 px-2">
            💡 Install MediaPipe: <code className="bg-6fb-surface px-1.5 py-0.5 rounded text-6fb-green">pip3 install mediapipe</code>
          </p>
        )}
      </section>

      {/* Storage Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-6fb-green">📁</span> Storage
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
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-6fb-green">ℹ️</span> About
        </h2>
        <div className="bg-6fb-card border border-6fb-border rounded-xl p-5 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-6fb-text-muted">Version</span>
            <span className="text-sm text-white font-mono">1.0.0</span>
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
        <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
          <span>⚠️</span> Danger Zone
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
