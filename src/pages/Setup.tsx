import { useState } from 'react';

interface SetupProps {
  onComplete: () => void;
}

// ─── SVG Icons (no emojis) ────────────────────────────────────────
const SetupIcons = {
  Scissors: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
      <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>
      <line x1="8.12" y1="8.12" x2="12" y2="12"/>
    </svg>
  ),
  Carousel: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="5" y="3" width="14" height="18" rx="2"/>
      <line x1="1" y1="6" x2="1" y2="18"/><line x1="23" y1="6" x2="23" y2="18"/>
    </svg>
  ),
  Video: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  Share: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  Key: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  ),
  Lock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Link: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
};

const FEATURES = [
  { Icon: SetupIcons.Scissors, text: 'Turn long videos into short-form clip candidates', color: '#8B5CF6' },
  { Icon: SetupIcons.Carousel, text: 'Create branded carousel posts from your ideas and clips', color: '#00C851' },
  { Icon: SetupIcons.Video, text: 'Preview, trim, and prepare clips for posting', color: '#EC4899' },
  { Icon: SetupIcons.Share, text: 'Connect 6FB tools for planner and scheduler handoff', color: '#3B82F6' },
];

export default function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');

    if (!apiKey.startsWith('sk-ant-')) {
      setError('Claude keys start with "sk-ant-". Check your key.');
      return;
    }
    if (apiKey.length < 20) {
      setError('Key seems too short. Paste the full key.');
      return;
    }

    setSaving(true);
    try {
      await window.electronAPI.saveApiKey('claude', apiKey);
      await window.electronAPI.completeSetup();
      onComplete();
    } catch {
      setError('Failed to save. Try again.');
    }
    setSaving(false);
  };

  return (
    <div className="h-screen bg-6fb-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center">
            <img
              src="/content-playbook.png"
              alt="6FB Content Studio"
              className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl object-contain mb-6"
            />
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Welcome to<br />
              <span className="text-6fb-green">6FB Content Studio</span>
            </h1>
            <p className="text-6fb-text-secondary text-sm mb-8 leading-relaxed">
              A focused content workflow for barbers.<br />
              Start with your brand, extract clips, then turn the best ideas into posts.
            </p>

            <div className="space-y-2.5 text-left mb-8">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-6fb-card rounded-lg px-4 py-3 border border-6fb-border">
                  <div className="w-5 h-5 shrink-0" style={{ color: f.color }}>
                    <f.Icon />
                  </div>
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
            <button onClick={() => setStep(0)} className="text-6fb-text-muted text-sm mb-6 hover:text-white transition-colors flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back
            </button>

            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-6fb-card border border-6fb-border flex items-center justify-center mb-4 text-6fb-green">
              <div className="w-6 h-6">
                <SetupIcons.Key />
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Connect Claude</h2>
            <p className="text-sm text-6fb-text-secondary mb-6">
              Your Claude key is stored locally and used only for AI generation requests you start.
            </p>

            <label className="text-xs font-bold text-6fb-text-muted uppercase tracking-wider mb-2 block">
              Supported AI Provider
            </label>
            <div className="mb-5 rounded-lg border border-6fb-green/30 bg-6fb-green/10 px-4 py-3 flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-6fb-green mt-2 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Claude is the production provider for this release.</p>
                <p className="text-xs text-6fb-text-muted mt-0.5">Claude powers clip, carousel, and blog generation in the student pilot.</p>
              </div>
            </div>

            {/* Key Input */}
            <label className="text-xs font-bold text-6fb-text-muted uppercase tracking-wider mb-2 block">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setError(''); }}
              placeholder="sk-ant-api03-..."
              className="w-full bg-6fb-card border border-6fb-border rounded-lg px-4 py-3 text-white text-sm placeholder-6fb-text-muted focus:outline-none focus:border-6fb-green transition-colors mb-2"
            />
            <p className="text-[11px] text-6fb-text-muted mb-5 flex items-center gap-1.5">
              <span className="w-3 h-3 shrink-0 text-6fb-green"><SetupIcons.Link /></span>
              Get your key: <a href="https://console.anthropic.com" target="_blank" className="text-6fb-green hover:underline">console.anthropic.com</a>
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
              {saving ? 'Saving...' : 'Save Claude Key & Launch Studio'}
            </button>

            <p className="text-[10px] text-6fb-text-muted text-center mt-4 flex items-center justify-center gap-1.5">
              <span className="w-3 h-3 shrink-0"><SetupIcons.Lock /></span>
              Stored locally via electron-store. The app never sends your key to 6FB.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
