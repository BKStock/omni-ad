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
  GoogleCampaign,
  GoogleAdGroup,
  GoogleAdGroupAd,
  GoogleMetricsRow,
  GoogleUserList,
  GoogleCampaignStatus,
  GoogleAdvertisingChannelType,
} from './types.js';

// ---------------------------------------------------------------------------
// Status / objective mappings
// ---------------------------------------------------------------------------

const GOOGLE_CHANNEL_OBJECTIVE_MAP: Record<GoogleAdvertisingChannelType, CampaignObjective> = {
  SEARCH: 'traffic',
  DISPLAY: 'awareness',
  VIDEO: 'awareness',
  PERFORMANCE_MAX: 'conversion',
  SHOPPING: 'conversion',
  SMART: 'conversion',
  LOCAL: 'leads',
  DISCOVERY: 'engagement',
};

const OBJECTIVE_TO_GOOGLE_CHANNEL: Record<CampaignObjective, GoogleAdvertisingChannelType> = {
  awareness: 'DISPLAY',
  traffic: 'SEARCH',
  engagement: 'DISCOVERY',
  leads: 'SEARCH',
  conversion: 'PERFORMANCE_MAX',
  retargeting: 'DISPLAY',
};

const GOOGLE_STATUS_MAP: Record<GoogleCampaignStatus, CampaignStatus> = {
  ENABLED: 'active',
  PAUSED: 'paused',
  REMOVED: 'completed',
};

export { OBJECTIVE_TO_GOOGLE_CHANNEL };

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

export function toNormalizedCampaign(
  campaign: GoogleCampaign,
  accountId: string,
  totalBudgetMicros = '0',
  dailyBudgetMicros = '0',
): NormalizedCampaign {
  return {
    id: campaign.id,
    organizationId: accountId,
    name: campaign.name,
    objective:
      GOOGLE_CHANNEL_OBJECTIVE_MAP[campaign.advertisingChannelType] ?? 'conversion',
    status: GOOGLE_STATUS_MAP[campaign.status] ?? 'error',
    startDate: parseGoogleDate(campaign.startDate),
    endDate: campaign.endDate ? parseGoogleDate(campaign.endDate) : null,
    totalBudget: microsToYen(totalBudgetMicros),
    dailyBudget: microsToYen(dailyBudgetMicros),
    platforms: [Platform.GOOGLE],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function toNormalizedAdGroup(
  adGroup: GoogleAdGroup,
  accountId: string,
): NormalizedAdGroup {
  // Targeting details require a separate criteria query;
  // return a minimal config here — callers enrich if needed
  const defaultTargeting: TargetingConfig = {
    ageMin: null,
    ageMax: null,
    genders: ['all'],
    locations: [],
    interests: [],
    customAudiences: [],
    excludedAudiences: [],
    languages: [],
    devices: ['all'],
    placements: [],
  };

  return {
    id: adGroup.id,
    campaignId: extractIdFromResourceName(adGroup.campaign),
    name: adGroup.name,
    platform: Platform.GOOGLE,
    targetingConfig: defaultTargeting,
    externalId: adGroup.id,
  };
  void accountId;
}

export function toNormalizedAd(adGroupAd: GoogleAdGroupAd): NormalizedAd {
  return {
    id: adGroupAd.ad.id,
    adGroupId: extractIdFromResourceName(adGroupAd.adGroup),
    name: adGroupAd.ad.name,
    creativeId: adGroupAd.ad.id,
    platform: Platform.GOOGLE,
    status: GOOGLE_STATUS_MAP[adGroupAd.status as GoogleCampaignStatus] ?? 'error',
    externalId: adGroupAd.ad.id,
  };
}

export function toNormalizedMetrics(
  row: GoogleMetricsRow,
  accountId: string,
): NormalizedMetrics {
  const m = row.metrics;
  const impressions = parseInt(m.impressions ?? '0', 10);
  const clicks = parseInt(m.clicks ?? '0', 10);
  const conversions = parseFloat(m.conversions ?? '0');
  const spend = microsToYen(m.costMicros ?? '0');
  const revenue = parseFloat(m.conversionsValue ?? '0');

  const ctr = parseFloat(m.ctr ?? '0');
  const cpc = microsToYen(m.averageCpc ?? '0');
  const cpa = conversions > 0 ? spend / conversions : 0;
  const roas = spend > 0 ? revenue / spend : 0;

  return {
    timestamp: new Date(row.segments?.date ?? new Date()),
    campaignId: row.campaign?.id ?? accountId,
    adGroupId: row.adGroup?.id ?? null,
    adId: row.adGroupAd?.ad.id ?? null,
    platform: Platform.GOOGLE,
    impressions,
    clicks,
    conversions,
    spend,
    revenue,
    ctr,
    cpc,
    cpa,
    roas,
  };
}

export function toNormalizedAudience(
  userList: GoogleUserList,
  accountId: string,
): AudienceSegment {
  const typeMap: Record<string, 'custom' | 'lookalike' | 'saved'> = {
    CRM_BASED: 'custom',
    SIMILAR: 'lookalike',
    RULE_BASED: 'saved',
    LOGICAL: 'saved',
    BASIC: 'custom',
  };

  return {
    id: userList.id,
    organizationId: accountId,
    name: userList.name,
    platform: Platform.GOOGLE,
    externalId: userList.id,
    size: userList.estimatedUserCount,
    definition: {
      type: typeMap[userList.type] ?? 'custom',
      source: null,
      rules: [],
    },
  };
}

// ---------------------------------------------------------------------------
// GAQL query builders
// ---------------------------------------------------------------------------

export function buildCampaignQuery(campaignId?: string): string {
  const where = campaignId ? `WHERE campaign.id = ${campaignId}` : '';
  return `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
    campaign.start_date, campaign.end_date, campaign.campaign_budget
    FROM campaign ${where}`.trim();
}

export function buildAdGroupQuery(campaignId: string): string {
  return `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.campaign, ad_group.type
    FROM ad_group WHERE campaign.id = ${campaignId}`;
}

export function buildAdQuery(adGroupId: string): string {
  return `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type,
    ad_group_ad.status, ad_group_ad.ad_group
    FROM ad_group_ad WHERE ad_group.id = ${adGroupId}`;
}

export function buildMetricsQuery(
  startDate: string,
  endDate: string,
  granularity: string,
  campaignId?: string,
  adGroupId?: string,
): string {
  const level = adGroupId ? 'ad_group' : 'campaign';
  const conditions: string[] = [
    `segments.date BETWEEN '${startDate}' AND '${endDate}'`,
  ];
  if (campaignId) conditions.push(`campaign.id = ${campaignId}`);
  if (adGroupId) conditions.push(`ad_group.id = ${adGroupId}`);

  void granularity; // granularity is handled by date segments

  const fields = [
    `${level}.id`,
    `${level}.name`,
    'segments.date',
    'metrics.impressions',
    'metrics.clicks',
    'metrics.conversions',
    'metrics.cost_micros',
    'metrics.conversions_value',
    'metrics.ctr',
    'metrics.average_cpc',
    'metrics.cost_per_conversion',
    'metrics.value_per_conversion',
  ];

  return `SELECT ${fields.join(', ')} FROM ${level} WHERE ${conditions.join(' AND ')}`;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function parseGoogleDate(dateStr: string): Date {
  // Google returns dates as "YYYY-MM-DD"
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year ?? 2000, (month ?? 1) - 1, day ?? 1);
}

/** Google Ads reports cost in micros: 1,000,000 micros = 1 JPY */
function microsToYen(micros: string): number {
  return parseInt(micros, 10) / 1_000_000;
}

export function yenToMicros(yen: number): string {
  return String(Math.round(yen * 1_000_000));
}

function extractIdFromResourceName(resourceName: string): string {
  const parts = resourceName.split('/');
  return parts[parts.length - 1] ?? resourceName;
}
