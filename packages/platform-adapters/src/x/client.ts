import crypto from 'crypto';
import { PlatformErrorCode } from '@omni-ad/shared';
import type { PlatformError } from '@omni-ad/shared';
import type { XApiError } from './types.js';

const BASE_URL = 'https://ads-api.twitter.com/12';

function isXApiError(value: unknown): value is XApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'errors' in value &&
    Array.isArray((value as Record<string, unknown>)['errors'])
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
    if (isXApiError(body)) {
      const first = body.errors[0];
      throw buildPlatformError(
        first?.message ?? 'X API error',
        String(first?.code ?? 'UNKNOWN'),
        response.status,
      );
    }
    throw buildPlatformError('X API error', 'UNKNOWN', response.status);
  }
  return body as T;
}

/**
 * X Ads API uses OAuth 1.0a. This client signs requests with HMAC-SHA1.
 */
export class XAdsClient {
  private readonly consumerKey: string;
  private readonly consumerSecret: string;

  constructor(consumerKey: string, consumerSecret: string) {
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
  }

  private buildOAuthHeader(
    method: string,
    url: string,
    oauthToken: string,
    oauthTokenSecret: string,
    params: Record<string, string> = {},
  ): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = String(Math.floor(Date.now() / 1000));

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: oauthToken,
      oauth_version: '1.0',
    };

    const allParams = { ...params, ...oauthParams };
    const sortedKeys = Object.keys(allParams).sort();
    const paramString = sortedKeys
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k] ?? '')}`)
      .join('&');

    const signatureBase = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(paramString),
    ].join('&');

    const signingKey = `${encodeURIComponent(this.consumerSecret)}&${encodeURIComponent(oauthTokenSecret)}`;
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(signatureBase)
      .digest('base64');

    oauthParams['oauth_signature'] = signature;

    const headerParts = Object.entries(oauthParams)
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(', ');

    return `OAuth ${headerParts}`;
  }

  async get<T>(
    path: string,
    params: Record<string, string>,
    accessToken: string,
    accessTokenSecret: string,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}/${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const baseUrl = `${url.origin}${url.pathname}`;
    const authHeader = this.buildOAuthHeader(
      'GET',
      baseUrl,
      accessToken,
      accessTokenSecret,
      params,
    );

    const response = await fetch(url.toString(), {
      headers: { Authorization: authHeader },
    });
    return parseResponse<T>(response);
  }

  async post<T>(
    path: string,
    body: Record<string, unknown>,
    accessToken: string,
    accessTokenSecret: string,
  ): Promise<T> {
    const url = `${BASE_URL}/${path}`;
    const authHeader = this.buildOAuthHeader('POST', url, accessToken, accessTokenSecret);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return parseResponse<T>(response);
  }

  async delete(
    path: string,
    accessToken: string,
    accessTokenSecret: string,
  ): Promise<void> {
    const url = `${BASE_URL}/${path}`;
    const authHeader = this.buildOAuthHeader('DELETE', url, accessToken, accessTokenSecret);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    });
    await parseResponse<unknown>(response);
  }
}

/**
 * Splits a combined accessToken string "token:secret" into its parts.
 * X OAuth 1.0a requires both the token and the token secret.
 */
export function splitXAccessToken(accessToken: string): {
  token: string;
  secret: string;
} {
  const idx = accessToken.indexOf(':');
  if (idx === -1) return { token: accessToken, secret: '' };
  return {
    token: accessToken.slice(0, idx),
    secret: accessToken.slice(idx + 1),
  };
}
