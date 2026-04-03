"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // API Key Management
  saveApiKey: (provider, key) => electron.ipcRenderer.invoke("save-api-key", { provider, key }),
  getApiKey: (provider) => electron.ipcRenderer.invoke("get-api-key", provider),
  getAllSettings: () => electron.ipcRenderer.invoke("get-all-settings"),
  completeSetup: () => electron.ipcRenderer.invoke("complete-setup"),
  // File Dialogs
  selectVideo: () => electron.ipcRenderer.invoke("select-video"),
  selectOutputDir: () => electron.ipcRenderer.invoke("select-output-dir"),
  // Clip Extraction (Python bridge)
  extractClips: (videoPath, options) => electron.ipcRenderer.invoke("extract-clips", { videoPath, options }),
  // Carousel Generation
  generateCarousel: (data) => electron.ipcRenderer.invoke("generate-carousel", data),
  // Video Rendering (Remotion)
  renderVideo: (compositionId, props) => electron.ipcRenderer.invoke("render-video", { compositionId, props }),
  // Social Posting
  postToSocial: (platform, content) => electron.ipcRenderer.invoke("post-to-social", { platform, content }),
  // Progress Updates
  onProgress: (callback) => {
    electron.ipcRenderer.on("progress-update", (_event, data) => callback(data));
    return () => electron.ipcRenderer.removeAllListeners("progress-update");
  }
});
