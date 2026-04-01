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
import { TikTokClient } from './client.js';
import {
  toNormalizedCampaign,
  toNormalizedAdGroup,
  toNormalizedAd,
  toNormalizedMetrics,
  toNormalizedAudience,
  OBJECTIVE_TO_TIKTOK,
} from './mapper.js';
import type {
  TikTokCampaign,
  TikTokAdGroup,
  TikTokAd,
  TikTokMetricsData,
  TikTokAudience,
  TikTokListData,
  TikTokOAuthResponse,
} from './types.js';

const AUTH_URL = 'https://business-api.tiktok.com/portal/auth';
const TOKEN_URL = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/';

export class TikTokAdapter extends BaseAdapter {
  private readonly client: TikTokClient;
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(appId: string, appSecret: string) {
    super(Platform.TIKTOK);
    this.client = new TikTokClient();
    this.appId = appId;
    this.appSecret = appSecret;
  }

  // --- OAuth ------------------------------------------------------------------

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      app_id: this.appId,
      redirect_uri: redirectUri,
      state,
      rid: state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    this.checkRateLimit();
    void redirectUri;
    const response = await this.withRetry(() =>
      this.client.post<TikTokOAuthResponse>(
        'oauth2/access_token/',
        { app_id: this.appId, secret: this.appSecret, auth_code: code },
        '',
      ),
    );
    return buildTokens(response);
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: this.appId,
          secret: this.appSecret,
          refresh_token: refreshToken,
        }),
      }),
    );
    const body = (await response.json()) as { data: TikTokOAuthResponse };
    return buildTokens(body.data);
  }

  async validateConnection(accessToken: string): Promise<ConnectionStatus> {
    this.checkRateLimit();
    const data = await this.withRetry(() =>
      this.client.get<{ advertiser_id: string; name: string }[]>(
        'oauth2/advertiser/get/',
        { app_id: this.appId, secret: this.appSecret },
        accessToken,
      ),
    );
    const account = data[0];
    return {
      platform: Platform.TIKTOK,
      status: 'active',
      accountId: account?.advertiser_id ?? 'unknown',
      accountName: account?.name ?? 'TikTok Advertiser',
      lastSyncAt: new Date(),
    };
  }

  // --- Campaigns --------------------------------------------------------------

  async getCampaigns(accountId: string, accessToken: string): Promise<NormalizedCampaign[]> {
    this.checkRateLimit();
    const data = await this.withRetry(() =>
      this.client.get<TikTokListData<TikTokCampaign>>(
        'campaign/get/',
        { advertiser_id: accountId, page_size: '1000' },
        accessToken,
      ),
    );
    return data.list.map(toNormalizedCampaign);
  }

  async getCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const data = await this.withRetry(() =>
      this.client.get<TikTokListData<TikTokCampaign>>(
        'campaign/get/',
        { advertiser_id: accountId, filtering: JSON.stringify({ campaign_ids: [campaignId] }) },
        accessToken,
      ),
    );
    const campaign = data.list[0];
    if (!campaign) throwNotFound('Campaign', campaignId);
    return toNormalizedCampaign(campaign);
  }

  async createCampaign(
    accountId: string,
    input: CreateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {
      advertiser_id: accountId,
      campaign_name: input.name,
      objective_type: OBJECTIVE_TO_TIKTOK[input.objective] ?? 'CONVERSIONS',
      budget_mode: 'BUDGET_MODE_DAY',
      budget: input.dailyBudget,
      operation_status: 'CAMPAIGN_STATUS_DISABLE',
    };

    const created = await this.withRetry(() =>
      this.client.post<{ campaign_id: string }>('campaign/create/', payload, accessToken),
    );
    return this.getCampaign(accountId, created.campaign_id, accessToken);
  }

  async updateCampaign(
    accountId: string,
    campaignId: string,
    input: UpdateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {
      advertiser_id: accountId,
      campaign_id: campaignId,
    };
    if (input.name) payload['campaign_name'] = input.name;
    if (input.status) payload['operation_status'] = mapStatusToTikTok(input.status);
    if (input.dailyBudget !== undefined) payload['budget'] = input.dailyBudget;

    await this.withRetry(() =>
      this.client.post<unknown>('campaign/update/', payload, accessToken),
    );
    return this.getCampaign(accountId, campaignId, accessToken);
  }

  async pauseCampaign(accountId: string, campaignId: string, accessToken: string): Promise<void> {
    await this.updateCampaign(accountId, campaignId, { status: 'paused' }, accessToken);
  }

  async resumeCampaign(accountId: string, campaignId: string, accessToken: string): Promise<void> {
    await this.updateCampaign(accountId, campaignId, { status: 'active' }, accessToken);
  }

  async deleteCampaign(accountId: string, campaignId: string, accessToken: string): Promise<void> {
    this.checkRateLimit();
    await this.withRetry(() =>
      this.client.post<unknown>(
        'campaign/delete/',
        { advertiser_id: accountId, campaign_ids: [campaignId] },
        accessToken,
      ),
    );
  }

  // --- Ad Groups --------------------------------------------------------------

  async getAdGroups(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedAdGroup[]> {
    this.checkRateLimit();
    const data = await this.withRetry(() =>
      this.client.get<TikTokListData<TikTokAdGroup>>(
        'adgroup/get/',
        {
          advertiser_id: accountId,
          filtering: JSON.stringify({ campaign_ids: [campaignId] }),
          page_size: '1000',
        },
        accessToken,
      ),
    );
    return data.list.map(toNormalizedAdGroup);
  }

  async createAdGroup(
    accountId: string,
    campaignId: string,
    input: CreateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {
      advertiser_id: accountId,
      campaign_id: campaignId,
      adgroup_name: input.name,
      placement_type: 'PLACEMENT_TYPE_AUTOMATIC',
      budget_mode: 'BUDGET_MODE_INFINITE',
      billing_event: 'OCPM',
      operation_status: 'ADGROUP_STATUS_DISABLE',
      ...(input.platformSpecificConfig ?? {}),
    };

    const created = await this.withRetry(() =>
      this.client.post<{ adgroup_id: string }>('adgroup/create/', payload, accessToken),
    );

    const data = await this.withRetry(() =>
      this.client.get<TikTokListData<TikTokAdGroup>>(
        'adgroup/get/',
        {
          advertiser_id: accountId,
          filtering: JSON.stringify({ adgroup_ids: [created.adgroup_id] }),
        },
        accessToken,
      ),
    );
    const adGroup = data.list[0];
    if (!adGroup) throwNotFound('AdGroup', created.adgroup_id);
    return toNormalizedAdGroup(adGroup);
  }

  async updateAdGroup(
    accountId: string,
    adGroupId: string,
    input: UpdateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {
      advertiser_id: accountId,
      adgroup_id: adGroupId,
    };
    if (input.name) payload['adgroup_name'] = input.name;

    await this.withRetry(() =>
      this.client.post<unknown>('adgroup/update/', payload, accessToken),
    );

    const data = await this.withRetry(() =>
      this.client.get<TikTokListData<TikTokAdGroup>>(
        'adgroup/get/',
        {
          advertiser_id: accountId,
          filtering: JSON.stringify({ adgroup_ids: [adGroupId] }),
        },
        accessToken,
      ),
    );
    const adGroup = data.list[0];
    if (!adGroup) throwNotFound('AdGroup', adGroupId);
    return toNormalizedAdGroup(adGroup);
  }

  // --- Ads --------------------------------------------------------------------

  async getAds(
    accountId: string,
    adGroupId: string,
    accessToken: string,
  ): Promise<NormalizedAd[]> {
    this.checkRateLimit();
    const data = await this.withRetry(() =>
      this.client.get<TikTokListData<TikTokAd>>(
        'ad/get/',
        {
          advertiser_id: accountId,
          filtering: JSON.stringify({ adgroup_ids: [adGroupId] }),
          page_size: '1000',
        },
        accessToken,
      ),
    );
    return data.list.map(toNormalizedAd);
  }

  async createAd(
    accountId: string,
    adGroupId: string,
    input: CreateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {
      advertiser_id: accountId,
      adgroup_id: adGroupId,
      ad_name: input.name,
      creative_id: input.creativeId,
      operation_status: 'AD_STATUS_DISABLE',
      ...(input.platformSpecificConfig ?? {}),
    };

    const created = await this.withRetry(() =>
      this.client.post<{ ad_id: string }>('ad/create/', payload, accessToken),
    );

    const data = await this.withRetry(() =>
      this.client.get<TikTokListData<TikTokAd>>(
        'ad/get/',
        {
          advertiser_id: accountId,
          filtering: JSON.stringify({ ad_ids: [created.ad_id] }),
        },
        accessToken,
      ),
    );
    const ad = data.list[0];
    if (!ad) throwNotFound('Ad', created.ad_id);
    return toNormalizedAd(ad);
  }

  async updateAd(
    accountId: string,
    adId: string,
    input: UpdateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    const payload: Record<string, unknown> = {
      advertiser_id: accountId,
      ad_id: adId,
    };
    if (input.name) payload['ad_name'] = input.name;
    if (input.status) payload['operation_status'] = mapAdStatusToTikTok(input.status);

    await this.withRetry(() =>
      this.client.post<unknown>('ad/update/', payload, accessToken),
    );

    const data = await this.withRetry(() =>
      this.client.get<TikTokListData<TikTokAd>>(
        'ad/get/',
        {
          advertiser_id: accountId,
          filtering: JSON.stringify({ ad_ids: [adId] }),
        },
        accessToken,
      ),
    );
    const ad = data.list[0];
    if (!ad) throwNotFound('Ad', adId);
    return toNormalizedAd(ad);
  }

  // --- Metrics ----------------------------------------------------------------

  async getMetrics(
    accountId: string,
    query: MetricsQuery,
    accessToken: string,
  ): Promise<NormalizedMetrics[]> {
    this.checkRateLimit();
    const data = await this.withRetry(() =>
      this.client.get<TikTokListData<TikTokMetricsData>>(
        'report/integrated/get/',
        {
          advertiser_id: accountId,
          report_type: 'BASIC',
          dimensions: JSON.stringify(['campaign_id', 'stat_time_day']),
          metrics: JSON.stringify([
            'impressions', 'clicks', 'conversions', 'cost', 'real_time_roas',
            'ctr', 'cpc', 'cost_per_conversion',
          ]),
          start_date: formatDate(query.startDate),
          end_date: formatDate(query.endDate),
          ...(query.campaignId ? { filtering: JSON.stringify([{ field_name: 'campaign_id', filter_type: 'IN', filter_value: `["${query.campaignId}"]` }]) } : {}),
        },
        accessToken,
      ),
    );
    return data.list.map(toNormalizedMetrics);
  }

  async getRealtimeMetrics(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<RealtimeMetrics> {
    const today = new Date();
    const metrics = await this.getMetrics(
      accountId,
      { campaignId, startDate: today, endDate: today, granularity: 'daily' },
      accessToken,
    );
    const m = metrics[0];
    return {
      campaignId,
      platform: Platform.TIKTOK,
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
    const data = await this.withRetry(() =>
      this.client.get<TikTokListData<TikTokAudience>>(
        'dmp/custom_audience/list/',
        { advertiser_id: accountId, page_size: '1000' },
        accessToken,
      ),
    );
    return data.list.map(toNormalizedAudience);
  }

  async createAudience(
    accountId: string,
    input: CreateAudienceInput,
    accessToken: string,
  ): Promise<AudienceSegment> {
    this.checkRateLimit();
    const created = await this.withRetry(() =>
      this.client.post<{ audience_id: string }>(
        'dmp/custom_audience/create/',
        {
          advertiser_id: accountId,
          name: input.name,
          type: 'CUSTOMER_FILE',
          file_type: 'PHONE',
        },
        accessToken,
      ),
    );

    const data = await this.withRetry(() =>
      this.client.get<TikTokListData<TikTokAudience>>(
        'dmp/custom_audience/get/',
        {
          advertiser_id: accountId,
          custom_audience_ids: JSON.stringify([created.audience_id]),
        },
        accessToken,
      ),
    );
    const audience = data.list[0];
    if (!audience) throwNotFound('Audience', created.audience_id);
    return toNormalizedAudience(audience);
    void input;
  }

  async uploadAudienceList(
    accountId: string,
    audienceId: string,
    data: AudienceListData,
    accessToken: string,
  ): Promise<void> {
    this.checkRateLimit();
    const elements: Record<string, string>[] = [];
    if (data.emails) {
      elements.push(
        ...data.emails.map((e) => ({ id_type: 'EMAIL_SHA256', id: hashSha256(e.toLowerCase().trim()) })),
      );
    }
    if (data.phones) {
      elements.push(
        ...data.phones.map((p) => ({ id_type: 'PHONE_SHA256', id: hashSha256(p.replace(/\D/g, '')) })),
      );
    }

    await this.withRetry(() =>
      this.client.post<unknown>(
        'dmp/custom_audience/update/',
        {
          advertiser_id: accountId,
          custom_audience_id: audienceId,
          action: 'APPEND',
          elements,
        },
        accessToken,
      ),
    );
  }

  // --- Creatives --------------------------------------------------------------

  getCreativeSpecs(): PlatformCreativeSpecs {
    return PLATFORM_CREATIVE_SPECS[Platform.TIKTOK];
  }

  async uploadCreative(
    accountId: string,
    creative: CreativeUploadInput,
    accessToken: string,
  ): Promise<string> {
    this.checkRateLimit();
    const base64 =
      creative.content instanceof Buffer
        ? creative.content.toString('base64')
        : creative.content;

    const endpoint =
      creative.type === 'video' ? 'file/video/ad/upload/' : 'file/image/ad/upload/';

    const response = await this.withRetry(() =>
      this.client.post<{ video_id?: string; image_id?: string }>(
        endpoint,
        {
          advertiser_id: accountId,
          file_name: creative.filename,
          data: base64,
          upload_type: 'UPLOAD_BY_FILE',
        },
        accessToken,
      ),
    );
    return response.video_id ?? response.image_id ?? '';
  }

  // --- Rate limits ------------------------------------------------------------

  getRateLimits(): RateLimitConfig {
    return PLATFORM_RATE_LIMITS[Platform.TIKTOK];
  }

  // --- Webhooks ---------------------------------------------------------------

  parseWebhook(headers: Record<string, string>, body: unknown): WebhookEvent {
    void headers;
    return {
      platform: Platform.TIKTOK,
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
    const signature = headers['x-tiktok-signature'];
    if (!signature) return false;

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const expected = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

function mapStatusToTikTok(status: string): string {
  const map: Record<string, string> = {
    active: 'CAMPAIGN_STATUS_ENABLE',
    paused: 'CAMPAIGN_STATUS_DISABLE',
    completed: 'CAMPAIGN_STATUS_DELETE',
    draft: 'CAMPAIGN_STATUS_DISABLE',
    error: 'CAMPAIGN_STATUS_DISABLE',
  };
  return map[status] ?? 'CAMPAIGN_STATUS_DISABLE';
}

function mapAdStatusToTikTok(status: string): string {
  const map: Record<string, string> = {
    active: 'AD_STATUS_DELIVERY_OK',
    paused: 'AD_STATUS_DISABLE',
    completed: 'AD_STATUS_DELETE',
    draft: 'AD_STATUS_DISABLE',
    error: 'AD_STATUS_DISABLE',
  };
  return map[status] ?? 'AD_STATUS_DISABLE';
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildTokens(response: TikTokOAuthResponse): OAuthTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.access_token, // TikTok doesn't return a separate refresh token
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // TikTok tokens last 24h by default
    scope: (response.scope ?? []).join(' '),
  };
}

function throwNotFound(entity: string, id: string): never {
  throw { message: `${entity} not found: ${id}`, code: 'NOT_FOUND', status: 404 };
}
