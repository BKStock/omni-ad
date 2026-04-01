import { z } from 'zod';
import { Platform } from '../types/platform.js';

// ── Shared primitives ──────────────────────────────────────────────────────

const platformSchema = z.nativeEnum(Platform);

const campaignObjectiveSchema = z.enum([
  'awareness',
  'traffic',
  'engagement',
  'leads',
  'conversion',
  'retargeting',
]);

export const targetingConfigSchema = z.object({
  ageMin: z.number().int().min(13).max(65).nullable(),
  ageMax: z.number().int().min(13).max(65).nullable(),
  genders: z.array(z.enum(['male', 'female', 'all'])),
  locations: z.array(z.string()),
  interests: z.array(z.string()),
  customAudiences: z.array(z.string()),
  excludedAudiences: z.array(z.string()),
  languages: z.array(z.string()),
  devices: z.array(z.enum(['mobile', 'desktop', 'tablet', 'all'])),
  placements: z.array(z.string()),
});

// ── Campaign schemas ───────────────────────────────────────────────────────

export const createCampaignSchema = z
  .object({
    organizationId: z.string().uuid(),
    name: z.string().min(1).max(255),
    objective: campaignObjectiveSchema,
    startDate: z.coerce.date(),
    endDate: z.coerce.date().nullable(),
    totalBudget: z.number().positive(),
    dailyBudget: z.number().positive(),
    platforms: z.array(platformSchema).min(1),
  })
  .refine(
    (data) => data.endDate === null || data.endDate > data.startDate,
    { message: '終了日は開始日より後である必要があります', path: ['endDate'] },
  );

export const updateCampaignSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    objective: campaignObjectiveSchema.optional(),
    status: z
      .enum(['draft', 'active', 'paused', 'completed', 'error'])
      .optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().nullable().optional(),
    totalBudget: z.number().positive().optional(),
    dailyBudget: z.number().positive().optional(),
    platforms: z.array(platformSchema).min(1).optional(),
  })
  .refine(
    (data) =>
      data.endDate === undefined ||
      data.endDate === null ||
      data.startDate === undefined ||
      data.endDate > data.startDate,
    { message: '終了日は開始日より後である必要があります', path: ['endDate'] },
  );

// ── Metrics schemas ────────────────────────────────────────────────────────

export const metricsQuerySchema = z
  .object({
    campaignId: z.string().uuid().optional(),
    adGroupId: z.string().uuid().optional(),
    platform: platformSchema.optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    granularity: z.enum(['hourly', 'daily', 'weekly', 'monthly']),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: '終了日は開始日以降である必要があります',
    path: ['endDate'],
  });

// ── Audience schemas ───────────────────────────────────────────────────────

const audienceRuleSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['is', 'is_not', 'contains', 'gt', 'lt']),
  value: z.union([z.string(), z.number()]),
});

const audienceDefinitionSchema = z.object({
  type: z.enum(['custom', 'lookalike', 'saved']),
  source: z.string().nullable(),
  rules: z.array(audienceRuleSchema),
});

export const createAudienceSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  platform: platformSchema,
  externalId: z.string().nullable(),
  size: z.number().int().min(0),
  definition: audienceDefinitionSchema,
});

// ── Budget schemas ─────────────────────────────────────────────────────────

const platformAllocationSchema = z.record(
  z.nativeEnum(Platform),
  z.number().min(0),
);

export const budgetAllocationSchema = z.object({
  organizationId: z.string().uuid(),
  date: z.coerce.date(),
  allocations: platformAllocationSchema,
  totalBudget: z.number().positive(),
  predictedRoas: z.number().min(0).nullable(),
  actualRoas: z.number().min(0).nullable(),
  algorithmVersion: z.string().min(1),
});

// ── Inferred input types ───────────────────────────────────────────────────

export type CreateCampaignSchemaInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignSchemaInput = z.infer<typeof updateCampaignSchema>;
export type MetricsQuerySchemaInput = z.infer<typeof metricsQuerySchema>;
export type CreateAudienceSchemaInput = z.infer<typeof createAudienceSchema>;
export type BudgetAllocationSchemaInput = z.infer<typeof budgetAllocationSchema>;
export type TargetingConfigSchemaInput = z.infer<typeof targetingConfigSchema>;
