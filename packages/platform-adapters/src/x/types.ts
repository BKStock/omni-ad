// X (Twitter) Ads API v12 native types

export type XCampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'DRAFT';

export type XObjective =
  | 'AWARENESS'
  | 'TWEET_ENGAGEMENTS'
  | 'WEBSITE_CLICKS'
  | 'FOLLOWERS'
  | 'APP_INSTALLS'
  | 'VIDEO_VIEWS'
  | 'PREROLL_VIEWS';

export interface XCampaign {
  id: string;
  name: string;
  account_id: string;
  objective: XObjective;
  entity_status: XCampaignStatus;
  start_time: string;
  end_time: string | null;
  total_budget_amount_local_micro: string;
  daily_budget_amount_local_micro: string;
  created_at: string;
  updated_at: string;
}

export interface XLineItem {
  id: string;
  name: string;
  account_id: string;
  campaign_id: string;
  entity_status: XCampaignStatus;
  targeting_criteria: XTargetingCriteria[];
  bid_amount_local_micro: string | null;
  created_at: string;
  updated_at: string;
}

export interface XTargetingCriteria {
  targeting_type: string;
  targeting_value: string;
}

export interface XTweet {
  id: string;
  line_item_id: string;
  tweet_id: string;
  entity_status: XCampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface XInsights {
  id: string;
  id_data: {
    metrics: {
      impressions: string[];
      clicks: string[];
      conversions: string[];
      billed_charge_local_micro: string[];
    };
  }[];
  segment: { start_time: string; end_time: string } | null;
}

export interface XCustomAudience {
  id: string;
  name: string;
  account_id: string;
  audience_size: number;
  reasons_not_targetable: string[];
  list_type: 'EMAIL' | 'PHONE_NUMBER' | 'DEVICE_ID' | 'TWITTER_ID';
}

export interface XOAuthTokens {
  oauth_token: string;
  oauth_token_secret: string;
  user_id: string;
  screen_name: string;
}

export interface XApiError {
  errors: { code: number; message: string; label: string }[];
  request: string;
}

export interface XApiResponse<T> {
  data: T | T[];
  request: { params: Record<string, unknown> };
  total_count?: number;
}
