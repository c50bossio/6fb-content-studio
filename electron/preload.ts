import { contextBridge, ipcRenderer } from 'electron';
import type { ContentBrain, ContentStrategyBrief } from '../src/types/content-strategy';
import type { PublishingQueuePost } from '../src/types/publishing';
import type { TrendFeed } from '../src/types/trends';

contextBridge.exposeInMainWorld('electronAPI', {
  // API Key Management
  saveApiKey: (provider: string, key: string) =>
    ipcRenderer.invoke('save-api-key', { provider, key }),
  getApiKey: (provider: string) =>
    ipcRenderer.invoke('get-api-key', provider),
  deleteApiKey: (provider: string) =>
    ipcRenderer.invoke('delete-api-key', provider),
  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),
  getAllSettings: () =>
    ipcRenderer.invoke('get-all-settings'),
  completeSetup: () =>
    ipcRenderer.invoke('complete-setup'),
  fetchTodayBrief: () =>
    ipcRenderer.invoke('fetch-today-brief'),
  fetchSmartTrends: (): Promise<TrendFeed> =>
    ipcRenderer.invoke('fetch-smart-trends'),
  openTrendSource: (url: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('open-trend-source', url),
  completeTodayPlay: (postId: string, action: 'complete' | 'skip') =>
    ipcRenderer.invoke('complete-today-play', { postId, action }),
  fetchVoiceProfile: () =>
    ipcRenderer.invoke('fetch-voice-profile'),

  // File Dialogs
  selectVideo: () =>
    ipcRenderer.invoke('select-video'),
  selectOutputDir: () =>
    ipcRenderer.invoke('select-output-dir'),
  selectLogo: () =>
    ipcRenderer.invoke('select-logo'),
  selectImageFile: () =>
    ipcRenderer.invoke('select-image-file'),
  checkMediaFile: (filePath: string) =>
    ipcRenderer.invoke('check-media-file', filePath),

  // Clip Extraction (Python bridge)
  extractClips: (videoPath: string, options: Record<string, unknown> & { strategyBrief?: ContentStrategyBrief }) =>
    ipcRenderer.invoke('extract-clips', { videoPath, options }),
  cancelExtraction: () =>
    ipcRenderer.invoke('cancel-extraction'),
  readClipTranscript: (clipPath: string) =>
    ipcRenderer.invoke('read-clip-transcript', clipPath),

  // Carousel Generation
  generateCarousel: (data: { topic: string; type: string; keyPoints: string[]; brandProfile?: object; strategyBrief?: ContentStrategyBrief }) =>
    ipcRenderer.invoke('generate-carousel', data),
  extractCarousel: (data: { transcript: string; brandProfile: object; contentType: string; strategyBrief?: ContentStrategyBrief }) =>
    ipcRenderer.invoke('extract-carousel', data),
  readTranscript: (runPath: string) =>
    ipcRenderer.invoke('read-transcript', runPath),
  autoMatchCarouselFrames: (data: { runPath: string; timestamps: string[] }) =>
    ipcRenderer.invoke('auto-match-carousel-frames', data),

  // Carousel Persistence & Export
  exportCarouselDeck: (title: string, images: string[]) =>
    ipcRenderer.invoke('export-carousel-deck', { title, images }),
  saveCarousel: (data: { title: string; slides: object[]; brandSnapshot: object }) =>
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
  generateBlogPost: (data: { transcript: string; brandProfile: object; contentType: string; strategyBrief?: ContentStrategyBrief }) =>
    ipcRenderer.invoke('generate-blog-post', data),
  saveBlogPost: (data: { title: string; metaDescription: string; sections: object[]; brandSnapshot: object }) =>
    ipcRenderer.invoke('save-blog-post', data),
  listBlogPosts: () =>
    ipcRenderer.invoke('list-blog-posts'),
  loadBlogPost: (id: string) =>
    ipcRenderer.invoke('load-blog-post', id),
  deleteBlogPost: (id: string) =>
    ipcRenderer.invoke('delete-blog-post', id),
  exportBlogMarkdown: (data: { title: string; metaDescription: string; sections: { heading: string; body: string; imagePath?: string | null }[] }) =>
    ipcRenderer.invoke('export-blog-markdown', data),

  // Brand Profile
  saveBrandProfile: (profile: object) =>
    ipcRenderer.invoke('save-brand-profile', profile),
  getBrandProfile: () =>
    ipcRenderer.invoke('get-brand-profile'),
  saveContentBrain: (brain: ContentBrain) =>
    ipcRenderer.invoke('save-content-brain', brain),
  getContentBrain: () =>
    ipcRenderer.invoke('get-content-brain'),

  // Video Rendering (Remotion)
  renderVideo: (compositionId: string, props: Record<string, unknown>) =>
    ipcRenderer.invoke('render-video', { compositionId, props }),

  // Social Posting
  postToSocial: (platform: string, content: Record<string, unknown>) =>
    ipcRenderer.invoke('post-to-social', { platform, content }),

  // System
  checkSystemHealth: () =>
    ipcRenderer.invoke('check-system-health'),
  resetApp: () =>
    ipcRenderer.invoke('reset-app'),
  openPath: (path: string) =>
    ipcRenderer.invoke('open-path', path),
  showInFinder: (path: string) =>
    ipcRenderer.invoke('show-in-finder', path),

  // Library / CRUD
  scanLibrary: () =>
    ipcRenderer.invoke('scan-library'),
  deleteRun: (runId: string) =>
    ipcRenderer.invoke('delete-run', runId),
  deleteClip: (clipPath: string) =>
    ipcRenderer.invoke('delete-clip', clipPath),
  renameClip: (specPath: string, newTitle: string) =>
    ipcRenderer.invoke('rename-clip', { specPath, newTitle }),
  trimClip: (data: { filePath: string; specPath: string; startSec: number; endSec: number }) =>
    ipcRenderer.invoke('trim-clip', data),
  generateThumbnail: (videoPath: string, thumbPath: string) =>
    ipcRenderer.invoke('generate-thumbnail', { videoPath, thumbPath }),

  // Progress Updates
  onProgress: (callback: (data: { percent: number; label: string }) => void) => {
    // Use a named handler so removeListener only removes THIS listener,
    // not all listeners (removeAllListeners would nuke other components' subscriptions).
    const handler = (_event: Electron.IpcRendererEvent, data: { percent: number; label: string }) => callback(data);
    ipcRenderer.on('progress-update', handler);
    return () => ipcRenderer.removeListener('progress-update', handler);
  },

  // Scheduler
  getPublishingQueue: () =>
    ipcRenderer.invoke('get-publishing-queue'),
  getLocalPublishingQueue: () =>
    ipcRenderer.invoke('get-local-publishing-queue'),
  getScheduledPosts: () =>
    ipcRenderer.invoke('get-scheduled-posts'),
  saveScheduledPost: (post: PublishingQueuePost | unknown) =>
    ipcRenderer.invoke('save-scheduled-post', post),
  deleteScheduledPost: (id: string) =>
    ipcRenderer.invoke('delete-scheduled-post', id),
  markPostAsPosted: (id: string) =>
    ipcRenderer.invoke('mark-post-as-posted', id),
  markPostAsPublished: (id: string) =>
    ipcRenderer.invoke('mark-post-as-published', id),
  onPostDue: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('post-due', handler);
    return () => ipcRenderer.removeListener('post-due', handler);
  },

  // 6FB Account (Content Manager)
  login6FB: (creds: { email: string; password: string }) =>
    ipcRenderer.invoke('login-6fb', creds),
  syncInstagramCredentials: () =>
    ipcRenderer.invoke('sync-instagram-credentials'),
  get6FBAccount: () =>
    ipcRenderer.invoke('get-6fb-account'),
  disconnect6FB: () =>
    ipcRenderer.invoke('disconnect-6fb'),

  // Auto-Updater
  checkForUpdate: () =>
    ipcRenderer.invoke('check-for-update'),
  installUpdate: () =>
    ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback: (info: { version: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, info: { version: string }) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, info: { version: string }) => callback(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },

  // Instagram Direct Posting
  postReelToInstagram: (data: { filePath: string; caption: string }) =>
    ipcRenderer.invoke('post-reel-to-instagram', data),
  postCarouselToInstagram: (data: { imagePaths: string[]; caption: string }) =>
    ipcRenderer.invoke('post-carousel-to-instagram', data),

  // Analytics
  getAnalytics: () =>
    ipcRenderer.invoke('get-analytics'),

  // Video Planner
  generateVideoPlan: (data: { prompt: string }) =>
    ipcRenderer.invoke('generate-video-plan', data),
  saveVideoPlan: (plan: object) =>
    ipcRenderer.invoke('save-video-plan', plan),
  listVideoPlans: () =>
    ipcRenderer.invoke('list-video-plans'),
});
