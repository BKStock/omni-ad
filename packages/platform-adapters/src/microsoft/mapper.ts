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
  MsCampaign,
  MsAdGroup,
  MsAd,
  MsMetrics,
  MsAudience,
  MsCampaignStatus,
  MsCampaignType,
} from './types.js';

const MS_TYPE_OBJECTIVE_MAP: Record<MsCampaignType, CampaignObjective> = {
  Search: 'traffic',
  Shopping: 'conversion',
  DynamicSearchAds: 'traffic',
  Audience: 'awareness',
  'Performance Max': 'conversion',
};

const OBJECTIVE_TO_MS_TYPE: Record<CampaignObjective, MsCampaignType> = {
  awareness: 'Audience',
  traffic: 'Search',
  engagement: 'Audience',
  leads: 'Search',
  conversion: 'Performance Max',
  retargeting: 'Audience',
};

const MS_STATUS_MAP: Record<MsCampaignStatus, CampaignStatus> = {
  Active: 'active',
  Paused: 'paused',
  Deleted: 'completed',
  BudgetAndManualPaused: 'paused',
};

export { OBJECTIVE_TO_MS_TYPE };

interface MsDateObj {
  Day: number;
  Month: number;
  Year: number;
}

function parseMsDate(d: MsDateObj): Date {
  return new Date(d.Year, d.Month - 1, d.Day);
}

export function toNormalizedCampaign(c: MsCampaign, accountId: string): NormalizedCampaign {
  return {
    id: c.Id,
    organizationId: accountId,
    name: c.Name,
    objective: MS_TYPE_OBJECTIVE_MAP[c.CampaignType] ?? 'conversion',
    status: MS_STATUS_MAP[c.Status] ?? 'error',
    startDate: c.StartDate ? parseMsDate(c.StartDate) : new Date(),
    endDate: c.EndDate ? parseMsDate(c.EndDate) : null,
    totalBudget: c.Budget ?? 0,
    dailyBudget: c.DailyBudget ?? 0,
    platforms: [Platform.MICROSOFT],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function toNormalizedAdGroup(ag: MsAdGroup, accountId: string): NormalizedAdGroup {
  return {
    id: ag.Id,
    campaignId: ag.CampaignId,
    name: ag.Name,
    platform: Platform.MICROSOFT,
    targetingConfig: {
      ageMin: null,
      ageMax: null,
      genders: ['all'],
      locations: [],
      interests: [],
      customAudiences: [],
      excludedAudiences: [],
      languages: ag.Language ? [ag.Language] : [],
      devices: ['all'],
      placements: [],
    },
    externalId: ag.Id,
  };
  void accountId;
}

export function toNormalizedAd(ad: MsAd): NormalizedAd {
  const statusMap: Record<string, CampaignStatus> = {
    Active: 'active',
    Paused: 'paused',
    Deleted: 'completed',
    Inactive: 'error',
  };

  return {
    id: ad.Id,
    adGroupId: ad.AdGroupId,
    name: ad.CreativeName ?? ([ad.TitlePart1, ad.TitlePart2].filter(Boolean).join(' - ') || ad.Id),
    creativeId: ad.Id,
    platform: Platform.MICROSOFT,
    status: statusMap[ad.Status] ?? 'error',
    externalId: ad.Id,
  };
}

export function toNormalizedMetrics(m: MsMetrics, accountId: string): NormalizedMetrics {
  const roas = m.Spend > 0 ? m.Revenue / m.Spend : 0;

  return {
    timestamp: new Date(m.TimePeriod),
    campaignId: m.CampaignId,
    adGroupId: m.AdGroupId,
    adId: m.AdId,
    platform: Platform.MICROSOFT,
    impressions: m.Impressions,
    clicks: m.Clicks,
    conversions: m.Conversions,
    spend: m.Spend,
    revenue: m.Revenue,
    ctr: m.Ctr,
    cpc: m.AverageCpc,
    cpa: m.CostPerConversion,
    roas: m.ReturnOnAdSpend > 0 ? m.ReturnOnAdSpend : roas,
  };
  void accountId;
}

export function toNormalizedAudience(a: MsAudience, accountId: string): AudienceSegment {
  const typeMap: Record<MsAudience['Type'], 'custom' | 'lookalike' | 'saved'> = {
    RemarketingList: 'custom',
    CustomAudience: 'custom',
    InMarketAudience: 'saved',
    SimilarRemarketingList: 'lookalike',
  };

  return {
    id: a.Id,
    organizationId: accountId,
    name: a.Name,
    platform: Platform.MICROSOFT,
    externalId: a.Id,
    size: 0,
    definition: {
      type: typeMap[a.Type] ?? 'custom',
      source: null,
      rules: [],
    },
  };
}

export function formatMsDate(date: Date): MsDateObj {
  return {
    Day: date.getDate(),
    Month: date.getMonth() + 1,
    Year: date.getFullYear(),
  };
}
