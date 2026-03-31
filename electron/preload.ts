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

  // Clip Extraction (Python bridge)
  extractClips: (videoPath: string, options: Record<string, unknown>) =>
    ipcRenderer.invoke('extract-clips', { videoPath, options }),

  // Carousel Generation
  generateCarousel: (data: { topic: string; type: string; keyPoints: string[] }) =>
    ipcRenderer.invoke('generate-carousel', data),

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

  // Progress Updates
  onProgress: (callback: (data: { percent: number; label: string }) => void) => {
    ipcRenderer.on('progress-update', (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('progress-update');
  },
});

