// Amazon Advertising API v3 native types

export type AmazonCampaignState = 'enabled' | 'paused' | 'archived';

export type AmazonCampaignType =
  | 'sponsoredProducts'
  | 'sponsoredBrands'
  | 'sponsoredDisplay';

export interface AmazonCampaign {
  campaignId: string;
  profileId: string;
  name: string;
  campaignType: AmazonCampaignType;
  targetingType: 'manual' | 'auto';
  state: AmazonCampaignState;
  dailyBudget: number;
  startDate: string;
  endDate: string | null;
  creationDate: number;
  lastUpdatedDate: number;
  servingStatus: string;
}

export type AmazonAdGroupState = 'enabled' | 'paused' | 'archived';

export interface AmazonAdGroup {
  adGroupId: string;
  campaignId: string;
  profileId: string;
  name: string;
  state: AmazonAdGroupState;
  defaultBid: number;
  creationDate: number;
  lastUpdatedDate: number;
  servingStatus: string;
}

export type AmazonAdState = 'enabled' | 'paused' | 'archived';

export interface AmazonAd {
  adId: string;
  adGroupId: string;
  campaignId: string;
  profileId: string;
  asin: string | null;
  sku: string | null;
  state: AmazonAdState;
  creationDate: number;
  lastUpdatedDate: number;
  servingStatus: string;
}

export interface AmazonMetrics {
  campaignId: string;
  adGroupId: string | null;
  adId: string | null;
  date: string;
  impressions: number;
  clicks: number;
  purchases1d: number;
  spend: number;
  sales1d: number;
  clickThroughRate: number;
  costPerClick: number;
  returnOnAdSpend: number;
  costPerPurchase: number;
}

export interface AmazonAudience {
  audienceId: string;
  name: string;
  profileId: string;
  type: 'remarketing' | 'lookalike' | 'in_market';
  description: string | null;
  audienceSize: number;
}

export interface AmazonOAuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AmazonApiError {
  code: string;
  details: string;
  requestId: string;
}

export interface AmazonProfile {
  profileId: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  accountInfo: {
    marketplaceStringId: string;
    id: string;
    type: string;
    name: string;
  };
}
