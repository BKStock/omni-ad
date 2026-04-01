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
import { MicrosoftAdsClient, splitMsAccountId } from './client.js';
import {
  toNormalizedCampaign,
  toNormalizedAdGroup,
  toNormalizedAd,
  toNormalizedMetrics,
  toNormalizedAudience,
  OBJECTIVE_TO_MS_TYPE,
  formatMsDate,
} from './mapper.js';
import type {
  MsCampaign,
  MsAdGroup,
  MsAd,
  MsMetrics,
  MsAudience,
  MsOAuthResponse,
} from './types.js';

const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const SCOPES = 'https://ads.microsoft.com/ads.manage offline_access';

export class MicrosoftAdsAdapter extends BaseAdapter {
  private readonly client: MicrosoftAdsClient;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(clientId: string, clientSecret: string, developerToken: string) {
    super(Platform.MICROSOFT);
    this.client = new MicrosoftAdsClient(developerToken);
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  // --- OAuth ------------------------------------------------------------------

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPES,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      fetchMsToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: SCOPES,
      }),
    );
    return buildTokens(response);
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    this.checkRateLimit();
    const response = await this.withRetry(() =>
      fetchMsToken({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: SCOPES,
      }),
    );
    return buildTokens(response, refreshToken);
  }

  async validateConnection(accessToken: string): Promise<ConnectionStatus> {
    this.checkRateLimit();
    // Use a dummy account to validate - real accounts use customerId:accountId format
    const { customerId, adAccountId } = splitMsAccountId('0:0');
    const data = await this.withRetry(() =>
      this.client.get<{ Accounts: { Id: string; Name: string }[] }>(
        'CustomerManagement/GetAccountsInfo',
        {},
        accessToken,
        customerId,
        adAccountId,
      ),
    );
    const account = data.Accounts?.[0];
    return {
      platform: Platform.MICROSOFT,
      status: 'active',
      accountId: account?.Id ?? 'unknown',
      accountName: account?.Name ?? 'Microsoft Ads Account',
      lastSyncAt: new Date(),
    };
  }

  // --- Campaigns --------------------------------------------------------------

  async getCampaigns(accountId: string, accessToken: string): Promise<NormalizedCampaign[]> {
    this.checkRateLimit();
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const response = await this.withRetry(() =>
      this.client.get<{ Campaigns: MsCampaign[] }>(
        'CampaignManagement/GetCampaignsByAccountId',
        { AccountId: adAccountId },
        accessToken,
        customerId,
        adAccountId,
      ),
    );
    return (response.Campaigns ?? []).map((c) => toNormalizedCampaign(c, accountId));
  }

  async getCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const response = await this.withRetry(() =>
      this.client.get<{ Campaigns: MsCampaign[] }>(
        'CampaignManagement/GetCampaignsByIds',
        { AccountId: adAccountId, CampaignIds: campaignId },
        accessToken,
        customerId,
        adAccountId,
      ),
    );
    const campaign = response.Campaigns?.[0];
    if (!campaign) throwNotFound('Campaign', campaignId);
    return toNormalizedCampaign(campaign, accountId);
  }

  async createCampaign(
    accountId: string,
    input: CreateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const { customerId, adAccountId } = splitMsAccountId(accountId);

    const payload: Record<string, unknown> = {
      AccountId: adAccountId,
      Campaigns: [
        {
          Name: input.name,
          Status: 'Paused',
          CampaignType: OBJECTIVE_TO_MS_TYPE[input.objective] ?? 'Search',
          BudgetType: 'DailyBudgetStandard',
          DailyBudget: input.dailyBudget,
          StartDate: input.startDate ? formatMsDate(input.startDate) : null,
          EndDate: input.endDate ? formatMsDate(input.endDate) : null,
        },
      ],
    };

    const response = await this.withRetry(() =>
      this.client.post<{ CampaignIds: string[] }>(
        'CampaignManagement/AddCampaigns',
        payload,
        accessToken,
        customerId,
        adAccountId,
      ),
    );

    const newId = response.CampaignIds?.[0];
    if (!newId) throwNotFound('Campaign', 'new');
    return this.getCampaign(accountId, newId, accessToken);
  }

  async updateCampaign(
    accountId: string,
    campaignId: string,
    input: UpdateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign> {
    this.checkRateLimit();
    const { customerId, adAccountId } = splitMsAccountId(accountId);

    const campaignUpdate: Record<string, unknown> = { Id: campaignId };
    if (input.name) campaignUpdate['Name'] = input.name;
    if (input.status) campaignUpdate['Status'] = mapStatusToMs(input.status);
    if (input.dailyBudget !== undefined) campaignUpdate['DailyBudget'] = input.dailyBudget;

    await this.withRetry(() =>
      this.client.post<unknown>(
        'CampaignManagement/UpdateCampaigns',
        { AccountId: adAccountId, Campaigns: [campaignUpdate] },
        accessToken,
        customerId,
        adAccountId,
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
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    await this.withRetry(() =>
      this.client.post<unknown>(
        'CampaignManagement/DeleteCampaigns',
        { AccountId: adAccountId, CampaignIds: [campaignId] },
        accessToken,
        customerId,
        adAccountId,
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
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const response = await this.withRetry(() =>
      this.client.get<{ AdGroups: MsAdGroup[] }>(
        'CampaignManagement/GetAdGroupsByCampaignId',
        { CampaignId: campaignId },
        accessToken,
        customerId,
        adAccountId,
      ),
    );
    return (response.AdGroups ?? []).map((ag) => toNormalizedAdGroup(ag, accountId));
  }

  async createAdGroup(
    accountId: string,
    campaignId: string,
    input: CreateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup> {
    this.checkRateLimit();
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const response = await this.withRetry(() =>
      this.client.post<{ AdGroupIds: string[] }>(
        'CampaignManagement/AddAdGroups',
        {
          CampaignId: campaignId,
          AdGroups: [
            {
              Name: input.name,
              Status: 'Paused',
              Language: 'All',
              BidScheme: { Type: 'ManualCpc' },
              ...(input.platformSpecificConfig ?? {}),
            },
          ],
        },
        accessToken,
        customerId,
        adAccountId,
      ),
    );

    const newId = response.AdGroupIds?.[0];
    if (!newId) throwNotFound('AdGroup', 'new');

    const adGroupResponse = await this.withRetry(() =>
      this.client.get<{ AdGroups: MsAdGroup[] }>(
        'CampaignManagement/GetAdGroupsByIds',
        { CampaignId: campaignId, AdGroupIds: newId },
        accessToken,
        customerId,
        adAccountId,
      ),
    );
    const adGroup = adGroupResponse.AdGroups?.[0];
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
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const update: Record<string, unknown> = { Id: adGroupId };
    if (input.name) update['Name'] = input.name;

    await this.withRetry(() =>
      this.client.post<unknown>(
        'CampaignManagement/UpdateAdGroups',
        { AdGroups: [update] },
        accessToken,
        customerId,
        adAccountId,
      ),
    );

    // Re-fetch — we need the CampaignId to look up the ad group
    const campaigns = await this.getCampaigns(accountId, accessToken);
    for (const campaign of campaigns) {
      const adGroupResponse = await this.withRetry(() =>
        this.client.get<{ AdGroups: MsAdGroup[] }>(
          'CampaignManagement/GetAdGroupsByIds',
          { CampaignId: campaign.id, AdGroupIds: adGroupId },
          accessToken,
          customerId,
          adAccountId,
        ),
      );
      const adGroup = adGroupResponse.AdGroups?.[0];
      if (adGroup) return toNormalizedAdGroup(adGroup, accountId);
    }

    throwNotFound('AdGroup', adGroupId);
  }

  // --- Ads --------------------------------------------------------------------

  async getAds(
    accountId: string,
    adGroupId: string,
    accessToken: string,
  ): Promise<NormalizedAd[]> {
    this.checkRateLimit();
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const response = await this.withRetry(() =>
      this.client.get<{ Ads: MsAd[] }>(
        'CampaignManagement/GetAdsByAdGroupId',
        { AdGroupId: adGroupId },
        accessToken,
        customerId,
        adAccountId,
      ),
    );
    return (response.Ads ?? []).map(toNormalizedAd);
  }

  async createAd(
    accountId: string,
    adGroupId: string,
    input: CreateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const response = await this.withRetry(() =>
      this.client.post<{ AdIds: string[] }>(
        'CampaignManagement/AddAds',
        {
          AdGroupId: adGroupId,
          Ads: [
            {
              Type: 'ExpandedText',
              Status: 'Paused',
              TitlePart1: input.name,
              TitlePart2: input.name,
              Text: input.name,
              FinalUrls: { Urls: ['https://example.com'] },
              ...(input.platformSpecificConfig ?? {}),
            },
          ],
        },
        accessToken,
        customerId,
        adAccountId,
      ),
    );

    const newId = response.AdIds?.[0];
    if (!newId) throwNotFound('Ad', 'new');

    const adResponse = await this.withRetry(() =>
      this.client.get<{ Ads: MsAd[] }>(
        'CampaignManagement/GetAdsByIds',
        { AdGroupId: adGroupId, AdIds: newId },
        accessToken,
        customerId,
        adAccountId,
      ),
    );
    const ad = adResponse.Ads?.[0];
    if (!ad) throwNotFound('Ad', newId);
    return toNormalizedAd(ad);
    void input;
  }

  async updateAd(
    accountId: string,
    adId: string,
    input: UpdateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd> {
    this.checkRateLimit();
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const update: Record<string, unknown> = { Id: adId };
    if (input.status) update['Status'] = mapStatusToMs(input.status);

    await this.withRetry(() =>
      this.client.post<unknown>(
        'CampaignManagement/UpdateAds',
        { Ads: [update] },
        accessToken,
        customerId,
        adAccountId,
      ),
    );

    const adResponse = await this.withRetry(() =>
      this.client.get<{ Ads: MsAd[] }>(
        'CampaignManagement/GetAdsByIds',
        { AdGroupId: '', AdIds: adId },
        accessToken,
        customerId,
        adAccountId,
      ),
    );
    const ad = adResponse.Ads?.[0];
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
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const response = await this.withRetry(() =>
      this.client.post<{ Rows: MsMetrics[] }>(
        'Reporting/SubmitGenerateReportRequest',
        {
          ReportRequest: {
            ReportName: 'CampaignPerformanceReport',
            Format: 'Tsv',
            Time: {
              CustomDateRangeStart: formatMsDate(query.startDate),
              CustomDateRangeEnd: formatMsDate(query.endDate),
            },
            Filter: query.campaignId
              ? { CampaignIds: [query.campaignId] }
              : undefined,
            Columns: [
              'TimePeriod', 'CampaignId', 'Impressions', 'Clicks',
              'Conversions', 'Spend', 'Revenue', 'Ctr', 'AverageCpc',
              'CostPerConversion', 'ReturnOnAdSpend',
            ],
          },
        },
        accessToken,
        customerId,
        adAccountId,
      ),
    );
    return (response.Rows ?? []).map((r) => toNormalizedMetrics(r, accountId));
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
      platform: Platform.MICROSOFT,
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
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const response = await this.withRetry(() =>
      this.client.get<{ Audiences: MsAudience[] }>(
        'CampaignManagement/GetAudiencesByIds',
        { AccountId: adAccountId },
        accessToken,
        customerId,
        adAccountId,
      ),
    );
    return (response.Audiences ?? []).map((a) => toNormalizedAudience(a, accountId));
  }

  async createAudience(
    accountId: string,
    input: CreateAudienceInput,
    accessToken: string,
  ): Promise<AudienceSegment> {
    this.checkRateLimit();
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const response = await this.withRetry(() =>
      this.client.post<{ AudienceIds: string[] }>(
        'CampaignManagement/AddAudiences',
        {
          Audiences: [
            {
              Name: input.name,
              AudienceNetworkSize: 0,
              Type: 'RemarketingList',
              MembershipDuration: 30,
            },
          ],
        },
        accessToken,
        customerId,
        adAccountId,
      ),
    );

    const newId = response.AudienceIds?.[0];
    if (!newId) throwNotFound('Audience', 'new');

    const audienceResponse = await this.withRetry(() =>
      this.client.get<{ Audiences: MsAudience[] }>(
        'CampaignManagement/GetAudiencesByIds',
        { AudienceIds: newId },
        accessToken,
        customerId,
        adAccountId,
      ),
    );
    const audience = audienceResponse.Audiences?.[0];
    if (!audience) throwNotFound('Audience', newId);
    return toNormalizedAudience(audience, accountId);
    void input;
  }

  async uploadAudienceList(
    accountId: string,
    audienceId: string,
    data: AudienceListData,
    accessToken: string,
  ): Promise<void> {
    this.checkRateLimit();
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const customerListItems: Record<string, string>[] = [];

    if (data.emails) {
      customerListItems.push(
        ...data.emails.map((e) => ({
          ActionType: 'Add',
          HashedEmail: hashSha256(e.toLowerCase().trim()),
        })),
      );
    }
    if (data.phones) {
      customerListItems.push(
        ...data.phones.map((p) => ({
          ActionType: 'Add',
          HashedPhoneNumber: hashSha256(p.replace(/\D/g, '')),
        })),
      );
    }

    await this.withRetry(() =>
      this.client.post<unknown>(
        'CampaignManagement/ApplyCustomerListItems',
        { AudienceId: audienceId, CustomerListItems: customerListItems },
        accessToken,
        customerId,
        adAccountId,
      ),
    );
  }

  // --- Creatives --------------------------------------------------------------

  getCreativeSpecs(): PlatformCreativeSpecs {
    return PLATFORM_CREATIVE_SPECS[Platform.MICROSOFT];
  }

  async uploadCreative(
    accountId: string,
    creative: CreativeUploadInput,
    accessToken: string,
  ): Promise<string> {
    this.checkRateLimit();
    const { customerId, adAccountId } = splitMsAccountId(accountId);
    const base64 =
      creative.content instanceof Buffer
        ? creative.content.toString('base64')
        : creative.content;

    const response = await this.withRetry(() =>
      this.client.post<{ MediaIds: string[] }>(
        'CampaignManagement/AddMedia',
        {
          AccountId: adAccountId,
          Media: [
            {
              Type: creative.type === 'image' ? 'Image' : 'Video',
              Name: creative.filename,
              MediaType: creative.mimeType,
              Data: base64,
            },
          ],
        },
        accessToken,
        customerId,
        adAccountId,
      ),
    );
    return response.MediaIds?.[0] ?? '';
  }

  // --- Rate limits ------------------------------------------------------------

  getRateLimits(): RateLimitConfig {
    return PLATFORM_RATE_LIMITS[Platform.MICROSOFT];
  }

  // --- Webhooks ---------------------------------------------------------------

  parseWebhook(headers: Record<string, string>, body: unknown): WebhookEvent {
    void headers;
    return {
      platform: Platform.MICROSOFT,
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
    const signature = headers['x-ms-ads-signature'];
    if (!signature) return false;

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const expected = crypto.createHmac('sha256', secret).update(bodyString).digest('base64');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

async function fetchMsToken(params: Record<string, string>): Promise<MsOAuthResponse> {
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
  return body as MsOAuthResponse;
}

function buildTokens(response: MsOAuthResponse, existingRefresh?: string): OAuthTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? existingRefresh ?? '',
    expiresAt: new Date(Date.now() + response.expires_in * 1000),
    scope: response.scope,
  };
}

function mapStatusToMs(status: string): string {
  const map: Record<string, string> = {
    active: 'Active',
    paused: 'Paused',
    completed: 'Deleted',
    draft: 'Paused',
    error: 'Paused',
  };
  return map[status] ?? 'Paused';
}

function hashSha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function throwNotFound(entity: string, id: string): never {
  throw { message: `${entity} not found: ${id}`, code: 'NOT_FOUND', status: 404 };
}
