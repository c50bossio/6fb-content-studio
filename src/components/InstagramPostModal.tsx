import { useState, useEffect } from 'react';

interface Props {
  type: 'reel' | 'carousel';
  /** For reels: path to the MP4 file */
  filePath?: string;
  /** For carousels: paths to the exported PNG files */
  imagePaths?: string[];
  /** Pre-fill caption (clip title or carousel title) */
  defaultCaption?: string;
  onClose: () => void;
}

type PostState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

const SUGGESTED_TAGS: Record<string, string[]> = {
  reel: ['#barbershop', '#barberlife', '#haircutmotivation', '#6fbmentorship', '#barbercoach', '#barbergame', '#hairtutorial', '#barbertalk'],
  carousel: ['#barbertips', '#barbercoach', '#barberbusiness', '#6fbmentorship', '#barbereducation', '#haircuttips', '#masterbarber', '#barbersociety'],
};

const STEP_LABELS: Record<PostState, string> = {
  idle: '',
  uploading: 'Uploading to Instagram…',
  processing: 'Instagram is processing…',
  done: '✓ Posted successfully!',
  error: '',
};

export default function InstagramPostModal({ type, filePath, imagePaths, defaultCaption = '', onClose }: Props) {
  const [caption, setCaption] = useState(defaultCaption);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [state, setState] = useState<PostState>('idle');
  const [error, setError] = useState('');
  const [mediaId, setMediaId] = useState('');

  // Close on Escape (unless posting)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state !== 'uploading' && state !== 'processing') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [state, onClose]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  const fullCaption = [caption.trim(), [...selectedTags].join(' ')].filter(Boolean).join('\n\n');
  const charCount = fullCaption.length;

  const handlePost = async () => {
    setError('');
    setState('uploading');
    try {
      let result: { success: boolean; error?: string; mediaId?: string };

      if (type === 'reel' && filePath) {
        result = await (window as any).electronAPI.postReelToInstagram({ filePath, caption: fullCaption });
      } else if (type === 'carousel' && imagePaths?.length) {
        result = await (window as any).electronAPI.postCarouselToInstagram({ imagePaths, caption: fullCaption });
      } else {
        setState('error');
        setError('Missing file paths');
        return;
      }

      if (!result.success) {
        setState('error');
        setError(result.error || 'Unknown error');
        return;
      }

      setState('done');
      setMediaId(result.mediaId || '');
    } catch (e) {
      setState('error');
      setError(String(e));
    }
  };

  const isPosting = state === 'uploading' || state === 'processing';
  const isDone = state === 'done';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md"
      onClick={e => { if (e.target === e.currentTarget && !isPosting) onClose(); }}
    >
      <div className="w-[440px] max-w-[95vw] bg-[#111] border border-[#222] rounded-2xl overflow-hidden shadow-2xl"
        style={{ animation: 'slideUp 0.25s ease' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1c1c1c]">
          {/* IG gradient icon */}
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)' }}>
            <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-white">
              Post {type === 'reel' ? 'Reel' : 'Carousel'} to Instagram
            </h2>
            <p className="text-[10px] text-[#555]">
              {type === 'reel' ? 'Video will be posted as a Reel' : `${imagePaths?.length || 0} slides as carousel`}
            </p>
          </div>
          {!isPosting && (
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[#444] hover:text-white transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width="14" height="14">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">

          {isDone ? (
            /* Success state */
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,200,81,0.12)', border: '1px solid rgba(0,200,81,0.3)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <p className="text-base font-bold text-white">Posted!</p>
                <p className="text-xs text-[#555] mt-1">Your {type === 'reel' ? 'Reel' : 'carousel'} is live on Instagram</p>
                {mediaId && <p className="text-[10px] text-[#333] font-mono mt-2">ID: {mediaId}</p>}
              </div>
              <button onClick={onClose}
                className="mt-2 px-6 py-2 rounded-xl text-sm font-bold"
                style={{ background: '#00C851', color: '#000' }}>
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Caption */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-[#555] uppercase tracking-wider">Caption</label>
                  <span className={`text-[10px] font-mono ${charCount > 2100 ? 'text-red-400' : 'text-[#444]'}`}>
                    {charCount} / 2200
                  </span>
                </div>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  disabled={isPosting}
                  placeholder="Write your caption…"
                  rows={4}
                  className="w-full bg-black border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#333] resize-none focus:outline-none focus:border-[#00C851]/40 transition-colors disabled:opacity-50"
                />
              </div>

              {/* Hashtag suggestions */}
              <div>
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-wider mb-2">Suggested Hashtags</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_TAGS[type].map(tag => {
                    const active = selectedTags.has(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        disabled={isPosting}
                        className="text-[10px] px-2 py-1 rounded-lg border transition-colors disabled:opacity-50"
                        style={active ? {
                          background: 'rgba(0,200,81,0.12)',
                          color: '#00C851',
                          borderColor: 'rgba(0,200,81,0.3)',
                        } : {
                          background: 'transparent',
                          color: '#555',
                          borderColor: '#222',
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status */}
              {isPosting && (
                <div className="flex items-center gap-2.5 bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl px-4 py-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#00C851" strokeWidth={2} strokeLinecap="round"
                    className="animate-spin w-4 h-4 shrink-0">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  <p className="text-xs text-[#00C851]">{STEP_LABELS[state]}</p>
                </div>
              )}

              {/* Error */}
              {state === 'error' && (
                <div className="bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">
                  <p className="text-xs text-red-400 font-semibold mb-0.5">Post failed</p>
                  <p className="text-[10px] text-red-400/70">{error}</p>
                </div>
              )}

              {/* Action */}
              <button
                onClick={handlePost}
                disabled={isPosting || charCount > 2200}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)', color: 'white' }}
              >
                {isPosting ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      className="animate-spin w-4 h-4">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
                    </svg>
                    Posting…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="white" width="14" height="14">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                    </svg>
                    Post to Instagram
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
