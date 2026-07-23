import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSavedThumbnailPackage, normalizeThumbnailPackage, thumbnailPackageToMarkdown } from '../electron/thumbnail-package.mts';

const validPackage = {
  diagnosis: 'The chair creates income, but structure decides whether that income becomes freedom.',
  titles: [
    'Why Busy Barbers Stay Broke',
    'The Money Move After Every Cut',
    'Your Booked Calendar Is Not Wealth',
  ],
  thumbnails: [
    { text: 'MONEY AFTER CUTS', creativeLane: 'warning', accent: 'red', treatment: 'warning-line', visualDirection: 'Chris beside a barber chair and a simple asset arrow.', transcriptEvidence: 'The speaker explains that chair income must fund assets.', timestamp: '02:14' },
    { text: 'BOOKED BUT BROKE', creativeLane: 'mistake', accent: 'emerald', treatment: 'marker', visualDirection: 'A full calendar beside an empty savings meter.', transcriptEvidence: 'The transcript contrasts a full schedule with missing margin.', timestamp: '08:03' },
    { text: 'CHAIR BECOMES FUEL', creativeLane: 'curiosity', accent: 'none', treatment: 'clean', visualDirection: 'Income moves from a chair into systems and investments.', transcriptEvidence: 'The closing section calls the chair fuel for the next move.', timestamp: '1:12:09' },
  ],
  description: 'A full book is valuable only when the money creates margin and options.',
  cta: 'Write down where the money from your next ten cuts is going.',
};

test('normalizes an exact transcript-grounded thumbnail package', () => {
  assert.deepEqual(normalizeThumbnailPackage(validPackage), validPackage);
});

test('rejects anything other than exactly three titles and concepts', () => {
  assert.throws(() => normalizeThumbnailPackage({ ...validPackage, titles: validPackage.titles.slice(0, 2) }), /exactly 3 titles/);
  assert.throws(() => normalizeThumbnailPackage({ ...validPackage, thumbnails: validPackage.thumbnails.slice(0, 2) }), /exactly 3 thumbnail concepts/);
});

test('rejects duplicate and overlong thumbnail copy', () => {
  const duplicate = validPackage.thumbnails.map((concept, index) => index === 2 ? { ...concept, text: validPackage.thumbnails[0].text } : concept);
  assert.throws(() => normalizeThumbnailPackage({ ...validPackage, thumbnails: duplicate }), /must be distinct/);
  const overlong = validPackage.thumbnails.map((concept, index) => index === 0 ? { ...concept, text: 'THIS COPY HAS FIVE WORDS' } : concept);
  assert.throws(() => normalizeThumbnailPackage({ ...validPackage, thumbnails: overlong }), /2-4 words/);
  assert.throws(() => normalizeThumbnailPackage({ ...validPackage, titles: [validPackage.titles[0], `${validPackage.titles[0]}!`, validPackage.titles[2]] }), /must be distinct/);
});

test('rejects invalid timestamps and title repetition', () => {
  const invalidTime = validPackage.thumbnails.map((concept, index) => index === 0 ? { ...concept, timestamp: 'soon' } : concept);
  assert.throws(() => normalizeThumbnailPackage({ ...validPackage, thumbnails: invalidTime }), /timestamp is invalid/);
  const overlongTime = validPackage.thumbnails.map((concept, index) => index === 0 ? { ...concept, timestamp: '00:02:14 (key moment)' } : concept);
  assert.throws(() => normalizeThumbnailPackage({ ...validPackage, thumbnails: overlongTime }), /timestamp is too long/);
  const repeatedTitle = { ...validPackage, titles: [validPackage.thumbnails[0].text, ...validPackage.titles.slice(1)] };
  assert.throws(() => normalizeThumbnailPackage(repeatedTitle), /complement rather than repeat/);
});

test('requires exactly one of each creative lane', () => {
  const repeatedLane = validPackage.thumbnails.map((concept, index) => index === 2 ? { ...concept, creativeLane: 'warning' } : concept);
  assert.throws(() => normalizeThumbnailPackage({ ...validPackage, thumbnails: repeatedLane }), /one warning, one mistake, and one curiosity/);
  const invalidLane = validPackage.thumbnails.map((concept, index) => index === 0 ? { ...concept, creativeLane: 'comparison' } : concept);
  assert.throws(() => normalizeThumbnailPackage({ ...validPackage, thumbnails: invalidLane }), /creative lane is invalid/);
});

test('serializes the complete package and optional local image references', () => {
  const withFrame = {
    ...validPackage,
    thumbnails: validPackage.thumbnails.map((concept, index) => index === 0 ? {
      ...concept,
      framePath: '/tmp/frame.jpg',
      generatedImagePath: '/tmp/finished-cover.png',
    } : concept),
  };
  const markdown = thumbnailPackageToMarkdown('Shop income.mp4', withFrame);
  assert.match(markdown, /# Thumbnail package: Shop income\.mp4/);
  assert.match(markdown, /## Three titles/);
  assert.match(markdown, /MONEY AFTER CUTS/);
  assert.match(markdown, /`\/tmp\/frame\.jpg`/);
  assert.match(markdown, /`\/tmp\/finished-cover\.png`/);
});

test('normalizes a saved package with its source and immutable timestamps', () => {
  const saved = {
    id: 'thumbnail-7f514a8d',
    sourceName: 'Shop income',
    sourceRunId: '1775592631332',
    createdAt: '2026-07-22T14:00:00.000Z',
    updatedAt: '2026-07-22T14:05:00.000Z',
    package: validPackage,
  };
  assert.deepEqual(normalizeSavedThumbnailPackage(saved), saved);
  assert.throws(() => normalizeSavedThumbnailPackage({ ...saved, id: '../escape' }), /id is invalid/);
  assert.throws(() => normalizeSavedThumbnailPackage({ ...saved, updatedAt: 'soon' }), /update time is invalid/);
});
