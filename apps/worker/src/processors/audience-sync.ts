import { syncAudienceJobSchema, type SyncAudienceJob } from '@omni-ad/queue';

export async function processAudienceSync(job: { name: string; data: unknown }): Promise<void> {
  const parsed = syncAudienceJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: SyncAudienceJob = parsed.data;
  console.log(
    `[audience-sync] Syncing audience ${data.audienceId} to ${data.platform}`
  );

  // TODO: Sync audience via platform adapter
}
