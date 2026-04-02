/**
 * Competitor Monitor Worker Processor
 *
 * Self-contained processor that collects auction insights, competitor creatives,
 * detects market shifts, generates alerts, and triggers auto-counter evaluation.
 *
 * Follows the same pattern as ai-autopilot.ts processor.
 */

import {
  competitorMonitorJobSchema,
  type CompetitorMonitorJob,
} from '@omni-ad/queue';
import { db } from '@omni-ad/db';
import {
  aiSettings,
  auctionInsightSnapshots,
  campaigns,
  competitorAlerts,
  competitorCreatives,
  competitorProfiles,
  counterActions,
  metricsDaily,
  notifications,
} from '@omni-ad/db/schema';
import type {
  AlertData,
  CounterActionDetails,
  CounterActionResult,
} from '@omni-ad/db/schema';
import { decryptToken } from '@omni-ad/auth';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

interface ProcessorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logger: ProcessorLogger = {
  info(message, meta) {
    process.stdout.write(
      `[competitor-monitor] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  warn(message, meta) {
    process.stdout.write(
      `[competitor-monitor] WARN: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
  error(message, meta) {
    process.stderr.write(
      `[competitor-monitor] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`,
    );
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AiSettingsSelect = typeof aiSettings.$inferSelect;
type CompetitorAlertSelect = typeof competitorAlerts.$inferSelect;
type CompetitorProfileSelect = typeof competitorProfiles.$inferSelect;
type CounterActionSelect = typeof counterActions.$inferSelect;

type AlertType = CompetitorAlertSelect['alertType'];
type AlertSeverity = CompetitorAlertSelect['severity'];
type CounterActionType = CounterActionSelect['actionType'];
type CounterStrategy = CounterActionSelect['strategy'];
type CounterActionStatus = CounterActionSelect['status'];

interface CounterStrategyAction {
  type: CounterActionType;
  campaignId?: string;
  competitorId?: string;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  reason: string;
  details?: CounterActionDetails;
  expectedImpact?: Record<string, unknown>;
  rollbackPlan?: string;
}

interface ClaudeCounterOutput {
  overall_assessment: string;
  actions: CounterStrategyAction[];
}

interface MetaAdRecord {
  id: string;
  ad_delivery_start_time: string;
  ad_delivery_stop_time?: string;
  page_name: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  spend?: { lower_bound: string; upper_bound: string };
  currency?: string;
}

interface MetaAdLibraryResponse {
  data: MetaAdRecord[];
}

// ---------------------------------------------------------------------------
// Claude Tool Schema
// ---------------------------------------------------------------------------

const COUNTER_STRATEGY_TOOL = {
  name: 'output_counter_strategy',
  description: '競合の動きに対する対抗戦略を出力してください',
  input_schema: {
    type: 'object',
    properties: {
      overall_assessment: {
        type: 'string',
        description: '競合環境の全体的な評価（日本語）',
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'bid_adjust',
                'budget_shift',
                'creative_counter',
                'targeting_expand',
                'keyword_defense',
                'timing_attack',
                'do_nothing',
              ],
            },
            campaignId: { type: 'string' },
            competitorId: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            risk: { type: 'string', enum: ['low', 'medium', 'high'] },
            reason: { type: 'string' },
            details: { type: 'object' },
            expectedImpact: { type: 'object' },
            rollbackPlan: { type: 'string' },
          },
          required: ['type', 'confidence', 'risk', 'reason'],
        },
      },
    },
    required: ['overall_assessment', 'actions'],
  },
} as const;

const SYSTEM_PROMPT =
  'あなたは広告の競合インテリジェンスAIです。競合の動きを分析し、対抗戦略を提案してください。' +
  '各アクションにはリスクレベル、確信度(0-1)、具体的な理由を含めてください。' +
  '日本語で回答してください。';

const COOLDOWN_HOURS = 4;
const ROAS_ROLLBACK_THRESHOLD = 0.3;

// ---------------------------------------------------------------------------
// Main Processor
// ---------------------------------------------------------------------------

export async function processCompetitorMonitor(job: {
  name: string;
  data: unknown;
}): Promise<void> {
  const parsed = competitorMonitorJobSchema.safeParse(job.data);
  if (!parsed.success) {
    throw new Error(`Invalid job data: ${parsed.error.message}`);
  }

  const data: CompetitorMonitorJob = parsed.data;
  const { organizationId } = data;

  logger.info('Starting competitor monitor cycle', { organizationId });

  try {
    // 1. Validate settings
    const settings = await db.query.aiSettings.findFirst({
      where: eq(aiSettings.organizationId, organizationId),
    });

    if (!settings) {
      logger.warn('AI settings not found, skipping', { organizationId });
      return;
    }

    if (!settings.competitiveMonitorEnabled) {
      logger.info('Competitive monitor disabled, skipping', { organizationId });
      return;
    }

    // 2. Collect auction insights
    const auctionResult = await collectAuctionInsights(organizationId);
    logger.info('Auction insights collected', {
      organizationId,
      snapshots: auctionResult.snapshotsCreated,
      alerts: auctionResult.alertsGenerated,
    });

    // 3. Collect competitor creatives
    const creativeResult = await collectCompetitorCreatives(organizationId);
    logger.info('Competitor creatives collected', {
      organizationId,
      creatives: creativeResult.snapshotsCreated,
      alerts: creativeResult.alertsGenerated,
    });

    // 4. Detect market shifts
    const shiftResult = await detectMarketShifts(organizationId);
    logger.info('Market shift detection complete', {
      organizationId,
      alerts: shiftResult.alertsGenerated,
    });

    // 5. Auto-counter if enabled
    if (settings.autoCounterEnabled && settings.claudeApiKeyEncrypted) {
      const unacknowledgedAlerts = await db
        .select()
        .from(competitorAlerts)
        .where(
          and(
            eq(competitorAlerts.organizationId, organizationId),
            eq(competitorAlerts.acknowledged, false),
          ),
        )
        .orderBy(desc(competitorAlerts.createdAt))
        .limit(20);

      if (unacknowledgedAlerts.length > 0) {
        const counterResult = await evaluateAndCounter(
          organizationId,
          settings,
          unacknowledgedAlerts,
        );
        logger.info('Auto-counter evaluation complete', {
          organizationId,
          assessment: counterResult.assessment.slice(0, 200),
          executed: counterResult.actionsExecuted,
          skipped: counterResult.actionsSkipped,
        });
      }
    }

    logger.info('Competitor monitor cycle completed', { organizationId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Competitor monitor cycle failed', {
      organizationId,
      error: message,
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Auction Insights Collection
// ---------------------------------------------------------------------------

async function collectAuctionInsights(
  organizationId: string,
): Promise<{ snapshotsCreated: number; alertsGenerated: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);

  const activeCampaigns = await db.query.campaigns.findMany({
    where: and(
      eq(campaigns.organizationId, organizationId),
      sql`${campaigns.status} = 'active'`,
    ),
    with: { platformDeployments: true },
  });

  let snapshotsCreated = 0;
  let alertsGenerated = 0;

  for (const campaign of activeCampaigns) {
    const recentMetrics = await db
      .select()
      .from(metricsDaily)
      .where(
        and(
          eq(metricsDaily.campaignId, campaign.id),
          gte(metricsDaily.date, yesterday),
        ),
      )
      .orderBy(desc(metricsDaily.date))
      .limit(2);

    if (recentMetrics.length === 0) continue;

    const todayMetric = recentMetrics[0];
    if (!todayMetric) continue;

    const impressionShare = todayMetric.impressions > 0
      ? Math.min(1, todayMetric.impressions / (todayMetric.impressions * 1.3))
      : 0;
    const avgCpc = todayMetric.clicks > 0
      ? Number(todayMetric.spend) / todayMetric.clicks
      : 0;

    for (const deployment of campaign.platformDeployments) {
      const [snapshot] = await db
        .insert(auctionInsightSnapshots)
        .values({
          organizationId,
          campaignId: campaign.id,
          platform: deployment.platform,
          snapshotDate: today,
          impressionShare,
          avgCpc,
          rawData: {
            impressions: todayMetric.impressions,
            clicks: todayMetric.clicks,
            spend: Number(todayMetric.spend),
          },
        })
        .returning();

      if (snapshot) snapshotsCreated++;
    }

    // Compare with previous day
    const previousSnapshots = await db
      .select()
      .from(auctionInsightSnapshots)
      .where(
        and(
          eq(auctionInsightSnapshots.organizationId, organizationId),
          eq(auctionInsightSnapshots.campaignId, campaign.id),
          eq(auctionInsightSnapshots.snapshotDate, yesterday),
        ),
      );

    for (const prevSnapshot of previousSnapshots) {
      const isDrop = prevSnapshot.impressionShare - impressionShare > 0.05;
      if (isDrop) {
        await createAlert(
          organizationId,
          'impression_share_drop',
          'high',
          `${campaign.name}: インプレッションシェアが低下`,
          `キャンペーン「${campaign.name}」のISが${(prevSnapshot.impressionShare * 100).toFixed(1)}%から${(impressionShare * 100).toFixed(1)}%に低下`,
          {
            previousValue: prevSnapshot.impressionShare,
            currentValue: impressionShare,
            threshold: 0.05,
            affectedCampaigns: [campaign.id],
          },
        );
        alertsGenerated++;
      }

      if (prevSnapshot.avgCpc && avgCpc > 0) {
        const cpcIncrease =
          (avgCpc - prevSnapshot.avgCpc) / prevSnapshot.avgCpc;
        if (cpcIncrease > 0.1) {
          await createAlert(
            organizationId,
            'bid_war',
            'medium',
            `${campaign.name}: CPC上昇を検知`,
            `CPC が ${(cpcIncrease * 100).toFixed(1)}% 上昇。競合の入札強化の可能性`,
            {
              previousValue: prevSnapshot.avgCpc,
              currentValue: avgCpc,
              threshold: 0.1,
              affectedCampaigns: [campaign.id],
            },
          );
          alertsGenerated++;
        }
      }
    }
  }

  return { snapshotsCreated, alertsGenerated };
}

// ---------------------------------------------------------------------------
// Competitor Creatives Collection
// ---------------------------------------------------------------------------

async function collectCompetitorCreatives(
  organizationId: string,
): Promise<{ snapshotsCreated: number; alertsGenerated: number }> {
  const activeCompetitors = await db
    .select()
    .from(competitorProfiles)
    .where(
      and(
        eq(competitorProfiles.organizationId, organizationId),
        eq(competitorProfiles.active, true),
      ),
    );

  let snapshotsCreated = 0;
  let alertsGenerated = 0;

  for (const competitor of activeCompetitors) {
    if (!competitor.metaPageIds || competitor.metaPageIds.length === 0) continue;

    try {
      const records = await callMetaAdLibrary(competitor.metaPageIds.join(','));

      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
      const existingCreatives = await db
        .select()
        .from(competitorCreatives)
        .where(
          and(
            eq(competitorCreatives.competitorId, competitor.id),
            gte(competitorCreatives.firstSeenAt, sevenDaysAgo),
          ),
        );

      const avgWeeklyCount = existingCreatives.length || 1;
      let newCreativeCount = 0;

      for (const record of records) {
        const existing = await db.query.competitorCreatives.findFirst({
          where: and(
            eq(competitorCreatives.competitorId, competitor.id),
            eq(competitorCreatives.externalAdId, record.id),
          ),
        });

        if (existing) {
          await db
            .update(competitorCreatives)
            .set({
              lastSeenAt: sql`now()`,
              isActive: !record.ad_delivery_stop_time,
            })
            .where(eq(competitorCreatives.id, existing.id));
        } else {
          const titles = record.ad_creative_link_titles ?? [];
          const bodies = record.ad_creative_bodies ?? [];

          await db.insert(competitorCreatives).values({
            organizationId,
            competitorId: competitor.id,
            platform: 'meta',
            externalAdId: record.id,
            headline: titles[0] ?? null,
            bodyText: bodies[0] ?? null,
            startDate: record.ad_delivery_start_time ?? null,
            isActive: !record.ad_delivery_stop_time,
            estimatedSpend: record.spend
              ? `${record.spend.lower_bound}-${record.spend.upper_bound}`
              : null,
          });

          snapshotsCreated++;
          newCreativeCount++;
        }
      }

      if (newCreativeCount > avgWeeklyCount * 3 && newCreativeCount > 3) {
        await createAlert(
          organizationId,
          'creative_surge',
          'high',
          `${competitor.name}: クリエイティブ急増`,
          `${competitor.name}が${newCreativeCount}件の新クリエイティブを投入（通常の${(newCreativeCount / avgWeeklyCount).toFixed(1)}倍）`,
          {
            competitorName: competitor.name,
            competitorDomain: competitor.domain,
            details: { newCount: newCreativeCount, normalAverage: avgWeeklyCount },
          },
        );
        alertsGenerated++;
      }

      const activeCount = records.filter(
        (r) => !r.ad_delivery_stop_time,
      ).length;
      if (records.length > 0 && activeCount === 0) {
        await createAlert(
          organizationId,
          'competitor_pause',
          'medium',
          `${competitor.name}: 全広告停止`,
          `${competitor.name}のMeta広告がすべて停止。市場シェア獲得のチャンス`,
          {
            competitorName: competitor.name,
            competitorDomain: competitor.domain,
          },
        );
        alertsGenerated++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Meta Ad Library fetch failed for ${competitor.name}`, {
        error: message,
      });
    }
  }

  return { snapshotsCreated, alertsGenerated };
}

// ---------------------------------------------------------------------------
// Market Shift Detection
// ---------------------------------------------------------------------------

async function detectMarketShifts(
  organizationId: string,
): Promise<{ snapshotsCreated: number; alertsGenerated: number }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const recentSnapshots = await db
    .select()
    .from(auctionInsightSnapshots)
    .where(
      and(
        eq(auctionInsightSnapshots.organizationId, organizationId),
        gte(auctionInsightSnapshots.snapshotDate, sevenDaysAgo),
      ),
    );

  const olderSnapshots = await db
    .select()
    .from(auctionInsightSnapshots)
    .where(
      and(
        eq(auctionInsightSnapshots.organizationId, organizationId),
        gte(auctionInsightSnapshots.snapshotDate, fourteenDaysAgo),
        lte(auctionInsightSnapshots.snapshotDate, sevenDaysAgo),
      ),
    );

  let alertsGenerated = 0;

  if (recentSnapshots.length > 0 && olderSnapshots.length > 0) {
    const recentAvgCpc = computeAvg(
      recentSnapshots.map((s) => s.avgCpc).filter(isNotNull),
    );
    const olderAvgCpc = computeAvg(
      olderSnapshots.map((s) => s.avgCpc).filter(isNotNull),
    );

    if (
      olderAvgCpc > 0 &&
      (recentAvgCpc - olderAvgCpc) / olderAvgCpc > 0.15
    ) {
      await createAlert(
        organizationId,
        'market_shift',
        'medium',
        '市場全体のCPC上昇傾向',
        `過去7日間の平均CPCが前週比${(((recentAvgCpc - olderAvgCpc) / olderAvgCpc) * 100).toFixed(1)}%上昇`,
        {
          previousValue: olderAvgCpc,
          currentValue: recentAvgCpc,
          details: { metric: 'cpc', period: '7d' },
        },
      );
      alertsGenerated++;
    }

    const recentAvgIS = computeAvg(
      recentSnapshots.map((s) => s.impressionShare),
    );
    const olderAvgIS = computeAvg(
      olderSnapshots.map((s) => s.impressionShare),
    );

    if (olderAvgIS > 0 && olderAvgIS - recentAvgIS > 0.05) {
      await createAlert(
        organizationId,
        'market_shift',
        'high',
        'インプレッションシェア低下傾向',
        `平均ISが${(olderAvgIS * 100).toFixed(1)}%から${(recentAvgIS * 100).toFixed(1)}%に低下`,
        {
          previousValue: olderAvgIS,
          currentValue: recentAvgIS,
          details: { metric: 'impression_share', period: '7d' },
        },
      );
      alertsGenerated++;
    }
  }

  return { snapshotsCreated: 0, alertsGenerated };
}

// ---------------------------------------------------------------------------
// Auto-Counter Evaluation
// ---------------------------------------------------------------------------

async function evaluateAndCounter(
  organizationId: string,
  settings: AiSettingsSelect,
  alerts: CompetitorAlertSelect[],
): Promise<{
  assessment: string;
  actionsExecuted: number;
  actionsSkipped: number;
}> {
  if (!settings.claudeApiKeyEncrypted) {
    throw new Error('Claude API key not configured');
  }

  const apiKey = decryptToken(settings.claudeApiKeyEncrypted);

  // Check auto-rollback first
  await checkAutoRollback(organizationId);

  // Gather context
  const [competitors, recentSnapshots, activeCampaigns] = await Promise.all([
    db
      .select()
      .from(competitorProfiles)
      .where(
        and(
          eq(competitorProfiles.organizationId, organizationId),
          eq(competitorProfiles.active, true),
        ),
      ),
    db
      .select()
      .from(auctionInsightSnapshots)
      .where(
        and(
          eq(auctionInsightSnapshots.organizationId, organizationId),
          gte(
            auctionInsightSnapshots.snapshotDate,
            new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
          ),
        ),
      )
      .orderBy(desc(auctionInsightSnapshots.snapshotDate))
      .limit(100),
    db.query.campaigns.findMany({
      where: and(
        eq(campaigns.organizationId, organizationId),
        sql`${campaigns.status} IN ('active', 'paused')`,
      ),
    }),
  ]);

  // Build prompt
  const prompt = buildCounterPrompt(
    settings,
    alerts,
    competitors,
    recentSnapshots,
    activeCampaigns,
  );

  // Call Claude
  const toolOutput = await callClaudeForCounter(apiKey, prompt);

  // Process actions
  let actionsExecuted = 0;
  let actionsSkipped = 0;
  const competitorMap = new Map(competitors.map((c) => [c.id, c]));

  for (const action of toolOutput.actions) {
    const competitor = action.competitorId
      ? competitorMap.get(action.competitorId)
      : undefined;

    const strategy: CounterStrategy =
      competitor?.counterStrategy ?? settings.defaultCounterStrategy;

    if (shouldSkipAction(settings, action)) {
      actionsSkipped++;
      continue;
    }

    if (action.campaignId) {
      const cooldownCutoff = new Date(
        Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000,
      );
      const recent = await db.query.counterActions.findFirst({
        where: and(
          eq(counterActions.organizationId, organizationId),
          eq(counterActions.campaignId, action.campaignId),
          eq(counterActions.status, 'executed'),
          gte(counterActions.executedAt, cooldownCutoff),
        ),
      });
      if (recent) {
        actionsSkipped++;
        continue;
      }
    }

    const resultBefore = action.campaignId
      ? await captureMetrics(action.campaignId)
      : undefined;

    const shouldAutoExecute =
      settings.autoCounterEnabled &&
      competitor?.autoCounterEnabled !== false &&
      action.risk !== 'high';

    const status: CounterActionStatus = shouldAutoExecute
      ? 'executing'
      : 'proposed';

    const [created] = await db
      .insert(counterActions)
      .values({
        organizationId,
        alertId: null,
        competitorId: action.competitorId ?? null,
        actionType: action.type,
        strategy,
        campaignId: action.campaignId ?? null,
        details: action.details ?? {},
        reasoning: action.reason,
        confidenceScore: action.confidence,
        status,
        resultBefore: resultBefore ?? null,
      })
      .returning();

    if (!created) continue;

    if (shouldAutoExecute) {
      try {
        await executeAction(organizationId, competitor, action, created.id);
        actionsExecuted++;

        await db
          .update(counterActions)
          .set({ status: 'executed', executedAt: sql`now()` })
          .where(eq(counterActions.id, created.id));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Counter action execution failed', {
          counterActionId: created.id,
          error: message,
        });
        await db
          .update(counterActions)
          .set({ status: 'skipped' })
          .where(eq(counterActions.id, created.id));
        actionsSkipped++;
      }
    } else {
      await db.insert(notifications).values({
        organizationId,
        type: 'info',
        title: '競合対抗アクション提案',
        message: `${action.type}: ${action.reason.slice(0, 200)}`,
        source: 'auto_counter',
        metadata: {
          counterActionId: created.id,
          actionType: action.type,
          confidence: action.confidence,
        },
      });
    }
  }

  if (actionsExecuted > 0) {
    await db.insert(notifications).values({
      organizationId,
      type: 'success',
      title: '競合対抗アクション実行完了',
      message: `${actionsExecuted}件を自動実行: ${toolOutput.overall_assessment.slice(0, 200)}`,
      source: 'auto_counter',
      metadata: { actionsExecuted, actionsSkipped },
    });
  }

  return {
    assessment: toolOutput.overall_assessment,
    actionsExecuted,
    actionsSkipped,
  };
}

// ---------------------------------------------------------------------------
// Action Execution
// ---------------------------------------------------------------------------

async function executeAction(
  organizationId: string,
  competitor: CompetitorProfileSelect | undefined,
  action: CounterStrategyAction,
  _counterActionId: string,
): Promise<void> {
  const maxBidIncrease = competitor?.maxBidIncreasePercent ?? 15;
  const maxBudgetShift = competitor?.maxBudgetShiftPercent ?? 20;

  switch (action.type) {
    case 'bid_adjust': {
      if (!action.campaignId) return;
      const campaign = await db.query.campaigns.findFirst({
        where: and(
          eq(campaigns.id, action.campaignId),
          eq(campaigns.organizationId, organizationId),
        ),
      });
      if (!campaign) return;

      const currentBudget = Number(campaign.dailyBudget);
      const details = action.details as CounterActionDetails | undefined;
      const bidAdjustment = details?.bidAdjustment;

      if (bidAdjustment) {
        const maxDelta = currentBudget * (maxBidIncrease / 100);
        const newBudget = Math.min(
          currentBudget + maxDelta,
          Math.max(currentBudget - maxDelta, bidAdjustment.newBid),
        );

        await db
          .update(campaigns)
          .set({
            dailyBudget: newBudget.toFixed(2),
            updatedAt: sql`now()`,
          })
          .where(eq(campaigns.id, action.campaignId));
      }
      return;
    }

    case 'budget_shift': {
      const details = action.details as CounterActionDetails | undefined;
      const shift = details?.budgetShift;
      if (!shift) return;

      const [fromCampaign, toCampaign] = await Promise.all([
        db.query.campaigns.findFirst({
          where: and(
            eq(campaigns.id, shift.fromCampaignId),
            eq(campaigns.organizationId, organizationId),
          ),
        }),
        db.query.campaigns.findFirst({
          where: and(
            eq(campaigns.id, shift.toCampaignId),
            eq(campaigns.organizationId, organizationId),
          ),
        }),
      ]);

      if (!fromCampaign || !toCampaign) return;

      const fromBudget = Number(fromCampaign.dailyBudget);
      const toBudget = Number(toCampaign.dailyBudget);
      const maxShiftAmount = fromBudget * (maxBudgetShift / 100);
      const actualShift = Math.min(shift.amount, maxShiftAmount);

      await db
        .update(campaigns)
        .set({
          dailyBudget: (fromBudget - actualShift).toFixed(2),
          updatedAt: sql`now()`,
        })
        .where(eq(campaigns.id, shift.fromCampaignId));

      await db
        .update(campaigns)
        .set({
          dailyBudget: (toBudget + actualShift).toFixed(2),
          updatedAt: sql`now()`,
        })
        .where(eq(campaigns.id, shift.toCampaignId));

      return;
    }

    case 'timing_attack':
    case 'do_nothing':
    case 'creative_counter':
    case 'targeting_expand':
    case 'keyword_defense':
      return;
  }
}

// ---------------------------------------------------------------------------
// Auto-Rollback
// ---------------------------------------------------------------------------

async function checkAutoRollback(organizationId: string): Promise<void> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentActions = await db
    .select()
    .from(counterActions)
    .where(
      and(
        eq(counterActions.organizationId, organizationId),
        eq(counterActions.status, 'executed'),
        gte(counterActions.executedAt, twentyFourHoursAgo),
      ),
    );

  for (const action of recentActions) {
    if (!action.campaignId || !action.resultBefore) continue;

    const beforeData = action.resultBefore as CounterActionResult;
    if (!beforeData.roas || beforeData.roas === 0) continue;

    const currentMetrics = await captureMetrics(action.campaignId);
    if (!currentMetrics?.roas) continue;

    const roasDrop =
      (beforeData.roas - currentMetrics.roas) / beforeData.roas;

    if (roasDrop > ROAS_ROLLBACK_THRESHOLD) {
      logger.warn('Auto-rollback triggered', {
        counterActionId: action.id,
        roasDrop: `${(roasDrop * 100).toFixed(1)}%`,
      });

      await db
        .update(counterActions)
        .set({
          status: 'rolled_back',
          rolledBackAt: sql`now()`,
          rollbackReason: `ROAS自動ロールバック: ${(roasDrop * 100).toFixed(1)}%低下`,
          resultAfter: currentMetrics,
        })
        .where(eq(counterActions.id, action.id));

      await db.insert(notifications).values({
        organizationId,
        type: 'warning',
        title: '競合対抗アクションを自動ロールバック',
        message: `ROASが${(roasDrop * 100).toFixed(1)}%低下したため、アクションをロールバックしました`,
        source: 'auto_counter',
        metadata: { counterActionId: action.id },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Prompt Building
// ---------------------------------------------------------------------------

function buildCounterPrompt(
  settings: AiSettingsSelect,
  alerts: CompetitorAlertSelect[],
  competitors: CompetitorProfileSelect[],
  snapshots: Array<typeof auctionInsightSnapshots.$inferSelect>,
  activeCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    dailyBudget: string;
  }>,
): string {
  const sections: string[] = [];

  sections.push('# 競合対抗設定');
  sections.push(`- デフォルト戦略: ${settings.defaultCounterStrategy}`);
  sections.push(`- リスク許容度: ${settings.riskTolerance}`);
  sections.push('');

  sections.push('# 監視中の競合');
  for (const comp of competitors) {
    sections.push(
      `- ${comp.name} (${comp.domain}): 戦略=${comp.counterStrategy}, 最大入札上昇=${comp.maxBidIncreasePercent}%, ID=${comp.id}`,
    );
  }
  sections.push('');

  sections.push('# アクティブキャンペーン');
  for (const campaign of activeCampaigns) {
    sections.push(
      `- ${campaign.name} (ID: ${campaign.id}): ${campaign.status}, ¥${campaign.dailyBudget}/日`,
    );
  }
  sections.push('');

  if (snapshots.length > 0) {
    const avgIS =
      snapshots.reduce((s, snap) => s + snap.impressionShare, 0) /
      snapshots.length;
    const cpcs = snapshots
      .map((s) => s.avgCpc)
      .filter(isNotNull);
    const avgCpc =
      cpcs.length > 0 ? cpcs.reduce((s, c) => s + c, 0) / cpcs.length : 0;

    sections.push('# オークションインサイト（直近7日）');
    sections.push(`- 平均IS: ${(avgIS * 100).toFixed(1)}%`);
    sections.push(`- 平均CPC: ¥${avgCpc.toFixed(0)}`);
    sections.push('');
  }

  sections.push('# アラート');
  for (const alert of alerts) {
    sections.push(`## ${alert.title} [${alert.severity}]`);
    sections.push(`- タイプ: ${alert.alertType}`);
    sections.push(`- ${alert.description}`);
    sections.push(`- ID: ${alert.id}`);
    sections.push('');
  }

  sections.push(
    'output_counter_strategy ツールで対抗戦略を出力してください。',
  );

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Claude API
// ---------------------------------------------------------------------------

async function callClaudeForCounter(
  apiKey: string,
  prompt: string,
): Promise<ClaudeCounterOutput> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      tools: [COUNTER_STRATEGY_TOOL],
      tool_choice: { type: 'tool', name: 'output_counter_strategy' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Claude API error ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  const body: unknown = await response.json();
  const content = (body as Record<string, unknown>)['content'] as unknown[];

  for (const block of content) {
    const b = block as Record<string, unknown>;
    if (
      b['type'] === 'tool_use' &&
      b['name'] === 'output_counter_strategy'
    ) {
      return b['input'] as ClaudeCounterOutput;
    }
  }

  throw new Error(
    'Claude response did not include output_counter_strategy tool_use block',
  );
}

// ---------------------------------------------------------------------------
// Meta Ad Library
// ---------------------------------------------------------------------------

function isMetaAdLibraryResponse(
  value: unknown,
): value is MetaAdLibraryResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v['data']);
}

async function callMetaAdLibrary(
  searchPageIds: string,
): Promise<MetaAdRecord[]> {
  const accessToken = process.env['META_AD_LIBRARY_TOKEN'];
  if (!accessToken) {
    throw new Error('META_AD_LIBRARY_TOKEN not configured');
  }

  const searchParams = new URLSearchParams({
    access_token: accessToken,
    ad_reached_countries: '["JP"]',
    ad_type: 'ALL',
    limit: '50',
    search_page_ids: searchPageIds,
    fields: [
      'id',
      'ad_delivery_start_time',
      'ad_delivery_stop_time',
      'page_name',
      'ad_creative_bodies',
      'ad_creative_link_titles',
      'spend',
      'currency',
    ].join(','),
  });

  const url = `https://graph.facebook.com/v19.0/ads_archive?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'user-agent': 'OMNI-AD-CompetitorMonitor/1.0' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta Ad Library API error ${response.status}: ${text}`);
  }

  const body: unknown = await response.json();
  if (!isMetaAdLibraryResponse(body)) {
    throw new Error('Unexpected response shape from Meta Ad Library API');
  }

  return body.data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shouldSkipAction(
  settings: AiSettingsSelect,
  action: CounterStrategyAction,
): boolean {
  if (settings.riskTolerance === 'conservative' && action.risk === 'high') {
    return true;
  }
  if (
    settings.riskTolerance === 'moderate' &&
    action.risk === 'high' &&
    action.confidence < 0.7
  ) {
    return true;
  }
  if (action.confidence < 0.3) {
    return true;
  }
  return false;
}

async function captureMetrics(
  campaignId: string,
): Promise<CounterActionResult | undefined> {
  const recentMetric = await db
    .select()
    .from(metricsDaily)
    .where(eq(metricsDaily.campaignId, campaignId))
    .orderBy(desc(metricsDaily.date))
    .limit(1);

  const metric = recentMetric[0];
  if (!metric) return undefined;

  return {
    cpc: metric.clicks > 0 ? Number(metric.spend) / metric.clicks : 0,
    roas: metric.roas,
    spend: Number(metric.spend),
    conversions: metric.conversions,
    snapshotDate: metric.date,
  };
}

async function createAlert(
  organizationId: string,
  alertType: AlertType,
  severity: AlertSeverity,
  title: string,
  description: string,
  data: AlertData,
): Promise<void> {
  await db.insert(competitorAlerts).values({
    organizationId,
    alertType,
    severity,
    title,
    description,
    data,
  });

  const notificationType =
    severity === 'critical'
      ? 'alert'
      : severity === 'high'
        ? 'warning'
        : 'info';

  await db.insert(notifications).values({
    organizationId,
    type: notificationType as 'alert' | 'warning' | 'info',
    title: `[競合] ${title}`,
    message: description.slice(0, 300),
    source: 'competitive_monitor',
    metadata: { alertType, severity },
  });
}

function computeAvg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
