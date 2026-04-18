import React, { useState, useEffect, useMemo } from 'react';
import { BrandProfile, EditorClip } from '../App';

interface Props {
  brandProfile: BrandProfile | null;
  editorClip: EditorClip | null;
  onNavigateToClips: () => void;
}

interface RawWord {
  word: string;
  start_ms: number;
  end_ms: number;
}

interface TranscriptWord {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  blockId: string;
  deleted: boolean;
}

interface SceneBlock {
  id: string;
  type: 'aroll' | 'broll';
  startMs: number;
  endMs: number;
  sourceStartMs: number;
  sourceEndMs: number;
  trackIndex: number;
}

// ─── Helpers ──────────────────────────────────────────────────────

const BLOCK_MS = 30_000; // 30-second scene blocks

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function mapRawToTranscriptWords(rawWords: RawWord[]): TranscriptWord[] {
  return rawWords.map((w, i) => ({
    id: `w${i}`,
    text: w.word,
    startMs: w.start_ms,
    endMs: w.end_ms,
    blockId: `block-${Math.floor(w.start_ms / BLOCK_MS)}`,
    deleted: false,
  }));
}

function deriveBlocksFromWords(rawWords: RawWord[]): SceneBlock[] {
  const blockMap = new Map<number, { startMs: number; endMs: number }>();
  for (const w of rawWords) {
    const idx = Math.floor(w.start_ms / BLOCK_MS);
    const existing = blockMap.get(idx);
    if (!existing) {
      blockMap.set(idx, { startMs: w.start_ms, endMs: w.end_ms });
    } else {
      blockMap.set(idx, { startMs: Math.min(existing.startMs, w.start_ms), endMs: Math.max(existing.endMs, w.end_ms) });
    }
  }
  return Array.from(blockMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([idx, { startMs, endMs }]) => ({
      id: `block-${idx}`,
      type: 'aroll' as const,
      startMs,
      endMs,
      sourceStartMs: startMs,
      sourceEndMs: endMs,
      trackIndex: 0,
    }));
}

function parseSrtToRawWords(srt: string): RawWord[] {
  const parseTime = (t: string) => {
    const [h, m, s] = t.replace(',', '.').split(':');
    return (parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s)) * 1000;
  };
  const result: RawWord[] = [];
  for (const block of srt.trim().split(/\n\n+/)) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2}[,.]?\d{3})\s-->\s(\d{2}:\d{2}:\d{2}[,.]?\d{3})/);
    if (!timeMatch) continue;
    const startMs = parseTime(timeMatch[1]);
    const endMs = parseTime(timeMatch[2]);
    const words = lines.slice(2).join(' ').replace(/<[^>]+>/g, '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const wDur = (endMs - startMs) / words.length;
    words.forEach((word, i) => result.push({
      word,
      start_ms: startMs + Math.round(i * wDur),
      end_ms: startMs + Math.round((i + 1) * wDur),
    }));
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────

export default function VideoEditor({ brandProfile, editorClip, onNavigateToClips }: Props) {
  const [words, setWords] = useState<TranscriptWord[]>([]);
  const [blocks, setBlocks] = useState<SceneBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  useEffect(() => {
    if (!editorClip) {
      setWords([]);
      setBlocks([]);
      return;
    }

    const api = (window as any).electronAPI;
    setLoading(true);
    setError(null);

    const loadFromSrt = () =>
      api.readTranscript(editorClip.clipDir)
        .then((res: { success: boolean; transcript?: string }) => {
          if (res.success && res.transcript) {
            const raw = parseSrtToRawWords(res.transcript);
            setWords(mapRawToTranscriptWords(raw));
            setBlocks(deriveBlocksFromWords(raw));
          } else {
            setError('No transcript found for this clip.');
          }
        });

    api.loadWordsJson(editorClip.wordsJsonPath)
      .then((res: { success: boolean; data?: { words: RawWord[] } }) => {
        if (res.success && res.data?.words?.length) {
          setWords(mapRawToTranscriptWords(res.data.words));
          setBlocks(deriveBlocksFromWords(res.data.words));
        } else {
          return loadFromSrt();
        }
      })
      .catch(() => loadFromSrt())
      .finally(() => setLoading(false));
  }, [editorClip]);

  const toggleWord = (id: string) => {
    setWords(ws => ws.map(w => w.id === id ? { ...w, deleted: !w.deleted } : w));
  };

  const handleExport = async () => {
    if (!editorClip) return;
    const spec = {
      version: 1,
      clipTitle: editorClip.title,
      exportedAt: new Date().toISOString(),
      words: words.map(({ id, text, startMs, endMs, deleted }) => ({ id, text, startMs, endMs, deleted })),
      blocks,
    };
    await (window as any).electronAPI.exportEditedSpec(editorClip.editedSpecPath, spec);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 2000);
  };

  // Group words by blockId preserving order
  const wordsByBlock = useMemo(() => {
    const map = new Map<string, TranscriptWord[]>();
    for (const w of words) {
      if (!map.has(w.blockId)) map.set(w.blockId, []);
      map.get(w.blockId)!.push(w);
    }
    return map;
  }, [words]);

  const activeColor = brandProfile?.primaryColor || '#00C851';
  const deletedCount = words.filter(w => w.deleted).length;

  return (
    <div className="h-full w-full bg-[#0a0a0a] flex flex-col font-sans">
      {/* Header */}
      <header className="h-14 border-b border-[#2a2a2a] flex items-center justify-between px-6 bg-[#111]">
        <div className="flex items-center gap-3 h-full">
          <div className="w-8 h-8 rounded bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center">
            <svg className="w-4 h-4 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm flex items-center gap-2">
              6FB Hybrid Editor
              <span className="bg-[#1f1f1f] px-2 py-0.5 rounded text-[10px] text-white/50 border border-[#2a2a2a]">V1</span>
            </h1>
            {editorClip && (
              <p className="text-[11px] text-[#00C851] leading-none mt-0.5 truncate max-w-[280px]">{editorClip.title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 h-full">
          {deletedCount > 0 && (
            <span className="text-[11px] text-white/40 mr-1">{deletedCount} word{deletedCount !== 1 ? 's' : ''} marked</span>
          )}
          <button
            onClick={handleExport}
            disabled={!editorClip || words.length === 0}
            className={`h-8 px-4 rounded text-xs font-semibold transition-colors ${
              exportSuccess
                ? 'bg-[#00C851] text-black'
                : editorClip && words.length > 0
                  ? 'bg-teal-600 hover:bg-teal-500 text-white'
                  : 'bg-[#1a1a1a] text-white/20 cursor-not-allowed border border-[#2a2a2a]'
            }`}
          >
            {exportSuccess ? 'Saved ✓' : 'Export Edit'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Player / Empty State */}
        <div className="flex-1 bg-black flex flex-col items-center justify-center relative shadow-inner">
          {!editorClip ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center text-center px-8 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mb-5">
                <svg className="w-7 h-7 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <h3 className="text-white/60 font-semibold mb-2 text-base">No clip loaded</h3>
              <p className="text-white/30 text-sm mb-5 leading-relaxed">
                Open a clip from the Clip Extractor to start editing its transcript.
              </p>
              <button
                onClick={onNavigateToClips}
                className="h-9 px-5 rounded-lg text-xs font-semibold bg-[#1a1a1a] border border-[#2a2a2a] text-white/50 hover:text-white hover:border-[#444] transition-colors"
              >
                Go to Clip Extractor
              </button>
            </div>
          ) : loading ? (
            /* Loading State */
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#2a2a2a] border-t-teal-500 rounded-full animate-spin" />
              <p className="text-white/30 text-xs">Loading transcript…</p>
            </div>
          ) : error ? (
            /* Error State */
            <div className="flex flex-col items-center text-center px-8 max-w-sm">
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <button
                onClick={onNavigateToClips}
                className="h-9 px-5 rounded-lg text-xs font-semibold bg-[#1a1a1a] border border-[#2a2a2a] text-white/50 hover:text-white hover:border-[#444] transition-colors"
              >
                Back to Clip Extractor
              </button>
            </div>
          ) : (
            /* Player Mock */
            <>
              <div className="w-[360px] h-[640px] bg-[#111] overflow-hidden relative border border-[#333] shadow-2xl shrink-0 flex items-center justify-center">
                <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center p-6 text-center">
                  <div className="text-white/20 mb-4">
                    <svg className="w-16 h-16 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
                      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                      <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
                      <line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/>
                      <line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/>
                      <line x1="17" y1="7" x2="22" y2="7"/>
                    </svg>
                  </div>
                  <h3 className="text-white/40 font-semibold mb-2">Remotion Player</h3>
                  <p className="text-white/20 text-xs max-w-[200px]">Video preview coming in Phase 2.</p>
                </div>
                <div className="absolute bottom-16 left-0 w-full px-6 flex flex-col items-center z-10 pointer-events-none">
                  <div className="text-[32px] font-black text-white px-4 py-2 uppercase italic tracking-tighter"
                    style={{ fontFamily: brandProfile?.headlineFont, textShadow: '0 4px 16px rgba(0,0,0,0.8)' }}>
                    {words.filter(w => !w.deleted)[0]?.text || '—'}
                  </div>
                  <div className="h-[4px] w-1/3 mt-2 rounded" style={{ backgroundColor: activeColor }} />
                </div>
              </div>
              <div className="absolute bottom-6 flex items-center gap-4 bg-[#1a1a1a] px-4 py-3 rounded-full border border-[#333] shadow-2xl">
                <button className="text-white/60 hover:text-white transition-colors">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="19 20 9 12 19 4 19 20"/></svg>
                </button>
                <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform">
                  <svg className="w-4 h-4 ml-1" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
                <button className="text-white/60 hover:text-white transition-colors">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="5 4 15 12 5 20 5 4"/></svg>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: Transcript */}
        <div className="w-[340px] bg-[#141414] border-l border-[#2a2a2a] flex flex-col">
          <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Transcript Editor</h2>
            {words.length > 0 && (
              <span className="text-[10px] text-white/30">{words.filter(w => !w.deleted).length} / {words.length} words</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!editorClip && (
              <p className="text-xs text-white/20 text-center mt-8">No clip loaded</p>
            )}
            {loading && (
              <div className="flex justify-center mt-8">
                <div className="w-5 h-5 border-2 border-[#2a2a2a] border-t-teal-500 rounded-full animate-spin" />
              </div>
            )}
            {editorClip && !loading && words.length === 0 && !error && (
              <p className="text-xs text-white/20 text-center mt-8">No transcript words found</p>
            )}
            {words.length > 0 && (
              <div className="space-y-5">
                {blocks.map(block => {
                  const blockWords = wordsByBlock.get(block.id) || [];
                  if (!blockWords.length) return null;
                  return (
                    <div key={block.id}>
                      {/* Block header */}
                      <div
                        onClick={() => setSelectedBlockId(selectedBlockId === block.id ? null : block.id)}
                        className={`flex items-center gap-2 mb-2 cursor-pointer group ${selectedBlockId === block.id ? 'opacity-100' : 'opacity-50 hover:opacity-70'}`}
                      >
                        <div className="h-px flex-1 bg-[#2a2a2a]" />
                        <span className="text-[9px] font-mono text-white/40 shrink-0">
                          {formatMs(block.startMs)} – {formatMs(block.endMs)}
                        </span>
                        <div className="h-px flex-1 bg-[#2a2a2a]" />
                      </div>
                      {/* Words */}
                      <div className="flex flex-wrap gap-1">
                        {blockWords.map(word => (
                          <span
                            key={word.id}
                            onClick={() => toggleWord(word.id)}
                            title={word.deleted ? 'Click to restore' : 'Click to mark for deletion'}
                            className={`px-1 py-0.5 rounded text-[15px] cursor-pointer transition-all duration-100 select-none border ${
                              word.deleted
                                ? 'line-through text-white/20 opacity-40 bg-black/50 border-transparent'
                                : 'text-white/80 hover:bg-red-900/20 hover:text-red-300 hover:border-red-500/20 border-transparent'
                            }`}
                          >
                            {word.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {editorClip && !loading && words.length > 0 && (
              <div className="mt-6 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                <p className="text-[11px] text-white/30 leading-relaxed">
                  Click any word to mark it for deletion. Click again to restore. Export saves a spec JSON — video rendering in Phase 2.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Timeline (static visual, blocks reflect real data) */}
      <div className="h-[200px] bg-[#1a1a1a] border-t border-[#2a2a2a] shrink-0 flex flex-col relative">
        <div className="h-8 border-b border-[#333] flex items-center px-4 justify-between bg-[#1f1f1f]">
          <div className="text-[10px] text-white/30 font-semibold uppercase tracking-widest">Timeline</div>
          <div className="text-[10px] text-white/40 font-mono tracking-widest">
            {words.length > 0 ? formatMs(blocks[blocks.length - 1]?.endMs ?? 0) : '00:00'}
          </div>
        </div>

        <div className="flex-1 flex relative">
          <div className="w-48 border-r border-[#333] bg-[#1f1f1f] flex flex-col z-10">
            <div className="flex-1 flex items-center px-4 text-xs font-semibold text-white">
              <div className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500/50 mr-2 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              </div>
              V1 (A-Roll)
            </div>
          </div>

          <div className="flex-1 overflow-x-auto bg-[#141414] relative px-2 flex items-center"
            style={{ backgroundImage: 'linear-gradient(to right, #2a2a2a 1px, transparent 1px)', backgroundSize: '50px 100%' }}>
            {blocks.length === 0 ? (
              <p className="text-[10px] text-white/20 px-4">No blocks — load a clip to see timeline</p>
            ) : (
              <div className="flex items-center gap-0.5 py-2 h-full">
                {blocks.map(block => {
                  const durationSec = (block.sourceEndMs - block.sourceStartMs) / 1000;
                  const widthPx = Math.max(40, durationSec * 6);
                  const isSelected = selectedBlockId === block.id;
                  return (
                    <div
                      key={block.id}
                      onClick={() => setSelectedBlockId(isSelected ? null : block.id)}
                      className={`h-14 rounded overflow-hidden border cursor-pointer transition-all shrink-0 ${
                        isSelected ? 'border-white' : 'border-[#444] opacity-70 hover:opacity-90'
                      }`}
                      style={{ width: `${widthPx}px`, background: 'linear-gradient(180deg, #1f4068 0%, #162447 100%)' }}
                      title={`${formatMs(block.startMs)} – ${formatMs(block.endMs)}`}
                    >
                      <div className="w-full h-full p-1.5 flex flex-col justify-between">
                        <div className="text-[8px] text-white/60 font-mono truncate leading-none">{formatMs(block.startMs)}</div>
                        <div className="w-full h-3 flex items-end gap-[1px] opacity-40">
                          {Array.from({ length: Math.max(4, Math.floor(widthPx / 6)) }).map((_, i) => (
                            <div key={i} className="w-full bg-[#4da8da] rounded-t-sm" style={{ height: `${30 + Math.sin(i * 0.8) * 20 + Math.cos(i * 1.3) * 15}%` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
