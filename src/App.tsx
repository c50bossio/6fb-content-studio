import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Setup from './pages/Setup';
import ClipExtractor from './pages/ClipExtractor';
import CarouselStudio from './pages/CarouselStudio';
import BrandStudio from './pages/BrandStudio';
import BlogWriter from './pages/BlogWriter';
import ContentPlanner from './pages/ContentPlanner';
import VideoEditor from './pages/VideoEditor';
import PostScheduler from './pages/PostScheduler';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { useStudioStats } from './hooks/useStudioStats';
import type { ContentStrategyBrief } from './types/content-strategy';

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

export interface EditorClip {
  title: string;
  clipDir: string;
  wordsJsonPath: string;
  editedSpecPath: string;
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

export interface SavedCarouselMeta {
  id: string;
  title: string;
  slideCount: number;
  createdAt: string;
  playbookPostId?: string;
  playbookTopicId?: string;
}

declare global {
  interface Window {
    electronAPI: {
      // API Keys
      saveApiKey: (provider: string, key: string) => Promise<{ success: boolean }>;
      getApiKey: (provider: string) => Promise<{ hasKey: boolean; hint: string | null }>;
      deleteApiKey: (provider: string) => Promise<{ success: boolean }>;
      getAllSettings: () => Promise<{ apiKeys: { claude: boolean; openai: boolean }; setupComplete: boolean; version?: string }>;
      getAppVersion: () => Promise<string>;
      completeSetup: () => Promise<{ success: boolean }>;
      // Files
      selectVideo: () => Promise<{ cancelled: boolean; filePath?: string }>;
      selectOutputDir: () => Promise<{ cancelled: boolean; dirPath?: string }>;
      selectLogo: () => Promise<{ cancelled: boolean; filePath?: string }>;
    selectImageFile: () => Promise<{ cancelled: boolean; filePath?: string }>;
      // Clips
      extractClips: (videoPath: string, options: Record<string, unknown> & { strategyBrief?: ContentStrategyBrief | null }) => Promise<{ success: boolean; data?: unknown; error?: string; runId?: string }>;
      // Carousel
      generateCarousel: (data: {
        topic: string; type: string; keyPoints: string[]; brandProfile?: BrandProfile;
        playbookBrief?: { topicTitle: string; pillar: string; hookIdea: string; visualSuggestion: string; shotList: string[] };
        strategyBrief?: ContentStrategyBrief | null;
        playbookPostId?: string; playbookTopicId?: string;
      }) => Promise<{ success: boolean; slides?: CarouselSlide[]; playbookPostId?: string; playbookTopicId?: string; error?: string }>;
      extractCarousel: (data: {
        transcript: string; brandProfile: BrandProfile; contentType: string; strategyBrief?: ContentStrategyBrief | null;
        playbookBrief?: { topicTitle: string; pillar: string; hookIdea: string; visualSuggestion: string; shotList: string[] };
        playbookPostId?: string; playbookTopicId?: string;
      }) => Promise<{ success: boolean; slides?: CarouselSlide[]; playbookPostId?: string; playbookTopicId?: string; error?: string }>;
      readTranscript: (runPath: string) => Promise<{ success: boolean; transcript?: string; format?: string; error?: string }>;
      autoMatchCarouselFrames: (data: { runPath: string; timestamps: string[] }) => Promise<{ success: boolean; frames?: (string | null)[]; error?: string }>;
      // Carousel Persistence & Export
      exportCarouselDeck: (title: string, images: string[], strategySnapshot?: ContentStrategyBrief | null) => Promise<{ success: boolean; folderPath?: string; savedPaths?: string[]; error?: string }>;
      saveTempMediaFiles: (title: string, images: string[]) => Promise<{ success: boolean; folderPath?: string; savedPaths?: string[]; error?: string }>;
      saveCarousel: (data: { title: string; slides: object[]; brandSnapshot: object; strategySnapshot?: ContentStrategyBrief | null; playbookPostId?: string; playbookTopicId?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
      listCarousels: () => Promise<{ carousels: { id: string; title: string; slideCount: number; createdAt: string }[] }>;
      loadCarousel: (id: string) => Promise<{ success: boolean; data?: { slides: CarouselSlide[]; title: string; brandSnapshot: BrandProfile; strategySnapshot?: ContentStrategyBrief | null } }>;
      deleteCarousel: (id: string) => Promise<{ success: boolean }>;
      renameCarousel: (id: string, title: string) => Promise<{ success: boolean }>;
      // Playbook
      fetchTodayBrief: () => Promise<{
        postId: string; topicId: string; topicTitle: string; pillar: string;
        contentType: string; hookIdea: string; visualSuggestion: string;
        shotList: string[]; hashtagSet: string[]; bestPostingTime: string;
      } | { postId: null } | null>;
      fetchPlaybookTopics: () => Promise<{ weekStart: string; weekEnd: string; posts: {
        postId: string; topicId: string; scheduledDay: string; topicTitle: string;
        pillar: string; contentType: string; status: string;
      }[] } | []>;
      // Planner
      generateVideoPlan: (data: { topic: string; type: string; duration: string; perspective: string; useRag?: boolean; targetLocation?: string; strategyBrief?: Partial<ContentStrategyBrief> }) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      // Blog
      generateBlogPost: (data: { transcript: string; brandProfile: object; contentType: string; strategyBrief?: ContentStrategyBrief | null }) => Promise<{ success: boolean; blogPost?: { title: string; metaDescription: string; sections: { id: string; heading: string; imageTimestamp: string; imagePath: string | null; body: string }[] }; error?: string }>;
      saveBlogPost: (data: { title: string; metaDescription: string; sections: object[]; brandSnapshot: object; strategySnapshot?: ContentStrategyBrief | null }) => Promise<{ success: boolean; id?: string }>;
      listBlogPosts: () => Promise<{ posts: { id: string; title: string; sectionCount: number; createdAt: string }[] }>;
      loadBlogPost: (id: string) => Promise<{ success: boolean; data?: unknown }>;
      deleteBlogPost: (id: string) => Promise<{ success: boolean }>;
      exportBlogMarkdown: (data: { title: string; metaDescription: string; sections: { heading: string; body: string; imagePath?: string | null }[]; strategySnapshot?: ContentStrategyBrief | null }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      // Brand
      saveBrandProfile: (profile: BrandProfile) => Promise<{ success: boolean }>;
      getBrandProfile: () => Promise<BrandProfile>;
      // System
      checkSystemHealth: () => Promise<unknown>;
      resetApp: () => Promise<{ success: boolean }>;
      openPath: (path: string) => Promise<{ success: boolean }>;
      // Library
      scanLibrary: () => Promise<unknown>;
      deleteRun: (runId: string) => Promise<{ success: boolean }>;
      deleteClip: (clipPath: string) => Promise<{ success: boolean }>;
      renameClip: (specPath: string, newTitle: string) => Promise<{ success: boolean }>;
      generateThumbnail: (videoPath: string, thumbPath: string) => Promise<{ success: boolean; thumbPath?: string }>;
      // Progress
      onProgress: (callback: (data: { percent: number; label: string }) => void) => () => void;
      // Publishing
      pushToScheduler: (payload: { filePath?: string; mediaFiles?: string[]; caption: string; mediaType: 'image' | 'video' | 'carousel'; scheduledFor: string; hashtags?: string[]; isTrial?: boolean; playbookPostId?: string; strategySnapshot?: ContentStrategyBrief | null }) => Promise<{ success: boolean; post?: unknown; error?: string }>;
      // Video Editor
      loadWordsJson: (path: string) => Promise<{ success: boolean; data?: { words: Array<{ word: string; start_ms: number; end_ms: number }> }; error?: string }>;
      exportEditedSpec: (path: string, spec: object) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export type Page = 'dashboard' | 'planner' | 'clips' | 'carousel' | 'brand' | 'editor' | 'schedule' | 'analytics' | 'blog' | 'settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [hasClaudeKey, setHasClaudeKey] = useState<boolean>(false);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [editorClip, setEditorClip] = useState<EditorClip | null>(null);
  const { stats, increment } = useStudioStats();

  const onClipCreated = useCallback(() => increment('clipsCreated'), [increment]);
  const onCarouselCreated = useCallback(() => increment('carouselsMade'), [increment]);
  const onBlogCreated = useCallback(() => increment('blogPostsWritten'), [increment]);

  const handleOpenInEditor = useCallback((clip: EditorClip) => {
    setEditorClip(clip);
    setCurrentPage('editor');
  }, []);

  useEffect(() => {
    if (!window.electronAPI) {
      (window as unknown as { electronAPI: typeof window.electronAPI }).electronAPI = {
        saveApiKey: async () => ({ success: true }),
        getApiKey: async () => ({ hasKey: false, hint: null }),
        getAllSettings: async () => ({ apiKeys: { claude: false, openai: false }, setupComplete: false }),
        getAppVersion: async () => '1.1.0',
        completeSetup: async () => ({ success: true }),
        selectVideo: async () => ({ cancelled: true }),
        selectOutputDir: async () => ({ cancelled: true }),
        selectLogo: async () => ({ cancelled: true }),
        selectImageFile: async () => ({ cancelled: true }),
        extractClips: async () => ({ success: false, error: 'Electron required' }),
        // Carousel Persistence & Export
        exportCarouselDeck: async () => ({ success: false, error: 'Not implemented in browser' }),
        saveTempMediaFiles: async () => ({ success: false, error: 'Not implemented in browser' }),
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
        onProgress: () => () => {},
        pushToScheduler: async () => ({ success: false, error: 'Electron required' }),
        deleteApiKey: async () => ({ success: true }),
        checkSystemHealth: async () => ({
          deps: { python: false, ffmpeg: false, ffprobe: false, mediapipe: false, clipExtractor: false },
          paths: { userData: '~/Library/Application Support/6fb-content-studio', clipExtractor: '' },
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
        generateVideoPlan: async () => ({ success: false, error: 'Electron required' }),
        generateBlogPost: async () => ({ success: false, error: 'Electron required' }),
        saveBlogPost: async () => ({ success: false }),
        listBlogPosts: async () => ({ posts: [] }),
        loadBlogPost: async () => ({ success: false }),
        deleteBlogPost: async () => ({ success: true }),
        exportBlogMarkdown: async () => ({ success: false, error: 'Electron required' }),
        fetchPlaybookTopics: async () => [],
        fetchTodayBrief: async () => null,
        loadWordsJson: async () => ({ success: false, error: 'Electron required' }),
        exportEditedSpec: async () => ({ success: false, error: 'Electron required' }),
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
        {currentPage === 'dashboard'  && <Dashboard onNavigate={setCurrentPage} stats={stats} />}
        {currentPage === 'planner'    && <ContentPlanner onPlanCreated={onClipCreated} hasClaudeKey={hasClaudeKey} />}
        {currentPage === 'clips'      && <ClipExtractor onClipCreated={onClipCreated} />}
        {currentPage === 'carousel'   && <CarouselStudio brandProfile={brandProfile} onNavigateToBrand={() => setCurrentPage('brand')} onCarouselCreated={onCarouselCreated} hasClaudeKey={hasClaudeKey} />}
        {currentPage === 'brand'      && <BrandStudio onSave={setBrandProfile} />}
        {currentPage === 'blog'       && <BlogWriter brandProfile={brandProfile} onBlogCreated={onBlogCreated} hasClaudeKey={hasClaudeKey} />}
        {currentPage === 'editor'     && <VideoEditor brandProfile={brandProfile} editorClip={editorClip} onNavigateToClips={() => setCurrentPage('clips')} />}
        {currentPage === 'schedule'   && <PostScheduler />}
        {currentPage === 'analytics'  && <Analytics />}
        {currentPage === 'settings'   && <Settings />}
      </main>
    </div>
  );
}
