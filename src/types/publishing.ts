export type PublishingStatus = 'scheduled' | 'due' | 'published' | 'failed' | 'cancelled' | 'studio_queue';

export type PublishingPlatform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin';

export type PublishingMediaType = 'reel' | 'carousel' | 'image' | 'video' | 'text';

export interface PublishingQueuePost {
  id: string;
  platform: PublishingPlatform;
  platforms?: PublishingPlatform[];
  caption: string;
  mediaPath: string;
  mediaUrls?: string[];
  scheduledAt: string;
  scheduledFor?: string;
  status: PublishingStatus;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string | null;
  postedAt?: string | null;
  thumbnailPath?: string;
  thumbnailUrl?: string | null;
  mediaType?: PublishingMediaType;
  title?: string | null;
  errorMessage?: string | null;
  source?: string | null;
  origin?: 'local' | 'remote';
}

export interface PublishingQueueResponse {
  success: boolean;
  posts: PublishingQueuePost[];
  source: 'local' | 'remote';
  fetchedAt: string;
  error?: string;
}

export interface PublishingQueueStats {
  totalQueue: number;
  scheduled: number;
  published: number;
  failed: number;
}

export const ACTIVE_PUBLISHING_STATUSES = new Set<PublishingStatus>(['scheduled', 'due']);
export const HISTORY_PUBLISHING_STATUSES = new Set<PublishingStatus>(['published', 'failed']);
