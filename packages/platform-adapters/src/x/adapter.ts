import crypto from 'crypto';
import { Platform, PLATFORM_CREATIVE_SPECS, PLATFORM_RATE_LIMITS } from '@omni-ad/shared';
import type {
  OAuthTokens,
  ConnectionStatus,
  NormalizedCampaign,
  NormalizedAdGroup,
  NormalizedAd,
  NormalizedMetrics,
  RealtimeMetrics,
  MetricsQuery,
  AudienceSegment,
  PlatformCreativeSpecs,
  RateLimitConfig,
} from '@omni-ad/shared';
import { BaseAdapter } from '../base-adapter.js';
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  CreateAdGroupInput,
  UpdateAdGroupInput,
  CreateAdInput,
  UpdateAdInput,
  CreateAudienceInput,
  AudienceListData,
  CreativeUploadInput,
  WebhookEvent,
} from '../types.js';
import { XAdsClient, splitXAccessToken } from './client.js';
import {
  toNormalizedCampaign,
  toNormalizedAdGroup,
  toNormalizedAd,
  toNormalizedMetrics,
  toNormalizedAudience,
  OBJECTIVE_TO_X_MAP,
  unitToMicros,
} from './mapper.js';
import type {
  XCampaign,
  XLineItem,
  XTweet,
  XInsights,
  XCustomAudience,
  XApiResponse,
} from './types.js';

const AUTH_URL = 'https://api.twitter.com/oauth/authenticate';
const REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';

export class XAdapter extends BaseAdapter {
  private readonly client: XAdsClient;
  private readonly consumerKey: string;

  constructor(consumerKey: string, consumerSecret: string) {
    super(Platform.X);
    this.client = new XAdsClient(consumerKey, consumerSecret);
    this.consumerKey = consumerKey;
  }

  // --- OAuth (1.0a) -----------------------------------------------------------

  getAuthUrl(redirectUri: string, state: string): string {
    // In practice, OAuth 1.0a requires a request_token round-trip first.
    // This returns the base authenticate URL; clients should call exchangeCode
    // after getting the oauth_verifier callback.
    const params = new URLSearchParams({
      oauth_consumer_key: this.consumerKey,
      oauth_callback: redirectUri,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    this.checkRateLimit();
    void redirectUri;
    // 'code' here is "oauth_token:oauth_verifier" combined
    const parts = code.split(':');
    const oauthToken = parts[0] ?? '';
    const oauthVerifier = parts[1] ?? '';

    const response = await this.withRetry(() =>
      fetch(`${REQUEST_TOKEN_URL}?oauth_verifier=${oauthVerifier}&oauth_token=${oauthToken}`, {
        method: 'POST',
      }),
    );

    const text = await response.text();
    const params = new URLSearchParams(text);

    const accessToken = params.get('oauth_token') ?? '';
    const accessTokenSecret = params.get('oauth_token_secret') ?? '';

    return {
      accessToken: `${accessToken}:${accessTokenSecret}`,
      refreshToken: `${accessToken}:${accessTokenSecret}`,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // X tokens don't expire
      scope: 'ads_read ads_write',
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    // X OAuth 1.0a tokens don't expire; return same token
    return {
      accessToken: refreshToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      scope: 'ads_read ads_write',
    };
  }

  async validateConnection(accessToken: string): Promise<ConnectionStatus> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const data = await this.withRetry(() =>
      this.client.get<{ data: { id: string; name: string } }>(
        'accounts',
        {},
        token,
        secret,
      ),
    );
    const account = Array.isArray(data.data) ? data.data[0] : data.data;
    return {
      platform: Platform.X,
      status: 'active',
      accountId: account?.id ?? 'unknown',
      accountName: account?.name ?? 'X Ads Account',
      lastSyncAt: new Date(),
    };
  }

  // --- Campaigns --------------------------------------------------------------

  async getCampaigns(accountId: string, accessToken: string): Promise<NormalizedCampaign[]> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const response = await this.withRetry(() =>
      this.client.get<XApiResponse<XCampaign>>(
        `accounts/${accountId}/campaigns`,
        { count: '1000' },
        token,
        secret,
      ),
    );
    const data = Array.isArray(response.data) ? response.data : [response.data];
    return data.map(toNormalizedCampaign);
  }

  async getCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const response = await this.withRetry(() =>
      this.client.get<XApiResponse<XCampaign>>(
        `accounts/${accountId}/campaigns/${campaignId}`,
        {},
        token,
        secret,
      ),
    );
    const campaign = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!campaign) throwNotFound('Campaign', campaignId);
    return toNormalizedCampaign(campaign);
  }

  async createCampaign(
    accountId: string,
    input: CreateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const payload: Record<string, unknown> = {
      name: input.name,
      objective: OBJECTIVE_TO_X_MAP[input.objective] ?? 'WEBSITE_CLICKS',
      entity_status: 'PAUSED',
      start_time: input.startDate.toISOString(),
      daily_budget_amount_local_micro: unitToMicros(input.dailyBudget),
      total_budget_amount_local_micro: unitToMicros(input.totalBudget),
    };
    if (input.endDate) payload['end_time'] = input.endDate.toISOString();

    const response = await this.withRetry(() =>
      this.client.post<XApiResponse<XCampaign>>(
        `accounts/${accountId}/campaigns`,
        payload,
        token,
        secret,
      ),
    );
    const created = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!created) throwNotFound('Campaign', 'new');
    return toNormalizedCampaign(created);
  }

  async updateCampaign(
    accountId: string,
    campaignId: string,
    input: UpdateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const payload: Record<string, unknown> = {};
    if (input.name) payload['name'] = input.name;
    if (input.status) payload['entity_status'] = mapStatusToX(input.status);
    if (input.dailyBudget !== undefined) {
      payload['daily_budget_amount_local_micro'] = unitToMicros(input.dailyBudget);
    }

    const response = await this.withRetry(() =>
      this.client.post<XApiResponse<XCampaign>>(
        `accounts/${accountId}/campaigns/${campaignId}`,
        payload,
        token,
        secret,
      ),
    );
    const updated = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!updated) throwNotFound('Campaign', campaignId);
    return toNormalizedCampaign(updated);
  }

  async pauseCampaign(accountId: string, campaignId: string, accessToken: string): Promise<void> {
    await this.updateCampaign(accountId, campaignId, { status: 'paused' }, accessToken);
  }

  async resumeCampaign(accountId: string, campaignId: string, accessToken: string): Promise<void> {
    await this.updateCampaign(accountId, campaignId, { status: 'active' }, accessToken);
  }

  async deleteCampaign(accountId: string, campaignId: string, accessToken: string): Promise<void> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    await this.withRetry(() =>
      this.client.delete(`accounts/${accountId}/campaigns/${campaignId}`, token, secret),
    );
  }

  // --- Ad Groups (Line Items) -------------------------------------------------

  async getAdGroups(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedAdGroup[]> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const response = await this.withRetry(() =>
      this.client.get<XApiResponse<XLineItem>>(
        `accounts/${accountId}/line_items`,
        { campaign_ids: campaignId },
        token,
        secret,
      ),
    );
    const data = Array.isArray(response.data) ? response.data : [response.data];
    return data.map(toNormalizedAdGroup);
  }

  async createAdGroup(
    accountId: string,
    campaignId: string,
    input: CreateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const payload: Record<string, unknown> = {
      name: input.name,
      campaign_id: campaignId,
      entity_status: 'PAUSED',
      bid_type: 'AUTO',
      ...(input.platformSpecificConfig ?? {}),
    };
    const response = await this.withRetry(() =>
      this.client.post<XApiResponse<XLineItem>>(
        `accounts/${accountId}/line_items`,
        payload,
        token,
        secret,
      ),
    );
    const created = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!created) throwNotFound('LineItem', 'new');
    return toNormalizedAdGroup(created);
  }

  async updateAdGroup(
    accountId: string,
    adGroupId: string,
    input: UpdateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const payload: Record<string, unknown> = {};
    if (input.name) payload['name'] = input.name;

    const response = await this.withRetry(() =>
      this.client.post<XApiResponse<XLineItem>>(
        `accounts/${accountId}/line_items/${adGroupId}`,
        payload,
        token,
        secret,
      ),
    );
    const updated = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!updated) throwNotFound('LineItem', adGroupId);
    return toNormalizedAdGroup(updated);
  }

  // --- Ads (Promoted Tweets) --------------------------------------------------

  async getAds(
    accountId: string,
    adGroupId: string,
    accessToken: string,
  ): Promise<NormalizedAd[]> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const response = await this.withRetry(() =>
      this.client.get<XApiResponse<XTweet>>(
        `accounts/${accountId}/promoted_tweets`,
        { line_item_ids: adGroupId },
        token,
        secret,
      ),
    );
    const data = Array.isArray(response.data) ? response.data : [response.data];
    return data.map(toNormalizedAd);
  }

  async createAd(
    accountId: string,
    adGroupId: string,
    input: CreateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const response = await this.withRetry(() =>
      this.client.post<XApiResponse<XTweet>>(
        `accounts/${accountId}/promoted_tweets`,
        {
          line_item_id: adGroupId,
          tweet_ids: [input.creativeId],
          ...(input.platformSpecificConfig ?? {}),
        },
        token,
        secret,
      ),
    );
    const created = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!created) throwNotFound('PromotedTweet', 'new');
    return toNormalizedAd(created);
  }

  async updateAd(
    accountId: string,
    adId: string,
    input: UpdateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const payload: Record<string, unknown> = {};
    if (input.status) payload['entity_status'] = mapStatusToX(input.status);

    const response = await this.withRetry(() =>
      this.client.post<XApiResponse<XTweet>>(
        `accounts/${accountId}/promoted_tweets/${adId}`,
        payload,
        token,
        secret,
      ),
    );
    const updated = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!updated) throwNotFound('PromotedTweet', adId);
    return toNormalizedAd(updated);
  }

  // --- Metrics ----------------------------------------------------------------

  async getMetrics(
    accountId: string,
    query: MetricsQuery,
    accessToken: string,
  ): Promise<NormalizedMetrics[]> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const params: Record<string, string> = {
      account_id: accountId,
      start_time: query.startDate.toISOString(),
      end_time: query.endDate.toISOString(),
      metric_groups: 'ENGAGEMENT,BILLING',
      granularity: granularityToX(query.granularity),
      entity_type: 'CAMPAIGN',
      entity_ids: query.campaignId ?? accountId,
    };

    const response = await this.withRetry(() =>
      this.client.get<{ data: XInsights[] }>(
        `stats/accounts/${accountId}`,
        params,
        token,
        secret,
      ),
    );

    return (response.data ?? []).map((ins) => toNormalizedMetrics(ins, query.campaignId ?? accountId));
  }

  async getRealtimeMetrics(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<RealtimeMetrics> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const metrics = await this.getMetrics(
      accountId,
      { campaignId, startDate: startOfDay, endDate: today, granularity: 'daily' },
      accessToken,
    );
    const m = metrics[0];

    return {
      campaignId,
      platform: Platform.X,
      impressionsToday: m?.impressions ?? 0,
      clicksToday: m?.clicks ?? 0,
      conversionsToday: m?.conversions ?? 0,
      spendToday: m?.spend ?? 0,
      revenueToday: m?.revenue ?? 0,
      lastUpdated: new Date(),
    };
  }

  // --- Audiences --------------------------------------------------------------

  async getAudiences(accountId: string, accessToken: string): Promise<AudienceSegment[]> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const response = await this.withRetry(() =>
      this.client.get<XApiResponse<XCustomAudience>>(
        `accounts/${accountId}/tailored_audiences`,
        {},
        token,
        secret,
      ),
    );
    const data = Array.isArray(response.data) ? response.data : [response.data];
    return data.map(toNormalizedAudience);
  }

  async createAudience(
    accountId: string,
    input: CreateAudienceInput,
    accessToken: string,
  ): Promise<AudienceSegment> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const response = await this.withRetry(() =>
      this.client.post<XApiResponse<XCustomAudience>>(
        `accounts/${accountId}/tailored_audiences`,
        { name: input.name, list_type: 'EMAIL' },
        token,
        secret,
      ),
    );
    const created = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!created) throwNotFound('Audience', 'new');
    return toNormalizedAudience(created);
    void input;
  }

  async uploadAudienceList(
    accountId: string,
    audienceId: string,
    data: AudienceListData,
    accessToken: string,
  ): Promise<void> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const users = [
      ...(data.emails?.map((e) => hashSha256(e.toLowerCase().trim())) ?? []),
      ...(data.phones?.map((p) => hashSha256(p.replace(/\D/g, ''))) ?? []),
    ];

    await this.withRetry(() =>
      this.client.post<unknown>(
        `accounts/${accountId}/tailored_audiences/${audienceId}/users`,
        { operation_type: 'Update', params: { users: users.map((u) => ({ key: u })) } },
        token,
        secret,
      ),
    );
  }

  // --- Creatives --------------------------------------------------------------

  getCreativeSpecs(): PlatformCreativeSpecs {
    return PLATFORM_CREATIVE_SPECS[Platform.X];
  }

  async uploadCreative(
    _accountId: string,
    creative: CreativeUploadInput,
    accessToken: string,
  ): Promise<string> {
    this.checkRateLimit();
    const { token, secret } = splitXAccessToken(accessToken);
    const base64 =
      creative.content instanceof Buffer
        ? creative.content.toString('base64')
        : creative.content;

    const response = await this.withRetry(() =>
      this.client.post<{ media_id_string: string }>(
        'media/upload',
        { media_data: base64, media_category: 'tweet_image' },
        token,
        secret,
      ),
    );
    return response.media_id_string;
  }

  // --- Rate limits ------------------------------------------------------------

  getRateLimits(): RateLimitConfig {
    return PLATFORM_RATE_LIMITS[Platform.X];
  }

  // --- Webhooks ---------------------------------------------------------------

  parseWebhook(headers: Record<string, string>, body: unknown): WebhookEvent {
    void headers;
    return {
      platform: Platform.X,
      eventType: 'conversion',
      payload: body as Record<string, unknown>,
      receivedAt: new Date(),
    };
  }

  verifyWebhookSignature(
    headers: Record<string, string>,
    body: unknown,
    secret: string,
  ): boolean {
    const signature = headers['x-twitter-webhooks-signature'];
    if (!signature) return false;

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const expected =
      'sha256=' + crypto.createHmac('sha256', secret).update(bodyString).digest('base64');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

function mapStatusToX(status: string): string {
  const map: Record<string, string> = {
    active: 'ACTIVE',
    paused: 'PAUSED',
    completed: 'DELETED',
    draft: 'DRAFT',
    error: 'PAUSED',
  };
  return map[status] ?? 'PAUSED';
}

function granularityToX(granularity: MetricsQuery['granularity']): string {
  const map: Record<MetricsQuery['granularity'], string> = {
    hourly: 'HOUR',
    daily: 'DAY',
    weekly: 'DAY',
    monthly: 'DAY',
  };
  return map[granularity];
}

function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function throwNotFound(entity: string, id: string): never {
  throw { message: `${entity} not found: ${id}`, code: 'NOT_FOUND', status: 404 };
}
