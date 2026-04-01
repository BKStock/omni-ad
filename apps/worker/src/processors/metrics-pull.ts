import { pullMetricsJobSchema, type PullMetricsJob } from '@omni-ad/queue';

export async function processMetricsPull(job: { name: string; data: unknown }): Promise<void> {
  const parsed = pullMetricsJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: PullMetricsJob = parsed.data;
  console.log(
    `[metrics-pull] Pulling metrics from ${data.platform} for org ${data.organizationId}`
  );

  // TODO: Pull metrics via platform adapter and upsert into metrics_hourly
}
