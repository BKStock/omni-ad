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
  MetaCampaign,
  MetaAdSet,
  MetaAd,
  MetaInsights,
  MetaCustomAudience,
  MetaObjective,
  MetaCampaignStatus,
} from './types.js';
import type { CreateCampaignInput } from '../types.js';

// ---------------------------------------------------------------------------
// Status / objective mappings
// ---------------------------------------------------------------------------

const META_OBJECTIVE_MAP: Record<MetaObjective, CampaignObjective> = {
  OUTCOME_AWARENESS: 'awareness',
  OUTCOME_TRAFFIC: 'traffic',
  OUTCOME_ENGAGEMENT: 'engagement',
  OUTCOME_LEADS: 'leads',
  OUTCOME_SALES: 'conversion',
  OUTCOME_APP_PROMOTION: 'conversion',
};

const OBJECTIVE_TO_META_MAP: Record<CampaignObjective, MetaObjective> = {
  awareness: 'OUTCOME_AWARENESS',
  traffic: 'OUTCOME_TRAFFIC',
  engagement: 'OUTCOME_ENGAGEMENT',
  leads: 'OUTCOME_LEADS',
  conversion: 'OUTCOME_SALES',
  retargeting: 'OUTCOME_SALES',
};

const META_STATUS_MAP: Record<MetaCampaignStatus, CampaignStatus> = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DELETED: 'completed',
  ARCHIVED: 'completed',
};

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

export function toNormalizedCampaign(c: MetaCampaign): NormalizedCampaign {
  return {
    id: c.id,
    organizationId: c.account_id,
    name: c.name,
    objective: META_OBJECTIVE_MAP[c.objective] ?? 'conversion',
    status: META_STATUS_MAP[c.effective_status] ?? 'error',
    startDate: new Date(c.start_time),
    endDate: c.stop_time ? new Date(c.stop_time) : null,
    totalBudget: parseFloat(c.lifetime_budget || '0'),
    dailyBudget: parseFloat(c.daily_budget || '0'),
    platforms: [Platform.META],
    createdAt: new Date(c.created_time),
    updatedAt: new Date(c.updated_time),
  };
}

export function toNormalizedAdGroup(adSet: MetaAdSet): NormalizedAdGroup {
  const t = adSet.targeting;

  const targeting: TargetingConfig = {
    ageMin: t.age_min ?? null,
    ageMax: t.age_max ?? null,
    genders: mapMetaGenders(t.genders),
    locations: extractLocations(t.geo_locations),
    interests: (t.interests ?? []).map((i) => i.name),
    customAudiences: (t.custom_audiences ?? []).map((a) => a.id),
    excludedAudiences: (t.excluded_custom_audiences ?? []).map((a) => a.id),
    languages: t.locales ?? [],
    devices: mapMetaDevices(t.device_platforms),
    placements: t.publisher_platforms ?? [],
  };

  return {
    id: adSet.id,
    campaignId: adSet.campaign_id,
    name: adSet.name,
    platform: Platform.META,
    targetingConfig: targeting,
    externalId: adSet.id,
  };
}

export function toNormalizedAd(ad: MetaAd): NormalizedAd {
  return {
    id: ad.id,
    adGroupId: ad.adset_id,
    name: ad.name,
    creativeId: ad.creative.id,
    platform: Platform.META,
    status: META_STATUS_MAP[ad.effective_status] ?? 'error',
    externalId: ad.id,
  };
}

export function toNormalizedMetrics(insights: MetaInsights): NormalizedMetrics {
  const impressions = parseFloat(insights.impressions || '0');
  const clicks = parseFloat(insights.clicks || '0');
  const conversions = parseFloat(insights.conversions || '0');
  const spend = parseFloat(insights.spend || '0');
  const revenue = parseFloat(insights.revenue || '0');

  const roasEntry = insights.purchase_roas?.[0];
  const roas = roasEntry ? parseFloat(roasEntry.value) : spend > 0 ? revenue / spend : 0;

  return {
    timestamp: new Date(insights.date_start),
    campaignId: insights.campaign_id,
    adGroupId: insights.adset_id,
    adId: insights.ad_id,
    platform: Platform.META,
    impressions,
    clicks,
    conversions,
    spend,
    revenue,
    ctr: parseFloat(insights.ctr || '0'),
    cpc: parseFloat(insights.cpc || '0'),
    cpa: conversions > 0 ? spend / conversions : 0,
    roas,
  };
}

export function toNormalizedAudience(audience: MetaCustomAudience): AudienceSegment {
  const typeMap: Record<MetaCustomAudience['subtype'], 'custom' | 'lookalike' | 'saved'> = {
    CUSTOM: 'custom',
    WEBSITE: 'custom',
    LOOKALIKE: 'lookalike',
    SAVED_AUDIENCE: 'saved',
  };

  return {
    id: audience.id,
    organizationId: audience.account_id,
    name: audience.name,
    platform: Platform.META,
    externalId: audience.id,
    size: audience.approximate_count_upper_bound,
    definition: {
      type: typeMap[audience.subtype] ?? 'custom',
      source: null,
      rules: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Input mappers
// ---------------------------------------------------------------------------

export function fromCreateCampaignInput(
  input: CreateCampaignInput,
  adAccountId: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: input.name,
    objective: OBJECTIVE_TO_META_MAP[input.objective] ?? 'OUTCOME_SALES',
    status: 'PAUSED',
    start_time: input.startDate.toISOString(),
  };

  if (input.endDate) {
    payload['stop_time'] = input.endDate.toISOString();
  }

  if (input.dailyBudget > 0) {
    // Meta expects budget in cents
    payload['daily_budget'] = Math.round(input.dailyBudget * 100).toString();
  } else if (input.totalBudget > 0) {
    payload['lifetime_budget'] = Math.round(input.totalBudget * 100).toString();
  }

  if (input.platformSpecificConfig) {
    Object.assign(payload, input.platformSpecificConfig);
  }

  payload['special_ad_categories'] = [];
  void adAccountId;

  return payload;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function mapMetaGenders(
  genders: number[] | undefined,
): ('male' | 'female' | 'all')[] {
  if (!genders || genders.length === 0) return ['all'];
  const result: ('male' | 'female')[] = [];
  if (genders.includes(1)) result.push('male');
  if (genders.includes(2)) result.push('female');
  return result.length === 0 ? ['all'] : result;
}

function extractLocations(
  geoLocations: MetaAdSet['targeting']['geo_locations'],
): string[] {
  if (!geoLocations) return [];
  const countries = geoLocations.countries ?? [];
  const cities = (geoLocations.cities ?? []).map((c) => c.name);
  const regions = (geoLocations.regions ?? []).map((r) => r.name);
  return [...countries, ...cities, ...regions];
}

function mapMetaDevices(
  devices: ('mobile' | 'desktop')[] | undefined,
): ('mobile' | 'desktop' | 'tablet' | 'all')[] {
  if (!devices || devices.length === 0) return ['all'];
  const result: ('mobile' | 'desktop')[] = [];
  if (devices.includes('mobile')) result.push('mobile');
  if (devices.includes('desktop')) result.push('desktop');
  return result.length === 0 ? ['all'] : result;
}
