import { type Platform } from './platform.js';

export interface DistributionEstimate {
  mean: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface BudgetAllocation {
  id: string;
  organizationId: string;
  date: Date;
  allocations: Record<Platform, number>;
  totalBudget: number;
  predictedRoas: number | null;
  actualRoas: number | null;
  algorithmVersion: string;
}

export interface BudgetForecast {
  platform: Platform;
  predictedImpressions: DistributionEstimate;
  predictedClicks: DistributionEstimate;
  predictedConversions: DistributionEstimate;
  predictedRevenue: DistributionEstimate;
  predictedRoas: DistributionEstimate;
  confidence: number;
}
