import { PlatformErrorCode } from '@omni-ad/shared';
import type { Platform, PlatformError, RateLimitConfig } from '@omni-ad/shared';
import type {
  ConnectionStatus,
  OAuthTokens,
  NormalizedCampaign,
  NormalizedAdGroup,
  NormalizedAd,
  NormalizedMetrics,
  RealtimeMetrics,
  MetricsQuery,
  AudienceSegment,
  PlatformCreativeSpecs,
  WebhookEvent,
  CreateCampaignInput,
  UpdateCampaignInput,
  CreateAdGroupInput,
  UpdateAdGroupInput,
  CreateAdInput,
  UpdateAdInput,
  CreateAudienceInput,
  AudienceListData,
  CreativeUploadInput,
} from './types';
import type { PlatformAdapter } from './types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

function isErrorWithMessage(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as Record<string, unknown>)['message'] === 'string'
  );
}

function extractPlatformCode(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as Record<string, unknown>)['code'] === 'string'
  ) {
    return (value as Record<string, unknown>)['code'] as string;
  }
  return 'UNKNOWN';
}

function classifyError(value: unknown): {
  code: PlatformErrorCode;
  retryable: boolean;
  retryAfterSeconds: number | null;
} {
  if (typeof value !== 'object' || value === null) {
    return { code: PlatformErrorCode.INTERNAL_ERROR, retryable: false, retryAfterSeconds: null };
  }

  const obj = value as Record<string, unknown>;
  const status = typeof obj['status'] === 'number' ? obj['status'] : 0;

  if (status === 401 || status === 403) {
    return { code: PlatformErrorCode.AUTH_EXPIRED, retryable: false, retryAfterSeconds: null };
  }
  if (status === 404) {
    return { code: PlatformErrorCode.NOT_FOUND, retryable: false, retryAfterSeconds: null };
  }
  if (status === 429) {
    const retryAfter =
      typeof obj['retryAfter'] === 'number' ? obj['retryAfter'] : null;
    return { code: PlatformErrorCode.RATE_LIMITED, retryable: true, retryAfterSeconds: retryAfter };
  }
  if (status >= 400 && status < 500) {
    return { code: PlatformErrorCode.INVALID_REQUEST, retryable: false, retryAfterSeconds: null };
  }
  if (status >= 500) {
    return { code: PlatformErrorCode.INTERNAL_ERROR, retryable: true, retryAfterSeconds: null };
  }

  return { code: PlatformErrorCode.NETWORK_ERROR, retryable: true, retryAfterSeconds: null };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// BaseAdapter
// ---------------------------------------------------------------------------

/**
 * Abstract base class for all platform adapters.
 *
 * Provides shared infrastructure:
 * - Uniform error wrapping via `handlePlatformError`
 * - Exponential-backoff retry via `withRetry`
 * - In-process rate-limit tracking via `checkRateLimit`
 *
 * Subclasses must implement every method of PlatformAdapter.  The abstract
 * declarations here mirror the interface so TypeScript enforces completeness
 * at compile time.
 */
export abstract class BaseAdapter implements PlatformAdapter {
  readonly platform: Platform;

  /** Rolling request timestamps used for rate-limit enforcement. */
  private readonly requestTimestamps: number[] = [];

  constructor(platform: Platform) {
    this.platform = platform;
  }

  // ---------------------------------------------------------------------------
  // Shared utilities
  // ---------------------------------------------------------------------------

  /**
   * Wraps any thrown value into a typed PlatformError.
   * Call this inside adapter catch blocks before re-throwing or returning.
   */
  protected handlePlatformError(error: unknown): PlatformError {
    const message = isErrorWithMessage(error) ? error.message : String(error);
    const platformCode = extractPlatformCode(error);
    const { code, retryable, retryAfterSeconds } = classifyError(error);

    return { code, message, platformCode, retryable, retryAfterSeconds };
  }

  /**
   * Retries `fn` up to `maxRetries` times using exponential backoff.
   * Only retries when the wrapped PlatformError is flagged as retryable.
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = DEFAULT_MAX_RETRIES,
  ): Promise<T> {
    let lastError: PlatformError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (raw: unknown) {
        const platformError = this.handlePlatformError(raw);
        lastError = platformError;

        const isLastAttempt = attempt === maxRetries;
        if (isLastAttempt || !platformError.retryable) {
          break;
        }

        const delayMs =
          platformError.retryAfterSeconds != null
            ? platformError.retryAfterSeconds * 1000
            : BASE_BACKOFF_MS * 2 ** attempt;

        await sleep(delayMs);
      }
    }

    // lastError is always set when we reach here because fn threw at least once
    throw lastError ?? new Error('withRetry: unexpected exit without error');
  }

  /**
   * Enforces the rate limits declared by `getRateLimits()`.
   * Tracks requests in a rolling 1-hour window.  Call at the top of each
   * API method before dispatching the network request.
   */
  protected checkRateLimit(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Purge entries older than 24 hours to prevent unbounded array growth
    while (
      this.requestTimestamps.length > 0 &&
      (this.requestTimestamps[0] ?? 0) < oneDayAgo
    ) {
      this.requestTimestamps.shift();
    }

    const limits = this.getRateLimits();
    const requestsInLastHour = this.requestTimestamps.filter((t) => t >= oneHourAgo).length;
    const requestsInLastDay = this.requestTimestamps.length;

    if (requestsInLastHour >= limits.maxRequestsPerHour) {
      const error: PlatformError = {
        code: PlatformErrorCode.RATE_LIMITED,
        message: `Hourly rate limit of ${limits.maxRequestsPerHour} requests exceeded`,
        platformCode: 'RATE_LIMITED_HOURLY',
        retryable: true,
        retryAfterSeconds: 60,
      };
      throw error;
    }

    if (requestsInLastDay >= limits.maxRequestsPerDay) {
      const error: PlatformError = {
        code: PlatformErrorCode.RATE_LIMITED,
        message: `Daily rate limit of ${limits.maxRequestsPerDay} requests exceeded`,
        platformCode: 'RATE_LIMITED_DAILY',
        retryable: true,
        retryAfterSeconds: 3600,
      };
      throw error;
    }

    this.requestTimestamps.push(now);
  }

  // ---------------------------------------------------------------------------
  // Abstract methods — all PlatformAdapter methods must be implemented
  // ---------------------------------------------------------------------------

  abstract getAuthUrl(redirectUri: string, state: string): string;
  abstract exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  abstract refreshToken(refreshToken: string): Promise<OAuthTokens>;
  abstract validateConnection(accessToken: string): Promise<ConnectionStatus>;

  abstract getCampaigns(accountId: string, accessToken: string): Promise<NormalizedCampaign[]>;
  abstract getCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedCampaign>;
  abstract createCampaign(
    accountId: string,
    input: CreateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign>;
  abstract updateCampaign(
    accountId: string,
    campaignId: string,
    input: UpdateCampaignInput,
    accessToken: string,
  ): Promise<NormalizedCampaign>;
  abstract pauseCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<void>;
  abstract resumeCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<void>;
  abstract deleteCampaign(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<void>;

  abstract getAdGroups(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<NormalizedAdGroup[]>;
  abstract createAdGroup(
    accountId: string,
    campaignId: string,
    input: CreateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup>;
  abstract updateAdGroup(
    accountId: string,
    adGroupId: string,
    input: UpdateAdGroupInput,
    accessToken: string,
  ): Promise<NormalizedAdGroup>;

  abstract getAds(
    accountId: string,
    adGroupId: string,
    accessToken: string,
  ): Promise<NormalizedAd[]>;
  abstract createAd(
    accountId: string,
    adGroupId: string,
    input: CreateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd>;
  abstract updateAd(
    accountId: string,
    adId: string,
    input: UpdateAdInput,
    accessToken: string,
  ): Promise<NormalizedAd>;

  abstract getMetrics(
    accountId: string,
    query: MetricsQuery,
    accessToken: string,
  ): Promise<NormalizedMetrics[]>;
  abstract getRealtimeMetrics(
    accountId: string,
    campaignId: string,
    accessToken: string,
  ): Promise<RealtimeMetrics>;

  abstract getAudiences(accountId: string, accessToken: string): Promise<AudienceSegment[]>;
  abstract createAudience(
    accountId: string,
    input: CreateAudienceInput,
    accessToken: string,
  ): Promise<AudienceSegment>;
  abstract uploadAudienceList(
    accountId: string,
    audienceId: string,
    data: AudienceListData,
    accessToken: string,
  ): Promise<void>;

  abstract getCreativeSpecs(): PlatformCreativeSpecs;
  abstract uploadCreative(
    accountId: string,
    creative: CreativeUploadInput,
    accessToken: string,
  ): Promise<string>;

  abstract getRateLimits(): RateLimitConfig;

  abstract parseWebhook(headers: Record<string, string>, body: unknown): WebhookEvent;
  abstract verifyWebhookSignature(
    headers: Record<string, string>,
    body: unknown,
    secret: string,
  ): boolean;
}
