export type ContentIntent = 'education' | 'entertainment' | 'hybrid';

export interface PackageVariant {
  title: string;
  thumbnailText: string;
  firstLineCaption: string;
  shortCaption: string;
  hashtags: string[];
  platformAngle: string;
}

export interface StrategyScoreBreakdown {
  audienceClarity: number;
  outcomeValue: number;
  novelty: number;
  emotionalTrigger: number;
  packagingStrength: number;
  retentionPath: number;
  total: number;
  rationale?: string;
}

export interface ContentStrategyBrief {
  id: string;
  intent: ContentIntent;
  audience: string;
  viewerOutcome: string;
  promise: string;
  curiosityGap: string;
  proofAsset: string;
  payoff: string;
  positioning: string;
  packageVariants: PackageVariant[];
  scoreBreakdown: StrategyScoreBreakdown;
  createdAt: string;
  source?: 'planner' | 'playbook' | 'clip-run' | 'manual';
}

export interface ContentBrain {
  audience: string;
  positioning: string;
  offers: string[];
  contentPillars: string[];
  proofAssets: string[];
  voiceRules: string[];
  preferredPhrases: string[];
  avoidedPhrases: string[];
  exampleHooks: string[];
  updatedAt?: string;
}

export interface ClipStrategyMeta {
  label: 'Strong Hook' | 'Proof Moment' | 'Payoff' | 'Needs Context' | 'Best Package Fit' | string;
  rationale?: string;
  packageVariant?: PackageVariant;
  scoreBreakdown?: Record<string, number>;
}
