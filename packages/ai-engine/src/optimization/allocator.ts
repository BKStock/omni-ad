/**
 * Budget Allocator
 *
 * Orchestrates the Thompson Sampling bandit and forecaster
 * to produce final budget allocation decisions.
 */

import type { BanditArm, BanditConfig, AllocationResult } from './bandit.js';
import { computeAllocation, updateArm } from './bandit.js';

export interface AllocationRequest {
  organizationId: string;
  totalBudget: number;
  platforms: string[];
  currentArms: BanditArm[];
  latestMetrics: PlatformMetricsSummary[];
  constraints: AllocationConstraints;
}

export interface PlatformMetricsSummary {
  platform: string;
  spend: number;
  revenue: number;
  roas: number;
  period: { start: Date; end: Date };
}

export interface AllocationConstraints {
  minBudgetPerPlatform: number;
  maxBudgetPerPlatform: number;
  lockedAllocations: Record<string, number>;
}

export function executeAllocationCycle(
  request: AllocationRequest
): { result: AllocationResult; updatedArms: BanditArm[] } {
  // Update arms with latest metrics
  const updatedArms = request.currentArms.map((arm) => {
    const metrics = request.latestMetrics.find(
      (m) => m.platform === arm.platform
    );
    if (!metrics) return arm;
    return updateArm(arm, metrics.spend, metrics.revenue);
  });

  // Compute new allocation
  const config: BanditConfig = {
    totalBudget: request.totalBudget,
    platforms: request.platforms,
    minBudgetPerPlatform: request.constraints.minBudgetPerPlatform,
    maxBudgetPerPlatform: request.constraints.maxBudgetPerPlatform,
    priorAlpha: 1,
    priorBeta: 1,
  };

  const result = computeAllocation(updatedArms, config);

  // Apply locked allocations (user overrides)
  for (const [platform, amount] of Object.entries(
    request.constraints.lockedAllocations
  )) {
    result.allocations[platform] = amount;
  }

  return { result, updatedArms };
}
