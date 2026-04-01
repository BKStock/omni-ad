import { Platform } from '@omni-ad/shared';
import type {
  CampaignObjective,
  CampaignStatus,
  NormalizedCampaign,
  NormalizedAdGroup,
  NormalizedAd,
  NormalizedMetrics,
  AudienceSegment,
  TargetingConfig,
} from '@omni-ad/shared';
import type {
  LYCampaign,
  LYAdGroup,
  LYAd,
  LYInsights,
  LYAudience,
  LYObjective,
  LYCampaignStatus,
} from './types.js';

const LY_OBJECTIVE_MAP: Record<LYObjective, CampaignObjective> = {
  REACH: 'awareness',
  TRAFFIC: 'traffic',
  ENGAGEMENT: 'engagement',
  APP_INSTALLS: 'conversion',
  CONVERSIONS: 'conversion',
  CATALOG_SALES: 'conversion',
  LEAD_GENERATION: 'leads',
};

const OBJECTIVE_TO_LY: Record<CampaignObjective, LYObjective> = {
  awareness: 'REACH',
  traffic: 'TRAFFIC',
  engagement: 'ENGAGEMENT',
  leads: 'LEAD_GENERATION',
  conversion: 'CONVERSIONS',
  retargeting: 'CONVERSIONS',
};

const LY_STATUS_MAP: Record<LYCampaignStatus, CampaignStatus> = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DELETED: 'completed',
  ENDED: 'completed',
};

export { OBJECTIVE_TO_LY };

export function toNormalizedCampaign(c: LYCampaign): NormalizedCampaign {
  return {
    id: c.campaignId,
    organizationId: c.lineAccountId,
    name: c.campaignName,
    objective: LY_OBJECTIVE_MAP[c.objective] ?? 'conversion',
    status: LY_STATUS_MAP[c.status] ?? 'error',
    startDate: new Date(c.startDate),
    endDate: c.endDate ? new Date(c.endDate) : null,
    totalBudget: c.budget,
    dailyBudget: c.dailyBudget,
    platforms: [Platform.LINE_YAHOO],
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
  };
}

export function toNormalizedAdGroup(ag: LYAdGroup): NormalizedAdGroup {
  const t = ag.targeting;
  const targeting: TargetingConfig = {
    ageMin: t.age?.min ?? null,
    ageMax: t.age?.max ?? null,
    genders: mapLYGender(t.gender),
    locations: t.locations,
    interests: t.interests,
    customAudiences: t.customAudiences,
    excludedAudiences: t.excludedAudiences,
    languages: t.languages,
    devices: mapLYDevices(t.deviceTypes),
    placements: t.adNetworks,
  };

  return {
    id: ag.adGroupId,
    campaignId: ag.campaignId,
    name: ag.adGroupName,
    platform: Platform.LINE_YAHOO,
    targetingConfig: targeting,
    externalId: ag.adGroupId,
  };
}

export function toNormalizedAd(ad: LYAd): NormalizedAd {
  const statusMap: Record<string, CampaignStatus> = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    DELETED: 'completed',
    UNDER_REVIEW: 'draft',
  };

  return {
    id: ad.adId,
    adGroupId: ad.adGroupId,
    name: ad.adName,
    creativeId: ad.creativeId ?? ad.adId,
    platform: Platform.LINE_YAHOO,
    status: statusMap[ad.status] ?? 'error',
    externalId: ad.adId,
  };
}

export function toNormalizedMetrics(m: LYInsights): NormalizedMetrics {
  return {
    timestamp: new Date(m.date),
    campaignId: m.campaignId,
    adGroupId: m.adGroupId,
    adId: m.adId,
    platform: Platform.LINE_YAHOO,
    impressions: m.impressions,
    clicks: m.clicks,
    conversions: m.conversions,
    spend: m.cost,
    revenue: m.revenue,
    ctr: m.ctr,
    cpc: m.cpc,
    cpa: m.cpa,
    roas: m.roas,
  };
}

export function toNormalizedAudience(a: LYAudience): AudienceSegment {
  const typeMap: Record<LYAudience['type'], 'custom' | 'lookalike' | 'saved'> = {
    CUSTOMER_LIST: 'custom',
    LOOKALIKE: 'lookalike',
    WEBSITE: 'custom',
    APP: 'custom',
  };

  return {
    id: a.audienceId,
    organizationId: a.lineAccountId,
    name: a.audienceName,
    platform: Platform.LINE_YAHOO,
    externalId: a.audienceId,
    size: a.size,
    definition: {
      type: typeMap[a.type] ?? 'custom',
      source: null,
      rules: [],
    },
  };
}

function mapLYGender(
  gender: LYAdGroup['targeting']['gender'],
): ('male' | 'female' | 'all')[] {
  if (!gender || gender === 'ALL') return ['all'];
  if (gender === 'MALE') return ['male'];
  if (gender === 'FEMALE') return ['female'];
  return ['all'];
}

function mapLYDevices(
  devices: LYAdGroup['targeting']['deviceTypes'],
): ('mobile' | 'desktop' | 'tablet' | 'all')[] {
  if (devices.includes('ALL')) return ['all'];
  const result: ('mobile' | 'desktop' | 'tablet')[] = [];
  if (devices.includes('SMARTPHONE')) result.push('mobile');
  if (devices.includes('PC')) result.push('desktop');
  if (devices.includes('TABLET')) result.push('tablet');
  return result.length > 0 ? result : ['all'];
}
