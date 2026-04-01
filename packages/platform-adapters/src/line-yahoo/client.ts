import { PlatformErrorCode } from '@omni-ad/shared';
import type { PlatformError } from '@omni-ad/shared';
import type { LYApiError } from './types.js';

const BASE_URL = 'https://ads-api.line.me/v3';

function isLYApiError(value: unknown): value is { error: LYApiError } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as Record<string, unknown>)['error'] === 'object'
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
    if (isLYApiError(body)) {
      throw buildPlatformError(body.error.message, body.error.code, response.status);
    }
    throw buildPlatformError('LINE/Yahoo API error', 'UNKNOWN', response.status);
  }
  return body as T;
}

export class LYClient {
  private buildHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async get<T>(
    path: string,
    params: Record<string, string>,
    accessToken: string,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const response = await fetch(url.toString(), {
      headers: this.buildHeaders(accessToken),
    });
    return parseResponse<T>(response);
  }

  async post<T>(
    path: string,
    body: Record<string, unknown>,
    accessToken: string,
  ): Promise<T> {
    const response = await fetch(`${BASE_URL}/${path}`, {
      method: 'POST',
      headers: this.buildHeaders(accessToken),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(response);
  }

  async put<T>(
    path: string,
    body: Record<string, unknown>,
    accessToken: string,
  ): Promise<T> {
    const response = await fetch(`${BASE_URL}/${path}`, {
      method: 'PUT',
      headers: this.buildHeaders(accessToken),
      body: JSON.stringify(body),
    });
    return parseResponse<T>(response);
  }

  async delete(path: string, accessToken: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/${path}`, {
      method: 'DELETE',
      headers: this.buildHeaders(accessToken),
    });
    await parseResponse<unknown>(response);
  }
}
