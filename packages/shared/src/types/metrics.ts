import { type Platform } from './platform.js';

export interface NormalizedMetrics {
  timestamp: Date;
  campaignId: string;
  adGroupId: string | null;
  adId: string | null;
  platform: Platform;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export interface MetricsQuery {
  campaignId?: string;
  adGroupId?: string;
  platform?: Platform;
  startDate: Date;
  endDate: Date;
  granularity: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface RealtimeMetrics {
  campaignId: string;
  platform: Platform;
  impressionsToday: number;
  clicksToday: number;
  conversionsToday: number;
  spendToday: number;
  revenueToday: number;
  lastUpdated: Date;
}

export interface MetricsSummary {
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalSpend: number;
  totalRevenue: number;
  avgCtr: number;
  avgCpc: number;
  avgCpa: number;
  avgRoas: number;
  period: {
    start: Date;
    end: Date;
  };
}
