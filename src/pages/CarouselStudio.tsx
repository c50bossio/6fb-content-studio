import { useState, useEffect, useCallback, useRef } from 'react';
import type { BrandProfile, CarouselSlide } from '../App';
import SlidePreview from '../components/carousel/SlidePreview';
import { toPng } from 'html-to-image';
import useGoogleFonts from '../hooks/useGoogleFonts';
import InstagramPostModal from '../components/InstagramPostModal';

interface Props {
  brandProfile: BrandProfile | null;
  onNavigateToBrand?: () => void;
  onCarouselCreated?: () => void;
  hasClaudeKey?: boolean;
}

interface LibraryClip {
  contentType?: string;
  thumbnailPath?: string;
  title?: string;
}

interface LibraryRun {
  runId: string;
  timestamp: number;
  sourceVideo: string;
  runPath: string;
  clips: LibraryClip[];
}

interface SavedDeck {
  id: string;
  title: string;
  slideCount: number;
  createdAt: string;
}

const DEFAULT_BRAND: BrandProfile = {
  brandName: '6FB Mentorship', primaryColor: '#00C851', accentColor: '#ffffff',
  backgroundColor: '#0f0f0f', fontPreset: 'clean-pro', headlineFont: 'Space Grotesk',
  bodyFont: 'Inter', layoutStyle: 'bold', tone: 'professional', logoPath: null,
};

const formatRelative = (ts: number | string) => {
  const d = Date.now() - (typeof ts === 'string' ? new Date(ts).getTime() : ts);
  if (d < 120000) return 'Just now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
};

const TEMPLATES: BrandProfile['layoutStyle'][] = ['bold', 'editorial', 'streetwear', 'luxury', 'data-forward', 'minimal'];

export default function CarouselStudio({ brandProfile, onNavigateToBrand, onCarouselCreated, hasClaudeKey }: Props) {
  // ── Local brand state so template switcher updates live ──
  const [localBrand, setLocalBrand] = useState<BrandProfile>(brandProfile ?? DEFAULT_BRAND);
  useEffect(() => { if (brandProfile) setLocalBrand(brandProfile); }, [brandProfile]);

  useGoogleFonts(localBrand.headlineFont, localBrand.bodyFont);

  const [mode, setMode] = useState<'extract' | 'manual'>('extract');
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentDeckId, setCurrentDeckId] = useState<string | null>(null);
  const [currentDeckTitle, setCurrentDeckTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportedPaths, setExportedPaths] = useState<string[]>([]);
  const [showIgModal, setShowIgModal] = useState(false);

  const exportContainerRef = useRef<HTMLDivElement>(null);

  // Manual
  const [topic, setTopic] = useState('');
  const [keyPoints, setKeyPoints] = useState(['', '', '']);

  // Extract
  const [library, setLibrary] = useState<LibraryRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<LibraryRun | null>(null);
  const [loadingLibrary, setLoadingLibrary] = useState(true);

  // Saved decks
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Frame extraction
  const [useFrames, setUseFrames] = useState(true);
  const [extractingFrames, setExtractingFrames] = useState(false);
  const [slideRatio, setSlideRatio] = useState<'4/3' | '4/5'>('4/5');

  const loadLibrary = useCallback(async () => {
    try {
      const result = await (window as any).electronAPI.scanLibrary();
      if (result?.runs) setLibrary(result.runs);
    } catch {}
    setLoadingLibrary(false);
  }, []);

  const loadDecks = useCallback(async () => {
    try {
      const result = await (window as any).electronAPI.listCarousels();
      if (result?.carousels) setSavedDecks(result.carousels);
    } catch {}
  }, []);

  useEffect(() => { loadLibrary(); loadDecks(); }, [loadLibrary, loadDecks]);

  // ── Template switcher — updates local state + persists ──
  const switchTemplate = (style: BrandProfile['layoutStyle']) => {
    const updated = { ...localBrand, layoutStyle: style };
    setLocalBrand(updated);
    window.electronAPI.saveBrandProfile(updated);
  };

  // ── Auto-match frames from clip thumbnails ──────────────────────
  const autoMatchFrames = async (generatedSlides: CarouselSlide[], runPath: string) => {
    const timestamps = generatedSlides.map(s => s.timestamp || '');

    setExtractingFrames(true);
    try {
      const result = await window.electronAPI.autoMatchCarouselFrames({
        runPath, timestamps,
      });
      if (result.success && result.frames) {
        return generatedSlides.map((s, i) => ({
          ...s, framePath: result.frames![i] || null,
        }));
      }
    } catch {}
    setExtractingFrames(false);
    return generatedSlides;
  };

  // ── Generation ────────────────────────────────────────────────────
  const handleExtract = async () => {
    if (!selectedRun) return;
    setLoading(true); setError(''); setSlides([]); setCurrentDeckId(null);
    try {
      const txResult = await window.electronAPI.readTranscript(selectedRun.runPath);
      if (!txResult.success || !txResult.transcript) {
        setError(txResult.error || 'No transcript found for this run.'); setLoading(false); return;
      }
      const contentType = selectedRun.clips[0]?.contentType || 'general';
      const result = await window.electronAPI.extractCarousel({
        transcript: txResult.transcript, brandProfile: localBrand, contentType,
      });
      if (result.success && result.slides) {
        let finalSlides = result.slides as CarouselSlide[];
        finalSlides = await autoMatchFrames(finalSlides, selectedRun.runPath);
        setSlides(finalSlides); setActiveSlide(0);
        setCurrentDeckTitle(selectedRun.sourceVideo || 'Untitled');
        setExtractingFrames(false);
        onCarouselCreated?.();
      } else { setError(result.error || 'Extraction failed'); }
    } catch { setError('Something went wrong. Check your Claude API key.'); }
    setLoading(false);
  };

  const handleManual = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setSlides([]); setCurrentDeckId(null);
    try {
      const result = await window.electronAPI.generateCarousel({
        topic, type: 'educational', keyPoints: keyPoints.filter(Boolean),
        brandProfile: localBrand,
      });
      if (result.success && result.slides) {
        const mapped: CarouselSlide[] = (result.slides as any[]).map((s: any, i: number) => ({
          slideNumber: i + 1,
          heading: s.heading || s.title || '',
          body: s.body || s.content || '',
          stat: s.stat || '',
          ctaText: s.ctaText || (s.slideType === 'cta' ? s.body : '') || '',
          slideType: s.slideType || (i === 0 ? 'cover' : i === (result.slides!.length - 1) ? 'cta' : 'content'),
        }));
        setSlides(mapped); setActiveSlide(0); setCurrentDeckTitle(topic);
        onCarouselCreated?.();
      } else { setError(result.error || 'Generation failed'); }
    } catch { setError('Something went wrong. Check your Claude API key.'); }
    setLoading(false);
  };

  // ── Save & Export ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!slides.length || saving) return;
    setSaving(true);
    try {
      const result = await window.electronAPI.saveCarousel({
        title: currentDeckTitle || 'Untitled Carousel', slides, brandSnapshot: localBrand,
      });
      if (result.success && result.id) { setCurrentDeckId(result.id); loadDecks(); setJustSaved(true); setTimeout(() => setJustSaved(false), 2500); }
    } catch {}
    setSaving(false);
  };

  const handleExport = async () => {
    if (!slides.length || !exportContainerRef.current || exporting) return;
    setExporting(true);
    try {
      const nodes = exportContainerRef.current.children;
      const dataUrls: string[] = [];
      const title = currentDeckTitle || 'Untitled';
      
      for (let i = 0; i < slides.length; i++) {
        const dataUrl = await toPng(nodes[i] as HTMLElement, {
           quality: 1.0, 
           pixelRatio: 1,
           style: { transform: 'scale(1)', transformOrigin: 'top left' },
        });
        dataUrls.push(dataUrl);
      }
      
      const res = await window.electronAPI.exportCarouselDeck(title, dataUrls);
      if (res.success) {
        // Store paths for Instagram posting
        if (res.savedPaths?.length) setExportedPaths(res.savedPaths);
        alert(`Successfully exported deck to:\n${res.folderPath}`);
      } else {
        alert('Export failed: ' + res.error);
      }
    } catch (err) {
      alert('Error rendering deck: ' + err);
    } finally {
      setExporting(false);
    }
  };

  const handleSwapFrame = async (index: number) => {
    const res = await window.electronAPI.selectImageFile();
    if (res && res.filePath) {
      setSlides(prev => prev.map((s, i) => i === index ? { ...s, framePath: res.filePath } : s));
    }
  };

  // ── Load ─────────────────────────────────────────────────────────
  const handleLoadDeck = async (deck: SavedDeck) => {
    try {
      const result = await (window as any).electronAPI.loadCarousel(deck.id);
      if (result.success && result.data) {
        setSlides(result.data.slides || []); setActiveSlide(0);
        setCurrentDeckId(deck.id); setCurrentDeckTitle(deck.title);
        if (result.data.brandSnapshot) setLocalBrand(result.data.brandSnapshot);
      }
    } catch {}
  };

  // ── Delete ───────────────────────────────────────────────────────
  const handleDeleteDeck = async (id: string) => {
    await (window as any).electronAPI.deleteCarousel(id);
    if (currentDeckId === id) { setSlides([]); setCurrentDeckId(null); }
    setConfirmDeleteId(null); loadDecks();
  };

  // ── Rename ───────────────────────────────────────────────────────
  const handleRename = async (id: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    await (window as any).electronAPI.renameCarousel(id, renameValue.trim());
    if (currentDeckId === id) setCurrentDeckTitle(renameValue.trim());
    setRenamingId(null); loadDecks();
  };

  // ── Run thumbnail helper ─────────────────────────────────────────
  const firstThumb = selectedRun?.clips?.find(c => c.thumbnailPath)?.thumbnailPath;
  const allThumbs = selectedRun?.clips?.filter(c => c.thumbnailPath).map(c => c.thumbnailPath!).slice(0, 4) ?? [];

  return (
    <>
    <div className="h-full flex overflow-hidden bg-[#0f0f0f]">

      {/* ═══ LEFT column ═══ */}
      <div className="w-[280px] shrink-0 border-r border-[#1a1a1a] flex flex-col">

        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[#1a1a1a]">
          <h1 className="text-sm font-bold text-white">Carousel Studio</h1>
          <button onClick={onNavigateToBrand}
            className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#444] hover:text-[#888] transition-colors">
            <div className="w-2 h-2 rounded-full" style={{ background: localBrand.primaryColor }} />
            <span>{localBrand.brandName}</span>
            <span className="text-[#333]">·</span>
            <span className="capitalize">{localBrand.layoutStyle}</span>
          </button>
        </div>

        {/* Mode tabs */}
        <div className="shrink-0 flex border-b border-[#1a1a1a]">
          {(['extract', 'manual'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${mode === m ? 'text-white border-b-2 border-[#00C851]' : 'text-[#444] hover:text-[#666]'}`}>
              {m === 'extract' ? 'From Video' : 'Manual'}
            </button>
          ))}
        </div>
        {/* Video frames toggle */}
        {mode === 'extract' && (
          <div className="shrink-0 px-3 py-2 border-b border-[#1a1a1a] flex items-center gap-2">
            <button onClick={() => setUseFrames(!useFrames)}
              className={`w-7 h-4 rounded-full transition-colors relative shrink-0 ${useFrames ? 'bg-[#00C851]' : 'bg-[#2a2a2a]'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${useFrames ? 'left-3.5' : 'left-0.5'}`} />
            </button>
            <span className="text-[10px] text-[#555]">
              {useFrames ? 'Video backgrounds on' : 'Video backgrounds off'}
            </span>
            {extractingFrames && (
              <span className="w-2.5 h-2.5 border border-[#333] border-t-[#00C851] rounded-full animate-spin ml-auto" />
            )}
          </div>
        )}

        {/* Scrollable area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {mode === 'extract' ? (
            <div className="p-3 space-y-2">
              {/* Selected run preview card */}
              {selectedRun && (
                <div className="rounded-xl border border-[#00C851]/30 bg-[#00C851]/5 p-3 mb-2">
                  {/* Thumbnail grid */}
                  {allThumbs.length > 0 ? (
                    <div className={`grid gap-1 mb-2 rounded-lg overflow-hidden ${allThumbs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {allThumbs.map((t, i) => (
                        <img key={i} src={`localfile://${t}`} alt=""
                          className="w-full aspect-video object-cover bg-[#111]"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ))}
                    </div>
                  ) : (
                    <div className="w-full aspect-video bg-[#111] rounded-lg mb-2 flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                      </svg>
                    </div>
                  )}
                  <p className="text-[11px] font-semibold text-white leading-snug">{selectedRun.sourceVideo || 'Untitled'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-[#00C851]">{selectedRun.clips.length} clips</span>
                    <span className="text-[#333]">·</span>
                    <span className="text-[9px] text-[#555]">{formatRelative(selectedRun.timestamp)}</span>
                    {selectedRun.clips[0]?.contentType && (
                      <>
                        <span className="text-[#333]">·</span>
                        <span className="text-[9px] text-[#555] capitalize">{selectedRun.clips[0].contentType}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Run list */}
              <p className="text-[9px] font-bold text-[#333] uppercase tracking-widest px-0.5 pb-1">Select Run</p>
              {loadingLibrary ? (
                <p className="text-[10px] text-[#333] px-1">Loading…</p>
              ) : library.length === 0 ? (
                <div className="py-6 px-4 bg-[#111] rounded-xl border border-[#222] flex flex-col items-center text-center mt-2">
                  <div className="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center mb-3">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#888]">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <p className="text-[11px] font-bold text-[#888]">Library Empty</p>
                  <p className="text-[10px] text-[#555] mt-1 leading-relaxed">No runs yet. Extract a video first to pull transcripts.</p>
                </div>
              ) : library.map(run => {
                const thumb = run.clips?.find(c => c.thumbnailPath)?.thumbnailPath;
                const isSelected = selectedRun?.runId === run.runId;
                return (
                  <button key={run.runId} onClick={() => setSelectedRun(run)}
                    className={`w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-xl border transition-all ${
                      isSelected ? 'border-[#00C851]/40 bg-[#00C851]/8' : 'border-transparent hover:bg-[#151515]'
                    }`}>
                    {/* Mini thumbnail */}
                    <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-[#111] flex items-center justify-center">
                      {thumb ? (
                        <img src={`localfile://${thumb}`} alt="" className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#2a2a2a" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-medium truncate ${isSelected ? 'text-white' : 'text-[#888]'}`}>
                        {run.sourceVideo || 'Untitled'}
                      </p>
                      <p className="text-[9px] text-[#444]">{formatRelative(run.timestamp)} · {run.clips.length} clips</p>
                    </div>
                    {isSelected && <div className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full bg-[#00C851]" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div>
                <label className="field-label">Topic</label>
                <input value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. How to raise your prices" className="field-input" />
              </div>
              <div>
                <label className="field-label">Key Points</label>
                {keyPoints.map((p, i) => (
                  <input key={i} value={p} onChange={e => setKeyPoints(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                    placeholder={`Point ${i + 1}`} className="field-input mb-1.5" />
                ))}
                <button onClick={() => setKeyPoints(prev => [...prev, ''])}
                  className="text-[10px] text-[#444] hover:text-[#00C851] transition-colors">+ Add point</button>
              </div>
            </div>
          )}

          {error && (
            <p className="mx-3 mb-3 text-[10px] text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Sticky generate button */}
        <div className="shrink-0 p-3 border-t border-[#1a1a1a]">
          {!hasClaudeKey ? (
            <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-red-500 shrink-0 mt-0.5">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
              <div>
                <p className="text-[11px] font-bold text-red-500">Claude API Key Required</p>
                <p className="text-[10px] text-red-400 mt-0.5 leading-relaxed">Please configure your API key in Settings to use the AI Carousel Generator.</p>
              </div>
            </div>
          ) : (
            <button onClick={mode === 'extract' ? handleExtract : handleManual}
              disabled={loading || (mode === 'extract' ? !selectedRun : !topic.trim())}
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-[#00C851] text-black hover:bg-[#00b548] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border border-black/30 border-t-black rounded-full animate-spin" />
                  {mode === 'extract' ? 'Reading transcript…' : 'Generating…'}
                </span>
              ) : 'Generate Carousel'}
            </button>
          )}
        </div>

        {/* Saved decks */}
        <div className="shrink-0 border-t border-[#1a1a1a]">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-[9px] font-bold text-[#2a2a2a] uppercase tracking-widest">Saved Decks</span>
            <span className="text-[9px] text-[#2a2a2a]">{savedDecks.length}</span>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {savedDecks.length === 0 ? (
              <div className="py-6 px-4 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-full bg-[#111] border border-[#222] flex items-center justify-center mb-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#444]">
                    <rect x="5" y="3" width="14" height="18" rx="2"/><line x1="1" y1="6" x2="1" y2="18"/><line x1="23" y1="6" x2="23" y2="18"/>
                  </svg>
                </div>
                <p className="text-[10px] font-bold text-[#666]">No saved decks</p>
                <p className="text-[9px] text-[#444] mt-0.5">Generate your first carousel above.</p>
              </div>
            ) : savedDecks.map(deck => (
              <div key={deck.id}
                className={`group/deck relative flex items-center gap-2 px-3 py-2 hover:bg-white/3 transition-colors cursor-pointer border-l-2 ${currentDeckId === deck.id ? 'border-[#00C851]' : 'border-transparent'}`}
                onClick={() => handleLoadDeck(deck)}>
                {renamingId === deck.id ? (
                  <input autoFocus value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(deck.id)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(deck.id); if (e.key === 'Escape') setRenamingId(null); }}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 bg-transparent text-[11px] text-white border-b border-[#00C851] outline-none pb-0.5" />
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[#888] truncate">{deck.title}</p>
                      <p className="text-[9px] text-[#333]">{deck.slideCount} slides · {formatRelative(deck.createdAt)}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover/deck:opacity-100 transition-opacity shrink-0">
                      <button onClick={e => { e.stopPropagation(); setRenamingId(deck.id); setRenameValue(deck.title); }}
                        className="w-5 h-5 flex items-center justify-center text-[#444] hover:text-white transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      {confirmDeleteId === deck.id ? (
                        <button onClick={e => { e.stopPropagation(); handleDeleteDeck(deck.id); }}
                          className="text-[9px] bg-red-900/60 text-red-300 px-1.5 rounded font-bold">Del?</button>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(deck.id); setTimeout(() => setConfirmDeleteId(null), 3000); }}
                          className="w-5 h-5 flex items-center justify-center text-[#444] hover:text-red-400 transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ RIGHT: Preview ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {slides.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-12">
            {loading ? (
              <>
                <div className="w-8 h-8 border-2 border-[#1e1e1e] border-t-[#00C851] rounded-full animate-spin mb-4" />
                <p className="text-sm text-[#555]">AI is writing your slides…</p>
                <p className="text-xs text-[#333] mt-1">
                  {selectedRun ? `Reading "${selectedRun.sourceVideo?.slice(0, 40)}…"` : `Topic: "${topic}"`}
                </p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 text-[#1e1e1e] mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                    <rect x="5" y="3" width="14" height="18" rx="2"/><line x1="1" y1="6" x2="1" y2="18"/><line x1="23" y1="6" x2="23" y2="18"/>
                  </svg>
                </div>
                <p className="text-sm text-[#444]">No slides yet</p>
                <p className="text-xs text-[#2a2a2a] mt-1">
                  {mode === 'extract' ? 'Select a video run, then hit Generate' : 'Enter a topic, then hit Generate'}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Toolbar */}
            <div className="shrink-0 border-b border-[#1a1a1a] px-4 py-2 flex items-center justify-between gap-3">
              <input value={currentDeckTitle} onChange={e => setCurrentDeckTitle(e.target.value)}
                className="bg-transparent text-sm font-semibold text-white border-b border-transparent hover:border-[#2a2a2a] focus:border-[#00C851] focus:outline-none transition-colors px-0.5 min-w-0 max-w-72"
                placeholder="Deck title…" />
              <div className="flex items-center gap-2 shrink-0">
                {/* Slide ratio toggle */}
                <div className="flex items-center bg-[#111] border border-[#222] rounded-lg overflow-hidden">
                  {(['4/3', '4/5'] as const).map(r => (
                    <button key={r} onClick={() => setSlideRatio(r)}
                      className={`text-[10px] font-bold px-2.5 py-1.5 transition-all ${
                        slideRatio === r ? 'bg-[#00C851] text-black' : 'text-[#555] hover:text-white'
                      }`}>
                      {r === '4/3' ? '4:3' : '4:5'}
                    </button>
                  ))}
                </div>
                <button onClick={handleExport} disabled={exporting || !slides.length}
                  className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-white hover:border-blue-500/50 hover:text-blue-400 transition-all disabled:opacity-40">
                  {exporting ? 'Exporting…' : 'Export PNGs'}
                </button>
                {exportedPaths.length >= 2 && (
                  <button
                    onClick={() => setShowIgModal(true)}
                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg text-white transition-all disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)' }}
                    title="Post carousel to Instagram">
                    <svg viewBox="0 0 24 24" fill="white" width="11" height="11">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                    </svg>
                    Post
                  </button>
                )}
                <button onClick={handleSave} disabled={saving || !slides.length}
                  className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                    justSaved ? 'border-[#00C851]/40 bg-[#00C851]/10 text-[#00C851]' : 'border-[#2a2a2a] bg-[#1a1a1a] text-white hover:border-[#3a3a3a]'
                  } disabled:opacity-40`}>
                  {justSaved ? 'Saved' : saving ? 'Saving…' : currentDeckId ? 'Update' : 'Save Deck'}
                </button>
              </div>
            </div>

            {/* Slide strip */}
            <div className="shrink-0 border-b border-[#1a1a1a] overflow-x-auto bg-[#0a0a0a]">
              <div className="flex gap-2 p-2.5">
                {slides.map((slide, i) => (
                  <div key={i} className="shrink-0 w-[55px]">
                    <SlidePreview slide={slide} brand={localBrand} slideIndex={i} totalSlides={slides.length}
                      isActive={activeSlide === i} onClick={() => setActiveSlide(i)} showVideoFrames={useFrames} ratio={slideRatio} />
                    <p className="text-[8px] text-center text-[#333] mt-1 truncate px-0.5">{slide.heading?.slice(0, 12) || `Slide ${i+1}`}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Active slide editor */}
            <div className="flex-1 overflow-auto p-5 flex gap-5">
              {/* Big preview + template picker */}
              <div className="shrink-0 w-[170px]">
                <SlidePreview slide={slides[activeSlide]} brand={localBrand} slideIndex={activeSlide} totalSlides={slides.length} isActive showVideoFrames={useFrames} ratio={slideRatio} />
                <div className="mt-3 grid grid-cols-3 gap-1">
                  {TEMPLATES.map(t => (
                    <button key={t} onClick={() => switchTemplate(t)}
                      className={`text-[9px] py-1 rounded-lg border capitalize transition-all ${
                        localBrand.layoutStyle === t
                          ? 'border-[#00C851]/50 bg-[#00C851]/10 text-[#00C851]'
                          : 'border-[#1e1e1e] text-[#444] hover:text-white hover:border-[#2a2a2a]'
                      }`}>
                      {t === 'data-forward' ? 'Data' : t}
                    </button>
                  ))}
                </div>
                <p className="text-[8px] text-[#2a2a2a] mt-1.5 text-center">Template</p>
              </div>

              {/* Fields editor */}
              <div className="flex-1 space-y-3 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: localBrand.primaryColor }}>
                    Slide {activeSlide + 1} of {slides.length}
                  </span>
                  <span className="text-[9px] text-[#333] capitalize">{slides[activeSlide].slideType}</span>
                </div>

                <div>
                  <label className="field-label">Heading</label>
                  <input value={slides[activeSlide].heading}
                    onChange={e => setSlides(prev => prev.map((s, i) => i === activeSlide ? { ...s, heading: e.target.value } : s))}
                    className="field-input" />
                </div>

                <div>
                  <label className="field-label">Body</label>
                  <textarea value={slides[activeSlide].body} rows={4} onChange={e => setSlides(prev => prev.map((s, i) => i === activeSlide ? { ...s, body: e.target.value } : s))}
                    className="field-input resize-none" />
                </div>

                <div>
                  <label className="field-label">Stat / Number</label>
                  <input value={slides[activeSlide].stat || ''}
                    onChange={e => setSlides(prev => prev.map((s, i) => i === activeSlide ? { ...s, stat: e.target.value } : s))}
                    placeholder="e.g. 73, $1,200, 34%" className="field-input" />
                </div>

                {slides[activeSlide].slideType === 'cta' && (
                  <div>
                    <label className="field-label">Call to Action</label>
                    <input value={slides[activeSlide].ctaText || ''}
                      onChange={e => setSlides(prev => prev.map((s, i) => i === activeSlide ? { ...s, ctaText: e.target.value } : s))}
                      placeholder="e.g. Follow for daily barber tips" className="field-input" />
                  </div>
                )}

                {/* Frame info */}
                <div>
                  <label className="field-label">Video Frame</label>
                  {slides[activeSlide].framePath ? (
                    <div className="flex items-center gap-2">
                      <img src={`localfile://${slides[activeSlide].framePath}`} alt=""
                        className="w-16 h-10 rounded-lg object-cover border border-[#2a2a2a]"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <div className="flex-1 min-w-0">
                        {slides[activeSlide].timestamp && (
                          <p className="text-[9px] text-[#555]">@ {slides[activeSlide].timestamp}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <button onClick={() => handleSwapFrame(activeSlide)}
                            className="text-[9px] text-[#00C851] hover:text-white transition-colors uppercase font-bold tracking-widest">
                            Replace Image
                          </button>
                          <button onClick={() => setSlides(prev => prev.map((s, i) => i === activeSlide ? { ...s, framePath: null } : s))}
                            className="text-[9px] text-red-500 hover:text-white transition-colors uppercase font-bold tracking-widest">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[9px] text-[#333]">
                      {slides[activeSlide].timestamp ? `Timestamp: ${slides[activeSlide].timestamp} — no frame extracted` : 'No frame — attach source video to enable'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Hidden DOM element for ultra-high-res 1080x1350 PNG EXPORTS */}
      <div className="fixed top-0 left-0 pointer-events-none" style={{ transform: 'translateX(-9999px) scale(1)' }}>
        <div ref={exportContainerRef} className="flex gap-4">
          {slides.map((slide, idx) => {
              const exportH = slideRatio === '4/3' ? 810 : 1350;
              return (
                <div key={`export-${idx}`} style={{ width: 1080, height: exportH }}>
                  <SlidePreview slide={slide} brand={localBrand} slideIndex={idx} totalSlides={slides.length} showVideoFrames={useFrames} ratio={slideRatio} />
                </div>
              );
            })}
        </div>
      </div>
    </div>

    {/* Instagram post modal */}
    {showIgModal && (
      <InstagramPostModal
        type="carousel"
        imagePaths={exportedPaths}
        defaultCaption={currentDeckTitle}
        onClose={() => setShowIgModal(false)}
      />
    )}
    </>
  );
}
