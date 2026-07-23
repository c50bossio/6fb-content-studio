import type {
  ThumbnailAccent,
  ThumbnailConcept,
  ThumbnailCreativeLane,
  ThumbnailPackage,
  SavedThumbnailPackage,
  ThumbnailTreatment,
} from '../src/types/thumbnail-package';

const creativeLanes = ['warning', 'mistake', 'curiosity'] as const;
const accents = ['emerald', 'red', 'none'] as const;
const treatments = ['clean', 'warning-line', 'marker'] as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maxLength = 4000): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be non-empty text`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

function unique(values: string[], label: string): void {
  const normalized = values.map(value => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${label} must be distinct`);
  }
}

function normalizeConcept(value: unknown, index: number): ThumbnailConcept {
  const concept = record(value, `Thumbnail concept ${index + 1}`);
  const conceptText = text(concept.text, `Thumbnail concept ${index + 1} text`, 80);
  const words = conceptText.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) {
    throw new Error(`Thumbnail concept ${index + 1} text must contain 2-4 words`);
  }

  const timestamp = text(concept.timestamp, `Thumbnail concept ${index + 1} timestamp`, 8);
  if (!/^(?:\d{1,2}:)?[0-5]?\d:[0-5]\d$/.test(timestamp)) {
    throw new Error(`Thumbnail concept ${index + 1} timestamp is invalid`);
  }
  const creativeLane = text(concept.creativeLane, `Thumbnail concept ${index + 1} creative lane`, 20) as ThumbnailCreativeLane;
  if (!creativeLanes.includes(creativeLane)) {
    throw new Error(`Thumbnail concept ${index + 1} creative lane is invalid`);
  }
  const accent = text(concept.accent, `Thumbnail concept ${index + 1} accent`, 20) as ThumbnailAccent;
  if (!accents.includes(accent)) {
    throw new Error(`Thumbnail concept ${index + 1} accent is invalid`);
  }
  const treatment = text(concept.treatment, `Thumbnail concept ${index + 1} treatment`, 20) as ThumbnailTreatment;
  if (!treatments.includes(treatment)) {
    throw new Error(`Thumbnail concept ${index + 1} treatment is invalid`);
  }

  const framePath = concept.framePath == null
    ? undefined
    : text(concept.framePath, `Thumbnail concept ${index + 1} frame path`, 1200);
  const generatedImagePath = concept.generatedImagePath == null
    ? undefined
    : text(concept.generatedImagePath, `Thumbnail concept ${index + 1} generated image path`, 1200);
  const exportedImagePath = concept.exportedImagePath == null
    ? undefined
    : text(concept.exportedImagePath, `Thumbnail concept ${index + 1} exported image path`, 1200);

  return {
    text: conceptText,
    creativeLane,
    accent,
    treatment,
    visualDirection: text(concept.visualDirection, `Thumbnail concept ${index + 1} visual direction`, 1200),
    transcriptEvidence: text(concept.transcriptEvidence, `Thumbnail concept ${index + 1} transcript evidence`, 1200),
    timestamp,
    ...(framePath ? { framePath } : {}),
    ...(generatedImagePath ? { generatedImagePath } : {}),
    ...(exportedImagePath ? { exportedImagePath } : {}),
  };
}

export function normalizeThumbnailConcept(value: unknown): ThumbnailConcept {
  return normalizeConcept(value, 0);
}

export function normalizeThumbnailPackage(value: unknown): ThumbnailPackage {
  const candidate = record(value, 'Thumbnail package');
  if (!Array.isArray(candidate.titles) || candidate.titles.length !== 3) {
    throw new Error('Thumbnail package must contain exactly 3 titles');
  }
  if (!Array.isArray(candidate.thumbnails) || candidate.thumbnails.length !== 3) {
    throw new Error('Thumbnail package must contain exactly 3 thumbnail concepts');
  }

  const titles = candidate.titles.map((title, index) => text(title, `Title ${index + 1}`, 160));
  const thumbnails = candidate.thumbnails.map(normalizeConcept);
  unique(titles, 'Titles');
  unique(thumbnails.map(concept => concept.text), 'Thumbnail concept text');
  if (new Set(thumbnails.map(concept => concept.creativeLane)).size !== 3) {
    throw new Error('Thumbnail concepts must use one warning, one mistake, and one curiosity creative lane');
  }

  const normalizedTitles = titles.map(title => title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  for (const concept of thumbnails) {
    const normalizedConcept = concept.text.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (normalizedTitles.some(title => title === normalizedConcept)) {
      throw new Error('Thumbnail text must complement rather than repeat a title');
    }
  }

  return {
    diagnosis: text(candidate.diagnosis, 'Diagnosis', 2400),
    titles,
    thumbnails,
    description: text(candidate.description, 'Description', 5000),
    cta: text(candidate.cta, 'CTA', 1200),
  };
}

function timestamp(value: unknown, label: string): string {
  const normalized = text(value, label, 40);
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${label} is invalid`);
  return normalized;
}

export function normalizeSavedThumbnailPackage(value: unknown): SavedThumbnailPackage {
  const candidate = record(value, 'Saved thumbnail package');
  const id = text(candidate.id, 'Saved thumbnail package id', 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)) {
    throw new Error('Saved thumbnail package id is invalid');
  }

  return {
    id,
    sourceName: text(candidate.sourceName, 'Saved thumbnail package source name', 240),
    sourceRunId: text(candidate.sourceRunId, 'Saved thumbnail package source run id', 128),
    createdAt: timestamp(candidate.createdAt, 'Saved thumbnail package creation time'),
    updatedAt: timestamp(candidate.updatedAt, 'Saved thumbnail package update time'),
    package: normalizeThumbnailPackage(candidate.package),
  };
}

export function thumbnailPackageToMarkdown(sourceName: string, value: unknown): string {
  const packageValue = normalizeThumbnailPackage(value);
  const safeSource = sourceName.trim().replace(/[\r\n]+/g, ' ').slice(0, 240) || 'Untitled video';
  const titles = packageValue.titles.map((title, index) => `${index + 1}. ${title}`).join('\n');
  const concepts = packageValue.thumbnails.map((concept, index) => {
    const frame = concept.framePath ? `\n- Frame: \`${concept.framePath}\`` : '';
    const generated = concept.generatedImagePath ? `\n- Generated cover: \`${concept.generatedImagePath}\`` : '';
    const exported = concept.exportedImagePath ? `\n- Exported exact cover: \`${concept.exportedImagePath}\`` : '';
    return `### ${index + 1}. ${concept.text}\n\n- Creative lane: ${concept.creativeLane}\n- Accent: ${concept.accent}\n- Treatment: ${concept.treatment}\n- Timestamp: \`${concept.timestamp}\`\n- Visual: ${concept.visualDirection}\n- Transcript evidence: ${concept.transcriptEvidence}${frame}${generated}${exported}`;
  }).join('\n\n');

  return `# Thumbnail package: ${safeSource}\n\n## Core diagnosis\n\n${packageValue.diagnosis}\n\n## Three titles\n\n${titles}\n\n## Three thumbnail concepts\n\n${concepts}\n\n## Description\n\n${packageValue.description}\n\n## CTA\n\n${packageValue.cta}\n`;
}
