import { PlatformErrorCode } from '@omni-ad/shared';
import type { PlatformError } from '@omni-ad/shared';
import type { MsApiError } from './types.js';

const BASE_URL = 'https://api.ads.microsoft.com/v13';

function isMsApiError(value: unknown): value is MsApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ErrorCode' in value &&
    'message' in value
  );
}

function buildPlatformError(message: string, platformCode: string, status: number): PlatformError {
  let code: PlatformErrorCode;
  if (status === 401 || status === 403) code = PlatformErrorCode.AUTH_EXPIRED;
  else if (status === 404) code = PlatformErrorCode.NOT_FOUND;
  else if (status === 429) code = PlatformErrorCode.RATE_LIMITED;
  else if (status >= 400 && status < 500) code = PlatformErrorCode.INVALID_REQUEST;
  else code = PlatformErrorCode.INTERNAL_ERROR;

  return {
    code,
    message,
    platformCode,
    retryable: code === PlatformErrorCode.RATE_LIMITED || status >= 500,
    retryAfterSeconds: status === 429 ? 60 : null,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) {
    if (isMsApiError(body)) {
      throw buildPlatformError(body.message, body.ErrorCode, response.status);
    }
    throw buildPlatformError('Microsoft Ads API error', 'UNKNOWN', response.status);
  }
  return body as T;
}

export class MicrosoftAdsClient {
  private readonly developerToken: string;

  constructor(developerToken: string) {
    this.developerToken = developerToken;
  }

  private buildHeaders(
    accessToken: string,
    customerId: string,
    accountId: string,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      DeveloperToken: this.developerToken,
      CustomerId: customerId,
      AccountId: accountId,
      'Content-Type': 'application/json',
    };
  }

  async get<T>(
    path: string,
    params: Record<string, string>,
    accessToken: string,
    customerId: string,
    accountId: string,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const response = await fetch(url.toString(), {
      headers: this.buildHeaders(accessToken, customerId, accountId),
    });
    return parseResponse<T>(response);
  }

  async post<T>(
    path: string,
    body: Record<string, unknown>,
    accessToken: string,
    customerId: string,
    accountId: string,
  ): Promise<T> {
    const response = await fetch(`${BASE_URL}/${path}`, {
      method: 'POST',
      headers: this.buildHeaders(accessToken, customerId, accountId),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(response);
  }

  async delete(
    path: string,
    accessToken: string,
    customerId: string,
    accountId: string,
  ): Promise<void> {
    const response = await fetch(`${BASE_URL}/${path}`, {
      method: 'DELETE',
      headers: this.buildHeaders(accessToken, customerId, accountId),
    });
    await parseResponse<unknown>(response);
  }
}

/**
 * Microsoft account IDs use format "customerId:accountId".
 * This splits them back out.
 */
export function splitMsAccountId(accountId: string): {
  customerId: string;
  adAccountId: string;
} {
  const idx = accountId.indexOf(':');
  if (idx === -1) return { customerId: accountId, adAccountId: accountId };
  return {
    customerId: accountId.slice(0, idx),
    adAccountId: accountId.slice(idx + 1),
  };
}
