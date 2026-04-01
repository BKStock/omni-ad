// TikTok Business API v1.3 native types

export type TikTokCampaignStatus =
  | 'CAMPAIGN_STATUS_ENABLE'
  | 'CAMPAIGN_STATUS_DISABLE'
  | 'CAMPAIGN_STATUS_DELETE'
  | 'CAMPAIGN_STATUS_ALL';

export type TikTokObjectiveType =
  | 'REACH'
  | 'TRAFFIC'
  | 'VIDEO_VIEWS'
  | 'LEAD_GENERATION'
  | 'CONVERSIONS'
  | 'APP_INSTALL'
  | 'CATALOG_SALES';

export interface TikTokCampaign {
  campaign_id: string;
  campaign_name: string;
  advertiser_id: string;
  objective_type: TikTokObjectiveType;
  operation_status: TikTokCampaignStatus;
  budget: number;
  budget_mode: 'BUDGET_MODE_TOTAL' | 'BUDGET_MODE_DAY' | 'BUDGET_MODE_INFINITE';
  create_time: string;
  modify_time: string;
}

export type TikTokAdGroupStatus =
  | 'ADGROUP_STATUS_ACTIVE'
  | 'ADGROUP_STATUS_DISABLE'
  | 'ADGROUP_STATUS_DELETE';

export interface TikTokAdGroupTargeting {
  age: string[];
  gender: 'GENDER_MALE' | 'GENDER_FEMALE' | 'GENDER_UNLIMITED' | null;
  location: string[];
  interest_keyword_ids: string[];
  audience: string[];
  excluded_audience: string[];
  languages: string[];
  device_model_ids: string[];
  placement: string[];
}

export interface TikTokAdGroup {
  adgroup_id: string;
  adgroup_name: string;
  campaign_id: string;
  advertiser_id: string;
  operation_status: TikTokAdGroupStatus;
  targeting: TikTokAdGroupTargeting;
  budget: number;
  budget_mode: string;
  create_time: string;
  modify_time: string;
}

export type TikTokAdStatus =
  | 'AD_STATUS_DELIVERY_OK'
  | 'AD_STATUS_DISABLE'
  | 'AD_STATUS_DELETE';

export interface TikTokAd {
  ad_id: string;
  ad_name: string;
  adgroup_id: string;
  campaign_id: string;
  advertiser_id: string;
  operation_status: TikTokAdStatus;
  creative_id: string | null;
  create_time: string;
  modify_time: string;
}

export interface TikTokMetricsData {
  advertiser_id: string;
  campaign_id: string;
  adgroup_id: string | null;
  ad_id: string | null;
  stat_time_day: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cost_per_conversion: number;
  real_time_roas: number;
}

export interface TikTokAudience {
  audience_id: string;
  name: string;
  advertiser_id: string;
  type: 'CUSTOMER_FILE' | 'ENGAGEMENT' | 'APP' | 'WEBSITE' | 'LOOKALIKE';
  cover_num: number;
  create_time: string;
}

export interface TikTokOAuthResponse {
  access_token: string;
  advertiser_ids: string[];
  scope: string[];
}

export interface TikTokApiError {
  code: number;
  message: string;
  request_id: string;
}

export interface TikTokApiResponse<T> {
  code: number;
  message: string;
  request_id: string;
  data: T;
}

export interface TikTokListData<T> {
  list: T[];
  page_info: { total_number: number; total_page: number; page: number; page_size: number };
}
