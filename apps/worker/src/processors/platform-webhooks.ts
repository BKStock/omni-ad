import { processWebhookJobSchema, type ProcessWebhookJob } from '@omni-ad/queue';

export async function processPlatformWebhook(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = processWebhookJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: ProcessWebhookJob = parsed.data;
  console.log(
    `[platform-webhooks] Processing ${data.eventType} from ${data.platform}`
  );

  // TODO: Route to appropriate handler based on platform + event type
}
