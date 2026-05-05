export function toLocalFileUrl(filePath?: string | null) {
  return filePath ? `localfile://${encodeURIComponent(filePath)}` : '';
}
