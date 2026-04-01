/**
 * Report Generator Service
 *
 * Compiles metrics, AI insights, and per-platform breakdowns
 * into structured report data. Supports daily/weekly/monthly reports
 * with AI-generated summaries via Claude API.
 */

import { db } from '@omni-ad/db';
import { campaigns, metricsDaily } from '@omni-ad/db/schema';
import { and, between, eq, sql, desc } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ReportParams {
  organizationId: string;
  reportType: ReportType;
  startDate: string;
  endDate: string;
  platforms?: string[];
  includeInsights?: boolean;
}

export interface Report {
  id: string;
  organizationId: string;
  reportType: ReportType;
  period: { start: string; end: string };
  generatedAt: string;
  summary: ReportSummary;
  platformBreakdown: PlatformReport[];
  topCampaigns: CampaignReport[];
  bottomCampaigns: CampaignReport[];
  budgetEfficiency: BudgetEfficiencyAnalysis;
  aiSummary: string | null;
  recommendations: string[];
}

export interface ReportSummary {
  totalSpend: number;
  totalRevenue: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  overallRoas: number;
  overallCtr: number;
  overallCpc: number;
  overallCpa: number;
  spendChange: number;
  revenueChange: number;
  roasChange: number;
  activeCampaigns: number;
}

export interface PlatformReport {
  platform: string;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpa: number;
  spendShare: number;
  revenueShare: number;
}

export interface CampaignReport {
  campaignId: string;
  campaignName: string;
  spend: number;
  revenue: number;
  roas: number;
  ctr: number;
  conversions: number;
  status: string;
}

export interface BudgetEfficiencyAnalysis {
  totalBudget: number;
  actualSpend: number;
  utilizationRate: number;
  wastedSpend: number;
  efficientPlatforms: string[];
  inefficientPlatforms: string[];
}

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

/**
 * Generate a structured report for the given parameters.
 */
export async function generateReport(params: ReportParams): Promise<Report> {
  const { organizationId, reportType, startDate, endDate, includeInsights = true } = params;

  // Fetch metrics for the current period
  const currentMetrics = await fetchAggregatedMetrics(organizationId, startDate, endDate);

  // Fetch metrics for the comparison period (same duration, prior period)
  const periodDays = daysBetween(startDate, endDate);
  const priorEnd = subtractDays(startDate, 1);
  const priorStart = subtractDays(formatDate(priorEnd), periodDays - 1);
  const priorMetrics = await fetchAggregatedMetrics(
    organizationId,
    formatDate(priorStart),
    formatDate(priorEnd),
  );

  // Platform breakdown
  const platformBreakdown = await fetchPlatformBreakdown(organizationId, startDate, endDate);

  // Campaign performance
  const campaignPerformance = await fetchCampaignPerformance(organizationId, startDate, endDate);

  // Sort campaigns by ROAS
  const sortedByRoas = [...campaignPerformance].sort((a, b) => b.roas - a.roas);
  const topCampaigns = sortedByRoas.slice(0, 5);
  const bottomCampaigns = sortedByRoas.slice(-5).reverse();

  // Build summary with period-over-period changes
  const summary = buildSummary(currentMetrics, priorMetrics);

  // Budget efficiency analysis
  const budgetEfficiency = analyzeBudgetEfficiency(platformBreakdown);

  // AI summary
  let aiSummary: string | null = null;
  const recommendations: string[] = [];

  if (includeInsights) {
    const insightResult = await generateAiSummary(summary, platformBreakdown, topCampaigns, bottomCampaigns);
    aiSummary = insightResult.summary;
    recommendations.push(...insightResult.recommendations);
  }

  // Add rule-based recommendations as fallback
  const ruleRecommendations = generateRuleBasedRecommendations(summary, platformBreakdown, budgetEfficiency);
  for (const rec of ruleRecommendations) {
    if (!recommendations.includes(rec)) {
      recommendations.push(rec);
    }
  }

  return {
    id: crypto.randomUUID(),
    organizationId,
    reportType,
    period: { start: startDate, end: endDate },
    generatedAt: new Date().toISOString(),
    summary,
    platformBreakdown,
    topCampaigns,
    bottomCampaigns,
    budgetEfficiency,
    aiSummary,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Data Fetching
// ---------------------------------------------------------------------------

interface AggregatedMetrics {
  totalSpend: number;
  totalRevenue: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  activeCampaigns: number;
}

async function fetchAggregatedMetrics(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<AggregatedMetrics> {
  const orgCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.organizationId, organizationId));

  if (orgCampaigns.length === 0) {
    return {
      totalSpend: 0,
      totalRevenue: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      activeCampaigns: 0,
    };
  }

  const activeCampaigns = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        eq(campaigns.status, 'active'),
      ),
    );

  const [result] = await db
    .select({
      totalSpend: sql<string>`COALESCE(SUM(${metricsDaily.spend}), 0)::numeric(14,2)::text`,
      totalRevenue: sql<string>`COALESCE(SUM(${metricsDaily.revenue}), 0)::numeric(14,2)::text`,
      totalImpressions: sql<number>`COALESCE(SUM(${metricsDaily.impressions}), 0)::int`,
      totalClicks: sql<number>`COALESCE(SUM(${metricsDaily.clicks}), 0)::int`,
      totalConversions: sql<number>`COALESCE(SUM(${metricsDaily.conversions}), 0)::int`,
    })
    .from(metricsDaily)
    .innerJoin(campaigns, eq(metricsDaily.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        between(metricsDaily.date, startDate, endDate),
      ),
    );

  return {
    totalSpend: Number(result?.totalSpend ?? '0'),
    totalRevenue: Number(result?.totalRevenue ?? '0'),
    totalImpressions: result?.totalImpressions ?? 0,
    totalClicks: result?.totalClicks ?? 0,
    totalConversions: result?.totalConversions ?? 0,
    activeCampaigns: activeCampaigns[0]?.count ?? 0,
  };
}

async function fetchPlatformBreakdown(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<PlatformReport[]> {
  const rows = await db
    .select({
      platform: metricsDaily.platform,
      spend: sql<string>`COALESCE(SUM(${metricsDaily.spend}), 0)::numeric(14,2)::text`,
      revenue: sql<string>`COALESCE(SUM(${metricsDaily.revenue}), 0)::numeric(14,2)::text`,
      impressions: sql<number>`COALESCE(SUM(${metricsDaily.impressions}), 0)::int`,
      clicks: sql<number>`COALESCE(SUM(${metricsDaily.clicks}), 0)::int`,
      conversions: sql<number>`COALESCE(SUM(${metricsDaily.conversions}), 0)::int`,
    })
    .from(metricsDaily)
    .innerJoin(campaigns, eq(metricsDaily.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        between(metricsDaily.date, startDate, endDate),
      ),
    )
    .groupBy(metricsDaily.platform);

  const totalSpend = rows.reduce((sum, r) => sum + Number(r.spend), 0);
  const totalRevenue = rows.reduce((sum, r) => sum + Number(r.revenue), 0);

  return rows.map((row) => {
    const spend = Number(row.spend);
    const revenue = Number(row.revenue);
    return {
      platform: row.platform,
      spend,
      revenue,
      impressions: row.impressions,
      clicks: row.clicks,
      conversions: row.conversions,
      roas: spend > 0 ? revenue / spend : 0,
      ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
      cpc: row.clicks > 0 ? spend / row.clicks : 0,
      cpa: row.conversions > 0 ? spend / row.conversions : 0,
      spendShare: totalSpend > 0 ? spend / totalSpend : 0,
      revenueShare: totalRevenue > 0 ? revenue / totalRevenue : 0,
    };
  });
}

async function fetchCampaignPerformance(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<CampaignReport[]> {
  const rows = await db
    .select({
      campaignId: metricsDaily.campaignId,
      campaignName: campaigns.name,
      campaignStatus: campaigns.status,
      spend: sql<string>`COALESCE(SUM(${metricsDaily.spend}), 0)::numeric(14,2)::text`,
      revenue: sql<string>`COALESCE(SUM(${metricsDaily.revenue}), 0)::numeric(14,2)::text`,
      impressions: sql<number>`COALESCE(SUM(${metricsDaily.impressions}), 0)::int`,
      clicks: sql<number>`COALESCE(SUM(${metricsDaily.clicks}), 0)::int`,
      conversions: sql<number>`COALESCE(SUM(${metricsDaily.conversions}), 0)::int`,
    })
    .from(metricsDaily)
    .innerJoin(campaigns, eq(metricsDaily.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        between(metricsDaily.date, startDate, endDate),
      ),
    )
    .groupBy(metricsDaily.campaignId, campaigns.name, campaigns.status)
    .orderBy(desc(sql`SUM(${metricsDaily.spend})`))
    .limit(50);

  return rows.map((row) => {
    const spend = Number(row.spend);
    const revenue = Number(row.revenue);
    return {
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      spend,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
      ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
      conversions: row.conversions,
      status: row.campaignStatus,
    };
  });
}

// ---------------------------------------------------------------------------
// Analysis Helpers
// ---------------------------------------------------------------------------

function buildSummary(
  current: AggregatedMetrics,
  prior: AggregatedMetrics,
): ReportSummary {
  const overallRoas = current.totalSpend > 0 ? current.totalRevenue / current.totalSpend : 0;
  const priorRoas = prior.totalSpend > 0 ? prior.totalRevenue / prior.totalSpend : 0;

  return {
    totalSpend: current.totalSpend,
    totalRevenue: current.totalRevenue,
    totalImpressions: current.totalImpressions,
    totalClicks: current.totalClicks,
    totalConversions: current.totalConversions,
    overallRoas,
    overallCtr: current.totalImpressions > 0 ? current.totalClicks / current.totalImpressions : 0,
    overallCpc: current.totalClicks > 0 ? current.totalSpend / current.totalClicks : 0,
    overallCpa: current.totalConversions > 0 ? current.totalSpend / current.totalConversions : 0,
    spendChange: computePercentChange(prior.totalSpend, current.totalSpend),
    revenueChange: computePercentChange(prior.totalRevenue, current.totalRevenue),
    roasChange: computePercentChange(priorRoas, overallRoas),
    activeCampaigns: current.activeCampaigns,
  };
}

function computePercentChange(previous: number, current: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function analyzeBudgetEfficiency(platforms: PlatformReport[]): BudgetEfficiencyAnalysis {
  const totalSpend = platforms.reduce((sum, p) => sum + p.spend, 0);

  // Consider a platform efficient if its ROAS > 1
  const efficientPlatforms = platforms
    .filter((p) => p.roas > 1)
    .map((p) => p.platform);

  const inefficientPlatforms = platforms
    .filter((p) => p.roas > 0 && p.roas < 1)
    .map((p) => p.platform);

  // Wasted spend = spend on platforms with ROAS < 1, beyond breakeven
  const wastedSpend = platforms
    .filter((p) => p.roas > 0 && p.roas < 1)
    .reduce((sum, p) => sum + (p.spend - p.revenue), 0);

  return {
    totalBudget: totalSpend,
    actualSpend: totalSpend,
    utilizationRate: 1.0, // Placeholder: actual budget vs allocated budget
    wastedSpend: Math.max(0, wastedSpend),
    efficientPlatforms,
    inefficientPlatforms,
  };
}

// ---------------------------------------------------------------------------
// AI Summary Generation (Claude API)
// ---------------------------------------------------------------------------

interface AiInsightResult {
  summary: string;
  recommendations: string[];
}

interface InsightOutput {
  summary: string;
  recommendations: string[];
}

const CLAUDE_INSIGHT_TOOL_SCHEMA = {
  name: 'output_report_insights',
  description: 'Output report summary and recommendations as structured JSON',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Executive summary in Japanese' },
      recommendations: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of actionable recommendations in Japanese',
      },
    },
    required: ['summary', 'recommendations'],
  },
};

async function generateAiSummary(
  summary: ReportSummary,
  platforms: PlatformReport[],
  topCampaigns: CampaignReport[],
  bottomCampaigns: CampaignReport[],
): Promise<AiInsightResult> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    return { summary: '', recommendations: [] };
  }

  const systemPrompt = [
    'あなたはデジタル広告運用の専門アナリストです。',
    'マーケティングレポートデータを分析し、経営層向けのサマリーと実行可能な改善提案を日本語で作成してください。',
    '数値の変化を具体的に指摘し、原因の仮説と対策を提示してください。',
  ].join('\n');

  const userPrompt = [
    '## レポートサマリー',
    `- 総支出: ${summary.totalSpend.toLocaleString()}円 (前期比: ${summary.spendChange.toFixed(1)}%)`,
    `- 総売上: ${summary.totalRevenue.toLocaleString()}円 (前期比: ${summary.revenueChange.toFixed(1)}%)`,
    `- ROAS: ${summary.overallRoas.toFixed(2)} (前期比: ${summary.roasChange.toFixed(1)}%)`,
    `- CTR: ${(summary.overallCtr * 100).toFixed(2)}%`,
    `- CPC: ${summary.overallCpc.toFixed(0)}円`,
    `- CPA: ${summary.overallCpa.toFixed(0)}円`,
    '',
    '## プラットフォーム別',
    ...platforms.map(
      (p) => `- ${p.platform}: 支出${p.spend.toLocaleString()}円, ROAS ${p.roas.toFixed(2)}, シェア${(p.spendShare * 100).toFixed(1)}%`,
    ),
    '',
    '## トップキャンペーン',
    ...topCampaigns.map(
      (c) => `- ${c.campaignName}: ROAS ${c.roas.toFixed(2)}, 支出${c.spend.toLocaleString()}円`,
    ),
    '',
    '## 改善が必要なキャンペーン',
    ...bottomCampaigns.map(
      (c) => `- ${c.campaignName}: ROAS ${c.roas.toFixed(2)}, 支出${c.spend.toLocaleString()}円`,
    ),
  ].join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        tools: [CLAUDE_INSIGHT_TOOL_SCHEMA],
        tool_choice: { type: 'tool', name: 'output_report_insights' },
      }),
    });

    if (!response.ok) {
      return { summary: '', recommendations: [] };
    }

    const body = (await response.json()) as Record<string, unknown>;
    const content = body['content'] as unknown[];

    for (const block of content) {
      const b = block as Record<string, unknown>;
      if (b['type'] === 'tool_use' && b['name'] === 'output_report_insights') {
        const input = b['input'] as InsightOutput;
        return {
          summary: input.summary,
          recommendations: input.recommendations,
        };
      }
    }

    return { summary: '', recommendations: [] };
  } catch {
    return { summary: '', recommendations: [] };
  }
}

// ---------------------------------------------------------------------------
// Rule-Based Recommendations
// ---------------------------------------------------------------------------

function generateRuleBasedRecommendations(
  summary: ReportSummary,
  platforms: PlatformReport[],
  efficiency: BudgetEfficiencyAnalysis,
): string[] {
  const recommendations: string[] = [];

  // ROAS declining
  if (summary.roasChange < -10) {
    recommendations.push(
      `ROASが前期比${Math.abs(summary.roasChange).toFixed(1)}%低下しています。低パフォーマンスのキャンペーンの予算を高パフォーマンスのプラットフォームに再配分することを検討してください。`,
    );
  }

  // High CPA
  if (summary.overallCpa > 0 && summary.overallRoas < 1) {
    recommendations.push(
      `全体のROASが1.0を下回っています（${summary.overallRoas.toFixed(2)}）。ターゲティングの見直しとクリエイティブの最適化が必要です。`,
    );
  }

  // Inefficient platforms
  if (efficiency.inefficientPlatforms.length > 0) {
    recommendations.push(
      `以下のプラットフォームのROASが1.0未満です: ${efficiency.inefficientPlatforms.join('、')}。予算の再配分または一時停止を検討してください。`,
    );
  }

  // Spend concentration risk
  const highSharePlatforms = platforms.filter((p) => p.spendShare > 0.6);
  if (highSharePlatforms.length > 0) {
    const platformNames = highSharePlatforms.map((p) => p.platform).join('、');
    recommendations.push(
      `広告費の60%以上が${platformNames}に集中しています。リスク分散のため、他のプラットフォームへの分散投資を検討してください。`,
    );
  }

  // Low CTR
  if (summary.overallCtr < 0.005 && summary.totalImpressions > 10000) {
    recommendations.push(
      `CTRが${(summary.overallCtr * 100).toFixed(2)}%と低水準です。クリエイティブの刷新とターゲティングの精度向上を優先してください。`,
    );
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Date Helpers
// ---------------------------------------------------------------------------

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

function subtractDays(dateStr: string, days: number): Date {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - days);
  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
