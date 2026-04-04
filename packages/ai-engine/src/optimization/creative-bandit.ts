/**
 * Thompson Sampling Bandit for Creative Variant Optimization
 *
 * Extends the platform-level bandit (bandit.ts) to the creative variant level.
 * Each creative variant is treated as a bandit arm. Thompson sampling drives
 * exploration/exploitation; statistical significance testing gates winner/loser decisions.
 */

export interface VariantArm {
  variantId: string;
  campaignId: string;
  platform: string;
  /** Beta distribution success parameter */
  alpha: number;
  /** Beta distribution failure parameter */
  beta: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctrHistory: number[];
  isActive: boolean;
  createdAt: Date;
  pausedAt?: Date;
  scaledAt?: Date;
}

export interface VariantAllocationResult {
  /** variantId → impression share (0–1, sums to 1 across active variants) */
  shares: Record<string, number>;
  /** variantId → expected CTR (Beta mean) */
  expectedCtr: Record<string, number>;
  /** variantId → confidence in the estimate */
  confidence: Record<string, number>;
  /** fraction of variants with fewer than MIN_OBSERVATIONS (still exploring) */
  explorationRate: number;
  winner?: string;
  losers: string[];
}

export interface SignificanceResult {
  isSignificant: boolean;
  pValue: number;
  winner?: string;
  /** relative lift of winner over control */
  effect: number;
}

const MIN_OBSERVATIONS = 100;
const SIGNIFICANCE_THRESHOLD = 0.05;
/** below this fraction of top-arm CTR → loser candidate */
const LOSER_CTR_THRESHOLD = 0.5;
/** at least this multiple above average CTR to qualify for scaling */
const SCALE_CTR_MULTIPLIER = 1.5;

// ─── Statistical sampling (self-contained, matches bandit.ts methodology) ────

function sampleStandardNormal(): number {
  let u: number, v: number, s: number;
  do {
    u = Math.random() * 2 - 1;
    v = Math.random() * 2 - 1;
    s = u * u + v * v;
  } while (s >= 1 || s === 0);
  return u * Math.sqrt((-2 * Math.log(s)) / s);
}

function sampleGamma(shape: number): number {
  if (shape < 1) {
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number;
    let v: number;
    do {
      x = sampleStandardNormal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    const x2 = x * x;
    if (u < 1 - 0.0331 * x2 * x2) return d * v;
    if (Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))) return d * v;
  }
}

function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  const total = x + y;
  return total === 0 ? 0.5 : x / total;
}

function detectChangePoint(history: number[]): boolean {
  const windowSize = 10;
  if (history.length < windowSize + 1) return false;
  const window = history.slice(-windowSize - 1, -1);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const variance = window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / window.length;
  const std = Math.sqrt(variance);
  if (std === 0) return false;
  const latest = history[history.length - 1] ?? 0;
  return Math.abs(latest - mean) > 2 * std;
}

// ─── Two-proportion z-test (one-sided H1: p1 > p2) ───────────────────────────

function standardNormalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.31938153 +
      t * (-0.356563782 +
        t * (1.781477937 +
          t * (-1.821255978 + t * 1.330274429))));
  const phi = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? 1 - phi : phi;
}

function twoProportionZTest(
  successes1: number,
  n1: number,
  successes2: number,
  n2: number,
): number {
  if (n1 === 0 || n2 === 0) return 1;
  const p1 = successes1 / n1;
  const p2 = successes2 / n2;
  const pPool = (successes1 + successes2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return p1 > p2 ? 0 : 1;
  const z = (p1 - p2) / se;
  return 1 - standardNormalCdf(z);
}

// ─── Arm lifecycle ────────────────────────────────────────────────────────────

export function initializeVariantArm(
  variantId: string,
  campaignId: string,
  platform: string,
): VariantArm {
  return {
    variantId,
    campaignId,
    platform,
    alpha: 1,
    beta: 1,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend: 0,
    revenue: 0,
    ctrHistory: [],
    isActive: true,
    createdAt: new Date(),
  };
}

export function updateVariantArm(
  arm: VariantArm,
  impressions: number,
  clicks: number,
  conversions: number,
  spend: number,
  revenue: number,
): VariantArm {
  if (impressions === 0) return arm;

  const ctr = clicks / impressions;
  const updatedHistory = [...arm.ctrHistory, ctr];

  const updated: VariantArm = {
    ...arm,
    alpha: arm.alpha + clicks,
    beta: arm.beta + (impressions - clicks),
    impressions: arm.impressions + impressions,
    clicks: arm.clicks + clicks,
    conversions: arm.conversions + conversions,
    spend: arm.spend + spend,
    revenue: arm.revenue + revenue,
    ctrHistory: updatedHistory,
  };

  // Structural break → reset Beta params so bandit adapts to new regime
  if (detectChangePoint(updatedHistory)) {
    return { ...updated, alpha: 1, beta: 1, ctrHistory: [] };
  }

  return updated;
}

export function pauseVariantArm(arm: VariantArm): VariantArm {
  return { ...arm, isActive: false, pausedAt: new Date() };
}

export function markVariantScaled(arm: VariantArm): VariantArm {
  return { ...arm, scaledAt: new Date() };
}

// ─── Allocation ───────────────────────────────────────────────────────────────

/**
 * Thompson sampling allocation across active variant arms.
 * Returns impression share per variant (sums to 1).
 */
export function computeVariantAllocation(
  arms: VariantArm[],
  numSamples = 2000,
): VariantAllocationResult {
  const active = arms.filter((a) => a.isActive);
  if (active.length === 0) {
    return { shares: {}, expectedCtr: {}, confidence: {}, explorationRate: 1, losers: [] };
  }

  const winCounts: Record<string, number> = {};
  const sumSamples: Record<string, number> = {};
  const sumSqSamples: Record<string, number> = {};

  for (const arm of active) {
    winCounts[arm.variantId] = 0;
    sumSamples[arm.variantId] = 0;
    sumSqSamples[arm.variantId] = 0;
  }

  for (let i = 0; i < numSamples; i++) {
    let best = -Infinity;
    let bestId = '';
    for (const arm of active) {
      const s = sampleBeta(arm.alpha, arm.beta);
      sumSamples[arm.variantId] = (sumSamples[arm.variantId] ?? 0) + s;
      sumSqSamples[arm.variantId] = (sumSqSamples[arm.variantId] ?? 0) + s * s;
      if (s > best) {
        best = s;
        bestId = arm.variantId;
      }
    }
    winCounts[bestId] = (winCounts[bestId] ?? 0) + 1;
  }

  const shares: Record<string, number> = {};
  const expectedCtr: Record<string, number> = {};
  const confidence: Record<string, number> = {};

  for (const arm of active) {
    shares[arm.variantId] = (winCounts[arm.variantId] ?? 0) / numSamples;
    const mean = (sumSamples[arm.variantId] ?? 0) / numSamples;
    const variance = (sumSqSamples[arm.variantId] ?? 0) / numSamples - mean * mean;
    const std = Math.sqrt(Math.max(0, variance));
    expectedCtr[arm.variantId] = mean;
    const intervalWidth = 2 * 1.96 * std;
    confidence[arm.variantId] =
      mean > 0
        ? Math.max(0, Math.min(1, 1 - intervalWidth / mean))
        : Math.max(0, 1 - intervalWidth);
  }

  const explorationRate =
    active.filter((a) => a.impressions < MIN_OBSERVATIONS).length / active.length;

  const { winner, losers } = _identifyWinnersAndLosers(active, expectedCtr);

  return { shares, expectedCtr, confidence, explorationRate, winner, losers };
}

// ─── Significance ─────────────────────────────────────────────────────────────

/**
 * Checks whether the top-performing variant is statistically better than
 * the weakest variant at p < 0.05 (two-proportion z-test).
 */
export function checkSignificance(arms: VariantArm[]): SignificanceResult {
  const mature = arms.filter((a) => a.isActive && a.impressions >= MIN_OBSERVATIONS);
  if (mature.length < 2) {
    return { isSignificant: false, pValue: 1, effect: 0 };
  }

  const sorted = [...mature].sort(
    (a, b) => b.clicks / b.impressions - a.clicks / a.impressions,
  );
  const top = sorted[0]!;
  const bottom = sorted[sorted.length - 1]!;

  const pValue = twoProportionZTest(
    top.clicks, top.impressions,
    bottom.clicks, bottom.impressions,
  );
  const topCtr = top.clicks / top.impressions;
  const bottomCtr = bottom.clicks / bottom.impressions;
  const effect = bottomCtr > 0 ? (topCtr - bottomCtr) / bottomCtr : 0;

  return {
    isSignificant: pValue < SIGNIFICANCE_THRESHOLD,
    pValue,
    winner: pValue < SIGNIFICANCE_THRESHOLD ? top.variantId : undefined,
    effect,
  };
}

// ─── Loser/winner selection ───────────────────────────────────────────────────

function _identifyWinnersAndLosers(
  active: VariantArm[],
  expectedCtr: Record<string, number>,
): { winner?: string; losers: string[] } {
  const mature = active.filter((a) => a.impressions >= MIN_OBSERVATIONS);
  if (mature.length < 2) return { losers: [] };

  const ctrs = mature.map((a) => expectedCtr[a.variantId] ?? 0);
  const maxCtr = Math.max(...ctrs);
  const avgCtr = ctrs.reduce((s, c) => s + c, 0) / ctrs.length;

  const winner =
    maxCtr > avgCtr * SCALE_CTR_MULTIPLIER
      ? mature.find((a) => (expectedCtr[a.variantId] ?? 0) === maxCtr)?.variantId
      : undefined;

  const losers = mature
    .filter((a) => (expectedCtr[a.variantId] ?? 0) < maxCtr * LOSER_CTR_THRESHOLD)
    .map((a) => a.variantId);

  return { winner, losers };
}

/** Returns arms eligible for pausing (statistical losers). */
export function selectLosers(arms: VariantArm[]): VariantArm[] {
  const active = arms.filter((a) => a.isActive && a.impressions >= MIN_OBSERVATIONS);
  if (active.length < 2) return [];
  const maxCtr = Math.max(
    ...active.map((a) => (a.impressions > 0 ? a.clicks / a.impressions : 0)),
  );
  return active.filter(
    (a) => a.impressions > 0 && a.clicks / a.impressions < maxCtr * LOSER_CTR_THRESHOLD,
  );
}

/** Returns the single best arm for budget scaling; requires statistical significance. */
export function selectWinner(arms: VariantArm[]): VariantArm | undefined {
  const sig = checkSignificance(arms);
  if (!sig.isSignificant || !sig.winner) return undefined;
  return arms.find((a) => a.variantId === sig.winner);
}
