import { db } from '@omni-ad/db';
import { funnels, funnelStageCampaigns } from '@omni-ad/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

type FunnelSelect = typeof funnels.$inferSelect;
type FunnelStageCampaignSelect = typeof funnelStageCampaigns.$inferSelect;

export interface FunnelWithStageCampaigns extends FunnelSelect {
  stageCampaigns: FunnelStageCampaignSelect[];
}

interface CreateFunnelInput {
  name: string;
  stages: unknown; // JSON stages definition from the client
}

interface FunnelStageAssignment {
  stageIndex: number;
  campaignId: string;
}

export async function listFunnels(
  organizationId: string,
): Promise<FunnelWithStageCampaigns[]> {
  return db.query.funnels.findMany({
    where: eq(funnels.organizationId, organizationId),
    orderBy: [desc(funnels.createdAt)],
    with: {
      stageCampaigns: true,
    },
  });
}

export async function getFunnel(
  id: string,
  organizationId: string,
): Promise<FunnelWithStageCampaigns | undefined> {
  return db.query.funnels.findFirst({
    where: and(
      eq(funnels.id, id),
      eq(funnels.organizationId, organizationId),
    ),
    with: {
      stageCampaigns: true,
    },
  });
}

export async function createFunnel(
  input: CreateFunnelInput,
  organizationId: string,
  userId: string,
  campaignAssignments?: FunnelStageAssignment[],
): Promise<FunnelWithStageCampaigns> {
  const result = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(funnels)
      .values({
        organizationId,
        name: input.name,
        stages: input.stages,
        status: 'draft',
        createdBy: userId,
      })
      .returning();

    if (!inserted) {
      throw new Error('Failed to insert funnel');
    }

    let stageCampaigns: FunnelStageCampaignSelect[] = [];

    if (campaignAssignments && campaignAssignments.length > 0) {
      stageCampaigns = await tx
        .insert(funnelStageCampaigns)
        .values(
          campaignAssignments.map((assignment) => ({
            funnelId: inserted.id,
            stageIndex: assignment.stageIndex,
            campaignId: assignment.campaignId,
          })),
        )
        .returning();
    }

    return { ...inserted, stageCampaigns };
  });

  return result;
}

export async function updateFunnel(
  id: string,
  input: { name?: string; stages?: unknown; status?: FunnelSelect['status'] },
  organizationId: string,
): Promise<FunnelSelect> {
  const updateSet: Record<string, unknown> = {
    updatedAt: sql`now()`,
  };

  if (input.name !== undefined) updateSet['name'] = input.name;
  if (input.stages !== undefined) updateSet['stages'] = input.stages;
  if (input.status !== undefined) updateSet['status'] = input.status;

  const [updated] = await db
    .update(funnels)
    .set(updateSet)
    .where(
      and(
        eq(funnels.id, id),
        eq(funnels.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new FunnelNotFoundError(id);
  }

  return updated;
}

export async function deleteFunnel(
  id: string,
  organizationId: string,
): Promise<FunnelSelect> {
  // Soft delete via status change
  const [updated] = await db
    .update(funnels)
    .set({ status: 'paused', updatedAt: sql`now()` })
    .where(
      and(
        eq(funnels.id, id),
        eq(funnels.organizationId, organizationId),
      ),
    )
    .returning();

  if (!updated) {
    throw new FunnelNotFoundError(id);
  }

  return updated;
}

export class FunnelNotFoundError extends Error {
  constructor(funnelId: string) {
    super(`Funnel not found: ${funnelId}`);
    this.name = 'FunnelNotFoundError';
  }
}
