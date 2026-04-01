import { type Platform } from './platform.js';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'error';

export type CampaignObjective =
  | 'awareness'
  | 'traffic'
  | 'engagement'
  | 'leads'
  | 'conversion'
  | 'retargeting';

export interface TargetingConfig {
  ageMin: number | null;
  ageMax: number | null;
  genders: ('male' | 'female' | 'all')[];
  locations: string[];
  interests: string[];
  customAudiences: string[];
  excludedAudiences: string[];
  languages: string[];
  devices: ('mobile' | 'desktop' | 'tablet' | 'all')[];
  placements: string[];
}

export interface NormalizedCampaign {
  id: string;
  organizationId: string;
  name: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  startDate: Date;
  endDate: Date | null;
  totalBudget: number;
  dailyBudget: number;
  platforms: Platform[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NormalizedAdGroup {
  id: string;
  campaignId: string;
  name: string;
  platform: Platform;
  targetingConfig: TargetingConfig;
  externalId: string | null;
}

export interface NormalizedAd {
  id: string;
  adGroupId: string;
  name: string;
  creativeId: string;
  platform: Platform;
  status: CampaignStatus;
  externalId: string | null;
}

export type CreateCampaignInput = Omit<NormalizedCampaign, 'id' | 'createdAt' | 'updatedAt' | 'status'>;

export type UpdateCampaignInput = Partial<Omit<NormalizedCampaign, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>;
