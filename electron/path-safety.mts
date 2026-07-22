import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

export function canonicalPath(candidate: string) {
  const resolved = resolve(candidate);
  let existing = resolved;
  const suffix: string[] = [];

  while (!existsSync(existing)) {
    const parent = dirname(existing);
    if (parent === existing) break;
    suffix.unshift(existing.slice(parent.length).replace(/^[/\\]+/, ''));
    existing = parent;
  }

  const canonicalExisting = existsSync(existing) ? realpathSync.native(existing) : existing;
  return resolve(canonicalExisting, ...suffix);
}

export function isInsidePath(childPath: string, parentPath: string) {
  const canonicalCandidate = canonicalPath(childPath);
  const canonicalParent = canonicalPath(parentPath);
  const rel = relative(canonicalParent, canonicalCandidate);
  return rel === '' || (!!rel && !rel.startsWith('..') && !isAbsolute(rel));
}

export function isSamePath(firstPath: string, secondPath: string) {
  return canonicalPath(firstPath) === canonicalPath(secondPath);
}

export function isAllowedReadPath(candidate: string, ownedRoots: string[], approvedFiles: string[]) {
  if (!candidate || !isAbsolute(candidate)) return false;
  if (ownedRoots.some(root => isInsidePath(candidate, root))) return true;
  const canonicalCandidate = canonicalPath(candidate);
  return approvedFiles.some(filePath => isAbsolute(filePath) && canonicalCandidate === resolve(filePath));
}

export function safeOwnedPath(candidate: string, rootPath: string) {
  if (!candidate || !isAbsolute(candidate)) return undefined;
  const resolvedCandidate = resolve(candidate);
  const resolvedRoot = resolve(rootPath);
  if (canonicalPath(resolvedCandidate) === canonicalPath(resolvedRoot) || !isInsidePath(resolvedCandidate, resolvedRoot)) return undefined;
  return resolvedCandidate;
}

export function safeNumericRunPath(runId: string, clipsRoot: string) {
  if (!/^\d{10,20}$/.test(runId)) return undefined;
  return safeOwnedPath(resolve(clipsRoot, runId), clipsRoot);
}

export function safeJsonRecordPath(rootPath: string, id: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)) return undefined;
  return safeOwnedPath(resolve(rootPath, `${id}.json`), rootPath);
}

export function localFilePathFromValue(value?: string | null) {
  if (!value || /^(https?:|data:|blob:)/i.test(value)) return undefined;
  const localfilePrefix = 'localfile://';
  let filePath = value;
  if (value.startsWith(localfilePrefix)) {
    try {
      filePath = decodeURIComponent(value.slice(localfilePrefix.length));
    } catch {
      return undefined;
    }
  }
  return isAbsolute(filePath) ? filePath : undefined;
}
