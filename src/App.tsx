import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Setup from './pages/Setup';
import ClipExtractor from './pages/ClipExtractor';
import CarouselStudio from './pages/CarouselStudio';
import BrandStudio from './pages/BrandStudio';
import BlogWriter from './pages/BlogWriter';
import Settings from './pages/Settings';
import VideoEditor from './pages/VideoEditor';
import Scheduler from './pages/Scheduler';
import { useStudioStats } from './hooks/useStudioStats';
import UpdateBanner from './components/UpdateBanner';

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
      getAllSettings: () => Promise<{ apiKeys: { claude: boolean; openai: boolean }; setupComplete: boolean }>;
      completeSetup: () => Promise<{ success: boolean }>;
      // Files
      selectVideo: () => Promise<{ cancelled: boolean; filePath?: string }>;
      selectOutputDir: () => Promise<{ cancelled: boolean; dirPath?: string }>;
      selectLogo: () => Promise<{ cancelled: boolean; filePath?: string }>;
    selectImageFile: () => Promise<{ cancelled: boolean; filePath?: string }>;
      // Clips
      extractClips: (videoPath: string, options: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      // Carousel
      generateCarousel: (data: { topic: string; type: string; keyPoints: string[]; brandProfile?: BrandProfile }) => Promise<{ success: boolean; slides?: CarouselSlide[]; error?: string }>;
      extractCarousel: (data: { transcript: string; brandProfile: BrandProfile; contentType: string }) => Promise<{ success: boolean; slides?: CarouselSlide[]; error?: string }>;
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
      generateBlogPost: (data: { transcript: string; brandProfile: object; contentType: string }) => Promise<{ success: boolean; blogPost?: { title: string; metaDescription: string; sections: { id: string; heading: string; imageTimestamp: string; imagePath: string | null; body: string }[] }; error?: string }>;
      saveBlogPost: (data: { title: string; metaDescription: string; sections: object[]; brandSnapshot: object }) => Promise<{ success: boolean; id?: string }>;
      listBlogPosts: () => Promise<{ posts: { id: string; title: string; sectionCount: number; createdAt: string }[] }>;
      loadBlogPost: (id: string) => Promise<{ success: boolean; data?: unknown }>;
      deleteBlogPost: (id: string) => Promise<{ success: boolean }>;
      exportBlogMarkdown: (data: { title: string; metaDescription: string; sections: { heading: string; body: string; imagePath?: string | null }[] }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      // Brand
      saveBrandProfile: (profile: BrandProfile) => Promise<{ success: boolean }>;
      getBrandProfile: () => Promise<BrandProfile>;
      // System
      renderVideo: (compositionId: string, props: Record<string, unknown> & { cuts?: {start: number, end: number}[] }) => Promise<{ success: boolean; error?: string }>;
      postToSocial: (platform: string, content: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
      checkSystemHealth: () => Promise<unknown>;
      resetApp: () => Promise<{ success: boolean }>;
      openPath: (path: string) => Promise<{ success: boolean }>;
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
      getScheduledPosts: () => Promise<unknown[]>;
      saveScheduledPost: (post: unknown) => Promise<{ success: boolean }>;
      deleteScheduledPost: (id: string) => Promise<{ success: boolean }>;
      markPostAsPosted: (id: string) => Promise<{ success: boolean }>;
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
        localStats: { totalRuns: number; totalClips: number; postedClips: number; totalCarousels: number; totalBlogs: number; totalScheduled: number; postedScheduled: number };
        igConnected: boolean;
        account: { username: string; followers_count: number; media_count: number; profile_picture_url?: string } | null;
        media: unknown[];
        error?: string;
      }>;
    };
  }
}

export type Page = 'dashboard' | 'clips' | 'carousel' | 'brand' | 'editor' | 'schedule' | 'analytics' | 'blog' | 'settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [hasClaudeKey, setHasClaudeKey] = useState<boolean>(false);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const { stats, increment } = useStudioStats();

  const onClipCreated = useCallback(() => increment('clipsCreated'), [increment]);
  const onCarouselCreated = useCallback(() => increment('carouselsMade'), [increment]);
  const onBlogCreated = useCallback(() => increment('blogPostsWritten'), [increment]);

  useEffect(() => {
    if (!window.electronAPI) {
      (window as unknown as { electronAPI: typeof window.electronAPI }).electronAPI = {
        saveApiKey: async () => ({ success: true }),
        getApiKey: async () => ({ hasKey: false, hint: null }),
        getAllSettings: async () => ({ apiKeys: { claude: false, openai: false }, setupComplete: false }),
        completeSetup: async () => ({ success: true }),
        selectVideo: async () => ({ cancelled: true }),
        selectOutputDir: async () => ({ cancelled: true }),
        selectLogo: async () => ({ cancelled: true }),
        selectImageFile: async () => ({ cancelled: true }),
        extractClips: async () => ({ success: false, error: 'Electron required' }),
        readClipTranscript: async () => null,
        // Carousel Persistence & Export
        exportCarouselDeck: async () => ({ success: false, error: 'Not implemented in browser' }),
        saveCarousel: async () => ({ success: false, error: 'Not implemented in browser' }),
        generateCarousel: async () => ({ success: false, error: 'Electron required' }),
        extractCarousel: async () => ({ success: false, error: 'Electron required' }),
        readTranscript: async () => ({ success: false, error: 'Electron required' }),
        autoMatchCarouselFrames: async () => ({ success: false, error: 'Electron required' }),
        saveBrandProfile: async () => ({ success: true }),
        getBrandProfile: async () => ({
          brandName: '6FB Mentorship', primaryColor: '#00C851', accentColor: '#ffffff',
          backgroundColor: '#0f0f0f', fontPreset: 'clean-pro', headlineFont: 'Space Grotesk',
          bodyFont: 'Inter', layoutStyle: 'bold', tone: 'professional', logoPath: null,
        }),
        renderVideo: async () => ({ success: false, error: 'Electron required' }),
        postToSocial: async () => ({ success: false, error: 'Electron required' }),
        onProgress: () => () => {},
        deleteApiKey: async () => ({ success: true }),
        checkSystemHealth: async () => ({
          deps: { python: false, ffmpeg: false, mediapipe: false, clipExtractor: false },
          paths: { userData: '~/Library/Application Support/6fb-content-studio', ixClipExtractor: '' },
          apiKeys: { claude: true, openai: false },
        }),
        resetApp: async () => ({ success: true }),
        openPath: async () => ({ success: true }),
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
        getScheduledPosts: async () => [],
        saveScheduledPost: async () => ({ success: true }),
        deleteScheduledPost: async () => ({ success: true }),
        markPostAsPosted: async () => ({ success: true }),
        onPostDue: () => () => {},
        login6FB: async () => ({ success: false, error: 'Electron required' }),
        syncInstagramCredentials: async () => ({ success: false, error: 'Electron required' }),
        get6FBAccount: async () => ({ email: null, igUsername: null, igTokenExpiresAt: null, connected: false }),
        disconnect6FB: async () => ({ success: true }),
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
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-y-auto">
        {currentPage === 'dashboard'  && <Dashboard onNavigate={setCurrentPage} stats={stats} hasBrandProfile={!!brandProfile} />}
        {currentPage === 'clips'      && <ClipExtractor onClipCreated={onClipCreated} />}
        {currentPage === 'carousel'   && <CarouselStudio brandProfile={brandProfile} onNavigateToBrand={() => setCurrentPage('brand')} onCarouselCreated={onCarouselCreated} hasClaudeKey={hasClaudeKey} />}
        {currentPage === 'brand'      && <BrandStudio onSave={setBrandProfile} />}
        {currentPage === 'blog'       && <BlogWriter brandProfile={brandProfile} onBlogCreated={onBlogCreated} hasClaudeKey={hasClaudeKey} />}
        {currentPage === 'editor'     && <VideoEditor />}
        {currentPage === 'schedule'   && <Scheduler />}
        {currentPage === 'analytics'  && <ComingSoon title="Content Analytics" />}
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
