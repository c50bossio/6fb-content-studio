import { useState } from 'react';

interface SetupProps {
  onComplete: () => void;
}

export default function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<'claude' | 'openai'>('claude');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');

    if (provider === 'claude' && !apiKey.startsWith('sk-ant-')) {
      setError('Claude keys start with "sk-ant-". Check your key.');
      return;
    }
    if (provider === 'openai' && !apiKey.startsWith('sk-')) {
      setError('OpenAI keys start with "sk-". Check your key.');
      return;
    }
    if (apiKey.length < 20) {
      setError('Key seems too short. Paste the full key.');
      return;
    }

    setSaving(true);
    try {
      await window.electronAPI.saveApiKey(provider, apiKey);
      await window.electronAPI.completeSetup();
      onComplete();
    } catch {
      setError('Failed to save. Try again.');
    }
    setSaving(false);
  };

  return (
    <div className="h-screen bg-6fb-bg flex items-center justify-center">
      <div className="w-full max-w-md px-8">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center">
            <img
              src="/content-playbook.png"
              alt="6FB Content Studio"
              className="w-20 h-20 mx-auto rounded-2xl object-contain mb-6"
            />
            <h1 className="text-3xl font-bold text-white mb-3">
              Welcome to<br />
              <span className="text-6fb-green">6FB Content Studio</span>
            </h1>
            <p className="text-6fb-text-secondary text-sm mb-8 leading-relaxed">
              Professional content tools for barbers.<br />
              Extract clips, create carousels, edit videos — all locally powered.
            </p>

            <div className="space-y-3 text-left mb-8">
              {[
                { icon: '✂️', text: 'AI-powered clip extraction from long videos' },
                { icon: '🎠', text: 'Instagram carousel generator' },
                { icon: '🎬', text: 'Remotion video editor with captions' },
                { icon: '📱', text: 'Multi-platform posting' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-6fb-card rounded-lg px-4 py-3 border border-6fb-border">
                  <span className="text-lg">{f.icon}</span>
                  <span className="text-sm text-6fb-text-secondary">{f.text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full bg-6fb-green hover:bg-6fb-green-hover text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Get Started
            </button>
          </div>
        )}

        {/* Step 1: API Key */}
        {step === 1 && (
          <div>
            <button onClick={() => setStep(0)} className="text-6fb-text-muted text-sm mb-6 hover:text-white transition-colors">
              ← Back
            </button>

            <div className="w-14 h-14 rounded-xl bg-6fb-card border border-6fb-border flex items-center justify-center mb-4">
              <span className="text-2xl">🔑</span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Connect Your AI</h2>
            <p className="text-sm text-6fb-text-secondary mb-6">
              Your API key is stored locally on your computer. It never leaves your machine.
            </p>

            {/* Provider Toggle */}
            <label className="text-xs font-bold text-6fb-text-muted uppercase tracking-wider mb-2 block">
              AI Provider
            </label>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {(['claude', 'openai'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => { setProvider(p); setApiKey(''); setError(''); }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-lg border text-sm font-medium transition-all ${
                    provider === p
                      ? 'border-6fb-green bg-6fb-green/10 text-6fb-green'
                      : 'border-6fb-border bg-6fb-card text-6fb-text-secondary hover:border-6fb-text-muted'
                  }`}
                >
                  {p === 'claude' ? '🟣 Claude' : '🟢 OpenAI'}
                </button>
              ))}
            </div>

            {/* Key Input */}
            <label className="text-xs font-bold text-6fb-text-muted uppercase tracking-wider mb-2 block">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setError(''); }}
              placeholder={provider === 'claude' ? 'sk-ant-api03-...' : 'sk-...'}
              className="w-full bg-6fb-card border border-6fb-border rounded-lg px-4 py-3 text-white text-sm placeholder-6fb-text-muted focus:outline-none focus:border-6fb-green transition-colors mb-2"
            />
            <p className="text-[11px] text-6fb-text-muted mb-5">
              🔗 Get your key: {provider === 'claude'
                ? <a href="https://console.anthropic.com" target="_blank" className="text-6fb-green hover:underline">console.anthropic.com</a>
                : <a href="https://platform.openai.com/api-keys" target="_blank" className="text-6fb-green hover:underline">platform.openai.com</a>
              }
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 mb-4">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={!apiKey || saving}
              className="w-full bg-6fb-green hover:bg-6fb-green-hover disabled:bg-6fb-border disabled:text-6fb-text-muted text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save & Launch Studio'}
            </button>

            <p className="text-[10px] text-6fb-text-muted text-center mt-4">
              🔒 Stored locally via electron-store. Your key never touches the internet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
