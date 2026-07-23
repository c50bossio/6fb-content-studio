export type TrendSourceId =
  | 'google-trends'
  | 'instagram'
  | 'youtube'
  | 'content-planner'
  | 'idea-starter';

export const YOUTUBE_POLICY_VERSION = '2026-07-22';

export type TrendEvidenceState = 'live' | 'cached' | 'your-plan' | 'idea-starter';

// A successful live-source response remains `live` while it is reused inside
// the ten-minute fresh-cache window. `cached` is reserved for stale data shown
// after a refresh failure. Planned Content Planner data uses `connected`.
export type TrendSourceState =
  | 'live'
  | 'cached'
  | 'connected'
  | 'not-connected'
  | 'unavailable'
  | 'empty'
  | 'error';

export interface TrendIdea {
  id: string;
  title: string;
  sourceId: TrendSourceId;
  sourceLabel: string;
  evidenceState: TrendEvidenceState;
  sourceUrl?: string;
  observedAt?: string;
  publishedAt?: string;
  trafficEvidence?: string;
  barberFitScore?: number;
  whyNow: string;
}

export interface TrendSourceStatus {
  sourceId: TrendSourceId;
  sourceLabel: string;
  state: TrendSourceState;
  message?: string;
  checkedAt?: string;
}

export interface YouTubeReference {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
  thumbnailUrl: string;
}

export interface YouTubeReferenceSection {
  status: TrendSourceStatus;
  results: YouTubeReference[];
  sourceCheckedAt?: string | null;
  servedAt?: string;
}

export interface TrendFeed {
  ideas: TrendIdea[];
  sources: TrendSourceStatus[];
  youtube: YouTubeReferenceSection;
  fetchedAt: string;
}
