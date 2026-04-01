import { db } from '@omni-ad/db';
import { budgetAllocations } from '@omni-ad/db/schema';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type { ComputeAllocationJob, ComputeForecastJob } from '@omni-ad/queue';
import { desc, eq } from 'drizzle-orm';

type BudgetAllocationSelect = typeof budgetAllocations.$inferSelect;
type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';

export async function getCurrentAllocations(
  organizationId: string,
): Promise<BudgetAllocationSelect | undefined> {
  return db.query.budgetAllocations.findFirst({
    where: eq(budgetAllocations.organizationId, organizationId),
    orderBy: [desc(budgetAllocations.createdAt)],
  });
}

export async function getAllocationHistory(
  organizationId: string,
  limit = 20,
): Promise<BudgetAllocationSelect[]> {
  return db.query.budgetAllocations.findMany({
    where: eq(budgetAllocations.organizationId, organizationId),
    orderBy: [desc(budgetAllocations.createdAt)],
    limit,
  });
}

export async function triggerOptimization(
  organizationId: string,
  totalBudget: number,
  platforms: Platform[],
  objective: ComputeAllocationJob['objective'] = 'maximize_roas',
): Promise<{ jobId: string }> {
  const queue = getQueue(QUEUE_NAMES.BUDGET_OPTIMIZATION);
  const jobData: ComputeAllocationJob = {
    organizationId,
    totalBudget,
    platforms,
    objective,
  };

  const job = await queue.add(
    `optimize-budget-${organizationId}-${Date.now()}`,
    jobData,
  );

  return { jobId: job.id ?? organizationId };
}

export async function getForecast(
  organizationId: string,
  proposedAllocations: Partial<Record<Platform, number>>,
  forecastDays = 7,
): Promise<{ jobId: string }> {
  const queue = getQueue(QUEUE_NAMES.BUDGET_OPTIMIZATION);

  // Build a full record ensuring all keys are valid platform values
  const allocationsRecord: Record<string, number> = {};
  for (const [key, value] of Object.entries(proposedAllocations)) {
    if (value !== undefined) {
      allocationsRecord[key] = value;
    }
  }

  const jobData: ComputeForecastJob = {
    organizationId,
    proposedAllocations: allocationsRecord as Record<Platform, number>,
    forecastDays,
  };

  const job = await queue.add(
    `forecast-${organizationId}-${Date.now()}`,
    jobData,
  );

  return { jobId: job.id ?? organizationId };
}
