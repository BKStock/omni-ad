import { db } from '@omni-ad/db';
import { auditLog } from '@omni-ad/db/schema';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type {
  GenerateReportJob,
  ComputeAttributionJob,
} from '@omni-ad/queue';
import { and, desc, eq } from 'drizzle-orm';

type AuditLogSelect = typeof auditLog.$inferSelect;

interface GenerateReportInput {
  reportType: GenerateReportJob['reportType'];
  startDate: string;
  endDate: string;
  platforms?: GenerateReportJob['platforms'];
  includeInsights: boolean;
}

interface AttributionInput {
  modelType: ComputeAttributionJob['modelType'];
  startDate: string;
  endDate: string;
}

export async function generateReport(
  input: GenerateReportInput,
  organizationId: string,
): Promise<{ jobId: string }> {
  const queue = getQueue(QUEUE_NAMES.REPORTING);
  const jobData: GenerateReportJob = {
    organizationId,
    reportType: input.reportType,
    startDate: input.startDate,
    endDate: input.endDate,
    platforms: input.platforms,
    includeInsights: input.includeInsights,
  };

  const job = await queue.add(
    `report-${organizationId}-${input.reportType}-${Date.now()}`,
    jobData,
  );

  return { jobId: job.id ?? organizationId };
}

export async function computeAttribution(
  input: AttributionInput,
  organizationId: string,
): Promise<{ jobId: string }> {
  const queue = getQueue(QUEUE_NAMES.REPORTING);
  const jobData: ComputeAttributionJob = {
    organizationId,
    modelType: input.modelType,
    startDate: input.startDate,
    endDate: input.endDate,
  };

  const job = await queue.add(
    `attribution-${organizationId}-${input.modelType}-${Date.now()}`,
    jobData,
  );

  return { jobId: job.id ?? organizationId };
}

export async function listAuditLogs(
  organizationId: string,
  entityType?: string,
  limit = 50,
): Promise<AuditLogSelect[]> {
  const conditions = [eq(auditLog.organizationId, organizationId)];
  if (entityType) {
    conditions.push(eq(auditLog.entityType, entityType));
  }

  return db
    .select()
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(auditLog.timestamp))
    .limit(limit);
}
