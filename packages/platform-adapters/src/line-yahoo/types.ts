// LINE/Yahoo (LY Corporation) Ads API v3 native types

export type LYCampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ENDED';

export type LYObjective =
  | 'REACH'
  | 'TRAFFIC'
  | 'ENGAGEMENT'
  | 'APP_INSTALLS'
  | 'CONVERSIONS'
  | 'CATALOG_SALES'
  | 'LEAD_GENERATION';

export interface LYCampaign {
  campaignId: string;
  campaignName: string;
  lineAccountId: string;
  objective: LYObjective;
  status: LYCampaignStatus;
  startDate: string;
  endDate: string | null;
  budget: number;
  dailyBudget: number;
  createdAt: string;
  updatedAt: string;
}

export type LYAdGroupStatus = 'ACTIVE' | 'PAUSED' | 'DELETED';

export interface LYAdGroupTargeting {
  age?: { min: number; max: number } | null;
  gender: 'MALE' | 'FEMALE' | 'ALL' | null;
  locations: string[];
  interests: string[];
  customAudiences: string[];
  excludedAudiences: string[];
  languages: string[];
  deviceTypes: ('PC' | 'SMARTPHONE' | 'TABLET' | 'ALL')[];
  adNetworks: string[];
}

export interface LYAdGroup {
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  lineAccountId: string;
  status: LYAdGroupStatus;
  targeting: LYAdGroupTargeting;
  createdAt: string;
  updatedAt: string;
}

export type LYAdStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'UNDER_REVIEW';

export interface LYAd {
  adId: string;
  adName: string;
  adGroupId: string;
  campaignId: string;
  lineAccountId: string;
  status: LYAdStatus;
  creativeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LYInsights {
  campaignId: string;
  adGroupId: string | null;
  adId: string | null;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export interface LYAudience {
  audienceId: string;
  audienceName: string;
  lineAccountId: string;
  type: 'CUSTOMER_LIST' | 'LOOKALIKE' | 'WEBSITE' | 'APP';
  size: number;
  createdAt: string;
}

export interface LYOAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface LYApiError {
  code: string;
  message: string;
  errors?: { field: string; message: string }[];
}

export interface LYApiResponse<T> {
  data: T;
  paging?: { nextCursor?: string; previousCursor?: string };
}

export interface LYListResponse<T> {
  data: T[];
  paging?: { nextCursor?: string; totalCount?: number };
}
