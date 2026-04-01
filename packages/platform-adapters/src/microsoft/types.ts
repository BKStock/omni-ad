// Microsoft Advertising API v13 native types

export type MsCampaignStatus = 'Active' | 'Paused' | 'Deleted' | 'BudgetAndManualPaused';

export type MsCampaignType =
  | 'Search'
  | 'Shopping'
  | 'DynamicSearchAds'
  | 'Audience'
  | 'Performance Max';

export interface MsCampaign {
  Id: string;
  Name: string;
  Status: MsCampaignStatus;
  CampaignType: MsCampaignType;
  BudgetType: 'DailyBudgetStandard' | 'DailyBudgetAccelerated' | 'MonthlyBudgetSpendUntilDepleted';
  DailyBudget: number | null;
  Budget: number | null;
  StartDate: { Day: number; Month: number; Year: number } | null;
  EndDate: { Day: number; Month: number; Year: number } | null;
}

export type MsAdGroupStatus = 'Active' | 'Paused' | 'Deleted' | 'Expired';

export interface MsAdGroup {
  Id: string;
  Name: string;
  CampaignId: string;
  Status: MsAdGroupStatus;
  Language: string;
  BidScheme: Record<string, unknown>;
  StartDate: { Day: number; Month: number; Year: number } | null;
  EndDate: { Day: number; Month: number; Year: number } | null;
}

export type MsAdStatus = 'Active' | 'Paused' | 'Deleted' | 'Inactive';

export interface MsAd {
  Id: string;
  AdGroupId: string;
  Type: string;
  Status: MsAdStatus;
  TitlePart1: string | null;
  TitlePart2: string | null;
  Text: string | null;
  FinalUrls: { Urls: string[] } | null;
  CreativeName?: string;
}

export interface MsMetrics {
  CampaignId: string;
  AdGroupId: string | null;
  AdId: string | null;
  TimePeriod: string;
  Impressions: number;
  Clicks: number;
  Conversions: number;
  Spend: number;
  Revenue: number;
  Ctr: number;
  CostPerConversion: number;
  AverageCpc: number;
  ReturnOnAdSpend: number;
}

export interface MsAudience {
  Id: string;
  Name: string;
  Type: 'RemarketingList' | 'CustomAudience' | 'InMarketAudience' | 'SimilarRemarketingList';
  Description: string | null;
  MembershipDuration: number;
  SupportedCampaignTypes: string[];
}

export interface MsOAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface MsApiError {
  code: string;
  message: string;
  ErrorCode: string;
  TrackingId: string;
}

export interface MsSoapResponse<T> {
  value: T;
}
