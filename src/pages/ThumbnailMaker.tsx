import { useCallback, useEffect, useRef, useState } from 'react';
import { Clipboard, Download, Film, Image, LibraryBig, Save, Sparkles } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { BrandProfile } from '../App';
import type { ContentStrategyBrief } from '../types/content-strategy';
import {
  THUMBNAIL_ACCENTS,
  THUMBNAIL_CREATIVE_LANES,
  THUMBNAIL_TREATMENTS,
  type ThumbnailConcept,
  type ThumbnailPackage,
  type ThumbnailPackageSummary,
} from '../types/thumbnail-package';
import ThumbnailCoverPreview from '../components/thumbnail/ThumbnailCoverPreview';
import { toLocalFileUrl } from '../utils/localFileUrl';

interface LibraryClip {
  thumbnailPath?: string | null;
  contentType?: string;
}

interface LibraryRun {
  runId: string;
  timestamp: number;
  sourceVideo: string;
  runPath: string;
  strategyBrief?: ContentStrategyBrief;
  clips: LibraryClip[];
}

interface ThumbnailMakerProps {
  brandProfile: BrandProfile | null;
  hasOpenAIKey: boolean;
  onNavigateToClips: () => void;
  onNavigateToSettings: () => void;
}

interface PackageSource {
  sourceName: string;
  sourceRunId: string;
}

function sourceLabel(path: string): string {
  const file = path.split(/[\\/]/).pop() || 'Untitled video';
  return file.replace(/\.[^.]+$/, '');
}

function relativeTime(timestamp: number): string {
  const elapsed = Date.now() - timestamp;
  if (elapsed < 120_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

function packageAsText(sourceName: string, value: ThumbnailPackage): string {
  const titles = value.titles.map((title, index) => `${index + 1}. ${title}`).join('\n');
  const thumbnails = value.thumbnails.map((concept, index) => [
    `${index + 1}. ${concept.text}`,
    `Creative lane: ${concept.creativeLane}`,
    `Accent: ${concept.accent}`,
    `Treatment: ${concept.treatment}`,
    `Timestamp: ${concept.timestamp}`,
    `Visual: ${concept.visualDirection}`,
    `Transcript evidence: ${concept.transcriptEvidence}`,
  ].join('\n')).join('\n\n');
  return `${sourceName}\n\nCORE DIAGNOSIS\n${value.diagnosis}\n\nTHREE TITLES\n${titles}\n\nTHREE THUMBNAIL CONCEPTS\n${thumbnails}\n\nDESCRIPTION\n${value.description}\n\nCTA\n${value.cta}`;
}

export default function ThumbnailMaker({
  brandProfile,
  hasOpenAIKey,
  onNavigateToClips,
  onNavigateToSettings,
}: ThumbnailMakerProps) {
  const [runs, setRuns] = useState<LibraryRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<LibraryRun | null>(null);
  const [packageValue, setPackageValue] = useState<ThumbnailPackage | null>(null);
  const [savedPackages, setSavedPackages] = useState<ThumbnailPackageSummary[]>([]);
  const [currentPackageId, setCurrentPackageId] = useState<string | null>(null);
  const [currentPackageSource, setCurrentPackageSource] = useState<PackageSource | null>(null);
  const [savingPackage, setSavingPackage] = useState(false);
  const [packageDirty, setPackageDirty] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingCover, setGeneratingCover] = useState<string | null>(null);
  const [exportingCover, setExportingCover] = useState<number | null>(null);
  const [coverImageDataUrls, setCoverImageDataUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const coverRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const packageValueRef = useRef<ThumbnailPackage | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const result = await window.electronAPI.scanLibrary() as { runs?: LibraryRun[] };
      const nextRuns = result.runs || [];
      setRuns(nextRuns);
      setSelectedRun(current => nextRuns.find(run => run.runId === current?.runId) || nextRuns[0] || null);
    } catch {
      setError('The local video library could not be loaded.');
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  const loadSavedPackages = useCallback(async () => {
    try {
      const result = await window.electronAPI.listThumbnailPackages();
      setSavedPackages(result.packages || []);
    } catch {
      setError('The saved thumbnail library could not be loaded.');
    }
  }, []);

  useEffect(() => { void loadSavedPackages(); }, [loadSavedPackages]);

  const savePackage = async (value: ThumbnailPackage, source?: PackageSource, announce = false, createNew = false) => {
    const resolvedSource = source || currentPackageSource || (selectedRun ? {
      sourceName: sourceLabel(selectedRun.sourceVideo),
      sourceRunId: selectedRun.runId,
    } : null);
    if (!resolvedSource || savingPackage) return false;

    setSavingPackage(true);
    try {
      const result = await window.electronAPI.saveThumbnailPackage({
        id: createNew ? undefined : currentPackageId || undefined,
        sourceName: resolvedSource.sourceName,
        sourceRunId: resolvedSource.sourceRunId,
        package: value,
      });
      if (!result.success || !result.id) {
        setError(result.error || 'The thumbnail package could not be saved.');
        return false;
      }
      setCurrentPackageId(result.id);
      setCurrentPackageSource(resolvedSource);
      setPackageDirty(false);
      await loadSavedPackages();
      if (announce) setStatus('Saved to your Thumbnail Library. Nothing has been uploaded or published.');
      return true;
    } catch {
      setError('The thumbnail package could not be saved.');
      return false;
    } finally {
      setSavingPackage(false);
    }
  };

  const hydrateGeneratedImages = async (value: ThumbnailPackage) => {
    const entries = await Promise.all(value.thumbnails.map(async concept => {
      if (!concept.generatedImagePath) return null;
      const result = await window.electronAPI.readThumbnailImageData(concept.generatedImagePath);
      return result.success && result.dataUrl ? [concept.generatedImagePath, result.dataUrl] as const : null;
    }));
    setCoverImageDataUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
  };

  const loadSavedPackage = async (id: string) => {
    setError('');
    setStatus('Opening saved thumbnail package...');
    try {
      const result = await window.electronAPI.loadThumbnailPackage(id);
      if (!result.success || !result.record) {
        setError(result.error || 'The saved thumbnail package could not be opened.');
        return;
      }
      const record = result.record;
      packageValueRef.current = record.package;
      setPackageValue(record.package);
      setCurrentPackageId(record.id);
      setCurrentPackageSource({ sourceName: record.sourceName, sourceRunId: record.sourceRunId });
      setPackageDirty(false);
      setSelectedRun(current => runs.find(run => run.runId === record.sourceRunId) || current);
      await hydrateGeneratedImages(record.package);
      setStatus('Saved package opened. You can refine it and save changes at any time.');
    } catch {
      setError('The saved thumbnail package could not be opened.');
    }
  };

  const generate = async () => {
    if (!selectedRun || generating) return;
    if (!hasOpenAIKey) {
      setError('Add your OpenAI API key in Settings before generating a package.');
      return;
    }

    setGenerating(true);
    setError('');
    setStatus('Reading the local transcript...');
    packageValueRef.current = null;
    setPackageValue(null);
    setCurrentPackageId(null);
    setCurrentPackageSource(null);
    setPackageDirty(false);
    try {
      const transcriptResult = await window.electronAPI.readTranscript(selectedRun.runPath);
      if (!transcriptResult.success || !transcriptResult.transcript) {
        setError(transcriptResult.error || 'This run does not contain a transcript.');
        return;
      }

      setStatus('Building three transcript-grounded directions...');
      const result = await window.electronAPI.generateThumbnailPackage({
        transcript: transcriptResult.transcript,
        brandProfile: brandProfile ? { ...brandProfile } : undefined,
        strategyBrief: selectedRun.strategyBrief,
      });
      if (!result.success || !result.package) {
        setError(result.error || 'The thumbnail package could not be generated.');
        return;
      }

      let nextPackage = result.package;
      setStatus('Matching local frames to each transcript beat...');
      try {
        const frameResult = await window.electronAPI.autoMatchCarouselFrames({
          runPath: selectedRun.runPath,
          timestamps: nextPackage.thumbnails.map(concept => concept.timestamp),
        });
        if (frameResult.success && frameResult.frames) {
          nextPackage = {
            ...nextPackage,
            thumbnails: nextPackage.thumbnails.map((concept, index) => ({
              ...concept,
              framePath: frameResult.frames?.[index] || null,
            })),
          };
        }
      } catch {
        // A package remains useful when no rendered clip frame is available.
      }

      packageValueRef.current = nextPackage;
      setPackageValue(nextPackage);
      const saved = await savePackage(nextPackage, {
        sourceName: sourceLabel(selectedRun.sourceVideo),
        sourceRunId: selectedRun.runId,
      }, false, true);
      setStatus(saved ? 'Package ready for review and saved to your Thumbnail Library.' : 'Package ready for review. Save it to keep it in your Thumbnail Library.');
    } catch {
      setError('Something went wrong. Check your OpenAI API key and try again.');
    } finally {
      setGenerating(false);
    }
  };

  const copyPackage = async () => {
    if (!packageValue) return;
    try {
      await navigator.clipboard.writeText(packageAsText(currentPackageSource?.sourceName || sourceLabel(selectedRun?.sourceVideo || ''), packageValue));
      setStatus('Package copied to the clipboard.');
    } catch {
      setError('The package could not be copied.');
    }
  };

  const generateCover = async (concept: ThumbnailPackage['thumbnails'][number], index: number) => {
    if (!selectedRun || (currentPackageSource && selectedRun.runId !== currentPackageSource.sourceRunId)) {
      return { success: false, error: 'Open this package’s source video from the local library before generating another cover.' };
    }
    const headlineWords = concept.text.trim().split(/\s+/).filter(Boolean);
    if (headlineWords.length < 2 || headlineWords.length > 4) {
      return { success: false, error: 'Use a 2-4 word headline before generating the finished cover.' };
    }
    const fallbackFrame = selectedRun.clips.find(clip => clip.thumbnailPath)?.thumbnailPath || null;
    const referenceFramePath = concept.framePath || fallbackFrame;
    if (!referenceFramePath) {
      return { success: false, error: 'This source has no local clip frame available for a finished cover.' };
    }

    try {
      const result = await window.electronAPI.generateThumbnailImage({
        sourceName: sourceLabel(selectedRun.sourceVideo),
        concept,
        referenceFramePath,
      });
      if (!result.success || !result.imagePath) {
        return { success: false, error: result.error || 'The finished thumbnail could not be generated.' };
      }
      const imageDataResult = await window.electronAPI.readThumbnailImageData(result.imagePath);
      if (!imageDataResult.success || !imageDataResult.dataUrl) {
        return { success: false, error: imageDataResult.error || 'The finished thumbnail image could not be prepared for export.' };
      }
      setCoverImageDataUrls(current => ({ ...current, [result.imagePath!]: imageDataResult.dataUrl! }));
      const livePackage = packageValueRef.current;
      const nextPackage = livePackage ? {
        ...livePackage,
        thumbnails: livePackage.thumbnails.map((item, conceptIndex) => conceptIndex === index
          ? { ...item, generatedImagePath: result.imagePath }
          : item),
      } : null;
      if (nextPackage) {
        packageValueRef.current = nextPackage;
        setPackageValue(nextPackage);
        const saved = await savePackage(nextPackage);
        if (!saved) setPackageDirty(true);
      }
      return { success: true };
    } catch {
      return { success: false, error: 'The finished thumbnail could not be generated. Check your OpenAI key and try again.' };
    }
  };

  const generateFinishedCover = async (concept: ThumbnailPackage['thumbnails'][number], index: number) => {
    if (generatingCover || exportingCover !== null) return;
    setGeneratingCover(concept.text);
    setError('');
    setStatus(`Generating the finished cover for “${concept.text}”...`);
    const result = await generateCover(concept, index);
    if (result.success) setStatus('Finished cover ready for review. It has not been uploaded or published.');
    else setError(result.error || 'The finished thumbnail could not be generated.');
    setGeneratingCover(null);
  };

  const generateAllFinishedCovers = async () => {
    if (!packageValue || generatingCover || exportingCover !== null) return;
    setError('');
    for (const [index, concept] of packageValue.thumbnails.entries()) {
      setGeneratingCover(concept.text);
      setStatus(`Generating finished cover ${index + 1} of 3: “${concept.text}”...`);
      const result = await generateCover(concept, index);
      if (!result.success) {
        setError(`${result.error} The remaining covers were not requested.`);
        setGeneratingCover(null);
        return;
      }
    }
    setGeneratingCover(null);
    setStatus('All three finished covers are ready for review. Nothing has been uploaded or published.');
  };

  const exportPackage = async () => {
    if (!packageValue) return;
    try {
      const result = await window.electronAPI.exportThumbnailPackage({
        sourceName: currentPackageSource?.sourceName || sourceLabel(selectedRun?.sourceVideo || ''),
        package: packageValue,
      });
      if (result.success) setStatus(`Markdown exported to ${result.filePath}`);
      else setError(result.error || 'The Markdown export failed.');
    } catch {
      setError('The Markdown export failed.');
    }
  };

  const updateConcept = (index: number, patch: Partial<ThumbnailConcept>) => {
    const livePackage = packageValueRef.current;
    if (livePackage) {
      const nextPackage = {
        ...livePackage,
        thumbnails: livePackage.thumbnails.map((concept, conceptIndex) => conceptIndex === index ? { ...concept, ...patch } : concept),
      };
      packageValueRef.current = nextPackage;
      setPackageValue(nextPackage);
    }
    setPackageDirty(true);
  };

  const exportFinishedCover = async (concept: ThumbnailConcept, index: number) => {
    const node = coverRefs.current[index];
    if (!node || !concept.generatedImagePath || exportingCover !== null) return;
    setExportingCover(index);
    setError('');
    setStatus(`Exporting “${concept.text}” with its exact app-rendered headline...`);
    try {
      const imageDataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 1,
      });
      const result = await window.electronAPI.exportThumbnailCover({
        sourceName: currentPackageSource?.sourceName || sourceLabel(selectedRun?.sourceVideo || ''),
        headline: concept.text,
        imageDataUrl,
      });
      if (!result.success || !result.imagePath) {
        setError(result.error || 'The finished cover could not be exported.');
      } else {
        const livePackage = packageValueRef.current;
        const nextPackage = livePackage ? {
          ...livePackage,
          thumbnails: livePackage.thumbnails.map((item, conceptIndex) => conceptIndex === index
            ? { ...item, exportedImagePath: result.imagePath }
            : item),
        } : null;
        if (nextPackage) {
          packageValueRef.current = nextPackage;
          setPackageValue(nextPackage);
          const saved = await savePackage(nextPackage);
          if (!saved) setPackageDirty(true);
        }
        setStatus('Finished 16:9 cover exported with the exact app-rendered headline. Nothing has been uploaded or published.');
      }
    } catch (error) {
      console.error('Thumbnail cover export failed', error);
      setError('The finished cover could not be exported.');
    } finally {
      setExportingCover(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 border-b border-6fb-border pb-5">
        <div className="mb-2 flex items-center gap-2 text-6fb-green">
          <Sparkles size={16} aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-widest">Transcript packaging</span>
        </div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Thumbnail Maker</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-6fb-text-secondary">
          Turn one transcribed video into three title options and three thumbnail directions tied to exact moments in the video.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-6fb-text-muted">Source video</h2>
            <button onClick={() => void loadLibrary()} className="text-xs font-semibold text-6fb-green hover:text-6fb-green-hover">
              Refresh
            </button>
          </div>

          {loadingLibrary ? (
            <div className="flex min-h-32 items-center justify-center border-y border-6fb-border text-xs text-6fb-text-muted">
              Loading transcribed runs...
            </div>
          ) : runs.length === 0 ? (
            <div className="border-y border-6fb-border py-6 text-center">
              <Film className="mx-auto mb-3 text-6fb-text-muted" size={24} aria-hidden="true" />
              <p className="text-sm font-semibold text-white">No transcribed videos yet</p>
              <p className="mt-1 text-xs leading-relaxed text-6fb-text-muted">Run a video through Clips first, then return here.</p>
              <button onClick={onNavigateToClips} className="mt-4 rounded-lg bg-6fb-green px-4 py-2 text-xs font-bold text-black hover:bg-6fb-green-hover">
                Open Clips
              </button>
            </div>
          ) : (
            <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {runs.map(run => {
                const preview = run.clips.find(clip => clip.thumbnailPath)?.thumbnailPath;
                const active = selectedRun?.runId === run.runId;
                return (
                  <button
                    key={run.runId}
                    onClick={() => {
                      setSelectedRun(run);
                      packageValueRef.current = null;
                      setPackageValue(null);
                      setCurrentPackageId(null);
                      setCurrentPackageSource(null);
                      setPackageDirty(false);
                      setCoverImageDataUrls({});
                      setError('');
                      setStatus('');
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${active ? 'border-6fb-green/50 bg-6fb-green/10' : 'border-6fb-border bg-6fb-card hover:border-white/20'}`}
                  >
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-black">
                      {preview ? (
                        <img src={toLocalFileUrl(preview)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Film className="m-auto h-full text-6fb-text-muted" size={20} aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">{sourceLabel(run.sourceVideo)}</p>
                      <p className="mt-1 text-[10px] text-6fb-text-muted">{run.clips.length} clips · {relativeTime(run.timestamp)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedRun && (
            <button
              onClick={() => void generate()}
              disabled={generating}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-6fb-green px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-6fb-green-hover disabled:cursor-wait disabled:opacity-60"
            >
              <Sparkles size={16} aria-hidden="true" />
              {generating ? 'Building package...' : 'Generate 3 Directions'}
            </button>
          )}

          {!hasOpenAIKey && (
            <button onClick={onNavigateToSettings} className="mt-3 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
              Add OpenAI API key in Settings
            </button>
          )}

          <div className="mt-7 border-t border-6fb-border pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-6fb-text-muted">
                <LibraryBig size={15} aria-hidden="true" />
                <h2 className="text-xs font-bold uppercase tracking-widest">Thumbnail Library</h2>
              </div>
              <button onClick={() => void loadSavedPackages()} className="text-xs font-semibold text-6fb-green hover:text-6fb-green-hover">
                Refresh
              </button>
            </div>
            {savedPackages.length === 0 ? (
              <p className="rounded-lg border border-dashed border-6fb-border px-3 py-4 text-xs leading-relaxed text-6fb-text-muted">
                Generated three-option packages are saved here for review and refinement.
              </p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {savedPackages.map(item => {
                  const active = currentPackageId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => void loadSavedPackage(item.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${active ? 'border-6fb-green/50 bg-6fb-green/10' : 'border-6fb-border bg-6fb-card hover:border-white/20'}`}
                    >
                      <p className="truncate text-xs font-bold text-white">{item.sourceName}</p>
                      <p className="mt-1 text-[10px] text-6fb-text-muted">
                        {item.finishedCoverCount}/3 finished covers · {relativeTime(Date.parse(item.updatedAt))}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0" aria-live="polite">
          {error && <div role="alert" className="mb-4 border-l-2 border-red-500 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
          {status && !error && <p role="status" className="mb-4 text-xs text-6fb-text-muted">{status}</p>}

          {generating ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center border-y border-6fb-border text-center">
              <div className="mb-4 h-9 w-9 animate-spin rounded-full border-2 border-6fb-border border-t-6fb-green" />
              <p className="text-sm font-semibold text-white">Reading the whole argument before choosing the cover</p>
              <p className="mt-1 text-xs text-6fb-text-muted">Titles and visuals will stay grounded in the transcript.</p>
            </div>
          ) : !packageValue ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center border-y border-6fb-border px-6 text-center">
              <Image className="mb-4 text-6fb-text-muted" size={32} aria-hidden="true" />
              <p className="text-sm font-semibold text-white">Choose a video and generate its package</p>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-6fb-text-muted">
                You will get one diagnosis, three titles, three thumbnail concepts, a description, and one CTA. Nothing is posted automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-6fb-text-muted">Package for</p>
                  <h2 className="mt-1 text-lg font-bold text-white">{currentPackageSource?.sourceName || sourceLabel(selectedRun?.sourceVideo || '')}</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void savePackage(packageValue, undefined, true)}
                    disabled={savingPackage}
                    title="Save package"
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-wait disabled:opacity-60 ${packageDirty ? 'border-6fb-green bg-6fb-green/10 text-6fb-green' : 'border-6fb-border text-white hover:border-white/30'}`}
                  >
                    <Save size={15} aria-hidden="true" /> {savingPackage ? 'Saving...' : packageDirty ? 'Save changes' : 'Saved'}
                  </button>
                  <button onClick={() => void copyPackage()} title="Copy package" aria-label="Copy package" className="flex items-center gap-2 rounded-lg border border-6fb-border px-3 py-2 text-xs font-semibold text-white hover:border-white/30">
                    <Clipboard size={15} aria-hidden="true" /> Copy
                  </button>
                  <button onClick={() => void exportPackage()} title="Export Markdown" className="flex items-center gap-2 rounded-lg border border-6fb-border px-3 py-2 text-xs font-semibold text-white hover:border-white/30">
                    <Download size={15} aria-hidden="true" /> Export
                  </button>
                </div>
              </div>

              <div className="border-l-2 border-6fb-green pl-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-6fb-green">Core diagnosis</h3>
                <p className="mt-2 text-sm leading-7 text-white">{packageValue.diagnosis}</p>
              </div>

              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-6fb-text-muted">Three titles</h3>
                <ol className="divide-y divide-6fb-border border-y border-6fb-border">
                  {packageValue.titles.map((title, index) => (
                    <li key={title} className="flex items-start gap-3 py-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] font-bold text-6fb-green">{index + 1}</span>
                      <p className="pt-0.5 text-sm font-semibold text-white">{title}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-6fb-text-muted">Three thumbnail concepts</h3>
                    <p className="mt-1 text-xs text-6fb-text-muted">House Cut standard: one claim, one visible proof cue, one accent system. Each direction gets its own finished cover for a clean comparison.</p>
                  </div>
                  <button
                    onClick={() => void generateAllFinishedCovers()}
                    disabled={generatingCover !== null || exportingCover !== null}
                    className="flex items-center justify-center gap-2 rounded-lg bg-6fb-green px-3 py-2 text-xs font-bold text-black hover:bg-6fb-green-hover disabled:cursor-wait disabled:opacity-60"
                  >
                    <Sparkles size={14} aria-hidden="true" />
                    {generatingCover ? 'Generating 3 covers...' : packageValue.thumbnails.some(concept => concept.generatedImagePath) ? 'Regenerate all 3 covers' : 'Generate 3 finished covers'}
                  </button>
                </div>
                <div className="grid gap-4 xl:grid-cols-3">
                  {packageValue.thumbnails.map((concept, index) => (
                    <article key={`${concept.timestamp}-${index}`} className="overflow-hidden rounded-lg border border-6fb-border bg-6fb-card">
                      <ThumbnailCoverPreview
                        concept={concept}
                        imagePath={concept.generatedImagePath || concept.framePath}
                        imageDataUrl={concept.generatedImagePath ? coverImageDataUrls[concept.generatedImagePath] : undefined}
                        alt={concept.generatedImagePath ? `Generated finished cover: ${concept.text}` : `Reference frame at ${concept.timestamp}`}
                      />
                      {concept.generatedImagePath && (
                        <div className="pointer-events-none fixed left-[-10000px] top-0">
                          <ThumbnailCoverPreview
                            ref={node => { coverRefs.current[index] = node; }}
                            concept={concept}
                            imagePath={concept.generatedImagePath}
                            imageDataUrl={coverImageDataUrls[concept.generatedImagePath]}
                            alt={`Export canvas: ${concept.text}`}
                            exportSize
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-white">Direction {index + 1}</h4>
                          <span className="rounded bg-white/5 px-2 py-1 text-[10px] font-semibold text-6fb-green">{concept.timestamp}</span>
                        </div>
                        <div className="space-y-3 border-y border-6fb-border py-3">
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-6fb-text-muted" htmlFor={`thumbnail-headline-${index}`}>Exact headline</label>
                            <input
                              id={`thumbnail-headline-${index}`}
                              value={concept.text}
                              onChange={event => updateConcept(index, { text: event.target.value.toUpperCase() })}
                              maxLength={80}
                              className="w-full rounded-md border border-6fb-border bg-black/30 px-2.5 py-2 text-sm font-black uppercase tracking-tight text-white outline-none focus:border-6fb-green"
                            />
                            <p className="mt-1 text-[10px] text-6fb-text-muted">Use 2-4 words. The app renders this exact text at full thumbnail scale in the exported PNG.</p>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-6fb-text-muted">Hook
                              <select value={concept.creativeLane} onChange={event => updateConcept(index, { creativeLane: event.target.value as ThumbnailConcept['creativeLane'] })} className="mt-1 w-full rounded-md border border-6fb-border bg-black/30 px-2 py-2 text-[11px] font-semibold normal-case tracking-normal text-white outline-none focus:border-6fb-green">
                                {THUMBNAIL_CREATIVE_LANES.map(lane => (
                                  <option key={lane} value={lane} disabled={packageValue.thumbnails.some((other, otherIndex) => otherIndex !== index && other.creativeLane === lane)}>
                                    {lane}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-6fb-text-muted">Accent
                              <select value={concept.accent} onChange={event => updateConcept(index, { accent: event.target.value as ThumbnailConcept['accent'] })} className="mt-1 w-full rounded-md border border-6fb-border bg-black/30 px-2 py-2 text-[11px] font-semibold normal-case tracking-normal text-white outline-none focus:border-6fb-green">
                                {THUMBNAIL_ACCENTS.map(accent => <option key={accent} value={accent}>{accent}</option>)}
                              </select>
                            </label>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-6fb-text-muted">Graphic
                              <select value={concept.treatment} onChange={event => updateConcept(index, { treatment: event.target.value as ThumbnailConcept['treatment'] })} className="mt-1 w-full rounded-md border border-6fb-border bg-black/30 px-2 py-2 text-[11px] font-semibold normal-case tracking-normal text-white outline-none focus:border-6fb-green">
                                {THUMBNAIL_TREATMENTS.map(treatment => <option key={treatment} value={treatment}>{treatment.replace('-', ' ')}</option>)}
                              </select>
                            </label>
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-6fb-text-muted" htmlFor={`thumbnail-direction-${index}`}>Visual proof cue</label>
                            <textarea
                              id={`thumbnail-direction-${index}`}
                              value={concept.visualDirection}
                              onChange={event => updateConcept(index, { visualDirection: event.target.value })}
                              rows={3}
                              className="w-full resize-none rounded-md border border-6fb-border bg-black/30 px-2.5 py-2 text-xs leading-relaxed text-white outline-none focus:border-6fb-green"
                            />
                          </div>
                        </div>
                        <p className="mt-3 border-t border-6fb-border pt-3 text-[11px] leading-relaxed text-6fb-text-muted">{concept.transcriptEvidence}</p>
                        <button
                          onClick={() => void generateFinishedCover(concept, index)}
                          disabled={generatingCover !== null || exportingCover !== null}
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-6fb-green px-3 py-2 text-xs font-bold text-black hover:bg-6fb-green-hover disabled:cursor-wait disabled:opacity-60"
                        >
                          <Sparkles size={14} aria-hidden="true" />
                          {generatingCover === concept.text ? 'Generating finished cover...' : concept.generatedImagePath ? 'Regenerate finished cover' : 'Generate finished cover'}
                        </button>
                        {concept.generatedImagePath && (
                          <button
                            onClick={() => void exportFinishedCover(concept, index)}
                            disabled={generatingCover !== null || exportingCover !== null}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-6fb-border px-3 py-2 text-xs font-bold text-white hover:border-white/30 disabled:cursor-wait disabled:opacity-60"
                          >
                            <Download size={14} aria-hidden="true" />
                            {exportingCover === index ? 'Exporting exact cover...' : 'Export finished PNG'}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 border-y border-6fb-border py-5 md:grid-cols-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-6fb-text-muted">Description</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white">{packageValue.description}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-6fb-text-muted">One CTA</h3>
                  <p className="mt-3 text-sm leading-7 text-white">{packageValue.cta}</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
