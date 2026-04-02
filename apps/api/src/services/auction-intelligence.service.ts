/**
 * Auction Intelligence Service
 *
 * Analyzes auction insight data to identify bid patterns, competitor budgets,
 * weak windows, and overall competitive position.
 */

import { db } from '@omni-ad/db';
import {
  auctionInsightSnapshots,
  competitorProfiles,
  metricsDaily,
} from '@omni-ad/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HourlyPattern {
  hour: number;
  avgCpc: number;
  avgImpressionShare: number;
  sampleCount: number;
}

interface DailyPattern {
  dayOfWeek: number;
  dayName: string;
  avgCpc: number;
  avgImpressionShare: number;
  sampleCount: number;
}

export interface BidPatternAnalysis {
  campaignId: string;
  hourlyPatterns: HourlyPattern[];
  dailyPatterns: DailyPattern[];
  weakWindows: WeakWindow[];
  strongWindows: StrongWindow[];
  summary: string;
}

export interface WeakWindow {
  dayOfWeek: number;
  dayName: string;
  hourStart: number;
  hourEnd: number;
  avgCpc: number;
  avgImpressionShare: number;
  opportunityScore: number;
}

interface StrongWindow {
  dayOfWeek: number;
  dayName: string;
  hourStart: number;
  hourEnd: number;
  avgCpc: number;
  avgImpressionShare: number;
}

export interface BudgetEstimate {
  competitorDomain: string;
  dailyRange: { lower: number; upper: number };
  monthlyRange: { lower: number; upper: number };
  confidence: number;
  methodology: string;
}

export interface ImpressionShareTrend {
  dates: string[];
  ourShare: number[];
  competitorShares: Record<string, number[]>;
  trend: 'improving' | 'stable' | 'declining';
}

export interface CompetitivePositionSummary {
  marketShare: number;
  rank: number;
  totalCompetitors: number;
  trend: 'improving' | 'stable' | 'declining';
  topCompetitors: CompetitorPosition[];
  avgCpc: number;
  avgCpcTrend: 'increasing' | 'stable' | 'decreasing';
}

interface CompetitorPosition {
  domain: string;
  estimatedShare: number;
  overlapRate: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AuctionIntelligenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuctionIntelligenceError';
  }
}

// ---------------------------------------------------------------------------
// Bid Pattern Analysis
// ---------------------------------------------------------------------------

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

export async function analyzeBidPatterns(
  organizationId: string,
  campaignId: string,
): Promise<BidPatternAnalysis> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // Fetch snapshots and metrics for the campaign
  const snapshots = await db
    .select()
    .from(auctionInsightSnapshots)
    .where(
      and(
        eq(auctionInsightSnapshots.organizationId, organizationId),
        eq(auctionInsightSnapshots.campaignId, campaignId),
        gte(auctionInsightSnapshots.snapshotDate, thirtyDaysAgo),
      ),
    )
    .orderBy(auctionInsightSnapshots.snapshotDate);

  const metrics = await db
    .select()
    .from(metricsDaily)
    .where(
      and(
        eq(metricsDaily.campaignId, campaignId),
        gte(metricsDaily.date, thirtyDaysAgo),
      ),
    )
    .orderBy(metricsDaily.date);

  // Build hourly patterns from metrics (using date to infer day-of-week)
  const hourlyBuckets = new Map<number, { cpcs: number[]; shares: number[] }>();
  const dailyBuckets = new Map<
    number,
    { cpcs: number[]; shares: number[] }
  >();

  for (const snapshot of snapshots) {
    const date = new Date(snapshot.snapshotDate);
    const dayOfWeek = date.getDay();
    // Approximate hourly distribution from daily data
    const cpc = snapshot.avgCpc ?? 0;
    const share = snapshot.impressionShare;

    // Daily aggregation
    const dailyEntry = dailyBuckets.get(dayOfWeek) ?? {
      cpcs: [],
      shares: [],
    };
    dailyEntry.cpcs.push(cpc);
    dailyEntry.shares.push(share);
    dailyBuckets.set(dayOfWeek, dailyEntry);
  }

  // Since we only have daily snapshots, derive hourly patterns from metrics
  // In production, this would use hourly reporting data
  for (const metric of metrics) {
    const date = new Date(metric.date);
    const hour = date.getHours();
    const cpc =
      metric.clicks > 0 ? Number(metric.spend) / metric.clicks : 0;
    const entry = hourlyBuckets.get(hour) ?? { cpcs: [], shares: [] };
    entry.cpcs.push(cpc);
    hourlyBuckets.set(hour, entry);
  }

  const hourlyPatterns: HourlyPattern[] = Array.from(
    { length: 24 },
    (_, hour) => {
      const bucket = hourlyBuckets.get(hour);
      return {
        hour,
        avgCpc: bucket ? avg(bucket.cpcs) : 0,
        avgImpressionShare: bucket ? avg(bucket.shares) : 0,
        sampleCount: bucket?.cpcs.length ?? 0,
      };
    },
  );

  const dailyPatterns: DailyPattern[] = Array.from(
    { length: 7 },
    (_, day) => {
      const bucket = dailyBuckets.get(day);
      return {
        dayOfWeek: day,
        dayName: DAY_NAMES[day] ?? '',
        avgCpc: bucket ? avg(bucket.cpcs) : 0,
        avgImpressionShare: bucket ? avg(bucket.shares) : 0,
        sampleCount: bucket?.cpcs.length ?? 0,
      };
    },
  );

  // Identify weak windows (low CPC, reasonable impression share)
  const overallAvgCpc = avg(
    dailyPatterns.filter((d) => d.sampleCount > 0).map((d) => d.avgCpc),
  );
  const weakWindows = findWeakWindowsFromPatterns(dailyPatterns, overallAvgCpc);
  const strongWindows = findStrongWindowsFromPatterns(
    dailyPatterns,
    overallAvgCpc,
  );

  const summary = buildPatternSummary(
    weakWindows,
    strongWindows,
    overallAvgCpc,
  );

  return {
    campaignId,
    hourlyPatterns,
    dailyPatterns,
    weakWindows,
    strongWindows,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Competitor Budget Estimation
// ---------------------------------------------------------------------------

export async function estimateCompetitorBudget(
  organizationId: string,
  competitorDomain: string,
): Promise<BudgetEstimate> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // Get snapshots mentioning this competitor
  const snapshots = await db
    .select()
    .from(auctionInsightSnapshots)
    .where(
      and(
        eq(auctionInsightSnapshots.organizationId, organizationId),
        eq(auctionInsightSnapshots.competitorDomain, competitorDomain),
        gte(auctionInsightSnapshots.snapshotDate, thirtyDaysAgo),
      ),
    );

  if (snapshots.length === 0) {
    return {
      competitorDomain,
      dailyRange: { lower: 0, upper: 0 },
      monthlyRange: { lower: 0, upper: 0 },
      confidence: 0,
      methodology: 'データ不足のため推定不可',
    };
  }

  // Estimate based on overlap rate and our spend
  const avgOverlap = avg(
    snapshots.map((s) => s.overlapRate).filter(isNotNull),
  );
  const avgOurCpc = avg(
    snapshots.map((s) => s.avgCpc).filter(isNotNull),
  );
  // Rough estimation: if competitor overlaps X% of our auctions
  // and our avg CPC is Y, their daily budget ~ (overlap * our_budget_proxy * competitor_share)
  const competitorShareEstimate = avgOverlap > 0 ? avgOverlap : 0.3;
  const ourDailySpendEstimate = avgOurCpc * 100; // proxy

  const dailyLower = ourDailySpendEstimate * competitorShareEstimate * 0.7;
  const dailyUpper = ourDailySpendEstimate * competitorShareEstimate * 1.5;

  const confidence = Math.min(
    0.8,
    snapshots.length / 30 + (avgOverlap > 0 ? 0.2 : 0),
  );

  return {
    competitorDomain,
    dailyRange: {
      lower: Math.round(dailyLower),
      upper: Math.round(dailyUpper),
    },
    monthlyRange: {
      lower: Math.round(dailyLower * 30),
      upper: Math.round(dailyUpper * 30),
    },
    confidence,
    methodology:
      'オーバーラップ率とインプレッションシェアに基づく推定。精度はデータ量に依存します。',
  };
}

// ---------------------------------------------------------------------------
// Impression Share Trend
// ---------------------------------------------------------------------------

export async function getImpressionShareTrend(
  organizationId: string,
  days: number,
): Promise<ImpressionShareTrend> {
  const startDate = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const snapshots = await db
    .select()
    .from(auctionInsightSnapshots)
    .where(
      and(
        eq(auctionInsightSnapshots.organizationId, organizationId),
        gte(auctionInsightSnapshots.snapshotDate, startDate),
      ),
    )
    .orderBy(auctionInsightSnapshots.snapshotDate);

  // Group by date
  const byDate = new Map<
    string,
    { ourShares: number[]; competitors: Map<string, number[]> }
  >();

  for (const snapshot of snapshots) {
    const dateKey = snapshot.snapshotDate;
    const entry = byDate.get(dateKey) ?? {
      ourShares: [],
      competitors: new Map<string, number[]>(),
    };

    entry.ourShares.push(snapshot.impressionShare);

    if (snapshot.competitorDomain) {
      const compShares =
        entry.competitors.get(snapshot.competitorDomain) ?? [];
      if (snapshot.outrankingShare !== null) {
        compShares.push(snapshot.outrankingShare);
      }
      entry.competitors.set(snapshot.competitorDomain, compShares);
    }

    byDate.set(dateKey, entry);
  }

  const dates: string[] = [];
  const ourShare: number[] = [];
  const competitorShares: Record<string, number[]> = {};

  for (const [dateKey, entry] of byDate) {
    dates.push(dateKey);
    ourShare.push(avg(entry.ourShares));

    for (const [domain, shares] of entry.competitors) {
      if (!competitorShares[domain]) {
        competitorShares[domain] = [];
      }
      competitorShares[domain].push(avg(shares));
    }
  }

  // Determine trend from first half vs second half
  const midpoint = Math.floor(ourShare.length / 2);
  const firstHalf = ourShare.slice(0, midpoint);
  const secondHalf = ourShare.slice(midpoint);
  const firstAvg = avg(firstHalf);
  const secondAvg = avg(secondHalf);

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (firstAvg > 0) {
    const change = (secondAvg - firstAvg) / firstAvg;
    if (change > 0.03) trend = 'improving';
    else if (change < -0.03) trend = 'declining';
  }

  return { dates, ourShare, competitorShares, trend };
}

// ---------------------------------------------------------------------------
// Weak Windows
// ---------------------------------------------------------------------------

export async function findWeakWindows(
  organizationId: string,
  campaignId: string,
): Promise<WeakWindow[]> {
  const analysis = await analyzeBidPatterns(organizationId, campaignId);
  return analysis.weakWindows;
}

// ---------------------------------------------------------------------------
// Competitive Position
// ---------------------------------------------------------------------------

export async function getCompetitivePosition(
  organizationId: string,
): Promise<CompetitivePositionSummary> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // Recent snapshots
  const recentSnapshots = await db
    .select()
    .from(auctionInsightSnapshots)
    .where(
      and(
        eq(auctionInsightSnapshots.organizationId, organizationId),
        gte(auctionInsightSnapshots.snapshotDate, sevenDaysAgo),
      ),
    );

  // Prior period for trend
  const priorSnapshots = await db
    .select()
    .from(auctionInsightSnapshots)
    .where(
      and(
        eq(auctionInsightSnapshots.organizationId, organizationId),
        gte(auctionInsightSnapshots.snapshotDate, fourteenDaysAgo),
        sql`${auctionInsightSnapshots.snapshotDate} < ${sevenDaysAgo}`,
      ),
    );

  // Get known competitors
  const competitors = await db
    .select()
    .from(competitorProfiles)
    .where(
      and(
        eq(competitorProfiles.organizationId, organizationId),
        eq(competitorProfiles.active, true),
      ),
    );

  // Calculate current position
  const currentShare = avg(recentSnapshots.map((s) => s.impressionShare));
  const priorShare = avg(priorSnapshots.map((s) => s.impressionShare));
  const currentCpc = avg(
    recentSnapshots.map((s) => s.avgCpc).filter(isNotNull),
  );
  const priorCpc = avg(
    priorSnapshots.map((s) => s.avgCpc).filter(isNotNull),
  );

  // Trend
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (priorShare > 0) {
    const shareChange = (currentShare - priorShare) / priorShare;
    if (shareChange > 0.03) trend = 'improving';
    else if (shareChange < -0.03) trend = 'declining';
  }

  let avgCpcTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (priorCpc > 0) {
    const cpcChange = (currentCpc - priorCpc) / priorCpc;
    if (cpcChange > 0.05) avgCpcTrend = 'increasing';
    else if (cpcChange < -0.05) avgCpcTrend = 'decreasing';
  }

  // Build competitor position list
  const competitorDomains = new Set(
    recentSnapshots
      .map((s) => s.competitorDomain)
      .filter(isNotNull),
  );

  const topCompetitors: CompetitorPosition[] = [];
  for (const domain of competitorDomains) {
    const domainSnapshots = recentSnapshots.filter(
      (s) => s.competitorDomain === domain,
    );
    topCompetitors.push({
      domain,
      estimatedShare: avg(
        domainSnapshots.map((s) => s.outrankingShare).filter(isNotNull),
      ),
      overlapRate: avg(
        domainSnapshots.map((s) => s.overlapRate).filter(isNotNull),
      ),
    });
  }

  topCompetitors.sort((a, b) => b.estimatedShare - a.estimatedShare);

  // Estimate rank (1-based, we are typically in the mix)
  const higherShareCount = topCompetitors.filter(
    (c) => c.estimatedShare > currentShare,
  ).length;
  const rank = higherShareCount + 1;

  return {
    marketShare: currentShare,
    rank,
    totalCompetitors: competitorDomains.size + competitors.length,
    trend,
    topCompetitors: topCompetitors.slice(0, 10),
    avgCpc: currentCpc,
    avgCpcTrend,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function findWeakWindowsFromPatterns(
  dailyPatterns: DailyPattern[],
  overallAvgCpc: number,
): WeakWindow[] {
  const windows: WeakWindow[] = [];

  for (const pattern of dailyPatterns) {
    if (pattern.sampleCount === 0) continue;

    // Weak = CPC below average AND reasonable impression share
    if (pattern.avgCpc < overallAvgCpc * 0.85 && pattern.avgImpressionShare > 0.3) {
      const opportunityScore =
        (1 - pattern.avgCpc / (overallAvgCpc || 1)) *
        pattern.avgImpressionShare *
        100;

      windows.push({
        dayOfWeek: pattern.dayOfWeek,
        dayName: pattern.dayName,
        hourStart: 0,
        hourEnd: 23,
        avgCpc: pattern.avgCpc,
        avgImpressionShare: pattern.avgImpressionShare,
        opportunityScore: Math.round(opportunityScore * 10) / 10,
      });
    }
  }

  return windows.sort((a, b) => b.opportunityScore - a.opportunityScore);
}

function findStrongWindowsFromPatterns(
  dailyPatterns: DailyPattern[],
  overallAvgCpc: number,
): StrongWindow[] {
  const windows: StrongWindow[] = [];

  for (const pattern of dailyPatterns) {
    if (pattern.sampleCount === 0) continue;

    // Strong = CPC above average (competitor bidding aggressively)
    if (pattern.avgCpc > overallAvgCpc * 1.15) {
      windows.push({
        dayOfWeek: pattern.dayOfWeek,
        dayName: pattern.dayName,
        hourStart: 0,
        hourEnd: 23,
        avgCpc: pattern.avgCpc,
        avgImpressionShare: pattern.avgImpressionShare,
      });
    }
  }

  return windows.sort((a, b) => b.avgCpc - a.avgCpc);
}

function buildPatternSummary(
  weakWindows: WeakWindow[],
  strongWindows: StrongWindow[],
  overallAvgCpc: number,
): string {
  const parts: string[] = [];

  parts.push(`平均CPC: ¥${overallAvgCpc.toFixed(0)}`);

  if (weakWindows.length > 0) {
    const topWeak = weakWindows[0];
    if (topWeak) {
      parts.push(
        `最適な出稿タイミング: ${topWeak.dayName}曜日 (CPC ¥${topWeak.avgCpc.toFixed(0)}, IS ${(topWeak.avgImpressionShare * 100).toFixed(1)}%)`,
      );
    }
  }

  if (strongWindows.length > 0) {
    const topStrong = strongWindows[0];
    if (topStrong) {
      parts.push(
        `競合が強い曜日: ${topStrong.dayName}曜日 (CPC ¥${topStrong.avgCpc.toFixed(0)})`,
      );
    }
  }

  return parts.join('。');
}
