import { db } from '@omni-ad/db';
import { platformConnections } from '@omni-ad/db/schema';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type { SyncCampaignJob } from '@omni-ad/queue';
import { and, eq, sql } from 'drizzle-orm';

type PlatformConnectionSelect = typeof platformConnections.$inferSelect;
type Platform = PlatformConnectionSelect['platform'];

export interface ConnectionStatusResult {
  connection: PlatformConnectionSelect;
  isTokenValid: boolean;
}

export async function listConnections(
  organizationId: string,
): Promise<PlatformConnectionSelect[]> {
  return db.query.platformConnections.findMany({
    where: eq(platformConnections.organizationId, organizationId),
  });
}

export async function connectPlatform(
  platform: Platform,
  organizationId: string,
  redirectUrl: string,
): Promise<{ oauthUrl: string }> {
  // Generate OAuth URL based on platform
  // In production this would delegate to a platform-specific adapter
  const baseUrls: Record<Platform, string> = {
    meta: 'https://www.facebook.com/v19.0/dialog/oauth',
    google: 'https://accounts.google.com/o/oauth2/v2/auth',
    x: 'https://twitter.com/i/oauth2/authorize',
    tiktok: 'https://ads.tiktok.com/marketing_api/auth',
    line_yahoo: 'https://access.line.me/oauth2/v2.1/authorize',
    amazon: 'https://www.amazon.com/ap/oa',
    microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  };

  const baseUrl = baseUrls[platform];
  const params = new URLSearchParams({
    redirect_uri: redirectUrl,
    state: `${organizationId}:${platform}`,
    response_type: 'code',
  });

  return { oauthUrl: `${baseUrl}?${params.toString()}` };
}

export async function disconnectPlatform(
  connectionId: string,
  organizationId: string,
): Promise<PlatformConnectionSelect> {
  const [updated] = await db
    .update(platformConnections)
    .set({
      status: 'revoked',
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(platformConnections.id, connectionId),
        eq(platformConnections.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new PlatformConnectionNotFoundError(connectionId);
  }

  return updated;
}

export async function getConnectionStatus(
  connectionId: string,
  organizationId: string,
): Promise<ConnectionStatusResult> {
  const connection = await db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.id, connectionId),
      eq(platformConnections.organizationId, organizationId),
    ),
  });

  if (!connection) {
    throw new PlatformConnectionNotFoundError(connectionId);
  }

  const isTokenValid =
    connection.status === 'active' &&
    connection.tokenExpiresAt > new Date();

  return { connection, isTokenValid };
}

export async function syncNow(
  connectionId: string,
  organizationId: string,
): Promise<{ jobId: string }> {
  const connection = await db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.id, connectionId),
      eq(platformConnections.organizationId, organizationId),
    ),
  });

  if (!connection) {
    throw new PlatformConnectionNotFoundError(connectionId);
  }

  const queue = getQueue(QUEUE_NAMES.AD_SYNC);
  const jobData: SyncCampaignJob = {
    organizationId,
    platformConnectionId: connectionId,
    platform: connection.platform,
    direction: 'pull',
  };

  const job = await queue.add(
    `sync-${connectionId}-${Date.now()}`,
    jobData,
  );

  // Update last sync timestamp
  await db
    .update(platformConnections)
    .set({ lastSyncAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(platformConnections.id, connectionId));

  return { jobId: job.id ?? connectionId };
}

export class PlatformConnectionNotFoundError extends Error {
  constructor(connectionId: string) {
    super(`Platform connection not found: ${connectionId}`);
    this.name = 'PlatformConnectionNotFoundError';
  }
}
