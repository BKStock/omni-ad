import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  CompetitorMonitorError,
  CompetitorNotFoundError,
  addCompetitor,
  listCompetitors,
  updateCompetitor,
  removeCompetitor,
  listAlerts,
  acknowledgeAlert,
} from '../../services/competitor-monitor.service.js';
import {
  getImpressionShareTrend,
  findWeakWindows,
  getCompetitivePosition,
} from '../../services/auction-intelligence.service.js';
import {
  AutoCounterError,
  CounterActionNotFoundError,
  listCounterActions,
  rollbackCounterAction,
} from '../../services/auto-counter.service.js';
import { getQueue, QUEUE_NAMES } from '@omni-ad/queue';
import type { CompetitorMonitorJob } from '@omni-ad/queue';
import { organizationProcedure, router } from '../trpc.js';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const AddCompetitorInput = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().min(1).max(500),
  platforms: z.array(z.string()).min(1).optional(),
  keywords: z.array(z.string()).optional(),
  metaPageIds: z.array(z.string()).optional(),
  autoCounterEnabled: z.boolean().optional(),
  counterStrategy: z
    .enum(['aggressive', 'defensive', 'opportunistic'])
    .optional(),
  maxBidIncreasePercent: z.number().int().min(1).max(100).optional(),
  maxBudgetShiftPercent: z.number().int().min(1).max(100).optional(),
});

const UpdateCompetitorInput = z.object({
  competitorId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  domain: z.string().min(1).max(500).optional(),
  platforms: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  metaPageIds: z.array(z.string()).nullable().optional(),
  autoCounterEnabled: z.boolean().optional(),
  counterStrategy: z
    .enum(['aggressive', 'defensive', 'opportunistic'])
    .optional(),
  maxBidIncreasePercent: z.number().int().min(1).max(100).optional(),
  maxBudgetShiftPercent: z.number().int().min(1).max(100).optional(),
});

const CompetitorIdInput = z.object({
  competitorId: z.string().uuid(),
});

const ListAlertsInput = z.object({
  acknowledged: z.boolean().optional(),
  alertType: z
    .enum([
      'impression_share_drop',
      'new_competitor',
      'creative_surge',
      'bid_war',
      'competitor_pause',
      'seasonal_attack',
      'market_shift',
    ])
    .optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

const AlertIdInput = z.object({
  alertId: z.string().uuid(),
});

const TrendInput = z.object({
  days: z.number().int().min(1).max(90).default(30),
});

const WeakWindowsInput = z.object({
  campaignId: z.string().uuid(),
});

const ListCounterActionsInput = z.object({
  status: z
    .enum(['proposed', 'executing', 'executed', 'rolled_back', 'skipped'])
    .optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

const RollbackInput = z.object({
  actionId: z.string().uuid(),
  reason: z.string().min(1).max(1000),
});

// ---------------------------------------------------------------------------
// Error Handler
// ---------------------------------------------------------------------------

function handleServiceError(error: unknown): never {
  if (error instanceof CompetitorNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof CounterActionNotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
    });
  }
  if (error instanceof CompetitorMonitorError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
    });
  }
  if (error instanceof AutoCounterError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
    });
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    cause: error,
  });
}

// ---------------------------------------------------------------------------
// Sub-Routers
// ---------------------------------------------------------------------------

const competitorsRouter = router({
  list: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await listCompetitors(ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),

  add: organizationProcedure
    .input(AddCompetitorInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await addCompetitor(ctx.organizationId, input);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  update: organizationProcedure
    .input(UpdateCompetitorInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const { competitorId, ...rest } = input;
        return await updateCompetitor(
          competitorId,
          ctx.organizationId,
          rest,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),

  remove: organizationProcedure
    .input(CompetitorIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await removeCompetitor(
          input.competitorId,
          ctx.organizationId,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});

const alertsRouter = router({
  list: organizationProcedure
    .input(ListAlertsInput)
    .query(async ({ ctx, input }) => {
      try {
        return await listAlerts(ctx.organizationId, {
          acknowledged: input.acknowledged,
          alertType: input.alertType,
          severity: input.severity,
          limit: input.limit,
          offset: input.offset,
        });
      } catch (error) {
        handleServiceError(error);
      }
    }),

  acknowledge: organizationProcedure
    .input(AlertIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await acknowledgeAlert(input.alertId, ctx.organizationId);
      } catch (error) {
        handleServiceError(error);
      }
    }),
});

const auctionInsightsRouter = router({
  trend: organizationProcedure
    .input(TrendInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getImpressionShareTrend(ctx.organizationId, input.days);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  weakWindows: organizationProcedure
    .input(WeakWindowsInput)
    .query(async ({ ctx, input }) => {
      try {
        return await findWeakWindows(ctx.organizationId, input.campaignId);
      } catch (error) {
        handleServiceError(error);
      }
    }),

  position: organizationProcedure.query(async ({ ctx }) => {
    try {
      return await getCompetitivePosition(ctx.organizationId);
    } catch (error) {
      handleServiceError(error);
    }
  }),
});

const counterActionsRouter = router({
  list: organizationProcedure
    .input(ListCounterActionsInput)
    .query(async ({ ctx, input }) => {
      try {
        return await listCounterActions(ctx.organizationId, {
          status: input.status,
          limit: input.limit,
          offset: input.offset,
        });
      } catch (error) {
        handleServiceError(error);
      }
    }),

  rollback: organizationProcedure
    .input(RollbackInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await rollbackCounterAction(
          input.actionId,
          ctx.organizationId,
          input.reason,
        );
      } catch (error) {
        handleServiceError(error);
      }
    }),
});

// ---------------------------------------------------------------------------
// Main Router
// ---------------------------------------------------------------------------

export const competitiveIntelRouter = router({
  competitors: competitorsRouter,
  alerts: alertsRouter,
  auctionInsights: auctionInsightsRouter,
  counterActions: counterActionsRouter,

  trigger: organizationProcedure.mutation(async ({ ctx }) => {
    try {
      const queue = getQueue(QUEUE_NAMES.COMPETITOR_MONITOR);
      const jobData: CompetitorMonitorJob = {
        organizationId: ctx.organizationId,
      };

      const job = await queue.add(
        `competitor-monitor-${ctx.organizationId}-${Date.now()}`,
        jobData,
      );

      return {
        queued: true,
        jobId: job.id ?? ctx.organizationId,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      handleServiceError(error);
    }
  }),
});
