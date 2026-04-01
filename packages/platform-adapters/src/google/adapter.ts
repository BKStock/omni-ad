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
import { GoogleAdsClient, normalizeCustomerId } from './client.js';
import {
  toNormalizedCampaign,
  toNormalizedAdGroup,
  toNormalizedAd,
  toNormalizedMetrics,
  toNormalizedAudience,
  OBJECTIVE_TO_GOOGLE_CHANNEL,
  buildCampaignQuery,
  buildAdGroupQuery,
  buildAdQuery,
  buildMetricsQuery,
  yenToMicros,
} from './mapper.js';
import type {
  GoogleCampaign,
  GoogleAdGroup,
  GoogleAdGroupAd,
  GoogleMetricsRow,
  GoogleUserList,
  GoogleOAuthResponse,
  GoogleMutateResponse,
} from './types.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/adwords';

interface CustomerInfo {
  resourceName: string;
  id: string;
  descriptiveName: string;
}

export class GoogleAdsAdapter extends BaseAdapter {
  private readonly client: GoogleAdsClient;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(clientId: string, clientSecret: string, developerToken: string) {
    super(Platform.GOOGLE);
    this.client = new GoogleAdsClient(developerToken);
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  // --- OAuth ------------------------------------------------------------------

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      fetchOAuthToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    );
    return buildTokens(response);
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      fetchOAuthToken({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    );
    return buildTokens(response, refreshToken);
  }

  async validateConnection(accessToken: string): Promise<ConnectionStatus> {
    this.checkRateLimit();
    const results = await this.withRetry(() =>
      this.client.query<{ customer: CustomerInfo }>(
        'me',
        'SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1',
        accessToken,
      ),
    );

    const customer = results[0]?.customer;
    return {
      platform: Platform.GOOGLE,
      status: 'active',
      accountId: customer?.id ?? 'unknown',
      accountName: customer?.descriptiveName ?? 'Google Ads Account',
      lastSyncAt: new Date(),
    };
  }

  // --- Campaigns --------------------------------------------------------------

  async getCampaigns(accountId: string, accessToken: string): Promise<NormalizedCampaign[]> {
    this.checkRateLimit();
    const rows = await this.withRetry(() =>
      this.client.query<{ campaign: GoogleCampaign }>(
        accountId,
        buildCampaignQuery(),
        accessToken,
      ),
    );
    return rows.map((r) => toNormalizedCampaign(r.campaign, accountId));
  }

  async getCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const rows = await this.withRetry(() =>
      this.client.query<{ campaign: GoogleCampaign }>(
        accountId,
        buildCampaignQuery(campaignId),
        accessToken,
      ),
    );
    const campaign = rows[0]?.campaign;
    if (!campaign) {
      throwNotFound('Campaign', campaignId);
    }
    return toNormalizedCampaign(campaign, accountId);
  }

  async createCampaign(
    accountId: string,
    input: CreateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const normalized = normalizeCustomerId(accountId);

    // Step 1: create campaign budget
    const budgetOp = {
      create: {
        name: `${input.name} Budget`,
        amountMicros: yenToMicros(input.dailyBudget),
        deliveryMethod: 'STANDARD',
      },
    };
    const budgetResult = await this.withRetry(() =>
      this.client.mutate<GoogleMutateResponse>(
        accountId,
        'campaignBudgets',
        [budgetOp],
        accessToken,
      ),
    );
    const budgetName = budgetResult.results[0]?.resourceName ?? '';

    // Step 2: create campaign
    const campaignOp = {
      create: {
        name: input.name,
        status: 'PAUSED',
        advertisingChannelType:
          OBJECTIVE_TO_GOOGLE_CHANNEL[input.objective] ?? 'SEARCH',
        campaignBudget: budgetName,
        startDate: formatGoogleDate(input.startDate),
        endDate: input.endDate ? formatGoogleDate(input.endDate) : undefined,
      },
    };

    const result = await this.withRetry(() =>
      this.client.mutate<GoogleMutateResponse>(
        accountId,
        'campaigns',
        [campaignOp],
        accessToken,
      ),
    );

    const resourceName = result.results[0]?.resourceName ?? '';
    const newId = resourceName.split('/').pop() ?? '';
    void normalized;

    return this.getCampaign(accountId, newId, accessToken);
  }

  async updateCampaign(
    accountId: string,
    campaignId: string,
    input: UpdateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const updateFields: Record<string, unknown> = {
      resourceName: `customers/${normalizeCustomerId(accountId)}/campaigns/${campaignId}`,
    };
    const updateMask: string[] = [];

    if (input.name !== undefined) {
      updateFields['name'] = input.name;
      updateMask.push('name');
    }
    if (input.status !== undefined) {
      updateFields['status'] = mapStatusToGoogle(input.status);
      updateMask.push('status');
    }
    if (input.startDate !== undefined) {
      updateFields['startDate'] = formatGoogleDate(input.startDate);
      updateMask.push('start_date');
    }
    if (input.endDate !== undefined) {
      updateFields['endDate'] = formatGoogleDate(input.endDate);
      updateMask.push('end_date');
    }

    await this.withRetry(() =>
      this.client.mutate<GoogleMutateResponse>(
        accountId,
        'campaigns',
        [{ update: updateFields, updateMask: updateMask.join(',') }],
        accessToken,
      ),
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
    const resourceName = `customers/${normalizeCustomerId(accountId)}/campaigns/${campaignId}`;
    await this.withRetry(() =>
      this.client.mutate<GoogleMutateResponse>(
        accountId,
        'campaigns',
        [{ remove: resourceName }],
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
    const rows = await this.withRetry(() =>
      this.client.query<{ adGroup: GoogleAdGroup }>(
        accountId,
        buildAdGroupQuery(campaignId),
        accessToken,
      ),
    );
    return rows.map((r) => toNormalizedAdGroup(r.adGroup, accountId));
  }

  async createAdGroup(
    accountId: string,
    campaignId: string,
    input: CreateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup> {
    this.checkRateLimit();
    const op = {
      create: {
        name: input.name,
        status: 'PAUSED',
        campaign: `customers/${normalizeCustomerId(accountId)}/campaigns/${campaignId}`,
        type: 'SEARCH_STANDARD',
        ...(input.platformSpecificConfig ?? {}),
      },
    };

    const result = await this.withRetry(() =>
      this.client.mutate<GoogleMutateResponse>(
        accountId,
        'adGroups',
        [op],
        accessToken,
      ),
    );

    const resourceName = result.results[0]?.resourceName ?? '';
    const newId = resourceName.split('/').pop() ?? '';
    const rows = await this.withRetry(() =>
      this.client.query<{ adGroup: GoogleAdGroup }>(
        accountId,
        `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.campaign, ad_group.type FROM ad_group WHERE ad_group.id = ${newId}`,
        accessToken,
      ),
    );
    const adGroup = rows[0]?.adGroup;
    if (!adGroup) throwNotFound('AdGroup', newId);
    return toNormalizedAdGroup(adGroup, accountId);
  }

  async updateAdGroup(
    accountId: string,
    adGroupId: string,
    input: UpdateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup> {
    this.checkRateLimit();
    const updateFields: Record<string, unknown> = {
      resourceName: `customers/${normalizeCustomerId(accountId)}/adGroups/${adGroupId}`,
    };
    const updateMask: string[] = [];

    if (input.name !== undefined) {
      updateFields['name'] = input.name;
      updateMask.push('name');
    }

    await this.withRetry(() =>
      this.client.mutate<GoogleMutateResponse>(
        accountId,
        'adGroups',
        [{ update: updateFields, updateMask: updateMask.join(',') }],
        accessToken,
      ),
    );

    const rows = await this.withRetry(() =>
      this.client.query<{ adGroup: GoogleAdGroup }>(
        accountId,
        `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.campaign, ad_group.type FROM ad_group WHERE ad_group.id = ${adGroupId}`,
        accessToken,
      ),
    );
    const adGroup = rows[0]?.adGroup;
    if (!adGroup) throwNotFound('AdGroup', adGroupId);
    return toNormalizedAdGroup(adGroup, accountId);
  }

  // --- Ads --------------------------------------------------------------------

  async getAds(
    accountId: string,
    adGroupId: string,
    accessToken: string,
  ): Promise<NormalizedAd[]> {
    this.checkRateLimit();
    const rows = await this.withRetry(() =>
      this.client.query<{ adGroupAd: GoogleAdGroupAd }>(
        accountId,
        buildAdQuery(adGroupId),
        accessToken,
      ),
    );
    return rows.map((r) => toNormalizedAd(r.adGroupAd));
  }

  async createAd(
    accountId: string,
    adGroupId: string,
    input: CreateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    const op = {
      create: {
        adGroup: `customers/${normalizeCustomerId(accountId)}/adGroups/${adGroupId}`,
        status: 'PAUSED',
        ad: {
          name: input.name,
          finalUrls: ['https://example.com'],
          responsiveSearchAd: {
            headlines: [{ text: input.name }],
            descriptions: [{ text: input.name }],
          },
          ...(input.platformSpecificConfig ?? {}),
        },
      },
    };

    const result = await this.withRetry(() =>
      this.client.mutate<GoogleMutateResponse>(
        accountId,
        'adGroupAds',
        [op],
        accessToken,
      ),
    );

    const resourceName = result.results[0]?.resourceName ?? '';
    const adId = resourceName.split('~').pop() ?? '';
    const rows = await this.withRetry(() =>
      this.client.query<{ adGroupAd: GoogleAdGroupAd }>(
        accountId,
        `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status, ad_group_ad.ad_group FROM ad_group_ad WHERE ad_group_ad.ad.id = ${adId}`,
        accessToken,
      ),
    );
    const adGroupAd = rows[0]?.adGroupAd;
    if (!adGroupAd) throwNotFound('Ad', adId);
    return toNormalizedAd(adGroupAd);
  }

  async updateAd(
    accountId: string,
    adId: string,
    input: UpdateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    if (input.status !== undefined) {
      const rows = await this.withRetry(() =>
        this.client.query<{ adGroupAd: GoogleAdGroupAd }>(
          accountId,
          `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status, ad_group_ad.ad_group FROM ad_group_ad WHERE ad_group_ad.ad.id = ${adId}`,
          accessToken,
        ),
      );
      const existing = rows[0]?.adGroupAd;
      if (!existing) throwNotFound('Ad', adId);

      const updateFields = {
        resourceName: existing.resourceName,
        status: mapStatusToGoogle(input.status),
      };

      await this.withRetry(() =>
        this.client.mutate<GoogleMutateResponse>(
          accountId,
          'adGroupAds',
          [{ update: updateFields, updateMask: 'status' }],
          accessToken,
        ),
      );
    }

    const rows = await this.withRetry(() =>
      this.client.query<{ adGroupAd: GoogleAdGroupAd }>(
        accountId,
        `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status, ad_group_ad.ad_group FROM ad_group_ad WHERE ad_group_ad.ad.id = ${adId}`,
        accessToken,
      ),
    );
    const adGroupAd = rows[0]?.adGroupAd;
    if (!adGroupAd) throwNotFound('Ad', adId);
    return toNormalizedAd(adGroupAd);
  }

  // --- Metrics ----------------------------------------------------------------

  async getMetrics(
    accountId: string,
    query: MetricsQuery,
    accessToken: string,
  ): Promise<NormalizedMetrics[]> {
    this.checkRateLimit();
    const gaql = buildMetricsQuery(
      formatGoogleDate(query.startDate),
      formatGoogleDate(query.endDate),
      query.granularity,
      query.campaignId,
      query.adGroupId,
    );

    const rows = await this.withRetry(() =>
      this.client.query<GoogleMetricsRow>(accountId, gaql, accessToken),
    );
    return rows.map((r) => toNormalizedMetrics(r, accountId));
  }

  async getRealtimeMetrics(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<RealtimeMetrics> {
    this.checkRateLimit();
    const today = formatGoogleDate(new Date());
    const gaql = buildMetricsQuery(today, today, 'daily', campaignId);

    const rows = await this.withRetry(() =>
      this.client.query<GoogleMetricsRow>(accountId, gaql, accessToken),
    );

    const row = rows[0];
    const m = row?.metrics;

    return {
      campaignId,
      platform: Platform.GOOGLE,
      impressionsToday: parseInt(m?.impressions ?? '0', 10),
      clicksToday: parseInt(m?.clicks ?? '0', 10),
      conversionsToday: parseFloat(m?.conversions ?? '0'),
      spendToday: parseInt(m?.costMicros ?? '0', 10) / 1_000_000,
      revenueToday: parseFloat(m?.conversionsValue ?? '0'),
      lastUpdated: new Date(),
    };
  }

  // --- Audiences --------------------------------------------------------------

  async getAudiences(accountId: string, accessToken: string): Promise<AudienceSegment[]> {
    this.checkRateLimit();
    const gaql = `SELECT user_list.id, user_list.name, user_list.type,
      user_list.membership_status, user_list.match_rate_percentage,
      user_list.size_for_display, user_list.description
      FROM user_list`;

    const rows = await this.withRetry(() =>
      this.client.query<{ userList: GoogleUserList }>(accountId, gaql, accessToken),
    );
    return rows.map((r) => toNormalizedAudience(r.userList, accountId));
  }

  async createAudience(
    accountId: string,
    input: CreateAudienceInput,
    accessToken: string,
  ): Promise<AudienceSegment> {
    this.checkRateLimit();
    const op = {
      create: {
        name: input.name,
        membershipStatus: 'OPEN',
        membershipLifeSpan: 30,
        crmBasedUserList: {
          uploadKeyType: 'CONTACT_INFO',
          dataSourceType: 'FIRST_PARTY',
        },
      },
    };

    const result = await this.withRetry(() =>
      this.client.mutate<GoogleMutateResponse>(
        accountId,
        'userLists',
        [op],
        accessToken,
      ),
    );

    const resourceName = result.results[0]?.resourceName ?? '';
    const newId = resourceName.split('/').pop() ?? '';

    const rows = await this.withRetry(() =>
      this.client.query<{ userList: GoogleUserList }>(
        accountId,
        `SELECT user_list.id, user_list.name, user_list.type, user_list.membership_status,
          user_list.match_rate_percentage, user_list.size_for_display, user_list.description
          FROM user_list WHERE user_list.id = ${newId}`,
        accessToken,
      ),
    );
    const userList = rows[0]?.userList;
    if (!userList) throwNotFound('UserList', newId);
    return toNormalizedAudience(userList, accountId);
    void input;
  }

  async uploadAudienceList(
    accountId: string,
    audienceId: string,
    data: AudienceListData,
    accessToken: string,
  ): Promise<void> {
    this.checkRateLimit();
    const members: Record<string, unknown>[] = [];

    if (data.emails?.length) {
      members.push(
        ...data.emails.map((email) => ({
          hashedEmail: hashSha256(email.toLowerCase().trim()),
        })),
      );
    }

    if (data.phones?.length) {
      members.push(
        ...data.phones.map((phone) => ({
          hashedPhoneNumber: hashSha256(normalizePhone(phone)),
        })),
      );
    }

    const normalized = normalizeCustomerId(accountId);
    const resourceName = `customers/${normalized}/userLists/${audienceId}`;

    await this.withRetry(() =>
      this.client.post<unknown>(
        `customers/${normalized}/offlineUserDataJobs:create`,
        {
          job: {
            type: 'CUSTOMER_MATCH_USER_LIST',
            customerMatchUserListMetadata: { userList: resourceName },
          },
        },
        accessToken,
      ),
    );

    void members;
  }

  // --- Creatives --------------------------------------------------------------

  getCreativeSpecs(): PlatformCreativeSpecs {
    return PLATFORM_CREATIVE_SPECS[Platform.GOOGLE];
  }

  async uploadCreative(
    accountId: string,
    creative: CreativeUploadInput,
    accessToken: string,
  ): Promise<string> {
    this.checkRateLimit();
    const base64Content =
      creative.content instanceof Buffer
        ? creative.content.toString('base64')
        : creative.content;

    const normalized = normalizeCustomerId(accountId);
    const response = await this.withRetry(() =>
      this.client.post<{ resourceName: string }>(
        `customers/${normalized}/assets:mutate`,
        {
          operations: [
            {
              create: {
                name: creative.filename,
                type: creative.type === 'video' ? 'YOUTUBE_VIDEO' : 'IMAGE',
                imageAsset: { data: base64Content },
              },
            },
          ],
        },
        accessToken,
      ),
    );

    return response.resourceName.split('/').pop() ?? '';
  }

  // --- Rate limits ------------------------------------------------------------

  getRateLimits(): RateLimitConfig {
    return PLATFORM_RATE_LIMITS[Platform.GOOGLE];
  }

  // --- Webhooks ---------------------------------------------------------------

  parseWebhook(headers: Record<string, string>, body: unknown): WebhookEvent {
    void headers;
    return {
      platform: Platform.GOOGLE,
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
    const signature = headers['x-goog-signature'];
    if (!signature) return false;

    const bodyString =
      typeof body === 'string' ? body : JSON.stringify(body);

    const expected = crypto
      .createHmac('sha256', secret)
      .update(bodyString)
      .digest('base64');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

async function fetchOAuthToken(params: Record<string, string>): Promise<GoogleOAuthResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  const body: unknown = await response.json();
  if (!response.ok) {
    const err = body as Record<string, unknown>;
    throw {
      message: String(err['error_description'] ?? 'OAuth error'),
      code: String(err['error'] ?? 'UNKNOWN'),
      status: response.status,
    };
  }
  return body as GoogleOAuthResponse;
}

function buildTokens(response: GoogleOAuthResponse, existingRefresh?: string): OAuthTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? existingRefresh ?? '',
    expiresAt: new Date(Date.now() + response.expires_in * 1000),
    scope: response.scope,
  };
}

function mapStatusToGoogle(status: string): string {
  const map: Record<string, string> = {
    active: 'ENABLED',
    paused: 'PAUSED',
    completed: 'REMOVED',
    draft: 'PAUSED',
    error: 'PAUSED',
  };
  return map[status] ?? 'PAUSED';
}

function formatGoogleDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function throwNotFound(entity: string, id: string): never {
  throw {
    message: `${entity} not found: ${id}`,
    code: 'NOT_FOUND',
    status: 404,
  };
}
