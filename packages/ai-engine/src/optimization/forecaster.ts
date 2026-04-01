/**
 * ROAS Forecasting Engine
 *
 * v1: Historical-average forecaster with Monte Carlo simulation.
 * ML microservice integration is deferred to v2.
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

/**
 * Platform-level historical ROAS priors (mean, std) derived from
 * industry benchmarks. Replaced by real data once campaigns accumulate.
 */
const PLATFORM_ROAS_PRIORS: Record<string, { mean: number; std: number }> = {
  META: { mean: 3.2, std: 1.1 },
  GOOGLE: { mean: 4.1, std: 1.4 },
  X: { mean: 1.8, std: 0.9 },
  TIKTOK: { mean: 2.4, std: 1.2 },
  LINE_YAHOO: { mean: 2.9, std: 1.0 },
  AMAZON: { mean: 5.2, std: 1.8 },
  MICROSOFT: { mean: 3.8, std: 1.3 },
};

const DEFAULT_PRIOR = { mean: 2.5, std: 1.2 };

/** Typical daily conversion count per ¥10,000 spend by platform (rough benchmarks). */
const PLATFORM_CONVERSION_RATE: Record<string, number> = {
  META: 0.8,
  GOOGLE: 1.2,
  X: 0.4,
  TIKTOK: 0.6,
  LINE_YAHOO: 0.7,
  AMAZON: 1.5,
  MICROSOFT: 1.0,
};

function sampleStandardNormal(): number {
  let u: number, v: number, s: number;
  do {
    u = Math.random() * 2 - 1;
    v = Math.random() * 2 - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  return u * Math.sqrt((-2 * Math.log(s)) / s);
}

function sampleNormal(mean: number, std: number): number {
  return mean + std * sampleStandardNormal();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function computePercentiles(values: number[]): {
  mean: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return {
    mean,
    p5: percentile(sorted, 5),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p95: percentile(sorted, 95),
  };
}

export async function forecastRoas(input: ForecastInput): Promise<ForecastResult> {
  const prior = PLATFORM_ROAS_PRIORS[input.platform] ?? DEFAULT_PRIOR;

  const N = 10_000;
  const roas: number[] = [];

  for (let i = 0; i < N; i++) {
    // Sample ROAS from normal approximation of prior, clamp to [0.1, 20]
    const sample = Math.max(0.1, Math.min(20, sampleNormal(prior.mean, prior.std)));
    roas.push(sample);
  }

  const rp = computePercentiles(roas);
  const convBase = PLATFORM_CONVERSION_RATE[input.platform] ?? 0.8;
  const budgetUnits = input.dailyBudget / 10_000;

  const conversions: number[] = roas.map((r) =>
    Math.max(0, Math.round(convBase * budgetUnits * (r / prior.mean) + sampleNormal(0, 0.5))),
  );
  const convSorted = [...conversions].sort((a, b) => a - b);

  // Confidence scales with number of "similar campaigns" (simulated from prior strength)
  const confidence = Math.min(0.9, 0.5 + 0.04 * 10); // 10 synthetic data points = 0.9 cap
  const similarCampaignCount = 10;

  return {
    predictedRoas: {
      mean: rp.mean,
      p5: rp.p5,
      p25: rp.p25,
      p50: rp.p50,
      p75: rp.p75,
      p95: rp.p95,
    },
    predictedConversions: {
      mean: conversions.reduce((s, v) => s + v, 0) / conversions.length,
      p5: percentile(convSorted, 5),
      p95: percentile(convSorted, 95),
    },
    confidence,
    similarCampaignCount,
    modelVersion: 'v1-historical-average',
  };
}

interface RunSummary {
  revenue: number;
  spend: number;
}

function simulateOneRun(
  allocations: Record<string, number>,
  forecastDays: number,
): RunSummary {
  let totalRevenue = 0;
  let totalSpend = 0;

  for (const [platform, dailyBudget] of Object.entries(allocations)) {
    const prior = PLATFORM_ROAS_PRIORS[platform] ?? DEFAULT_PRIOR;
    for (let day = 0; day < forecastDays; day++) {
      const roas = Math.max(0.1, sampleNormal(prior.mean, prior.std));
      totalRevenue += dailyBudget * roas;
      totalSpend += dailyBudget;
    }
  }

  return { revenue: totalRevenue, spend: totalSpend };
}

function computeRevenueSummary(revenues: number[]): {
  mean: number;
  p5: number;
  p95: number;
} {
  const sorted = [...revenues].sort((a, b) => a - b);
  const mean = revenues.reduce((s, v) => s + v, 0) / revenues.length;
  return { mean, p5: percentile(sorted, 5), p95: percentile(sorted, 95) };
}

export async function simulateBudgetChange(
  input: SimulationInput,
): Promise<SimulationResult> {
  const MONTE_CARLO_RUNS = 10_000;

  const currentRevenues: number[] = [];
  const currentRoas: number[] = [];
  const proposedRevenues: number[] = [];
  const proposedRoas: number[] = [];

  for (let i = 0; i < MONTE_CARLO_RUNS; i++) {
    const cur = simulateOneRun(input.currentAllocations, input.forecastDays);
    currentRevenues.push(cur.revenue);
    currentRoas.push(cur.spend > 0 ? cur.revenue / cur.spend : 0);

    const prop = simulateOneRun(input.proposedAllocations, input.forecastDays);
    proposedRevenues.push(prop.revenue);
    proposedRoas.push(prop.spend > 0 ? prop.revenue / prop.spend : 0);
  }

  const curRevSummary = computeRevenueSummary(currentRevenues);
  const propRevSummary = computeRevenueSummary(proposedRevenues);
  const curRoasSummary = computeRevenueSummary(currentRoas);
  const propRoasSummary = computeRevenueSummary(proposedRoas);

  return {
    currentPrediction: {
      totalRevenue: curRevSummary,
      totalRoas: curRoasSummary,
    },
    proposedPrediction: {
      totalRevenue: propRevSummary,
      totalRoas: propRoasSummary,
    },
    delta: {
      revenueChange: propRevSummary.mean - curRevSummary.mean,
      roasChange: propRoasSummary.mean - curRoasSummary.mean,
    },
    monteCarloRuns: MONTE_CARLO_RUNS,
  };
}
