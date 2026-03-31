import { useState } from 'react';
import type { Slide } from '../App';

export default function CarouselStudio() {
  const [topic, setTopic] = useState('');
  const [type, setType] = useState<'educational' | 'product'>('educational');
  const [keyPoints, setKeyPoints] = useState(['', '', '']);
  const [generating, setGenerating] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [error, setError] = useState('');

  const addKeyPoint = () => setKeyPoints([...keyPoints, '']);
  const removeKeyPoint = (i: number) => setKeyPoints(keyPoints.filter((_, idx) => idx !== i));
  const updateKeyPoint = (i: number, val: string) => {
    const updated = [...keyPoints];
    updated[i] = val;
    setKeyPoints(updated);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setError('');
    setSlides([]);

    const filledPoints = keyPoints.filter(p => p.trim());

    try {
      const result = await window.electronAPI.generateCarousel({
        topic,
        type,
        keyPoints: filledPoints,
      });

      if (result.success && result.slides) {
        setSlides(result.slides);
      } else {
        setError(result.error || 'Generation failed');
      }
    } catch {
      setError('Generation failed. Check your API key in Settings.');
    }

    setGenerating(false);
  };

  const handleDownload = () => {
    const text = slides.map(s =>
      `--- SLIDE ${s.slideNumber} (${s.slideType.toUpperCase()}) ---\n\n` +
      `HEADING: ${s.heading}\n\nBODY:\n${s.body}\n\n` +
      (s.visuals.length ? `VISUALS: ${s.visuals.join(', ')}\n\n` : '') +
      (s.designNotes ? `DESIGN: ${s.designNotes}\n` : '')
    ).join('\n\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carousel-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SLIDE_COLORS = {
    cover: { bg: 'from-6fb-green/20 to-6fb-card', badge: 'bg-6fb-green/20 text-6fb-green' },
    content: { bg: 'from-6fb-card to-6fb-bg', badge: 'bg-6fb-border text-6fb-text-muted' },
    cta: { bg: 'from-yellow-500/15 to-6fb-card', badge: 'bg-yellow-500/20 text-yellow-400' },
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-white">Carousel Generator</h1>
          <span className="px-2.5 py-1 bg-6fb-green/10 text-6fb-green text-[10px] font-bold uppercase tracking-wider rounded-full border border-6fb-green/20">
            AI Powered
          </span>
        </div>
        <p className="text-sm text-6fb-text-secondary">
          Fill in a topic, style, and key points. AI generates 5 slides in seconds.
        </p>
      </div>

      {/* Form */}
      <div className="bg-6fb-card rounded-2xl border border-6fb-border p-6 mb-6">
        {/* Topic */}
        <label className="text-xs font-bold text-6fb-text-muted uppercase tracking-wider mb-2 block">Topic</label>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. How to raise your prices without losing clients"
          className="w-full bg-6fb-bg border border-6fb-border rounded-lg px-4 py-3 text-white text-sm placeholder-6fb-text-muted focus:outline-none focus:border-6fb-green transition-colors mb-5"
        />

        {/* Style */}
        <label className="text-xs font-bold text-6fb-text-muted uppercase tracking-wider mb-2 block">Style</label>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {(['educational', 'product'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`py-3 rounded-lg border text-sm font-medium transition-all ${
                type === t
                  ? 'border-6fb-green bg-6fb-green/10 text-6fb-green'
                  : 'border-6fb-border bg-6fb-bg text-6fb-text-secondary hover:border-6fb-text-muted'
              }`}
            >
              {t === 'educational' ? '📚 Educational' : '📢 Product Announcement'}
            </button>
          ))}
        </div>

        {/* Key Points */}
        <label className="text-xs font-bold text-6fb-text-muted uppercase tracking-wider mb-2 block">Key Points</label>
        <div className="space-y-2 mb-4">
          {keyPoints.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={p}
                onChange={e => updateKeyPoint(i, e.target.value)}
                placeholder={`Point ${i + 1}`}
                className="flex-1 bg-6fb-bg border border-6fb-border rounded-lg px-4 py-2.5 text-white text-sm placeholder-6fb-text-muted focus:outline-none focus:border-6fb-green transition-colors"
              />
              {keyPoints.length > 1 && (
                <button onClick={() => removeKeyPoint(i)} className="text-6fb-text-muted hover:text-red-400 transition-colors px-2">✕</button>
              )}
            </div>
          ))}
        </div>
        {keyPoints.length < 6 && (
          <button onClick={addKeyPoint} className="text-xs text-6fb-green hover:text-6fb-green-hover transition-colors mb-5">
            + Add Key Point
          </button>
        )}

        {/* Generate */}
        <button
          onClick={handleGenerate}
          disabled={!topic.trim() || generating}
          className="w-full bg-6fb-green hover:bg-6fb-green-hover disabled:bg-6fb-border disabled:text-6fb-text-muted text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>✨ Generate Carousel</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Preview */}
      {slides.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">{slides.length} Slides Generated</h2>
            <button
              onClick={handleDownload}
              className="text-xs bg-6fb-card border border-6fb-border px-3 py-2 rounded-lg text-6fb-text-secondary hover:text-white transition-colors"
            >
              📥 Download Text
            </button>
          </div>

          <div className="grid grid-cols-5 gap-3 mb-6">
            {slides.map(slide => {
              const colors = SLIDE_COLORS[slide.slideType] || SLIDE_COLORS.content;
              return (
                <div key={slide.slideNumber} className={`bg-gradient-to-br ${colors.bg} rounded-xl border border-6fb-border p-4`}>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors.badge} inline-block mb-2`}>
                    {slide.slideType}
                  </span>
                  <h3 className="text-xs font-bold text-white mb-1 leading-tight">{slide.heading}</h3>
                  <p className="text-[10px] text-6fb-text-secondary leading-relaxed line-clamp-4">{slide.body}</p>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleGenerate}
            className="text-xs text-6fb-green hover:text-6fb-green-hover transition-colors"
          >
            🔄 Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
