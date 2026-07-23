import type { ContentStrategyBrief } from './content-strategy';

export const THUMBNAIL_CREATIVE_LANES = ['warning', 'mistake', 'curiosity'] as const;
export type ThumbnailCreativeLane = typeof THUMBNAIL_CREATIVE_LANES[number];

export const THUMBNAIL_ACCENTS = ['emerald', 'red', 'none'] as const;
export type ThumbnailAccent = typeof THUMBNAIL_ACCENTS[number];

export const THUMBNAIL_TREATMENTS = ['clean', 'warning-line', 'marker'] as const;
export type ThumbnailTreatment = typeof THUMBNAIL_TREATMENTS[number];

export interface ThumbnailConcept {
  text: string;
  creativeLane: ThumbnailCreativeLane;
  accent: ThumbnailAccent;
  treatment: ThumbnailTreatment;
  visualDirection: string;
  transcriptEvidence: string;
  timestamp: string;
  framePath?: string | null;
  generatedImagePath?: string | null;
  exportedImagePath?: string | null;
}

export interface ThumbnailPackage {
  diagnosis: string;
  titles: string[];
  thumbnails: ThumbnailConcept[];
  description: string;
  cta: string;
}

export interface ThumbnailPackageRequest {
  transcript: string;
  brandProfile?: Record<string, unknown>;
  strategyBrief?: ContentStrategyBrief;
}

export interface ThumbnailPackageExportRequest {
  sourceName: string;
  package: ThumbnailPackage;
}

export interface ThumbnailCoverExportRequest {
  sourceName: string;
  headline: string;
  imageDataUrl: string;
}

export interface ThumbnailImageRequest {
  sourceName: string;
  concept: ThumbnailConcept;
  referenceFramePath?: string | null;
}

export interface SavedThumbnailPackage {
  id: string;
  sourceName: string;
  sourceRunId: string;
  createdAt: string;
  updatedAt: string;
  package: ThumbnailPackage;
}

export interface ThumbnailPackageSummary {
  id: string;
  sourceName: string;
  sourceRunId: string;
  createdAt: string;
  updatedAt: string;
  finishedCoverCount: number;
}

export interface SaveThumbnailPackageRequest {
  id?: string;
  sourceName: string;
  sourceRunId: string;
  package: ThumbnailPackage;
}
