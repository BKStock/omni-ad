// Meta Marketing API v24.0 native types

export type MetaCampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';

export type MetaObjective =
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_APP_PROMOTION';

export interface MetaCampaign {
  id: string;
  name: string;
  objective: MetaObjective;
  status: MetaCampaignStatus;
  effective_status: MetaCampaignStatus;
  start_time: string;
  stop_time: string | null;
  daily_budget: string;
  lifetime_budget: string;
  created_time: string;
  updated_time: string;
  account_id: string;
}

export type MetaAdSetStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';

export interface MetaAdSetTargeting {
  age_min?: number;
  age_max?: number;
  genders?: number[];
  geo_locations?: {
    countries?: string[];
    cities?: { key: string; name: string }[];
    regions?: { key: string; name: string }[];
  };
  interests?: { id: string; name: string }[];
  custom_audiences?: { id: string; name: string }[];
  excluded_custom_audiences?: { id: string; name: string }[];
  locales?: string[];
  device_platforms?: ('mobile' | 'desktop')[];
  publisher_platforms?: string[];
}

export interface MetaAdSet {
  id: string;
  campaign_id: string;
  name: string;
  status: MetaAdSetStatus;
  effective_status: MetaAdSetStatus;
  targeting: MetaAdSetTargeting;
  daily_budget: string | null;
  lifetime_budget: string | null;
  start_time: string;
  end_time: string | null;
  created_time: string;
  updated_time: string;
}

export type MetaAdStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';

export interface MetaAdCreative {
  id: string;
  name: string;
}

export interface MetaAd {
  id: string;
  adset_id: string;
  campaign_id: string;
  name: string;
  status: MetaAdStatus;
  effective_status: MetaAdStatus;
  creative: MetaAdCreative;
  created_time: string;
  updated_time: string;
}

export interface MetaInsights {
  campaign_id: string;
  adset_id: string | null;
  ad_id: string | null;
  date_start: string;
  date_stop: string;
  impressions: string;
  clicks: string;
  conversions: string;
  spend: string;
  revenue: string;
  ctr: string;
  cpc: string;
  cost_per_conversion: string;
  purchase_roas: { action_type: string; value: string }[];
}

export interface MetaCustomAudience {
  id: string;
  account_id: string;
  name: string;
  subtype: 'CUSTOM' | 'WEBSITE' | 'LOOKALIKE' | 'SAVED_AUDIENCE';
  approximate_count_lower_bound: number;
  approximate_count_upper_bound: number;
  description: string | null;
  rule: unknown;
}

export interface MetaOAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  auth_type?: string;
}

export interface MetaApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

export interface MetaApiResponse<T> {
  data: T[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
    previous?: string;
  };
}

export interface MetaBusinessUsage {
  type: string;
  call_count: number;
  total_cputime: number;
  total_time: number;
  estimated_time_to_regain_access: number;
}
