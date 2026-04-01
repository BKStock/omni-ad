import { anomalyDetectionJobSchema, type AnomalyDetectionJob } from '@omni-ad/queue';

export async function processAnomalyDetection(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = anomalyDetectionJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: AnomalyDetectionJob = parsed.data;
  console.log(
    `[anomaly-detection] Running checks: ${data.checkTypes.join(', ')} for org ${data.organizationId}`
  );

  // TODO: Implement statistical anomaly detection (CUSUM, EWMA, Isolation Forest)
}
