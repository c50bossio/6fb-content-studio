import { useState, useEffect, useCallback } from 'react';
import type { BrandProfile } from '../App';
import useGoogleFonts from '../hooks/useGoogleFonts';

interface BlogSection {
  id: string;
  heading: string;
  imageTimestamp: string;
  imagePath: string | null;
  body: string;
}

interface LibraryRun {
  runId: string;
  timestamp: number;
  sourceVideo: string;
  runPath: string;
  clips: { contentType?: string; thumbnailPath?: string }[];
}

interface SavedPost {
  id: string;
  title: string;
  sectionCount: number;
  createdAt: string;
}

interface Props {
  brandProfile: BrandProfile | null;
  onBlogCreated?: () => void;
  hasClaudeKey?: boolean;
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

export default function BlogWriter({ brandProfile, onBlogCreated, hasClaudeKey }: Props) {
  const [localBrand, setLocalBrand] = useState<BrandProfile>(brandProfile ?? DEFAULT_BRAND);
  useEffect(() => { if (brandProfile) setLocalBrand(brandProfile); }, [brandProfile]);
  const brand = localBrand;
  useGoogleFonts(brand.headlineFont, brand.bodyFont);

  // State
  const [title, setTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [sections, setSections] = useState<BlogSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);

  // Source selector
  const [libraryRuns, setLibraryRuns] = useState<LibraryRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<LibraryRun | null>(null);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);

  // Preview mode
  const [activeSection, setActiveSection] = useState(0);
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');

  // Load library + saved posts
  const loadLibrary = useCallback(async () => {
    try {
      const res = await window.electronAPI.scanLibrary();
      const data = res as { runs?: LibraryRun[] };
      if (data.runs) setLibraryRuns(data.runs);
    } catch {}
  }, []);

  const loadSavedPosts = useCallback(async () => {
    try {
      const res = await window.electronAPI.listBlogPosts();
      setSavedPosts(res.posts as SavedPost[]);
    } catch {}
  }, []);

  useEffect(() => { loadLibrary(); loadSavedPosts(); }, [loadLibrary, loadSavedPosts]);

  // Generate blog from transcript
  const handleGenerate = async () => {
    if (!selectedRun) return;
    setLoading(true); setError(''); setSections([]); setCurrentPostId(null);
    try {
      const txResult = await window.electronAPI.readTranscript(selectedRun.runPath);
      if (!txResult.success || !txResult.transcript) {
        setError(txResult.error || 'No transcript found.'); setLoading(false); return;
      }
      const contentType = selectedRun.clips[0]?.contentType || 'general';
      const result = await window.electronAPI.generateBlogPost({
        transcript: txResult.transcript, brandProfile: brand, contentType,
      });
      if (result.success && result.blogPost) {
        setTitle(result.blogPost.title);
        setMetaDescription(result.blogPost.metaDescription);

        // Auto-match images from clip thumbnails
        let blogSections = result.blogPost.sections;
        const imageTimestamps = blogSections.filter(s => s.imageTimestamp !== 'none').map(s => s.imageTimestamp);
        if (imageTimestamps.length > 0) {
          try {
            const frameResult = await window.electronAPI.autoMatchCarouselFrames({
              runPath: selectedRun.runPath,
              timestamps: imageTimestamps,
            });
            if (frameResult.success && frameResult.frames) {
              let frameIdx = 0;
              blogSections = blogSections.map(s => {
                if (s.imageTimestamp !== 'none' && frameResult.frames![frameIdx]) {
                  const updated = { ...s, imagePath: frameResult.frames![frameIdx] };
                  frameIdx++;
                  return updated;
                }
                return s;
              });
            }
          } catch {}
        }

        setSections(blogSections);
        setActiveSection(0);
        setTitle(result.blogPost.title);
        onBlogCreated?.();
      } else {
        setError(result.error || 'Generation failed.');
      }
    } catch { setError('Something went wrong. Check your Claude API key.'); }
    setLoading(false);
  };

  // Save
  const handleSave = async () => {
    if (!sections.length || saving) return;
    setSaving(true);
    try {
      const result = await window.electronAPI.saveBlogPost({
        title, metaDescription, sections, brandSnapshot: brand,
      });
      if (result.success && result.id) {
        setCurrentPostId(result.id); loadSavedPosts();
        setJustSaved(true); setTimeout(() => setJustSaved(false), 2500);
      }
    } catch {}
    setSaving(false);
  };

  // Export markdown
  const handleExport = async () => {
    if (!sections.length) return;
    try {
      const result = await window.electronAPI.exportBlogMarkdown({ title, metaDescription, sections });
      if (result.success) {
        alert(`Blog exported to:\n${result.filePath}`);
      } else {
        alert('Export failed: ' + result.error);
      }
    } catch (err) {
      alert('Export error: ' + err);
    }
  };

  // Load saved post
  const handleLoadPost = async (post: SavedPost) => {
    try {
      const res = await window.electronAPI.loadBlogPost(post.id);
      if (res.success && res.data) {
        const d = res.data as { title: string; metaDescription: string; sections: BlogSection[]; brandSnapshot?: BrandProfile };
        setTitle(d.title); setMetaDescription(d.metaDescription);
        setSections(d.sections); setCurrentPostId(post.id); setActiveSection(0);
        if (d.brandSnapshot) setLocalBrand(d.brandSnapshot);
      }
    } catch {}
  };

  // Swap image for a section
  const handleSwapImage = async (sectionIdx: number) => {
    const res = await window.electronAPI.selectImageFile();
    if (res && !res.cancelled && res.filePath) {
      setSections(prev => prev.map((s, i) => i === sectionIdx ? { ...s, imagePath: res.filePath! } : s));
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1a1a1a] bg-[#0f0f0f]">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-white">Blog Writer</h1>
          <div className="flex items-center bg-[#161616] rounded-lg border border-[#222] overflow-hidden">
            <button onClick={() => setViewMode('editor')}
              className={`px-3 py-1.5 text-[11px] font-bold transition-all ${viewMode === 'editor' ? 'bg-[#00C851]/10 text-[#00C851]' : 'text-[#666] hover:text-white'}`}>
              Editor
            </button>
            <button onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 text-[11px] font-bold transition-all ${viewMode === 'preview' ? 'bg-[#00C851]/10 text-[#00C851]' : 'text-[#666] hover:text-white'}`}>
              Preview
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={!sections.length}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-white hover:border-blue-500/50 hover:text-blue-400 transition-all disabled:opacity-40">
            Export .md
          </button>
          <button onClick={handleSave} disabled={saving || !sections.length}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
              justSaved ? 'border-[#00C851]/40 bg-[#00C851]/10 text-[#00C851]' : 'border-[#2a2a2a] bg-[#1a1a1a] text-white hover:border-[#3a3a3a]'
            } disabled:opacity-40`}>
            {justSaved ? 'Saved' : saving ? 'Saving...' : currentPostId ? 'Update' : 'Save Draft'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar: Source + Saved */}
        <div className="w-[240px] border-r border-[#1a1a1a] flex flex-col bg-[#0d0d0d]">  
          <div className="p-4 border-b border-[#1a1a1a]">
            <p className="text-[10px] text-[#555] uppercase tracking-widest font-bold mb-2">Source Video</p>
            <select
              value={selectedRun?.runId || ''}
              onChange={e => {
                const run = libraryRuns.find(r => r.runId === e.target.value);
                setSelectedRun(run || null);
              }}
              className="w-full bg-[#161616] border border-[#222] rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#00C851]/50"
            >
              <option value="">Select a run...</option>
              {libraryRuns.map(run => (
                <option key={run.runId} value={run.runId}>
                  {run.sourceVideo} ({run.clips.length} clips)
                </option>
              ))}
            </select>
            {!hasClaudeKey ? (
              <div className="w-full mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 flex items-start gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
                <div>
                  <p className="text-[10px] font-bold text-red-500">API Key Required</p>
                  <p className="text-[9px] text-red-400 mt-0.5 leading-tight">Configure in Settings first.</p>
                </div>
              </div>
            ) : (
              <button onClick={handleGenerate} disabled={!selectedRun || loading}
                className="w-full mt-3 py-2 rounded-lg text-xs font-bold bg-[#00C851] text-black hover:bg-[#00b548] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {loading ? 'Generating...' : 'Generate Blog Post'}
              </button>
            )}
          </div>

          {/* Saved drafts */}
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-[10px] text-[#555] uppercase tracking-widest font-bold mb-2 px-1">Saved Drafts</p>
            {savedPosts.length === 0 ? (
              <div className="py-4 px-3 flex flex-col items-center text-center mt-2">
                <div className="w-8 h-8 rounded-full bg-[#111] border border-[#222] flex items-center justify-center mb-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#444]">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <p className="text-[10px] font-bold text-[#666]">No drafts</p>
              </div>
            ) : (
              <div className="space-y-1">
                {savedPosts.map(post => (
                  <button key={post.id} onClick={() => handleLoadPost(post)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-all text-xs ${
                      currentPostId === post.id ? 'bg-[#00C851]/10 text-[#00C851]' : 'text-[#888] hover:text-white hover:bg-white/5'
                    }`}>
                    <p className="font-medium truncate">{post.title}</p>
                    <p className="text-[9px] text-[#444] mt-0.5">{post.sectionCount} sections · {formatRelative(post.createdAt)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">{error}</div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-10 h-10 border-2 border-[#222] border-t-[#00C851] rounded-full animate-spin" />
              <p className="text-sm text-[#555]">Writing your blog post...</p>
            </div>
          )}

          {!loading && sections.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-12 h-12 text-[#2a2a2a] mb-5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Blog Post Writer</h2>
              <p className="text-sm text-[#555] max-w-md">
                Select a clip extractor run from the sidebar, then hit Generate to transform your video transcript into a fully structured, SEO-ready blog post with images.
              </p>
            </div>
          )}

          {!loading && sections.length > 0 && viewMode === 'preview' && (
            <article className="max-w-2xl mx-auto px-8 py-10">
              <h1 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: `'${brand.headlineFont}', sans-serif` }}>
                {title}
              </h1>
              <p className="text-sm text-[#666] mb-8 italic" style={{ fontFamily: `'${brand.bodyFont}', sans-serif` }}>
                {metaDescription}
              </p>
              <div className="h-[2px] bg-gradient-to-r from-[#00C851] to-transparent mb-8" />
              {sections.map((section, idx) => (
                <div key={section.id} className="mb-10">
                  <h2 className="text-xl font-bold text-white mb-4" style={{ fontFamily: `'${brand.headlineFont}', sans-serif`, color: brand.primaryColor }}>
                    {section.heading}
                  </h2>
                  {section.imagePath && (
                    <img src={`localfile://${section.imagePath}`} alt={section.heading}
                      className="w-full rounded-xl mb-4 border border-[#222]" />
                  )}
                  <div className="text-sm text-[#ccc] leading-relaxed whitespace-pre-wrap" style={{ fontFamily: `'${brand.bodyFont}', sans-serif` }}>
                    {section.body}
                  </div>
                </div>
              ))}
            </article>
          )}

          {!loading && sections.length > 0 && viewMode === 'editor' && (
            <div className="max-w-3xl mx-auto px-8 py-6">
              {/* Title + Meta */}
              <div className="mb-6 space-y-3">
                <div>
                  <label className="text-[10px] text-[#555] uppercase tracking-widest font-bold mb-1 block">Blog Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)}
                    className="w-full bg-[#161616] border border-[#222] rounded-lg px-3 py-2.5 text-white text-lg font-bold focus:outline-none focus:border-[#00C851]/50 transition-colors"
                    placeholder="Enter blog title..." />
                </div>
                <div>
                  <label className="text-[10px] text-[#555] uppercase tracking-widest font-bold mb-1 block">Meta Description (SEO)</label>
                  <input value={metaDescription} onChange={e => setMetaDescription(e.target.value)}
                    className="w-full bg-[#161616] border border-[#222] rounded-lg px-3 py-2 text-[#aaa] text-xs focus:outline-none focus:border-[#00C851]/50 transition-colors"
                    placeholder="Short SEO description..." maxLength={160} />
                  <p className="text-[9px] text-[#333] mt-1 text-right">{metaDescription.length}/160</p>
                </div>
              </div>

              {/* Section tabs */}
              <div className="flex gap-1 mb-4 border-b border-[#1a1a1a] pb-3">
                {sections.map((s, idx) => (
                  <button key={s.id} onClick={() => setActiveSection(idx)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      activeSection === idx ? 'bg-[#00C851]/10 text-[#00C851] border border-[#00C851]/30' : 'text-[#555] hover:text-white border border-transparent'
                    }`}>
                    S{idx + 1}
                  </button>
                ))}
              </div>

              {/* Active section editor */}
              {sections[activeSection] && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-[#555] uppercase tracking-widest font-bold mb-1 block">Section Heading</label>
                    <input
                      value={sections[activeSection].heading}
                      onChange={e => setSections(prev => prev.map((s, i) => i === activeSection ? { ...s, heading: e.target.value } : s))}
                      className="w-full bg-[#161616] border border-[#222] rounded-lg px-3 py-2 text-white text-sm font-semibold focus:outline-none focus:border-[#00C851]/50 transition-colors" />
                  </div>

                  {/* Image */}
                  <div>
                    <label className="text-[10px] text-[#555] uppercase tracking-widest font-bold mb-1.5 block">Section Image</label>
                    {sections[activeSection].imagePath ? (
                      <div className="relative group">
                        <img src={`localfile://${sections[activeSection].imagePath}`} alt=""
                          className="w-full h-40 object-cover rounded-xl border border-[#222]" />
                        <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleSwapImage(activeSection)}
                            className="text-[9px] bg-black/70 text-[#00C851] px-2 py-1 rounded font-bold uppercase tracking-wider">
                            Replace
                          </button>
                          <button onClick={() => setSections(prev => prev.map((s, i) => i === activeSection ? { ...s, imagePath: null } : s))}
                            className="text-[9px] bg-black/70 text-red-400 px-2 py-1 rounded font-bold uppercase tracking-wider">
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => handleSwapImage(activeSection)}
                        className="w-full h-24 border-2 border-dashed border-[#222] rounded-xl flex items-center justify-center text-[#444] hover:text-white hover:border-[#00C851]/30 transition-all">
                        <span className="text-xs">+ Add image from video or upload</span>
                      </button>
                    )}
                  </div>

                  {/* Body */}
                  <div>
                    <label className="text-[10px] text-[#555] uppercase tracking-widest font-bold mb-1 block">Body Content</label>
                    <textarea
                      value={sections[activeSection].body}
                      onChange={e => setSections(prev => prev.map((s, i) => i === activeSection ? { ...s, body: e.target.value } : s))}
                      rows={12}
                      className="w-full bg-[#161616] border border-[#222] rounded-lg px-3 py-2.5 text-[#ccc] text-sm leading-relaxed focus:outline-none focus:border-[#00C851]/50 transition-colors resize-none"
                      placeholder="Write or edit this section..." />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
