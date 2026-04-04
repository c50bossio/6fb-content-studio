import { useState, useEffect } from 'react';

interface PlanSection {
  type: 'hook' | 'body' | 'payoff';
  timerange: string;
  instruction: string;
  scriptIdea: string;
}

interface ShootPlan {
  title: string;
  sections: PlanSection[];
}

interface PlaybookTopic {
  id: string;
  title: string;
  pillar: string | null;
  contentType: string;
  scheduledFor: string;
}

interface Props {
  onPlanCreated?: () => void;
  hasClaudeKey?: boolean;
}

const DURATIONS = ['1 Minute', '3 Minutes', '5 Minutes', '10 Minutes', '20+ Minutes'];
const FORMATS = ['Vlog', 'Tutorial', 'Podcast', 'Talking Head', 'Interview', 'Behind the Scenes', 'Product Review', 'Listicle'];

export default function ContentPlanner({ onPlanCreated, hasClaudeKey }: Props) {
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('3 Minutes');
  const [format, setFormat] = useState('Talking Head');
  const [perspective, setPerspective] = useState('Shop Owner');
  
  const [useRag, setUseRag] = useState(false);
  const [targetLocation, setTargetLocation] = useState('');
  
  const [playbookTopics, setPlaybookTopics] = useState<PlaybookTopic[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<ShootPlan | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const api = window.electronAPI as typeof window.electronAPI & { fetchPlaybookTopics: () => Promise<PlaybookTopic[]> };
    if (api.fetchPlaybookTopics) {
      api.fetchPlaybookTopics()
        .then((topics) => {
          if (Array.isArray(topics)) setPlaybookTopics(topics);
        })
        .catch(() => {});
    }
  }, []);

  const handleCopy = async () => {
    if (!plan) return;
    
    let text = `# ${plan.title.toUpperCase()}\n\n`;
    plan.sections.forEach(sec => {
      text += `[${sec.timerange}] - ${sec.type.toUpperCase()}`;
      if (sec.type === 'hook' || sec.type === 'payoff') text += `  (🔥 AI DROP ZONE)`;
      text += `\n`;
      text += `DIRECTION: ${sec.instruction}\n`;
      text += `SCRIPT: "${sec.scriptIdea}"\n\n`;
      text += `-------------------------------------------\n\n`;
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleGenerate = async () => {
    if (!topic) return;
    setLoading(true);
    setError('');
    setPlan(null);

    try {
      const result = await window.electronAPI.generateVideoPlan({
        topic, type: format, duration, perspective, useRag, targetLocation
      });

      if (result.success && result.data) {
        setPlan(result.data as ShootPlan);
        onPlanCreated?.();
      } else {
        setError(result.error || 'Failed to generate shoot plan.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col pt-12 pb-20 overflow-y-auto w-full max-w-[1200px] mx-auto px-6 hide-scrollbar">
      <div className="w-full flex-1 grid grid-cols-12 gap-8 items-start">
        {/* Left Col: Setup */}
        <div className="col-span-4 sticky top-12">
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Video Planner</h2>
          <p className="text-sm text-6fb-text-muted mb-8 leading-relaxed">
            Structure your long-form videos with built-in AI Drop Zones to ensure maximum virality and perfect clip extraction afterwards.
          </p>

          <div className="bg-6fb-card border border-6fb-border rounded-xl p-5 shadow-sm mb-6">
            <h3 className="text-xs font-bold text-6fb-text-secondary uppercase tracking-wider mb-4">Configuration</h3>
            
            <div className="space-y-4">
              {playbookTopics.length > 0 && (
                <div className="mb-1">
                  <label className="block text-[10px] font-bold text-6fb-text-muted uppercase tracking-wider mb-2 ml-1">From Playbook</label>
                  <div className="flex flex-wrap gap-1.5">
                    {playbookTopics.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTopic(t.title)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-6fb-green/10 text-6fb-green border border-6fb-green/20 hover:bg-6fb-green/20 hover:border-6fb-green/40 transition-all truncate max-w-[200px]"
                        title={t.title}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-6fb-text-secondary mb-1.5 ml-1">Core Topic</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. 5 reasons why barbers fail in their first year..."
                  className="w-full h-24 bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-6fb-green/50 focus:ring-1 focus:ring-6fb-green/50 transition-all resize-none"
                />
              </div>

              <div>
                <label className="flex items-center text-xs font-semibold text-6fb-text-secondary mb-2 ml-1">
                  Creator Perspective
                  <div className="relative ml-1.5 group cursor-help">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-6fb-text-muted group-hover:text-white transition-colors">
                      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {/* Tooltip Popup */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-[#111] border border-6fb-border rounded-lg shadow-2xl text-[11px] leading-relaxed text-6fb-text-secondary opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 pointer-events-none">
                      Define the exact angle for the script. 
                      <span className="block mt-1.5 text-white">Examples:</span>
                      <ul className="list-disc pl-3 mt-0.5 space-y-0.5 opacity-80">
                        <li>"Shop owner hiring barbers"</li>
                        <li>"Solo barber building clientele"</li>
                        <li>"Educator selling courses"</li>
                      </ul>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-[5px] border-transparent border-t-[#111]" />
                    </div>
                  </div>
                </label>
                <input
                  type="text"
                  value={perspective}
                  onChange={(e) => setPerspective(e.target.value)}
                  placeholder="e.g. A solo barber building a brand..."
                  className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-6fb-green/50 focus:ring-1 focus:ring-6fb-green/50 transition-all mb-4"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-6fb-text-secondary mb-1.5 ml-1">Format Outline</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-6fb-green/50 appearance-none mb-4"
                >
                  {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-6fb-text-secondary mb-1.5 ml-1">Target Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-6fb-green/50 appearance-none"
                >
                  {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* RAG KNOWLEDGE ENGINE TOGGLE */}
              <div className="pt-4 border-t border-6fb-border">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-xs font-semibold text-6fb-text flex items-center gap-1.5 ml-1">
                    <svg className="w-3.5 h-3.5 text-6fb-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    6FB Knowledge Engine
                  </label>
                  <button
                    onClick={() => setUseRag(!useRag)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-6fb-green/20 ${useRag ? 'bg-6fb-green' : 'bg-white/10'}`}
                  >
                    <span className="sr-only">Use RAG</span>
                    <span aria-hidden="true" className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useRag ? 'translate-x-2' : '-translate-x-2'}`} />
                  </button>
                </div>
                
                {useRag && (
                  <div className="animate-fade-in pl-1">
                    <label className="block text-[10px] font-medium text-6fb-text-secondary mb-1">Target Market (City/Zip) - Live Data</label>
                    <input
                      type="text"
                      value={targetLocation}
                      onChange={(e) => setTargetLocation(e.target.value)}
                      placeholder="e.g. Miami, FL or 33132"
                      className="w-full bg-black/40 border border-6fb-border/60 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-6fb-green/50 transition-all"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!topic || loading || !hasClaudeKey}
            className={`w-full py-3 rounded-lg font-bold text-sm tracking-wide transition-all shadow-lg
              ${!topic || loading || !hasClaudeKey 
                ? 'bg-white/5 text-white/30 cursor-not-allowed shadow-none' 
                : 'bg-6fb-green text-[#052614] hover:bg-[#00e25b] hover:shadow-6fb-green/20'
              }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
                Architecting Plan...
              </span>
            ) : !hasClaudeKey ? 'Missing API Key' : 'Generate Shoot Plan'}
          </button>
          
          {error && <p className="mt-4 text-xs text-red-400 font-medium text-center bg-red-400/10 py-2 rounded-lg">{error}</p>}
        </div>

        {/* Right Col: Blueprint */}
        <div className="col-span-8 min-h-[500px]">
          {!plan && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center bg-6fb-card border border-6fb-border rounded-xl border-dashed">
              <div className="w-16 h-16 text-6fb-border mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full opacity-50">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No Plan Created</h3>
              <p className="text-sm text-6fb-text-muted max-w-[250px]">Fill out the details on the left to architect your video structure.</p>
            </div>
          )}

          {loading && (
            <div className="min-h-[400px] w-full flex flex-col items-center justify-center text-center bg-6fb-card border border-6fb-border rounded-xl relative overflow-hidden shadow-2xl">
              {/* Subtle background glow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-6fb-green/10 via-transparent to-transparent animate-pulse" style={{ animationDuration: '3s' }} />
              
              <div className="relative flex items-center justify-center w-24 h-24 mb-6">
                {/* Pulsing sonar rings */}
                <div className="absolute inset-0 border-[1.5px] border-6fb-green/30 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
                
                {/* Dual-sided dynamic spinner */}
                <div className="absolute w-16 h-16 border-[1.5px] border-6fb-green/20 border-t-6fb-green border-r-6fb-green rounded-full animate-spin shadow-[0_0_15px_rgba(0,200,81,0.3)]" style={{ animationDuration: '1.5s' }} />
                
                {/* Center Brain/Blueprint Icon */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white animate-pulse">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>

              <div className="relative z-10 px-8">
                <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Architecting Structure</h3>
                <p className="text-sm font-semibold text-6fb-green flex items-center justify-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-6fb-green shadow-[0_0_8px_rgba(0,200,81,0.8)] animate-pulse" />
                  Generating AI Drop Zones
                </p>
              </div>
            </div>
          )}

          {plan && !loading && (
            <div className="bg-[#121212] rounded-xl border border-6fb-border shadow-2xl overflow-hidden pb-8">
              <div className="bg-gradient-to-b from-[#1a1a1a] to-[#121212] px-8 py-6 border-b border-6fb-border/50 flex justify-between items-start">
                <div>
                  <strong className="text-[10px] uppercase tracking-[0.2em] font-bold text-6fb-green/80 flex items-center gap-2 mb-2">
                    <div className="w-1 h-1 rounded-full bg-6fb-green animate-pulse" /> Shoot Blueprint
                  </strong>
                  <h2 className="text-2xl font-black text-white tracking-tight">{plan.title}</h2>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#222] hover:bg-[#333] border border-6fb-border transition-colors text-sm font-semibold text-white"
                >
                  {copied ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-6fb-green"><polyline points="20 6 9 17 4 12" /></svg>
                      <span className="text-6fb-green">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-6fb-text-muted"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      Copy Script
                    </>
                  )}
                </button>
              </div>
              
              <div className="px-6 pt-6">
                <div className="space-y-4">
                  {plan.sections.map((sec, idx) => {
                    const isDropZone = sec.type === 'hook' || sec.type === 'payoff';
                    return (
                      <div 
                        key={idx} 
                        className={`relative rounded-xl p-5 border transition-all ${
                          isDropZone 
                            ? 'bg-[linear-gradient(135deg,rgba(0,200,81,0.03)_0%,transparent_100%)] border-6fb-green/30 shadow-[0_4px_24px_rgba(0,200,81,0.02)]' 
                            : 'bg-6fb-card border-6fb-border/50'
                        }`}
                      >
                        {isDropZone && (
                          <div className="absolute -top-2.5 -right-2.5">
                            <span className="bg-6fb-green text-[#052614] text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md shadow-[0_0_12px_rgba(0,200,81,0.4)]">
                              AI Drop Zone
                            </span>
                          </div>
                        )}
                        <div className="flex items-start gap-4">
                          <div className={`shrink-0 text-xs font-mono font-bold mt-0.5 ${isDropZone ? 'text-6fb-green' : 'text-6fb-text-muted'}`}>
                            {sec.timerange}
                          </div>
                          <div className="flex-1">
                            <h4 className={`text-xs font-black uppercase tracking-wider mb-2 ${isDropZone ? 'text-white' : 'text-6fb-text-secondary'}`}>
                              {sec.type}
                            </h4>
                            <p className="text-[13px] leading-relaxed text-white/90 mb-3 font-medium">
                              {sec.instruction}
                            </p>
                            <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                              <p className="text-xs text-6fb-text-muted font-mono leading-relaxed">
                                <span className="text-white/40 mr-2">{"//"}</span>{sec.scriptIdea}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
