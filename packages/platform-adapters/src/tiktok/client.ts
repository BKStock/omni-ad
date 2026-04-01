import { PlatformErrorCode } from '@omni-ad/shared';
import type { PlatformError } from '@omni-ad/shared';
import type { TikTokApiResponse } from './types.js';

const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3';

function buildPlatformError(message: string, code: number, httpStatus: number): PlatformError {
  let platformCode: PlatformErrorCode;
  if (httpStatus === 401 || httpStatus === 403 || code === 40001) {
    platformCode = PlatformErrorCode.AUTH_EXPIRED;
  } else if (httpStatus === 404 || code === 40002) {
    platformCode = PlatformErrorCode.NOT_FOUND;
  } else if (httpStatus === 429 || code === 40100) {
    platformCode = PlatformErrorCode.RATE_LIMITED;
  } else if (httpStatus >= 400 && httpStatus < 500) {
    platformCode = PlatformErrorCode.INVALID_REQUEST;
  } else {
    platformCode = PlatformErrorCode.INTERNAL_ERROR;
  }

  return {
    code: platformCode,
    message,
    platformCode: String(code),
    retryable: platformCode === PlatformErrorCode.RATE_LIMITED || httpStatus >= 500,
    retryAfterSeconds: httpStatus === 429 ? 60 : null,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as TikTokApiResponse<T>;

  if (!response.ok || body.code !== 0) {
    throw buildPlatformError(body.message, body.code, response.status);
  }

  return body.data;
}

export class TikTokClient {
  async get<T>(
    path: string,
    params: Record<string, string>,
    accessToken: string,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}/${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
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
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return parseResponse<T>(response);
  }
}
