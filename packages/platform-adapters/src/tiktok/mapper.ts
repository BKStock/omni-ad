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
  TikTokCampaign,
  TikTokAdGroup,
  TikTokAd,
  TikTokMetricsData,
  TikTokAudience,
  TikTokObjectiveType,
  TikTokCampaignStatus,
} from './types.js';

const TIKTOK_OBJECTIVE_MAP: Record<TikTokObjectiveType, CampaignObjective> = {
  REACH: 'awareness',
  TRAFFIC: 'traffic',
  VIDEO_VIEWS: 'awareness',
  LEAD_GENERATION: 'leads',
  CONVERSIONS: 'conversion',
  APP_INSTALL: 'conversion',
  CATALOG_SALES: 'conversion',
};

const OBJECTIVE_TO_TIKTOK: Record<CampaignObjective, TikTokObjectiveType> = {
  awareness: 'REACH',
  traffic: 'TRAFFIC',
  engagement: 'VIDEO_VIEWS',
  leads: 'LEAD_GENERATION',
  conversion: 'CONVERSIONS',
  retargeting: 'CONVERSIONS',
};

const TIKTOK_STATUS_MAP: Record<TikTokCampaignStatus, CampaignStatus> = {
  CAMPAIGN_STATUS_ENABLE: 'active',
  CAMPAIGN_STATUS_DISABLE: 'paused',
  CAMPAIGN_STATUS_DELETE: 'completed',
  CAMPAIGN_STATUS_ALL: 'active',
};

export { OBJECTIVE_TO_TIKTOK };

export function toNormalizedCampaign(
  c: TikTokCampaign,
): NormalizedCampaign {
  const isDaily = c.budget_mode === 'BUDGET_MODE_DAY';
  return {
    id: c.campaign_id,
    organizationId: c.advertiser_id,
    name: c.campaign_name,
    objective: TIKTOK_OBJECTIVE_MAP[c.objective_type] ?? 'conversion',
    status: TIKTOK_STATUS_MAP[c.operation_status] ?? 'error',
    startDate: new Date(c.create_time),
    endDate: null,
    totalBudget: isDaily ? 0 : c.budget,
    dailyBudget: isDaily ? c.budget : 0,
    platforms: [Platform.TIKTOK],
    createdAt: new Date(c.create_time),
    updatedAt: new Date(c.modify_time),
  };
}

export function toNormalizedAdGroup(ag: TikTokAdGroup): NormalizedAdGroup {
  const t = ag.targeting;
  const targeting: TargetingConfig = {
    ageMin: parseAgeMin(t.age),
    ageMax: parseAgeMax(t.age),
    genders: mapTikTokGender(t.gender),
    locations: t.location,
    interests: t.interest_keyword_ids,
    customAudiences: t.audience,
    excludedAudiences: t.excluded_audience,
    languages: t.languages,
    devices: ['all'],
    placements: t.placement,
  };

  return {
    id: ag.adgroup_id,
    campaignId: ag.campaign_id,
    name: ag.adgroup_name,
    platform: Platform.TIKTOK,
    targetingConfig: targeting,
    externalId: ag.adgroup_id,
  };
}

export function toNormalizedAd(ad: TikTokAd): NormalizedAd {
  const statusMap: Record<string, CampaignStatus> = {
    AD_STATUS_DELIVERY_OK: 'active',
    AD_STATUS_DISABLE: 'paused',
    AD_STATUS_DELETE: 'completed',
  };

  return {
    id: ad.ad_id,
    adGroupId: ad.adgroup_id,
    name: ad.ad_name,
    creativeId: ad.creative_id ?? ad.ad_id,
    platform: Platform.TIKTOK,
    status: statusMap[ad.operation_status] ?? 'error',
    externalId: ad.ad_id,
  };
}

export function toNormalizedMetrics(m: TikTokMetricsData): NormalizedMetrics {
  return {
    timestamp: new Date(m.stat_time_day),
    campaignId: m.campaign_id,
    adGroupId: m.adgroup_id,
    adId: m.ad_id,
    platform: Platform.TIKTOK,
    impressions: m.impressions,
    clicks: m.clicks,
    conversions: m.conversions,
    spend: m.cost,
    revenue: m.revenue,
    ctr: m.ctr,
    cpc: m.cpc,
    cpa: m.cost_per_conversion,
    roas: m.real_time_roas,
  };
}

export function toNormalizedAudience(a: TikTokAudience): AudienceSegment {
  const typeMap: Record<TikTokAudience['type'], 'custom' | 'lookalike' | 'saved'> = {
    CUSTOMER_FILE: 'custom',
    ENGAGEMENT: 'custom',
    APP: 'custom',
    WEBSITE: 'custom',
    LOOKALIKE: 'lookalike',
  };

  return {
    id: a.audience_id,
    organizationId: a.advertiser_id,
    name: a.name,
    platform: Platform.TIKTOK,
    externalId: a.audience_id,
    size: a.cover_num,
    definition: {
      type: typeMap[a.type] ?? 'custom',
      source: null,
      rules: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAgeMin(ages: string[]): number | null {
  if (ages.length === 0) return null;
  const first = ages[0];
  const match = first?.match(/AGE_(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

function parseAgeMax(ages: string[]): number | null {
  if (ages.length === 0) return null;
  const last = ages[ages.length - 1];
  const match = last?.match(/AGE_(\d+)_(\d+)|AGE_(\d+)/);
  if (match?.[2]) return parseInt(match[2], 10);
  if (match?.[3]) return parseInt(match[3], 10) + 4;
  return null;
}

function mapTikTokGender(
  gender: TikTokAdGroup['targeting']['gender'],
): ('male' | 'female' | 'all')[] {
  if (!gender || gender === 'GENDER_UNLIMITED') return ['all'];
  if (gender === 'GENDER_MALE') return ['male'];
  if (gender === 'GENDER_FEMALE') return ['female'];
  return ['all'];
}
