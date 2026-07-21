export function toLocalFileUrl(filePath?: string | null) {
  if (!filePath) return '';
  if (/^(https?:|data:|blob:)/i.test(filePath)) return filePath;
  return `localfile://${encodeURIComponent(filePath)}`;
}
