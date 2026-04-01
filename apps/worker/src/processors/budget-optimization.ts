import { computeAllocationJobSchema, type ComputeAllocationJob } from '@omni-ad/queue';

export async function processBudgetOptimization(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = computeAllocationJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: ComputeAllocationJob = parsed.data;
  console.log(
    `[budget-optimization] Computing allocation for org ${data.organizationId}, budget: ${data.totalBudget}`
  );

  // TODO: Call ML microservice for Thompson Sampling + Bayesian MMM
}
