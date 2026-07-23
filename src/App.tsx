import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Setup from './pages/Setup';
import ClipExtractor from './pages/ClipExtractor';
import VideoPlanner from './pages/VideoPlanner';
import CarouselStudio from './pages/CarouselStudio';
import BrandStudio from './pages/BrandStudio';
import BlogWriter from './pages/BlogWriter';
import Settings from './pages/Settings';
import VideoEditor from './pages/VideoEditor';
import Scheduler from './pages/Scheduler';
import Analytics from './pages/Analytics';
import { useStudioStats } from './hooks/useStudioStats';
import UpdateBanner from './components/UpdateBanner';
import type { ContentBrain, ContentStrategyBrief } from './types/content-strategy';
import type { PublishingQueueResponse } from './types/publishing';
import type { ScheduleDraft } from './types/creation-handoff';
import type { TrendFeed } from './types/trends';

export interface BrandProfile {
  brandName: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontPreset: string;
  headlineFont: string;
  bodyFont: string;
  layoutStyle: 'minimal' | 'bold' | 'editorial' | 'streetwear' | 'luxury' | 'data-forward';
  tone: 'professional' | 'hype' | 'storyteller' | 'data-driven';
  logoPath: string | null;
}

export interface CarouselSlide {
  slideNumber: number;
  heading: string;
  body: string;
  stat?: string;
  ctaText?: string;
  timestamp?: string;
  framePath?: string | null;
  slideType: 'cover' | 'content' | 'cta';
}

declare global {
  interface Window {
    electronAPI: {
      // API Keys
      saveApiKey: (provider: string, key: string) => Promise<{ success: boolean }>;
      getApiKey: (provider: string) => Promise<{ hasKey: boolean; hint: string | null }>;
      deleteApiKey: (provider: string) => Promise<{ success: boolean }>;
      getAllSettings: () => Promise<{ apiKeys: { claude: boolean; openai: boolean }; contentPlannerToken: boolean; setupComplete: boolean }>;
      completeSetup: () => Promise<{ success: boolean }>;
      // Files
      selectVideo: () => Promise<{ cancelled: boolean; filePath?: string }>;
      selectOutputDir: () => Promise<{ cancelled: boolean; dirPath?: string }>;
      selectLogo: () => Promise<{ cancelled: boolean; filePath?: string }>;
      selectImageFile: () => Promise<{ cancelled: boolean; filePath?: string }>;
      checkMediaFile: (filePath: string) => Promise<{ success: boolean; exists: boolean; error?: string }>;
      // Clips
      extractClips: (videoPath: string, options: Record<string, unknown> & { strategyBrief?: ContentStrategyBrief }) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      cancelExtraction: () => Promise<{ success: boolean }>;
      // Carousel
      generateCarousel: (data: { topic: string; type: string; keyPoints: string[]; brandProfile?: BrandProfile; strategyBrief?: ContentStrategyBrief }) => Promise<{ success: boolean; slides?: CarouselSlide[]; error?: string }>;
      extractCarousel: (data: { transcript: string; brandProfile: BrandProfile; contentType: string; strategyBrief?: ContentStrategyBrief }) => Promise<{ success: boolean; slides?: CarouselSlide[]; error?: string }>;
      readClipTranscript: (clipPath: string) => Promise<{ word: string; start: number; end: number }[] | null>;
      readTranscript: (runPath: string) => Promise<{ success: boolean; transcript?: string; format?: string; error?: string }>;
      autoMatchCarouselFrames: (data: { runPath: string; timestamps: string[] }) => Promise<{ success: boolean; frames?: (string | null)[]; error?: string }>;
      // Carousel Persistence & Export
      exportCarouselDeck: (title: string, images: string[]) => Promise<{ success: boolean; folderPath?: string; savedPaths?: string[]; error?: string }>;
      saveCarousel: (data: { title: string; slides: object[]; brandSnapshot: object }) => Promise<{ success: boolean; id?: string; error?: string }>;
      listCarousels: () => Promise<{ carousels: { id: string; title: string; slideCount: number; createdAt: string }[] }>;
      loadCarousel: (id: string) => Promise<{ success: boolean; data?: { slides: CarouselSlide[]; title: string; brandSnapshot: BrandProfile } }>;
      deleteCarousel: (id: string) => Promise<{ success: boolean }>;
      renameCarousel: (id: string, title: string) => Promise<{ success: boolean }>;
      // Blog
      generateBlogPost: (data: { transcript: string; brandProfile: object; contentType: string; strategyBrief?: ContentStrategyBrief }) => Promise<{ success: boolean; blogPost?: { title: string; metaDescription: string; sections: { id: string; heading: string; imageTimestamp: string; imagePath: string | null; body: string }[] }; error?: string }>;
      saveBlogPost: (data: { title: string; metaDescription: string; sections: object[]; brandSnapshot: object }) => Promise<{ success: boolean; id?: string }>;
      listBlogPosts: () => Promise<{ posts: { id: string; title: string; sectionCount: number; createdAt: string }[] }>;
      loadBlogPost: (id: string) => Promise<{ success: boolean; data?: unknown }>;
      deleteBlogPost: (id: string) => Promise<{ success: boolean }>;
      exportBlogMarkdown: (data: { title: string; metaDescription: string; sections: { heading: string; body: string; imagePath?: string | null }[] }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      // Brand
      saveBrandProfile: (profile: BrandProfile) => Promise<{ success: boolean }>;
      getBrandProfile: () => Promise<BrandProfile>;
      saveContentBrain: (brain: ContentBrain) => Promise<{ success: boolean }>;
      getContentBrain: () => Promise<ContentBrain>;
      // System
      getAppVersion: () => Promise<string>;
      renderVideo: (compositionId: string, props: Record<string, unknown> & { cuts?: {start: number, end: number}[] }) => Promise<{ success: boolean; error?: string }>;
      postToSocial: (platform: string, content: Record<string, unknown>) => Promise<{ success: boolean; opened: boolean; error?: string }>;
      checkSystemHealth: () => Promise<unknown>;
      resetApp: () => Promise<{ success: boolean }>;
      openPath: (path: string) => Promise<{ success: boolean }>;
      showInFinder: (path: string) => Promise<{ success: boolean }>;
      fetchTodayBrief: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
      fetchSmartTrends: () => Promise<TrendFeed>;
      getYouTubeTrendsConsent: () => Promise<{ accepted: boolean; acceptedVersion: string | null; currentVersion: string; accountConnected: boolean }>;
      setYouTubeTrendsConsent: (accepted: boolean) => Promise<{ success: boolean; accepted?: boolean; acceptedVersion?: string | null; error?: string }>;
      openTrendSource: (url: string) => Promise<{ success: boolean; error?: string }>;
      // Library
      scanLibrary: () => Promise<unknown>;
      deleteRun: (runId: string) => Promise<{ success: boolean }>;
      deleteClip: (clipPath: string) => Promise<{ success: boolean }>;
      renameClip: (specPath: string, newTitle: string) => Promise<{ success: boolean }>;
      trimClip: (data: { filePath: string; specPath: string; startSec: number; endSec: number }) => Promise<{ success: boolean; error?: string }>;
      generateThumbnail: (videoPath: string, thumbPath: string) => Promise<{ success: boolean; thumbPath?: string }>;
      // Progress
      onProgress: (callback: (data: { percent: number; label: string }) => void) => () => void;
      // Scheduler
      getPublishingQueue: () => Promise<PublishingQueueResponse>;
      getLocalPublishingQueue: () => Promise<PublishingQueueResponse>;
      getScheduledPosts: () => Promise<unknown[]>;
      saveScheduledPost: (post: unknown) => Promise<{ success: boolean }>;
      deleteScheduledPost: (id: string) => Promise<{ success: boolean }>;
      markPostAsPosted: (id: string) => Promise<{ success: boolean }>;
      markPostAsPublished: (id: string) => Promise<{ success: boolean }>;
      onPostDue: (callback: () => void) => () => void;
      // 6FB Account
      login6FB: (creds: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
      syncInstagramCredentials: () => Promise<{ success: boolean; username?: string; tokenExpiresAt?: string; error?: string }>;
      get6FBAccount: () => Promise<{ email: string | null; igUsername: string | null; igTokenExpiresAt: string | null; connected: boolean }>;
      disconnect6FB: () => Promise<{ success: boolean }>;
      // Auto-Updater
      checkForUpdate: () => Promise<{ success: boolean; updateInfo?: unknown }>;
      installUpdate: () => void;
      onUpdateAvailable: (cb: (info: { version: string }) => void) => () => void;
      onUpdateDownloaded: (cb: (info: { version: string }) => void) => () => void;
      // Instagram Direct Posting
      postReelToInstagram: (data: { filePath: string; caption: string }) => Promise<{ success: boolean; error?: string; mediaId?: string }>;
      postCarouselToInstagram: (data: { imagePaths: string[]; caption: string }) => Promise<{ success: boolean; error?: string; mediaId?: string }>;
      // Analytics
      getAnalytics: () => Promise<{
        success: boolean;
        localStats: { totalRuns: number; totalClips: number; postedClips: number; totalCarousels: number; totalBlogs: number; totalScheduled: number; totalQueue: number; postedScheduled: number; failedScheduled: number };
        igConnected: boolean;
        account: { username: string; followers_count: number; media_count: number; profile_picture_url?: string } | null;
        media: unknown[];
        error?: string;
      }>;
      // Video Planner
      generateVideoPlan: (data: { prompt: string }) => Promise<{ success: boolean; plan?: unknown; error?: string }>;
      saveVideoPlan: (plan: object) => Promise<{ success: boolean; id?: string; error?: string }>;
      listVideoPlans: () => Promise<{ plans: unknown[]; error?: string }>;
    };
  }
}

export type Page = 'dashboard' | 'planner' | 'clips' | 'carousel' | 'brand' | 'editor' | 'schedule' | 'analytics' | 'blog' | 'settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [hasClaudeKey, setHasClaudeKey] = useState<boolean>(false);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [editorClipPath, setEditorClipPath] = useState<string | null>(null);
  const [clipPlanHandoffId, setClipPlanHandoffId] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(null);
  const { stats, increment } = useStudioStats();

  const onClipCreated = useCallback(() => increment('clipsCreated'), [increment]);
  const onCarouselCreated = useCallback(() => increment('carouselsMade'), [increment]);
  const onBlogCreated = useCallback(() => increment('blogPostsWritten'), [increment]);
  const onVideoRendered = useCallback(() => increment('videosRendered'), [increment]);

  const navigate = useCallback((page: Page) => {
    setCurrentPage(page);
    setEditorClipPath(null);
    setClipPlanHandoffId(null);
    setScheduleDraft(null);
  }, []);

  const openClipsFromPlan = useCallback((planId: string) => {
    setClipPlanHandoffId(planId);
    setEditorClipPath(null);
    setScheduleDraft(null);
    setCurrentPage('clips');
  }, []);

  const openEditorForClip = useCallback((clip: { filePath?: string | null }) => {
    setEditorClipPath(clip.filePath || null);
    setClipPlanHandoffId(null);
    setScheduleDraft(null);
    setCurrentPage('editor');
  }, []);

  const openSchedulerDraft = useCallback((draft: ScheduleDraft) => {
    setScheduleDraft(draft);
    setClipPlanHandoffId(null);
    setEditorClipPath(null);
    setCurrentPage('schedule');
  }, []);

  useEffect(() => {
    if (!window.electronAPI) {
      const localJson = <T extends object>(key: string, fallback: T): T => {
        try {
          const value = localStorage.getItem(key);
          return value ? { ...fallback, ...JSON.parse(value) } : fallback;
        } catch {
          return fallback;
        }
      };
      const localList = <T,>(key: string): T[] => {
        try {
          const value = localStorage.getItem(key);
          const parsed = value ? JSON.parse(value) : [];
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };
      const mockBrandProfile: BrandProfile = {
        brandName: '6FB Mentorship',
        primaryColor: '#00C851',
        accentColor: '#ffffff',
        backgroundColor: '#0f0f0f',
        fontPreset: 'clean-pro',
        headlineFont: 'Space Grotesk',
        bodyFont: 'Inter',
        layoutStyle: 'bold',
        tone: 'professional',
        logoPath: null,
      };
      const mockContentBrain: ContentBrain = {
        audience: '',
        positioning: '',
        offers: [],
        contentPillars: [],
        proofAssets: [],
        voiceRules: [],
        preferredPhrases: [],
        avoidedPhrases: [],
        exampleHooks: [],
      };
      (window as unknown as { electronAPI: typeof window.electronAPI }).electronAPI = {
        saveApiKey: async (provider: string, _key: string) => {
          if (provider === 'claude') localStorage.setItem('contentStudio:hasClaudeKey', 'true');
          return { success: true };
        },
        getApiKey: async (provider: string) => ({
          hasKey: provider === 'claude' && localStorage.getItem('contentStudio:hasClaudeKey') === 'true',
          hint: null,
        }),
        getAllSettings: async () => ({
          apiKeys: { claude: localStorage.getItem('contentStudio:hasClaudeKey') === 'true', openai: false },
          contentPlannerToken: false,
          setupComplete: localStorage.getItem('contentStudio:setupComplete') === 'true',
        }),
        completeSetup: async () => {
          localStorage.setItem('contentStudio:setupComplete', 'true');
          return { success: true };
        },
        selectVideo: async () => ({ cancelled: true }),
        selectOutputDir: async () => ({ cancelled: true }),
        selectLogo: async () => ({ cancelled: true }),
        selectImageFile: async () => ({ cancelled: true }),
        checkMediaFile: async () => ({ success: false, exists: false, error: 'Electron required' }),
        extractClips: async () => ({ success: false, error: 'Electron required' }),
        cancelExtraction: async () => ({ success: true }),
        readClipTranscript: async () => null,
        // Carousel Persistence & Export
        exportCarouselDeck: async () => ({ success: false, error: 'Not implemented in browser' }),
        saveCarousel: async () => ({ success: false, error: 'Not implemented in browser' }),
        generateCarousel: async () => ({ success: false, error: 'Electron required' }),
        extractCarousel: async () => ({ success: false, error: 'Electron required' }),
        readTranscript: async () => ({ success: false, error: 'Electron required' }),
        autoMatchCarouselFrames: async () => ({ success: false, error: 'Electron required' }),
        saveBrandProfile: async (profile: BrandProfile) => {
          localStorage.setItem('contentStudio:brandProfile', JSON.stringify(profile));
          return { success: true };
        },
        getBrandProfile: async () => localJson('contentStudio:brandProfile', mockBrandProfile),
        saveContentBrain: async (brain: ContentBrain) => {
          localStorage.setItem('contentStudio:contentBrain', JSON.stringify(brain));
          return { success: true };
        },
        getContentBrain: async () => localJson('contentStudio:contentBrain', mockContentBrain),
        renderVideo: async () => ({ success: false, error: 'Electron required' }),
        postToSocial: async () => ({ success: false, opened: false, error: 'Electron required' }),
        onProgress: () => () => {},
        deleteApiKey: async (provider: string) => {
          if (provider === 'claude') localStorage.removeItem('contentStudio:hasClaudeKey');
          return { success: true };
        },
        checkSystemHealth: async () => ({
          deps: { python: false, ffmpeg: false, ffprobe: false, mediapipe: false, clipExtractor: false },
          paths: { userData: '~/Library/Application Support/6fb-content-studio', clipExtractor: '' },
          apiKeys: { claude: true, openai: false },
        }),
        getAppVersion: async () => 'browser-preview',
        resetApp: async () => ({ success: true }),
        openPath: async () => ({ success: true }),
        showInFinder: async () => ({ success: true }),
        fetchTodayBrief: async () => ({ success: false, error: 'Electron required' }),
        fetchSmartTrends: async () => ({
          fetchedAt: new Date().toISOString(),
          ideas: [
            {
              id: 'preview-idea-starter',
              title: 'The consultation habit that builds repeat clientele',
              sourceId: 'idea-starter',
              sourceLabel: 'Idea starters',
              evidenceState: 'idea-starter',
              whyNow: 'Timeless barber-specific inspiration; no live trend evidence.',
            },
          ],
          sources: [
            { sourceId: 'google-trends', sourceLabel: 'Google Trends', state: 'unavailable', message: 'Open the Electron app to check live sources.' },
            { sourceId: 'instagram', sourceLabel: 'Instagram', state: 'not-connected', message: 'Open the Electron app to use an authorized account.' },
            { sourceId: 'content-planner', sourceLabel: 'Your plan', state: 'not-connected', message: 'Open the Electron app to include your plan.' },
          ],
          youtube: {
            results: [],
            status: { sourceId: 'youtube', sourceLabel: 'YouTube', state: 'not-connected', message: 'Sign in to 6FB and enable YouTube inspiration in Settings.' },
          },
        }),
        getYouTubeTrendsConsent: async () => ({ accepted: false, acceptedVersion: null, currentVersion: '2026-07-22', accountConnected: false }),
        setYouTubeTrendsConsent: async () => ({ success: false, error: 'Electron required' }),
        openTrendSource: async () => ({ success: true }),
        scanLibrary: async () => ({ runs: [] }),
        deleteRun: async () => ({ success: true }),
        deleteClip: async () => ({ success: true }),
        renameClip: async () => ({ success: true }),
        generateThumbnail: async () => ({ success: false }),
        listCarousels: async () => ({ carousels: [] }),
        loadCarousel: async () => ({ success: false }),
        deleteCarousel: async () => ({ success: true }),
        renameCarousel: async () => ({ success: true }),
        generateBlogPost: async () => ({ success: false, error: 'Electron required' }),
        saveBlogPost: async () => ({ success: false }),
        listBlogPosts: async () => ({ posts: [] }),
        loadBlogPost: async () => ({ success: false }),
        deleteBlogPost: async () => ({ success: true }),
        exportBlogMarkdown: async () => ({ success: false, error: 'Electron required' }),
        getPublishingQueue: async () => ({ success: true, posts: [], source: 'local', fetchedAt: new Date().toISOString() }),
        getLocalPublishingQueue: async () => ({ success: true, posts: [], source: 'local', fetchedAt: new Date().toISOString() }),
        getScheduledPosts: async () => [],
        saveScheduledPost: async () => ({ success: true }),
        deleteScheduledPost: async () => ({ success: true }),
        markPostAsPosted: async () => ({ success: true }),
        markPostAsPublished: async () => ({ success: true }),
        onPostDue: () => () => {},
        login6FB: async () => ({ success: false, error: 'Electron required' }),
        syncInstagramCredentials: async () => ({ success: false, error: 'Electron required' }),
        get6FBAccount: async () => ({ email: null, igUsername: null, igTokenExpiresAt: null, connected: false }),
        disconnect6FB: async () => ({ success: true }),
        getAnalytics: async () => ({
          success: true,
          localStats: { totalRuns: 0, totalClips: 0, postedClips: 0, totalCarousels: 0, totalBlogs: 0, totalScheduled: 0, totalQueue: 0, postedScheduled: 0, failedScheduled: 0 },
          igConnected: false,
          account: null,
          media: [],
        }),
        generateVideoPlan: async () => ({ success: false, error: 'Electron required' }),
        saveVideoPlan: async (plan: object) => {
          const plans = localList<object>('contentStudio:videoPlans');
          const planWithId = { id: Date.now().toString(), ...plan };
          localStorage.setItem('contentStudio:videoPlans', JSON.stringify([planWithId, ...plans]));
          return { success: true, id: (planWithId as { id: string }).id };
        },
        listVideoPlans: async () => ({
          plans: localList<Record<string, unknown>>('contentStudio:videoPlans')
            .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))),
        }),
      } as unknown as typeof window.electronAPI;
    }

    window.electronAPI.getAllSettings().then(s => {
      setSetupComplete(s.setupComplete);
      setHasClaudeKey(s.apiKeys?.claude || false);
    }).catch(() => setSetupComplete(false));
    window.electronAPI.getBrandProfile().then(setBrandProfile).catch(() => {});
  }, [currentPage]);

  const handleSetupDone = () => { setSetupComplete(true); setCurrentPage('dashboard'); };

  if (setupComplete === null) {
    return (
      <div className="h-screen bg-6fb-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-6fb-border border-t-6fb-green rounded-full animate-spin" />
      </div>
    );
  }

  if (!setupComplete) return <Setup onComplete={handleSetupDone} />;

  return (
    <div className="h-screen bg-6fb-bg flex overflow-hidden">
      <Sidebar currentPage={currentPage} onNavigate={navigate} />
      <main className="flex-1 min-w-0 overflow-y-auto pt-14 lg:pt-0">
        {currentPage === 'dashboard'  && <Dashboard onNavigate={navigate} stats={stats} hasBrandProfile={!!brandProfile} />}
        {currentPage === 'planner'   && <VideoPlanner onCreateFromPlan={openClipsFromPlan} />}
        {currentPage === 'clips'      && <ClipExtractor initialPlanId={clipPlanHandoffId} onPlanHandoffConsumed={() => setClipPlanHandoffId(null)} onClipCreated={onClipCreated} onNavigateToEditor={openEditorForClip} onScheduleClip={openSchedulerDraft} />}
        {currentPage === 'carousel'   && <CarouselStudio brandProfile={brandProfile} onNavigateToBrand={() => navigate('brand')} onCarouselCreated={onCarouselCreated} hasClaudeKey={hasClaudeKey} />}
        {currentPage === 'brand'      && <BrandStudio onSave={setBrandProfile} />}
        {currentPage === 'blog'       && <BlogWriter brandProfile={brandProfile} onBlogCreated={onBlogCreated} hasClaudeKey={hasClaudeKey} />}
        {currentPage === 'editor'     && <VideoEditor initialClipPath={editorClipPath} onVideoRendered={onVideoRendered} onScheduleExport={openSchedulerDraft} />}
        {currentPage === 'schedule'   && <Scheduler initialDraft={scheduleDraft} />}
        {currentPage === 'analytics'  && <Analytics />}
        {currentPage === 'settings'   && <Settings />}
      </main>
      <UpdateBanner />
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8">
      <div className="w-12 h-12 text-[#2a2a2a] mb-5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-6fb-text-secondary text-sm">Coming in Phase 2</p>
    </div>
  );
}
