export enum Platform {
  META = 'META',
  GOOGLE = 'GOOGLE',
  X = 'X',
  TIKTOK = 'TIKTOK',
  LINE_YAHOO = 'LINE_YAHOO',
  AMAZON = 'AMAZON',
  MICROSOFT = 'MICROSOFT',
}

export enum PlatformErrorCode {
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export type PlatformStatus = 'active' | 'expired' | 'revoked' | 'error';

export interface ConnectionStatus {
  platform: Platform;
  status: PlatformStatus;
  accountId: string;
  accountName: string;
  lastSyncAt: Date | null;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export interface RateLimitConfig {
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  burstLimit: number;
}

export interface PlatformError {
  code: PlatformErrorCode;
  message: string;
  platformCode: string;
  retryable: boolean;
  retryAfterSeconds: number | null;
}
