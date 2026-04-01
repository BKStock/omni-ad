// Google Ads API v17 native types (REST)

export type GoogleCampaignStatus = 'ENABLED' | 'PAUSED' | 'REMOVED';

export type GoogleAdvertisingChannelType =
  | 'SEARCH'
  | 'DISPLAY'
  | 'VIDEO'
  | 'PERFORMANCE_MAX'
  | 'SHOPPING'
  | 'SMART'
  | 'LOCAL'
  | 'DISCOVERY';

export interface GoogleCampaign {
  resourceName: string;
  id: string;
  name: string;
  status: GoogleCampaignStatus;
  advertisingChannelType: GoogleAdvertisingChannelType;
  startDate: string;
  endDate: string | null;
  campaignBudget: string;
}

export interface GoogleCampaignBudget {
  resourceName: string;
  id: string;
  amountMicros: string;
  name: string;
}

export type GoogleAdGroupStatus = 'ENABLED' | 'PAUSED' | 'REMOVED';

export interface GoogleAdGroupCriterion {
  resourceName: string;
  type: 'AGE_RANGE' | 'GENDER' | 'LOCATION' | 'KEYWORD' | 'USER_LIST';
  ageRange?: { type: string };
  gender?: { type: string };
  location?: { geoTargetConstant: string };
  keyword?: { text: string; matchType: string };
  userList?: { userList: string };
}

export interface GoogleAdGroup {
  resourceName: string;
  id: string;
  name: string;
  status: GoogleAdGroupStatus;
  campaign: string;
  baseAdGroup: string | null;
  type: string;
}

export type GoogleAdStatus = 'ENABLED' | 'PAUSED' | 'REMOVED';

export interface GoogleAdGroupAd {
  resourceName: string;
  status: GoogleAdStatus;
  adGroup: string;
  ad: {
    id: string;
    name: string;
    type: string;
    finalUrls: string[];
    responsiveSearchAd?: {
      headlines: { text: string; pinned_field?: string }[];
      descriptions: { text: string; pinned_field?: string }[];
    };
    responsiveDisplayAd?: {
      headlines: { text: string }[];
      descriptions: { text: string }[];
    };
  };
}

export interface GoogleMetricsRow {
  campaign?: { id: string; name: string; status: string };
  adGroup?: { id: string; name: string };
  adGroupAd?: { ad: { id: string } };
  segments?: { date: string };
  metrics: {
    impressions: string;
    clicks: string;
    conversions: string;
    costMicros: string;
    conversionsValue: string;
    ctr: string;
    averageCpc: string;
    costPerConversion: string;
    valuePerConversion: string;
  };
}

export interface GoogleUserList {
  resourceName: string;
  id: string;
  name: string;
  type: string;
  membershipStatus: 'OPEN' | 'CLOSED';
  matchRatePercentage: number;
  estimatedUserCount: number;
  description: string | null;
  crmBasedUserList?: {
    uploadKeyType: string;
    dataSourceType: string;
  };
}

export interface GoogleOAuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface GoogleApiError {
  error: {
    code: number;
    message: string;
    status: string;
    details?: {
      errors?: {
        message: string;
        errorCode?: Record<string, string>;
        location?: { fieldPathElements: { fieldName: string }[] };
      }[];
    }[];
  };
}

export interface GoogleQueryResponse<T> {
  results: T[];
  nextPageToken?: string;
  totalResultsCount?: string;
}

export interface GoogleMutateResponse {
  results: { resourceName: string }[];
  partialFailureError?: unknown;
}
