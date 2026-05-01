import { contextBridge, ipcRenderer } from 'electron';
import type { ContentStrategyBrief } from '../src/types/content-strategy';

contextBridge.exposeInMainWorld('electronAPI', {
  // API Key Management
  saveApiKey: (provider: string, key: string) =>
    ipcRenderer.invoke('save-api-key', { provider, key }),
  getApiKey: (provider: string) =>
    ipcRenderer.invoke('get-api-key', provider),
  deleteApiKey: (provider: string) =>
    ipcRenderer.invoke('delete-api-key', provider),
  getAllSettings: () =>
    ipcRenderer.invoke('get-all-settings'),
  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),
  completeSetup: () =>
    ipcRenderer.invoke('complete-setup'),

  // File Dialogs
  selectVideo: () =>
    ipcRenderer.invoke('select-video'),
  selectOutputDir: () =>
    ipcRenderer.invoke('select-output-dir'),
  selectLogo: () =>
    ipcRenderer.invoke('select-logo'),
  selectImageFile: () =>
    ipcRenderer.invoke('select-image-file'),

  // Clip Extraction (Python bridge)
  extractClips: (videoPath: string, options: Record<string, unknown> & { strategyBrief?: ContentStrategyBrief | null }) =>
    ipcRenderer.invoke('extract-clips', { videoPath, options }),

  // Video Planner
  generateVideoPlan: (data: { topic: string; type: string; duration: string; perspective: string; useRag?: boolean; targetLocation?: string; strategyBrief?: Partial<ContentStrategyBrief> }) =>
    ipcRenderer.invoke('generate-video-plan', data),

  // Carousel Generation
  generateCarousel: (data: { topic: string; type: string; keyPoints: string[]; brandProfile?: object; playbookBrief?: { topicTitle: string; pillar: string; hookIdea: string; visualSuggestion: string; shotList: string[] }; strategyBrief?: ContentStrategyBrief | null; playbookPostId?: string; playbookTopicId?: string }) =>
    ipcRenderer.invoke('generate-carousel', data),
  extractCarousel: (data: {
    transcript: string;
    brandProfile: object;
    contentType: string;
    strategyBrief?: ContentStrategyBrief | null;
    playbookBrief?: { topicTitle: string; pillar: string; hookIdea: string; visualSuggestion: string; shotList: string[] };
    playbookPostId?: string;
    playbookTopicId?: string;
  }) => ipcRenderer.invoke('extract-carousel', data),
  readTranscript: (runPath: string) =>
    ipcRenderer.invoke('read-transcript', runPath),
  autoMatchCarouselFrames: (data: { runPath: string; timestamps: string[] }) =>
    ipcRenderer.invoke('auto-match-carousel-frames', data),

  // Carousel Persistence & Export
  exportCarouselDeck: (title: string, images: string[], strategySnapshot?: ContentStrategyBrief | null) =>
    ipcRenderer.invoke('export-carousel-deck', { title, images, strategySnapshot }),
  saveTempMediaFiles: (title: string, images: string[]) =>
    ipcRenderer.invoke('save-temp-media-files', { title, images }),
  saveCarousel: (data: { title: string; slides: object[]; brandSnapshot: object; strategySnapshot?: ContentStrategyBrief | null; playbookPostId?: string; playbookTopicId?: string }) =>
    ipcRenderer.invoke('save-carousel', data),
  listCarousels: () =>
    ipcRenderer.invoke('list-carousels'),
  loadCarousel: (id: string) =>
    ipcRenderer.invoke('load-carousel', id),
  deleteCarousel: (id: string) =>
    ipcRenderer.invoke('delete-carousel', id),
  renameCarousel: (id: string, title: string) =>
    ipcRenderer.invoke('rename-carousel', { id, title }),

  // Blog Post Writer
  generateBlogPost: (data: { transcript: string; brandProfile: object; contentType: string; strategyBrief?: ContentStrategyBrief | null }) =>
    ipcRenderer.invoke('generate-blog-post', data),
  saveBlogPost: (data: { title: string; metaDescription: string; sections: object[]; brandSnapshot: object; strategySnapshot?: ContentStrategyBrief | null }) =>
    ipcRenderer.invoke('save-blog-post', data),
  listBlogPosts: () =>
    ipcRenderer.invoke('list-blog-posts'),
  loadBlogPost: (id: string) =>
    ipcRenderer.invoke('load-blog-post', id),
  deleteBlogPost: (id: string) =>
    ipcRenderer.invoke('delete-blog-post', id),
  exportBlogMarkdown: (data: { title: string; metaDescription: string; sections: { heading: string; body: string; imagePath?: string | null }[]; strategySnapshot?: ContentStrategyBrief | null }) =>
    ipcRenderer.invoke('export-blog-markdown', data),

  // Brand Profile
  saveBrandProfile: (profile: object) =>
    ipcRenderer.invoke('save-brand-profile', profile),
  getBrandProfile: () =>
    ipcRenderer.invoke('get-brand-profile'),

  // System
  checkSystemHealth: () =>
    ipcRenderer.invoke('check-system-health'),
  notifyClipComplete: (data: { clipCount: number; title?: string }) =>
    ipcRenderer.invoke('notify-clip-complete', data),
  resetApp: () =>
    ipcRenderer.invoke('reset-app'),
  openPath: (path: string) =>
    ipcRenderer.invoke('open-path', path),

  // Library / CRUD
  scanLibrary: () =>
    ipcRenderer.invoke('scan-library'),
  deleteRun: (runId: string) =>
    ipcRenderer.invoke('delete-run', runId),
  deleteClip: (clipPath: string) =>
    ipcRenderer.invoke('delete-clip', clipPath),
  renameClip: (specPath: string, newTitle: string) =>
    ipcRenderer.invoke('rename-clip', { specPath, newTitle }),
  generateThumbnail: (videoPath: string, thumbPath: string) =>
    ipcRenderer.invoke('generate-thumbnail', { videoPath, thumbPath }),

  // Progress Updates
  onProgress: (callback: (data: { percent: number; label: string }) => void) => {
    const handler = (_event: unknown, data: { percent: number; label: string }) => callback(data);
    ipcRenderer.on('progress-update', handler);
    return () => ipcRenderer.removeListener('progress-update', handler);
  },

  // Publishing Bridge (Content Studio → Content Generator)
  savePublishingConfig: (config: { apiKey: string; userEmail: string; blobToken: string }) =>
    ipcRenderer.invoke('save-publishing-config', config),
  getPublishingConfig: () =>
    ipcRenderer.invoke('get-publishing-config'),
  getScheduledQueue: () =>
    ipcRenderer.invoke('get-scheduled-queue'),
  pushToScheduler: (payload: { filePath?: string; mediaFiles?: string[]; caption: string; mediaType: 'image' | 'video' | 'carousel'; scheduledFor: string; hashtags?: string[]; isTrial?: boolean; playbookPostId?: string; strategySnapshot?: ContentStrategyBrief | null }) =>
    ipcRenderer.invoke('push-to-scheduler', payload),

  // Playbook Topics
  fetchPlaybookTopics: () =>
    ipcRenderer.invoke('fetch-playbook-topics'),
  fetchTodayBrief: () =>
    ipcRenderer.invoke('fetch-today-brief'),

  // Video Editor
  loadWordsJson: (path: string) =>
    ipcRenderer.invoke('load-words-json', path),
  exportEditedSpec: (path: string, spec: object) =>
    ipcRenderer.invoke('export-edited-spec', path, spec),
});
