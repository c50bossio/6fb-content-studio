import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Setup from './pages/Setup';
import ClipExtractor from './pages/ClipExtractor';
import CarouselStudio from './pages/CarouselStudio';

declare global {
  interface Window {
    electronAPI: {
      saveApiKey: (provider: string, key: string) => Promise<{ success: boolean }>;
      getApiKey: (provider: string) => Promise<{ hasKey: boolean; hint: string | null }>;
      getAllSettings: () => Promise<{
        apiKeys: { claude: boolean; openai: boolean };
        setupComplete: boolean;
      }>;
      completeSetup: () => Promise<{ success: boolean }>;
      selectVideo: () => Promise<{ cancelled: boolean; filePath?: string }>;
      selectOutputDir: () => Promise<{ cancelled: boolean; dirPath?: string }>;
      extractClips: (videoPath: string, options: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      generateCarousel: (data: { topic: string; type: string; keyPoints: string[] }) => Promise<{ success: boolean; slides?: Slide[]; error?: string }>;
      renderVideo: (compositionId: string, props: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
      postToSocial: (platform: string, content: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
      onProgress: (callback: (data: { percent: number; label: string }) => void) => () => void;
    };
  }
}

export interface Slide {
  slideNumber: number;
  heading: string;
  body: string;
  visuals: string[];
  designNotes: string;
  slideType: 'cover' | 'content' | 'cta';
}

type Page = 'dashboard' | 'clips' | 'carousel' | 'editor' | 'schedule' | 'analytics';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    // Browser fallback if electronAPI isn't available (dev testing)
    if (!window.electronAPI) {
      (window as unknown as { electronAPI: typeof window.electronAPI }).electronAPI = {
        saveApiKey: async () => ({ success: true }),
        getApiKey: async () => ({ hasKey: false, hint: null }),
        getAllSettings: async () => ({ apiKeys: { claude: false, openai: false }, setupComplete: false }),
        completeSetup: async () => ({ success: true }),
        selectVideo: async () => ({ cancelled: true }),
        selectOutputDir: async () => ({ cancelled: true }),
        extractClips: async () => ({ success: false, error: 'Electron required' }),
        generateCarousel: async () => ({ success: false, error: 'Electron required' }),
        renderVideo: async () => ({ success: false, error: 'Electron required' }),
        postToSocial: async () => ({ success: false, error: 'Electron required' }),
        onProgress: () => () => {},
      };
    }

    // Check if setup is complete
    window.electronAPI.getAllSettings().then(settings => {
      setSetupComplete(settings.setupComplete);
    }).catch(() => {
      setSetupComplete(false);
    });
  }, []);

  const handleSetupDone = () => {
    setSetupComplete(true);
    setCurrentPage('dashboard');
  };

  // Loading
  if (setupComplete === null) {
    return (
      <div className="h-screen bg-6fb-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-6fb-border border-t-6fb-green rounded-full animate-spin" />
      </div>
    );
  }

  // Setup wizard
  if (!setupComplete) {
    return <Setup onComplete={handleSetupDone} />;
  }

  // Main app
  return (
    <div className="h-screen bg-6fb-bg flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {currentPage === 'dashboard' && <Dashboard onNavigate={setCurrentPage} />}
        {currentPage === 'clips' && <ClipExtractor />}
        {currentPage === 'carousel' && <CarouselStudio />}
        {currentPage === 'editor' && <ComingSoon title="Video Editor" icon="🎬" />}
        {currentPage === 'schedule' && <ComingSoon title="Scheduler" icon="📅" />}
        {currentPage === 'analytics' && <ComingSoon title="Analytics" icon="📊" />}
      </main>
    </div>
  );
}

function ComingSoon({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8">
      <span className="text-6xl mb-4">{icon}</span>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-6fb-text-secondary text-sm">Coming in Phase 2</p>
    </div>
  );
}
