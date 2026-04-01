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
  AmazonCampaign,
  AmazonAdGroup,
  AmazonAd,
  AmazonMetrics,
  AmazonAudience,
  AmazonCampaignState,
  AmazonCampaignType,
} from './types.js';

const AMAZON_TYPE_OBJECTIVE_MAP: Record<AmazonCampaignType, CampaignObjective> = {
  sponsoredProducts: 'conversion',
  sponsoredBrands: 'awareness',
  sponsoredDisplay: 'retargeting',
};

const OBJECTIVE_TO_AMAZON_TYPE: Record<CampaignObjective, AmazonCampaignType> = {
  awareness: 'sponsoredBrands',
  traffic: 'sponsoredProducts',
  engagement: 'sponsoredDisplay',
  leads: 'sponsoredProducts',
  conversion: 'sponsoredProducts',
  retargeting: 'sponsoredDisplay',
};

const AMAZON_STATE_MAP: Record<AmazonCampaignState, CampaignStatus> = {
  enabled: 'active',
  paused: 'paused',
  archived: 'completed',
};

export { OBJECTIVE_TO_AMAZON_TYPE };

export function toNormalizedCampaign(c: AmazonCampaign): NormalizedCampaign {
  return {
    id: c.campaignId,
    organizationId: c.profileId,
    name: c.name,
    objective: AMAZON_TYPE_OBJECTIVE_MAP[c.campaignType] ?? 'conversion',
    status: AMAZON_STATE_MAP[c.state] ?? 'error',
    startDate: parseAmazonDate(c.startDate),
    endDate: c.endDate ? parseAmazonDate(c.endDate) : null,
    totalBudget: 0,
    dailyBudget: c.dailyBudget,
    platforms: [Platform.AMAZON],
    createdAt: new Date(c.creationDate),
    updatedAt: new Date(c.lastUpdatedDate),
  };
}

export function toNormalizedAdGroup(ag: AmazonAdGroup): NormalizedAdGroup {
  return {
    id: ag.adGroupId,
    campaignId: ag.campaignId,
    name: ag.name,
    platform: Platform.AMAZON,
    targetingConfig: {
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
    },
    externalId: ag.adGroupId,
  };
}

export function toNormalizedAd(ad: AmazonAd): NormalizedAd {
  return {
    id: ad.adId,
    adGroupId: ad.adGroupId,
    name: ad.sku ?? ad.asin ?? ad.adId,
    creativeId: ad.asin ?? ad.adId,
    platform: Platform.AMAZON,
    status: AMAZON_STATE_MAP[ad.state] ?? 'error',
    externalId: ad.adId,
  };
}

export function toNormalizedMetrics(m: AmazonMetrics): NormalizedMetrics {
  const impressions = m.impressions;
  const clicks = m.clicks;
  const conversions = m.purchases1d;
  const spend = m.spend;
  const revenue = m.sales1d;

  return {
    timestamp: parseAmazonDate(m.date),
    campaignId: m.campaignId,
    adGroupId: m.adGroupId,
    adId: m.adId,
    platform: Platform.AMAZON,
    impressions,
    clicks,
    conversions,
    spend,
    revenue,
    ctr: m.clickThroughRate,
    cpc: m.costPerClick,
    cpa: m.costPerPurchase,
    roas: m.returnOnAdSpend,
  };
}

export function toNormalizedAudience(a: AmazonAudience): AudienceSegment {
  const typeMap: Record<AmazonAudience['type'], 'custom' | 'lookalike' | 'saved'> = {
    remarketing: 'custom',
    lookalike: 'lookalike',
    in_market: 'saved',
  };

  return {
    id: a.audienceId,
    organizationId: a.profileId,
    name: a.name,
    platform: Platform.AMAZON,
    externalId: a.audienceId,
    size: a.audienceSize,
    definition: {
      type: typeMap[a.type] ?? 'custom',
      source: null,
      rules: [],
    },
  };
}

/** Amazon uses YYYYMMDD date format */
function parseAmazonDate(dateStr: string): Date {
  if (dateStr.length === 8) {
    const y = parseInt(dateStr.slice(0, 4), 10);
    const m = parseInt(dateStr.slice(4, 6), 10) - 1;
    const d = parseInt(dateStr.slice(6, 8), 10);
    return new Date(y, m, d);
  }
  return new Date(dateStr);
}

export function formatAmazonDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
