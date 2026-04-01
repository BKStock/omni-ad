/**
 * AI Insights Generator
 *
 * Uses Claude API to generate actionable insights
 * from cross-channel marketing data.
 */

export interface InsightInput {
  organizationId: string;
  metricsLast7Days: PlatformMetrics[];
  budgetHistory: BudgetSnapshot[];
  topCreatives: CreativePerformance[];
  attributionData: ChannelAttribution[];
}

export interface PlatformMetrics {
  platform: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  roas: number;
  trend: 'up' | 'down' | 'stable';
}

export interface BudgetSnapshot {
  date: string;
  allocations: Record<string, number>;
  totalRoas: number;
}

export interface CreativePerformance {
  creativeId: string;
  platform: string;
  ctr: number;
  cvr: number;
  roas: number;
}

export interface ChannelAttribution {
  channel: string;
  credit: number;
  touchpoints: number;
}

export type InsightType = 'opportunity' | 'warning' | 'achievement';
export type InsightSeverity = 'high' | 'medium' | 'low';

export interface Insight {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  explanation: string;
  recommendation: string;
  estimatedImpact: {
    roasChange: number;
    revenueChange: number;
  } | null;
  actionType: string | null;
}

export async function generateInsights(
  _input: InsightInput
): Promise<Insight[]> {
  // TODO: Implement with Claude API (structured output via tool_use)
  // Send aggregated metrics, budget history, creative performance, attribution
  // Request JSON array of Insight objects
  throw new Error('Not implemented: AI insights generation - requires Claude API');
}
