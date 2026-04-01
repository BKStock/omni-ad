import { db } from '@omni-ad/db';
import { campaigns, metricsDaily } from '@omni-ad/db/schema';
import { and, between, eq, sql } from 'drizzle-orm';

interface AggregatedMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: string;
  revenue: string;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export interface OverviewResult extends AggregatedMetrics {
  campaignCount: number;
}

export interface PlatformMetrics extends AggregatedMetrics {
  platform: string;
}

export interface CampaignMetrics extends AggregatedMetrics {
  campaignId: string;
  campaignName: string;
}

export async function getOverview(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<OverviewResult> {
  // Get campaign IDs for the org to scope metrics
  const orgCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.organizationId, organizationId));

  if (orgCampaigns.length === 0) {
    return {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: '0.00',
      revenue: '0.00',
      ctr: 0,
      cpc: 0,
      cpa: 0,
      roas: 0,
      campaignCount: 0,
    };
  }

  const [result] = await db
    .select({
      impressions: sql<number>`COALESCE(SUM(${metricsDaily.impressions}), 0)::int`,
      clicks: sql<number>`COALESCE(SUM(${metricsDaily.clicks}), 0)::int`,
      conversions: sql<number>`COALESCE(SUM(${metricsDaily.conversions}), 0)::int`,
      spend: sql<string>`COALESCE(SUM(${metricsDaily.spend}), 0)::numeric(14,2)::text`,
      revenue: sql<string>`COALESCE(SUM(${metricsDaily.revenue}), 0)::numeric(14,2)::text`,
    })
    .from(metricsDaily)
    .innerJoin(campaigns, eq(metricsDaily.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        between(metricsDaily.date, startDate, endDate),
      ),
    );

  const impressions = result?.impressions ?? 0;
  const clicks = result?.clicks ?? 0;
  const conversions = result?.conversions ?? 0;
  const spend = result?.spend ?? '0.00';
  const revenue = result?.revenue ?? '0.00';
  const spendNum = Number(spend);
  const revenueNum = Number(revenue);

  return {
    impressions,
    clicks,
    conversions,
    spend,
    revenue,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? spendNum / clicks : 0,
    cpa: conversions > 0 ? spendNum / conversions : 0,
    roas: spendNum > 0 ? revenueNum / spendNum : 0,
    campaignCount: orgCampaigns.length,
  };
}

export async function getByPlatform(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<PlatformMetrics[]> {
  const rows = await db
    .select({
      platform: metricsDaily.platform,
      impressions: sql<number>`COALESCE(SUM(${metricsDaily.impressions}), 0)::int`,
      clicks: sql<number>`COALESCE(SUM(${metricsDaily.clicks}), 0)::int`,
      conversions: sql<number>`COALESCE(SUM(${metricsDaily.conversions}), 0)::int`,
      spend: sql<string>`COALESCE(SUM(${metricsDaily.spend}), 0)::numeric(14,2)::text`,
      revenue: sql<string>`COALESCE(SUM(${metricsDaily.revenue}), 0)::numeric(14,2)::text`,
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

  return rows.map((row) => {
    const spendNum = Number(row.spend);
    const revenueNum = Number(row.revenue);
    return {
      platform: row.platform,
      impressions: row.impressions,
      clicks: row.clicks,
      conversions: row.conversions,
      spend: row.spend,
      revenue: row.revenue,
      ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
      cpc: row.clicks > 0 ? spendNum / row.clicks : 0,
      cpa: row.conversions > 0 ? spendNum / row.conversions : 0,
      roas: spendNum > 0 ? revenueNum / spendNum : 0,
    };
  });
}

export async function getByCampaign(
  organizationId: string,
  startDate: string,
  endDate: string,
  limit = 20,
): Promise<CampaignMetrics[]> {
  const rows = await db
    .select({
      campaignId: metricsDaily.campaignId,
      campaignName: campaigns.name,
      impressions: sql<number>`COALESCE(SUM(${metricsDaily.impressions}), 0)::int`,
      clicks: sql<number>`COALESCE(SUM(${metricsDaily.clicks}), 0)::int`,
      conversions: sql<number>`COALESCE(SUM(${metricsDaily.conversions}), 0)::int`,
      spend: sql<string>`COALESCE(SUM(${metricsDaily.spend}), 0)::numeric(14,2)::text`,
      revenue: sql<string>`COALESCE(SUM(${metricsDaily.revenue}), 0)::numeric(14,2)::text`,
    })
    .from(metricsDaily)
    .innerJoin(campaigns, eq(metricsDaily.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        between(metricsDaily.date, startDate, endDate),
      ),
    )
    .groupBy(metricsDaily.campaignId, campaigns.name)
    .orderBy(sql`SUM(${metricsDaily.spend}) DESC`)
    .limit(limit);

  return rows.map((row) => {
    const spendNum = Number(row.spend);
    const revenueNum = Number(row.revenue);
    return {
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      impressions: row.impressions,
      clicks: row.clicks,
      conversions: row.conversions,
      spend: row.spend,
      revenue: row.revenue,
      ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
      cpc: row.clicks > 0 ? spendNum / row.clicks : 0,
      cpa: row.conversions > 0 ? spendNum / row.conversions : 0,
      roas: spendNum > 0 ? revenueNum / spendNum : 0,
    };
  });
}
