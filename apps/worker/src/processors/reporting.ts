import { generateReportJobSchema, type GenerateReportJob } from '@omni-ad/queue';

export async function processReporting(job: { name: string; data: unknown }): Promise<void> {
  const parsed = generateReportJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: GenerateReportJob = parsed.data;
  console.log(
    `[reporting] Generating ${data.reportType} report for org ${data.organizationId}`
  );

  // TODO: Aggregate metrics, generate AI insights via Claude API
}
