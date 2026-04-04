import { useState } from 'react';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  defaultCaption?: string;
  mediaType: 'image' | 'video' | 'carousel';
}

type ScheduleStatus = 'idle' | 'uploading' | 'scheduling' | 'done' | 'error';

export default function ScheduleModal({ isOpen, onClose, filePath, defaultCaption = '', mediaType }: ScheduleModalProps) {
  const [caption, setCaption] = useState(defaultCaption);
  const [hashtags, setHashtags] = useState('#barbershop #6figures #barber');
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [isTrial, setIsTrial] = useState(false);
  const [status, setStatus] = useState<ScheduleStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const api = (window as any).electronAPI;

  const handleSchedule = async () => {
    if (!caption.trim()) return;
    setStatus('uploading');
    setErrorMsg('');

    try {
      const scheduledFor = new Date(scheduleDate).toISOString();
      const hashtagList = hashtags.split(/[\s,]+/).filter(h => h.startsWith('#'));

      setStatus('scheduling');
      const result = await api.pushToScheduler({
        filePath,
        caption: caption.trim(),
        mediaType,
        scheduledFor,
        hashtags: hashtagList,
        isTrial: mediaType === 'video' ? isTrial : false,
      });

      if (result.success) {
        setStatus('done');
        setTimeout(() => { onClose(); setStatus('idle'); }, 2000);
      } else {
        setErrorMsg(result.error || 'Scheduling failed');
        setStatus('error');
      }
    } catch (err) {
      setErrorMsg(String(err));
      setStatus('error');
    }
  };

  if (!isOpen) return null;

  const busy = status === 'uploading' || status === 'scheduling';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!busy ? onClose : undefined} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#111] border border-[#222] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">📅</span>
            <div>
              <h3 className="text-sm font-bold text-white">Schedule Post</h3>
              <p className="text-[10px] text-[#555]">Push to Content Generator queue</p>
            </div>
          </div>
          <button onClick={onClose} disabled={busy}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#555] hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Caption */}
          <div>
            <label className="block text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">Caption</label>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={4}
              placeholder="Write your post caption..."
              className="w-full bg-[#161616] border border-[#222] rounded-xl px-3 py-2.5 text-xs text-white placeholder-[#3a3a3a] resize-none focus:outline-none focus:border-[#00C851]/40 transition-colors"
            />
            <p className="text-[9px] text-[#3a3a3a] mt-1 text-right">{caption.length}/2200</p>
          </div>

          {/* Hashtags */}
          <div>
            <label className="block text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">Hashtags</label>
            <input
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder="#barbershop #barber"
              className="w-full bg-[#161616] border border-[#222] rounded-xl px-3 py-2 text-xs text-[#00C851] placeholder-[#3a3a3a] focus:outline-none focus:border-[#00C851]/40 transition-colors font-mono"
            />
          </div>

          {/* Date/Time */}
          <div>
            <label className="block text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">Schedule For</label>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full bg-[#161616] border border-[#222] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00C851]/40 transition-colors [color-scheme:dark]"
            />
          </div>

          {/* Trial Reel toggle — video only */}
          {mediaType === 'video' && (
            <div className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
              isTrial
                ? 'border-purple-500/40 bg-purple-500/10'
                : 'border-[#1a1a1a] bg-[#0d0d0d] hover:border-[#2a2a2a]'
            }`} onClick={() => setIsTrial(!isTrial)}>
              {/* Toggle switch */}
              <div className={`relative shrink-0 w-8 h-4.5 mt-0.5 rounded-full transition-colors ${
                isTrial ? 'bg-purple-500' : 'bg-[#2a2a2a]'
              }`} style={{ width: 32, height: 18 }}>
                <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                  isTrial ? 'left-[14px]' : 'left-0.5'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <span>🧪</span> Trial Reel
                  {isTrial && <span className="text-[9px] font-bold text-purple-400 border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 rounded uppercase tracking-wide">Active</span>}
                </p>
                <p className="text-[10px] text-[#555] mt-0.5 leading-relaxed">
                  {isTrial
                    ? 'Will be shown to non-followers first. You can promote to your full feed after reviewing performance.'
                    : 'Post to your full audience. Toggle on to test with non-followers first.'}
                </p>
              </div>
            </div>
          )}

          {/* Platform */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl">
            <svg className="w-4 h-4 text-[#E1306C]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            <span className="text-xs text-white/60">Instagram</span>
            <span className="ml-auto text-[9px] text-[#00C851] font-semibold border border-[#00C851]/30 bg-[#00C851]/10 px-1.5 py-0.5 rounded">Connected via Content Generator</span>
          </div>

          {/* Error */}
          {status === 'error' && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-3 py-2">{errorMsg}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleSchedule}
            disabled={busy || !caption.trim() || status === 'done'}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
              status === 'done' ? 'bg-[#00C851] text-black' :
              status === 'error' ? 'bg-red-600/20 border border-red-500/30 text-red-400' :
              'bg-[#00C851] text-black hover:bg-[#00b548] disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {status === 'uploading' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Uploading file…
              </span>
            ) : status === 'scheduling' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Scheduling post…
              </span>
            ) : status === 'done' ? (
              '✓ Scheduled!'
            ) : (
              'Schedule Post'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
