import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { trimmedClipMetadata } from '../electron/clip-metadata.mts';
import {
  isInsidePath,
  isAllowedReadPath,
  canonicalPath,
  localFilePathFromValue,
  safeJsonRecordPath,
  safeNumericRunPath,
  safeOwnedPath,
} from '../electron/path-safety.mts';

function fixture() {
  const parent = mkdtempSync(join(tmpdir(), '6fb-path-safety-'));
  const root = join(parent, 'owned');
  mkdirSync(root);
  return { parent, root };
}

test('inside-path checks reject prefix siblings and traversal', () => {
  const { parent, root } = fixture();
  try {
    assert.equal(isInsidePath(join(root, 'clips', 'a.mp4'), root), true);
    assert.equal(isInsidePath(root, root), true);
    assert.equal(isInsidePath(join(`${root}-sibling`, 'a.mp4'), root), false);
    assert.equal(isInsidePath(join(root, 'clips', '..', '..', 'outside'), root), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('owned paths must be absolute descendants, never the root itself', () => {
  const { parent, root } = fixture();
  try {
    const clip = join(root, 'clips', 'a.mp4');
    assert.equal(safeOwnedPath(clip, root), resolve(clip));
    assert.equal(safeOwnedPath(root, root), undefined);
    assert.equal(safeOwnedPath(join('..', 'outside'), root), undefined);
    assert.equal(safeOwnedPath(join(root, '..', 'outside'), root), undefined);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('owned paths reject symlink and junction escapes', () => {
  const { parent, root } = fixture();
  try {
    const outside = join(parent, 'outside');
    const link = join(root, 'link');
    mkdirSync(outside);
    writeFileSync(join(outside, 'secret.txt'), 'secret');
    symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(safeOwnedPath(join(link, 'secret.txt'), root), undefined);
    assert.equal(isInsidePath(join(link, 'secret.txt'), root), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('read policy allows owned media and exact files but never descendants of approved output directories', () => {
  const { parent, root } = fixture();
  try {
    const mediaRoot = join(root, 'clips');
    const selectedFile = join(parent, 'selected.mp4');
    const broadOutputDirectory = parent;
    const secret = join(broadOutputDirectory, 'config.json');
    mkdirSync(mediaRoot);
    writeFileSync(selectedFile, 'video');
    writeFileSync(secret, 'secret');
    const pinnedFile = canonicalPath(selectedFile);
    assert.equal(isAllowedReadPath(join(mediaRoot, 'clip.mp4'), [mediaRoot], [pinnedFile]), true);
    assert.equal(isAllowedReadPath(selectedFile, [mediaRoot], [pinnedFile]), true);
    assert.equal(isAllowedReadPath(secret, [mediaRoot], [canonicalPath(broadOutputDirectory)]), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('exact read approvals pin the original canonical target across symlink retargeting', () => {
  const { parent } = fixture();
  try {
    const firstTarget = join(parent, 'first');
    const secondTarget = join(parent, 'second');
    const link = join(parent, 'selected');
    mkdirSync(firstTarget);
    mkdirSync(secondTarget);
    writeFileSync(join(firstTarget, 'media.mp4'), 'first');
    writeFileSync(join(secondTarget, 'media.mp4'), 'second');
    symlinkSync(firstTarget, link, process.platform === 'win32' ? 'junction' : 'dir');
    const selectedPath = join(link, 'media.mp4');
    const pinnedTarget = canonicalPath(selectedPath);
    assert.equal(isAllowedReadPath(selectedPath, [], [pinnedTarget]), true);
    rmSync(link, { recursive: true, force: true });
    symlinkSync(secondTarget, link, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(isAllowedReadPath(selectedPath, [], [pinnedTarget]), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('clip run ids accept only 10 to 20 digits', () => {
  const { parent, root } = fixture();
  try {
    const clips = join(root, 'clips');
    assert.equal(safeNumericRunPath('1784660000000', clips), resolve(clips, '1784660000000'));
    assert.equal(safeNumericRunPath('../victim', clips), undefined);
    assert.equal(safeNumericRunPath('123456789', clips), undefined);
    assert.equal(safeNumericRunPath('123456789012345678901', clips), undefined);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('JSON record ids cannot escape or introduce path syntax', () => {
  const { parent, root } = fixture();
  try {
    const plans = join(root, 'plans');
    assert.equal(safeJsonRecordPath(plans, 'plan_1-A'), resolve(plans, 'plan_1-A.json'));
    assert.equal(safeJsonRecordPath(plans, '../victim'), undefined);
    assert.equal(safeJsonRecordPath(plans, 'bad.name'), undefined);
    assert.equal(safeJsonRecordPath(plans, 'x'.repeat(129)), undefined);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test('local file values decode safely and reject remote or malformed URLs', () => {
  const localPath = resolve(tmpdir(), 'video file.mp4');
  assert.equal(localFilePathFromValue(localPath), localPath);
  assert.equal(localFilePathFromValue(`localfile://${encodeURIComponent(localPath)}`), localPath);
  assert.equal(localFilePathFromValue('https://example.com/video.mp4'), undefined);
  assert.equal(localFilePathFromValue('data:video/mp4;base64,AA=='), undefined);
  assert.equal(localFilePathFromValue('localfile://%ZZ'), undefined);
  assert.equal(localFilePathFromValue('relative/video.mp4'), undefined);
});

test('clip trim metadata applies the offset exactly once and rejects invalid ranges', () => {
  assert.deepEqual(trimmedClipMetadata({ clipStart: 10, duration: 20, title: 'Clip' }, 3, 8), {
    clipStart: 13,
    clipEnd: 18,
    duration: 5,
    title: 'Clip',
  });
  assert.equal(trimmedClipMetadata({ clipStart: 10, duration: 20 }, -1, 8), undefined);
  assert.equal(trimmedClipMetadata({ clipStart: 10, duration: 20 }, 8, 8), undefined);
  assert.equal(trimmedClipMetadata({ clipStart: 10, duration: 20 }, Number.NaN, 8), undefined);
  assert.equal(trimmedClipMetadata({ clipStart: 10, duration: 20 }, 0, 21), undefined);
  assert.equal(trimmedClipMetadata({ clipStart: 10 }, 0, 5), undefined);
});
