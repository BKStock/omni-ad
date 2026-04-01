import { generateTextJobSchema, type GenerateTextJob } from '@omni-ad/queue';

export async function processCreativeGeneration(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = generateTextJobSchema.safeParse(job.data);
  if (!parsed.success) {
    console.log(`[creative-generation] Job type: ${job.name}, skipping schema validation for non-text jobs`);
    return;
  }

  const data: GenerateTextJob = parsed.data;
  console.log(
    `[creative-generation] Generating ${data.variantCount} variants for campaign ${data.campaignId}`
  );

  // TODO: Implement AI creative generation pipeline (text -> image -> video -> adapt)
}
