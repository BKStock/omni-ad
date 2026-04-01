/**
 * ROAS Forecasting Engine
 *
 * Predicts campaign ROAS before spending money.
 * Uses historical data to build prediction models.
 */

export interface ForecastInput {
  platform: string;
  objective: string;
  audienceSize: number;
  creativeType: string;
  dailyBudget: number;
  season: string;
  dayOfWeek: number;
}

export interface ForecastResult {
  predictedRoas: {
    mean: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  predictedConversions: {
    mean: number;
    p5: number;
    p95: number;
  };
  confidence: number;
  similarCampaignCount: number;
  modelVersion: string;
}

export async function forecastRoas(
  _input: ForecastInput
): Promise<ForecastResult> {
  // TODO: Call Python ML microservice endpoint
  // The ML service runs XGBoost regression trained on historical campaign data
  // Features: platform, objective, audience_size, creative_type, season, dow
  // Target: ROAS
  throw new Error('Not implemented: ROAS forecasting - requires ML microservice');
}

export interface SimulationInput {
  currentAllocations: Record<string, number>;
  proposedAllocations: Record<string, number>;
  forecastDays: number;
}

export interface SimulationResult {
  currentPrediction: {
    totalRevenue: { mean: number; p5: number; p95: number };
    totalRoas: { mean: number; p5: number; p95: number };
  };
  proposedPrediction: {
    totalRevenue: { mean: number; p5: number; p95: number };
    totalRoas: { mean: number; p5: number; p95: number };
  };
  delta: {
    revenueChange: number;
    roasChange: number;
  };
  monteCarloRuns: number;
}

export async function simulateBudgetChange(
  _input: SimulationInput
): Promise<SimulationResult> {
  // TODO: Monte Carlo simulation (10,000 runs)
  // For each run, sample from posterior distributions of platform ROAS
  // Calculate total revenue under current vs proposed allocations
  throw new Error('Not implemented: Budget simulation - requires ML microservice');
}
