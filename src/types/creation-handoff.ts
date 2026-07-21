export type ScheduleDraftSource = 'clip' | 'editor-export';

export interface ScheduleDraft {
  source: ScheduleDraftSource;
  mediaPath: string;
  thumbnailPath?: string | null;
  caption: string;
  planId?: string;
  planTopic?: string;
}
