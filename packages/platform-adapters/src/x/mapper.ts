import { Platform } from '@omni-ad/shared';
import type {
  CampaignObjective,
  CampaignStatus,
  NormalizedCampaign,
  NormalizedAdGroup,
  NormalizedAd,
  NormalizedMetrics,
  AudienceSegment,
} from '@omni-ad/shared';
import type {
  XCampaign,
  XLineItem,
  XTweet,
  XInsights,
  XCustomAudience,
  XObjective,
  XCampaignStatus,
} from './types.js';

const X_OBJECTIVE_MAP: Record<XObjective, CampaignObjective> = {
  AWARENESS: 'awareness',
  TWEET_ENGAGEMENTS: 'engagement',
  WEBSITE_CLICKS: 'traffic',
  FOLLOWERS: 'engagement',
  APP_INSTALLS: 'conversion',
  VIDEO_VIEWS: 'awareness',
  PREROLL_VIEWS: 'awareness',
};

const OBJECTIVE_TO_X_MAP: Record<CampaignObjective, XObjective> = {
  awareness: 'AWARENESS',
  traffic: 'WEBSITE_CLICKS',
  engagement: 'TWEET_ENGAGEMENTS',
  leads: 'WEBSITE_CLICKS',
  conversion: 'APP_INSTALLS',
  retargeting: 'WEBSITE_CLICKS',
};

const X_STATUS_MAP: Record<XCampaignStatus, CampaignStatus> = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DELETED: 'completed',
  DRAFT: 'draft',
};

export { OBJECTIVE_TO_X_MAP };

/** X reports budgets in local micros (1,000,000 = 1 unit of currency) */
function microsToUnit(micros: string): number {
  return parseInt(micros, 10) / 1_000_000;
}

export function unitToMicros(unit: number): string {
  return String(Math.round(unit * 1_000_000));
}

export function toNormalizedCampaign(c: XCampaign): NormalizedCampaign {
  return {
    id: c.id,
    organizationId: c.account_id,
    name: c.name,
    objective: X_OBJECTIVE_MAP[c.objective] ?? 'conversion',
    status: X_STATUS_MAP[c.entity_status] ?? 'error',
    startDate: new Date(c.start_time),
    endDate: c.end_time ? new Date(c.end_time) : null,
    totalBudget: microsToUnit(c.total_budget_amount_local_micro),
    dailyBudget: microsToUnit(c.daily_budget_amount_local_micro),
    platforms: [Platform.X],
    createdAt: new Date(c.created_at),
    updatedAt: new Date(c.updated_at),
  };
}

export function toNormalizedAdGroup(lineItem: XLineItem): NormalizedAdGroup {
  return {
    id: lineItem.id,
    campaignId: lineItem.campaign_id,
    name: lineItem.name,
    platform: Platform.X,
    targetingConfig: {
      ageMin: null,
      ageMax: null,
      genders: ['all'],
      locations: lineItem.targeting_criteria
        .filter((t) => t.targeting_type === 'LOCATION')
        .map((t) => t.targeting_value),
      interests: lineItem.targeting_criteria
        .filter((t) => t.targeting_type === 'INTEREST')
        .map((t) => t.targeting_value),
      customAudiences: lineItem.targeting_criteria
        .filter((t) => t.targeting_type === 'TAILORED_AUDIENCE')
        .map((t) => t.targeting_value),
      excludedAudiences: [],
      languages: lineItem.targeting_criteria
        .filter((t) => t.targeting_type === 'LANGUAGE')
        .map((t) => t.targeting_value),
      devices: ['all'],
      placements: [],
    },
    externalId: lineItem.id,
  };
}

export function toNormalizedAd(tweet: XTweet): NormalizedAd {
  return {
    id: tweet.id,
    adGroupId: tweet.line_item_id,
    name: `Tweet ${tweet.tweet_id}`,
    creativeId: tweet.tweet_id,
    platform: Platform.X,
    status: X_STATUS_MAP[tweet.entity_status] ?? 'error',
    externalId: tweet.id,
  };
}

export function toNormalizedMetrics(
  insights: XInsights,
  campaignId: string,
): NormalizedMetrics {
  const metricsData = insights.id_data[0]?.metrics;
  const sumFirst = (arr: string[] | undefined) =>
    parseFloat(arr?.[0] ?? '0');

  const impressions = sumFirst(metricsData?.impressions);
  const clicks = sumFirst(metricsData?.clicks);
  const conversions = sumFirst(metricsData?.conversions);
  const spend = microsToUnit(metricsData?.billed_charge_local_micro?.[0] ?? '0');

  return {
    timestamp: new Date(insights.segment?.start_time ?? Date.now()),
    campaignId,
    adGroupId: null,
    adId: null,
    platform: Platform.X,
    impressions,
    clicks,
    conversions,
    spend,
    revenue: 0,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    roas: 0,
  };
}

export function toNormalizedAudience(audience: XCustomAudience): AudienceSegment {
  return {
    id: audience.id,
    organizationId: audience.account_id,
    name: audience.name,
    platform: Platform.X,
    externalId: audience.id,
    size: audience.audience_size,
    definition: {
      type: 'custom',
      source: null,
      rules: [],
    },
  };
}
