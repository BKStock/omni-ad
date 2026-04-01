/**
 * Thompson Sampling Combinatorial Bandit for Budget Optimization
 *
 * This is the core differentiating algorithm for OMNI-AD.
 * It determines optimal budget allocation across ad platforms
 * using Bayesian exploration/exploitation.
 */

export interface BanditArm {
  platform: string;
  alpha: number; // Beta distribution success parameter
  beta: number; // Beta distribution failure parameter
  totalSpend: number;
  totalRevenue: number;
  observations: number;
}

export interface AllocationResult {
  allocations: Record<string, number>;
  expectedRoas: Record<string, number>;
  confidence: Record<string, number>;
  explorationRate: number;
}

export interface BanditConfig {
  totalBudget: number;
  platforms: string[];
  minBudgetPerPlatform: number;
  maxBudgetPerPlatform: number;
  priorAlpha: number;
  priorBeta: number;
}

function sampleBeta(alpha: number, beta: number): number {
  // Joehnk's algorithm for Beta distribution sampling
  // For production, use a proper statistical library
  let u1: number, u2: number, x: number, y: number;
  do {
    u1 = Math.random();
    u2 = Math.random();
    x = Math.pow(u1, 1 / alpha);
    y = Math.pow(u2, 1 / beta);
  } while (x + y > 1);
  return x / (x + y);
}

export function initializeArms(config: BanditConfig): BanditArm[] {
  return config.platforms.map((platform) => ({
    platform,
    alpha: config.priorAlpha,
    beta: config.priorBeta,
    totalSpend: 0,
    totalRevenue: 0,
    observations: 0,
  }));
}

export function updateArm(
  arm: BanditArm,
  spend: number,
  revenue: number
): BanditArm {
  const roas = spend > 0 ? revenue / spend : 0;
  const success = roas >= 1 ? 1 : 0;
  return {
    ...arm,
    alpha: arm.alpha + success,
    beta: arm.beta + (1 - success),
    totalSpend: arm.totalSpend + spend,
    totalRevenue: arm.totalRevenue + revenue,
    observations: arm.observations + 1,
  };
}

export function computeAllocation(
  arms: BanditArm[],
  config: BanditConfig,
  numSamples = 1000
): AllocationResult {
  const { totalBudget, minBudgetPerPlatform, maxBudgetPerPlatform } = config;
  const allocations: Record<string, number> = {};
  const expectedRoas: Record<string, number> = {};
  const confidence: Record<string, number> = {};

  // Sample from each arm's Beta distribution
  const samples = arms.map((arm) => {
    const armSamples: number[] = [];
    for (let i = 0; i < numSamples; i++) {
      armSamples.push(sampleBeta(arm.alpha, arm.beta));
    }
    const mean = armSamples.reduce((a, b) => a + b, 0) / numSamples;
    const variance =
      armSamples.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (numSamples - 1);

    return { platform: arm.platform, mean, std: Math.sqrt(variance) };
  });

  // Allocate budget proportional to expected performance
  const totalScore = samples.reduce((sum, s) => sum + s.mean, 0);
  let remainingBudget = totalBudget;

  // First pass: assign minimum budgets
  for (const sample of samples) {
    allocations[sample.platform] = minBudgetPerPlatform;
    remainingBudget -= minBudgetPerPlatform;
  }

  // Second pass: distribute remaining budget proportionally
  if (remainingBudget > 0 && totalScore > 0) {
    for (const sample of samples) {
      const proportionalShare = (sample.mean / totalScore) * remainingBudget;
      const maxAdditional = maxBudgetPerPlatform - minBudgetPerPlatform;
      const additional = Math.min(proportionalShare, maxAdditional);
      allocations[sample.platform] =
        (allocations[sample.platform] ?? 0) + additional;
    }
  }

  // Compute expected ROAS and confidence for each platform
  for (const sample of samples) {
    expectedRoas[sample.platform] = sample.mean;
    confidence[sample.platform] = 1 - sample.std;
  }

  const explorationRate =
    arms.reduce((sum, arm) => sum + (arm.observations < 10 ? 1 : 0), 0) /
    arms.length;

  return { allocations, expectedRoas, confidence, explorationRate };
}
