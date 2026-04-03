import { contextBridge, ipcRenderer } from 'electron';

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
  extractClips: (videoPath: string, options: Record<string, unknown>) =>
    ipcRenderer.invoke('extract-clips', { videoPath, options }),

  // Carousel Generation
  generateCarousel: (data: { topic: string; type: string; keyPoints: string[]; brandProfile?: object }) =>
    ipcRenderer.invoke('generate-carousel', data),
  extractCarousel: (data: { transcript: string; brandProfile: object; contentType: string }) =>
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
  generateBlogPost: (data: { transcript: string; brandProfile: object; contentType: string }) =>
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
    ipcRenderer.on('progress-update', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('progress-update');
  },

  // Scheduler
  getScheduledPosts: () =>
    ipcRenderer.invoke('get-scheduled-posts'),
  saveScheduledPost: (post: unknown) =>
    ipcRenderer.invoke('save-scheduled-post', post),
  deleteScheduledPost: (id: string) =>
    ipcRenderer.invoke('delete-scheduled-post', id),
  markPostAsPosted: (id: string) =>
    ipcRenderer.invoke('mark-post-as-posted', id),
  onPostDue: (callback: () => void) => {
    ipcRenderer.on('post-due', () => callback());
    return () => ipcRenderer.removeAllListeners('post-due');
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
    ipcRenderer.on('update-available', (_e, info) => callback(info));
    return () => ipcRenderer.removeAllListeners('update-available');
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on('update-downloaded', (_e, info) => callback(info));
    return () => ipcRenderer.removeAllListeners('update-downloaded');
  },
});
