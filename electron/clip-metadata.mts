export function trimmedClipMetadata(
  spec: Record<string, unknown>,
  startSec: number,
  endSec: number,
) {
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || startSec < 0 || endSec <= startSec) {
    return undefined;
  }
  const originalStart = typeof spec.clipStart === 'number' && Number.isFinite(spec.clipStart)
    ? spec.clipStart
    : 0;
  const sourceDuration = typeof spec.duration === 'number' && Number.isFinite(spec.duration)
    ? spec.duration
    : typeof spec.clipEnd === 'number' && Number.isFinite(spec.clipEnd)
    ? spec.clipEnd - originalStart
    : Number.NaN;
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0 || endSec > sourceDuration + 0.001) {
    return undefined;
  }
  const duration = endSec - startSec;
  const clipStart = originalStart + startSec;
  return { ...spec, clipStart, clipEnd: clipStart + duration, duration };
}
