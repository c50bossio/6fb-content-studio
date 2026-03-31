import { useState, useEffect } from 'react';

interface Clip {
  start: number;
  end: number;
  score: number;
  label: string;
  filePath?: string;
}

export default function ClipExtractor() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, label: '' });
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const cleanup = window.electronAPI.onProgress((data) => {
      setProgress(data);
    });
    return cleanup;
  }, []);

  const handleSelectVideo = async () => {
    const result = await window.electronAPI.selectVideo();
    if (!result.cancelled && result.filePath) {
      setVideoPath(result.filePath);
      setClips([]);
      setError('');
    }
  };

  const handleExtract = async () => {
    if (!videoPath) return;
    setProcessing(true);
    setError('');
    setProgress({ percent: 0, label: 'Starting clip extraction...' });

    try {
      const result = await window.electronAPI.extractClips(videoPath, {
        format: '9x16',
        autoTrack: true,
      });

      if (result.success && result.data) {
        const data = result.data as { clips: Clip[] };
        setClips(data.clips || []);
      } else {
        setError(result.error || 'Extraction failed');
      }
    } catch {
      setError('Extraction failed. Make sure Python and ffmpeg are installed.');
    }

    setProcessing(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-white">Clip Extractor</h1>
          <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-purple-500/20">
            AI Powered
          </span>
        </div>
        <p className="text-sm text-6fb-text-secondary">
          Upload a long video. AI selects the best moments and reframes to 9:16.
        </p>
      </div>

      {/* Video Selection */}
      {!videoPath ? (
        <button
          onClick={handleSelectVideo}
          className="w-full bg-6fb-card border-2 border-dashed border-6fb-border rounded-2xl p-12 flex flex-col items-center justify-center hover:border-6fb-green/50 hover:bg-6fb-green/5 transition-all group"
        >
          <div className="w-16 h-16 rounded-2xl bg-6fb-border/50 flex items-center justify-center mb-4 group-hover:bg-6fb-green/10 transition-colors">
            <span className="text-3xl">📹</span>
          </div>
          <p className="text-base font-semibold text-white mb-1">Select Video File</p>
          <p className="text-xs text-6fb-text-muted">MP4, MOV, AVI, MKV — any length</p>
        </button>
      ) : (
        <div>
          {/* Selected video info */}
          <div className="bg-6fb-card rounded-xl border border-6fb-border p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎥</span>
              <div>
                <p className="text-sm text-white font-medium truncate max-w-md">
                  {videoPath.split('/').pop()}
                </p>
                <p className="text-[11px] text-6fb-text-muted">{videoPath}</p>
              </div>
            </div>
            <button
              onClick={handleSelectVideo}
              className="text-xs text-6fb-text-muted hover:text-white transition-colors"
            >
              Change
            </button>
          </div>

          {/* Extract Button */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={handleExtract}
              disabled={processing}
              className="flex-1 bg-6fb-green hover:bg-6fb-green-hover disabled:bg-6fb-border disabled:text-6fb-text-muted text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Extracting...
                </>
              ) : (
                <>✂️ Extract Clips with AI</>
              )}
            </button>
          </div>

          {/* Progress */}
          {processing && (
            <div className="bg-6fb-card rounded-xl border border-6fb-border p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-white font-medium">{progress.label}</p>
                <p className="text-sm text-6fb-green font-mono">{Math.round(progress.percent)}%</p>
              </div>
              <div className="h-2 bg-6fb-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-6fb-green rounded-full transition-all duration-500"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Clips Grid */}
          {clips.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">
                  Found {clips.length} Clips
                </h2>
                <p className="text-xs text-6fb-text-muted">Sorted by AI score</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {clips.map((clip, i) => (
                  <div
                    key={i}
                    className="bg-6fb-card rounded-xl border border-6fb-border p-4 hover:border-6fb-green/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-white mb-1">{clip.label || `Clip ${i + 1}`}</p>
                        <p className="text-[11px] text-6fb-text-muted">
                          {formatTime(clip.start)} — {formatTime(clip.end)} ({Math.round(clip.end - clip.start)}s)
                        </p>
                      </div>
                      <div className="flex items-center gap-1 bg-6fb-green/10 px-2 py-1 rounded-md">
                        <span className="text-[10px] text-6fb-green font-bold">{Math.round(clip.score * 100)}%</span>
                      </div>
                    </div>

                    {/* Mockup aspect ratio preview */}
                    <div className="aspect-[9/16] bg-6fb-bg rounded-lg border border-6fb-border/50 flex items-center justify-center mb-3 max-h-40 overflow-hidden">
                      <span className="text-4xl opacity-30">🎬</span>
                    </div>

                    <div className="flex gap-2">
                      <button className="flex-1 text-xs bg-6fb-green/10 text-6fb-green py-2 rounded-lg hover:bg-6fb-green/20 transition-colors font-medium">
                        Export
                      </button>
                      <button className="flex-1 text-xs bg-6fb-card border border-6fb-border text-6fb-text-secondary py-2 rounded-lg hover:text-white transition-colors font-medium">
                        Preview
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
