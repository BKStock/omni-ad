import { type CampaignObjective } from './campaign.js';
import { type Platform } from './platform.js';

export interface FunnelStage {
  name: string;
  objective: CampaignObjective;
  platforms: Platform[];
  campaignIds: string[];
}

export interface Funnel {
  id: string;
  organizationId: string;
  name: string;
  stages: FunnelStage[];
  status: 'draft' | 'active' | 'paused';
  createdAt: Date;
}
