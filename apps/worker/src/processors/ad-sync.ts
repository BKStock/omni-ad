import { syncCampaignJobSchema, type SyncCampaignJob } from '@omni-ad/queue';

export async function processAdSync(job: { name: string; data: unknown }): Promise<void> {
  const parsed = syncCampaignJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: SyncCampaignJob = parsed.data;
  console.log(
    `[ad-sync] Processing ${data.direction} sync for ${data.platform} (org: ${data.organizationId})`
  );

  // TODO: Implement platform sync via adapter
}
