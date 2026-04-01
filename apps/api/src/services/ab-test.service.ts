/**
 * A/B Test Engine
 *
 * Statistical testing with sequential analysis (O'Brien-Fleming boundaries),
 * sample size calculation, and Thompson Sampling for multi-variant tests.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ABTestParams {
  metricType: 'ctr' | 'cvr' | 'roas';
  minimumDetectableEffect: number;
  alpha: number;
  power: number;
  variants: number;
}

export interface TestArm {
  name: string;
  impressions: number;
  successes: number;
}

export interface SampleSizeResult {
  perVariant: number;
  total: number;
  params: ABTestParams;
}

export interface SignificanceResult {
  isSignificant: boolean;
  pValue: number;
  zScore: number;
  controlRate: number;
  treatmentRate: number;
  relativeLift: number;
  confidenceInterval: { lower: number; upper: number };
  obrienFlemingBoundary: number;
  currentLook: number;
  maxLooks: number;
}

export interface TestWinnerResult {
  testId: string;
  winner: string | null;
  isSignificant: boolean;
  arms: ArmResult[];
}

export interface ArmResult {
  name: string;
  rate: number;
  impressions: number;
  successes: number;
  probability: number;
}

export interface ThompsonSamplingResult {
  arms: ThompsonArm[];
  recommendedArm: string;
  allocationWeights: Record<string, number>;
}

export interface ThompsonArm {
  name: string;
  alpha: number;
  beta: number;
  sampledValue: number;
  winProbability: number;
}

// ---------------------------------------------------------------------------
// Standard Normal Distribution Helpers
// ---------------------------------------------------------------------------

/**
 * Approximation of the inverse standard normal CDF (probit function).
 * Uses the Rational Approximation method (Abramowitz & Stegun 26.2.23).
 */
function qnorm(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const isLowerHalf = p < 0.5;
  const pp = isLowerHalf ? p : 1 - p;

  const t = Math.sqrt(-2 * Math.log(pp));

  // Coefficients for rational approximation
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  const result = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);

  return isLowerHalf ? -result : result;
}

/**
 * Standard normal CDF approximation (Abramowitz & Stegun 7.1.26).
 */
function pnorm(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

// ---------------------------------------------------------------------------
// Sample Size Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate required sample size per variant for a given MDE, alpha, and power.
 *
 * Formula: n = (Z_{alpha/2} + Z_{beta})^2 * (p1*(1-p1) + p2*(1-p2)) / (p1-p2)^2
 *
 * For ROAS metric type, we use a continuous metric approximation.
 */
export function designTest(params: ABTestParams): SampleSizeResult {
  const { minimumDetectableEffect, alpha, power, variants } = params;

  const zAlpha = qnorm(1 - alpha / 2);
  const zBeta = qnorm(power);

  let perVariant: number;

  if (params.metricType === 'roas') {
    // For continuous metrics, assume coefficient of variation = 1
    // n = 2 * (Z_alpha/2 + Z_beta)^2 / MDE^2
    const numerator = 2 * (zAlpha + zBeta) ** 2;
    const denominator = minimumDetectableEffect ** 2;
    perVariant = Math.ceil(numerator / denominator);
  } else {
    // For proportions (CTR, CVR), assume baseline rate around 5% for CTR, 2% for CVR
    const baselineRate = params.metricType === 'ctr' ? 0.05 : 0.02;
    const p1 = baselineRate;
    const p2 = baselineRate * (1 + minimumDetectableEffect);

    const numerator = (zAlpha + zBeta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2));
    const denominator = (p1 - p2) ** 2;

    perVariant = Math.ceil(numerator / denominator);
  }

  // Bonferroni correction for multiple comparisons (>2 variants)
  if (variants > 2) {
    const bonferroniMultiplier =
      (qnorm(1 - alpha / (2 * (variants - 1))) / zAlpha) ** 2;
    perVariant = Math.ceil(perVariant * bonferroniMultiplier);
  }

  return {
    perVariant,
    total: perVariant * variants,
    params,
  };
}

// ---------------------------------------------------------------------------
// Sequential Testing with O'Brien-Fleming Boundaries
// ---------------------------------------------------------------------------

/**
 * Check statistical significance using sequential testing.
 * O'Brien-Fleming spending function provides conservative early-stopping boundaries.
 */
export function checkSignificance(
  control: TestArm,
  treatment: TestArm,
  options: {
    alpha?: number;
    maxLooks?: number;
    currentLook?: number;
  } = {},
): SignificanceResult {
  const alpha = options.alpha ?? 0.05;
  const maxLooks = options.maxLooks ?? 5;
  const currentLook = options.currentLook ?? 1;

  const controlRate =
    control.impressions > 0 ? control.successes / control.impressions : 0;
  const treatmentRate =
    treatment.impressions > 0 ? treatment.successes / treatment.impressions : 0;

  // Pooled standard error
  const totalImpressions = control.impressions + treatment.impressions;
  const pooledRate =
    totalImpressions > 0
      ? (control.successes + treatment.successes) / totalImpressions
      : 0;

  const se = Math.sqrt(
    pooledRate *
      (1 - pooledRate) *
      (1 / Math.max(control.impressions, 1) +
        1 / Math.max(treatment.impressions, 1)),
  );

  const zScore = se > 0 ? (treatmentRate - controlRate) / se : 0;
  const pValue = 2 * (1 - pnorm(Math.abs(zScore)));

  // O'Brien-Fleming boundary at current look
  const informationFraction = currentLook / maxLooks;
  const obrienFlemingBoundary = computeOBFBoundary(alpha, informationFraction);

  const isSignificant = Math.abs(zScore) > obrienFlemingBoundary;

  // Confidence interval for the difference
  const diff = treatmentRate - controlRate;
  const ciMultiplier = qnorm(1 - alpha / 2);
  const ciWidth = ciMultiplier * se;

  const relativeLift = controlRate > 0 ? (treatmentRate - controlRate) / controlRate : 0;

  return {
    isSignificant,
    pValue,
    zScore,
    controlRate,
    treatmentRate,
    relativeLift,
    confidenceInterval: {
      lower: diff - ciWidth,
      upper: diff + ciWidth,
    },
    obrienFlemingBoundary,
    currentLook,
    maxLooks,
  };
}

/**
 * O'Brien-Fleming spending function boundary.
 * At information fraction t, the boundary is: Z_alpha * / sqrt(t)
 */
function computeOBFBoundary(alpha: number, informationFraction: number): number {
  if (informationFraction <= 0) return Infinity;
  const zAlpha = qnorm(1 - alpha / 2);
  return zAlpha / Math.sqrt(informationFraction);
}

// ---------------------------------------------------------------------------
// Winner Declaration
// ---------------------------------------------------------------------------

/**
 * Declare a winner for a completed test.
 * Returns the winning arm when significance is reached.
 */
export function declareWinner(
  testId: string,
  arms: TestArm[],
  options: {
    alpha?: number;
    maxLooks?: number;
    currentLook?: number;
  } = {},
): TestWinnerResult {
  if (arms.length < 2) {
    throw new Error('At least 2 arms required for A/B testing');
  }

  const control = arms[0]!;
  const armResults: ArmResult[] = arms.map((arm) => ({
    name: arm.name,
    rate: arm.impressions > 0 ? arm.successes / arm.impressions : 0,
    impressions: arm.impressions,
    successes: arm.successes,
    probability: 0,
  }));

  // For multi-variant, use Thompson Sampling to compute win probabilities
  if (arms.length > 2) {
    const thompson = thompsonSampling(arms);
    for (const armResult of armResults) {
      const tArm = thompson.arms.find((a) => a.name === armResult.name);
      armResult.probability = tArm?.winProbability ?? 0;
    }

    // Check if any arm has >95% probability of being best
    const bestArm = armResults.reduce((best, arm) =>
      arm.probability > best.probability ? arm : best,
    );

    if (bestArm.probability > 0.95) {
      return {
        testId,
        winner: bestArm.name,
        isSignificant: true,
        arms: armResults,
      };
    }

    return {
      testId,
      winner: null,
      isSignificant: false,
      arms: armResults,
    };
  }

  // Two-arm test: use sequential significance test
  const treatment = arms[1]!;
  const significance = checkSignificance(control, treatment, options);

  if (significance.isSignificant) {
    const winner =
      significance.treatmentRate > significance.controlRate
        ? treatment.name
        : control.name;

    armResults[0]!.probability =
      significance.treatmentRate <= significance.controlRate ? 1 : 0;
    armResults[1]!.probability =
      significance.treatmentRate > significance.controlRate ? 1 : 0;

    return {
      testId,
      winner,
      isSignificant: true,
      arms: armResults,
    };
  }

  return {
    testId,
    winner: null,
    isSignificant: false,
    arms: armResults,
  };
}

// ---------------------------------------------------------------------------
// Thompson Sampling for Multi-Variant Testing
// ---------------------------------------------------------------------------

/**
 * Thompson Sampling using Beta-Bernoulli conjugate model.
 * Simulates draws from each arm's posterior to estimate win probabilities.
 */
export function thompsonSampling(
  arms: TestArm[],
  numSimulations = 10_000,
): ThompsonSamplingResult {
  // Use Beta(1,1) prior (uniform)
  const thompsonArms: ThompsonArm[] = arms.map((arm) => ({
    name: arm.name,
    alpha: 1 + arm.successes,
    beta: 1 + (arm.impressions - arm.successes),
    sampledValue: 0,
    winProbability: 0,
  }));

  // Win counts from simulations
  const winCounts = new Map<string, number>();
  for (const arm of thompsonArms) {
    winCounts.set(arm.name, 0);
  }

  for (let sim = 0; sim < numSimulations; sim++) {
    let bestValue = -Infinity;
    let bestName = '';

    for (const arm of thompsonArms) {
      const sampled = sampleBeta(arm.alpha, arm.beta);
      if (sampled > bestValue) {
        bestValue = sampled;
        bestName = arm.name;
      }
    }

    const current = winCounts.get(bestName) ?? 0;
    winCounts.set(bestName, current + 1);
  }

  // Compute win probabilities
  for (const arm of thompsonArms) {
    arm.winProbability = (winCounts.get(arm.name) ?? 0) / numSimulations;
    // Single sample for the current recommendation
    arm.sampledValue = sampleBeta(arm.alpha, arm.beta);
  }

  // Recommended arm = highest win probability
  const recommendedArm = thompsonArms.reduce((best, arm) =>
    arm.winProbability > best.winProbability ? arm : best,
  );

  // Allocation weights proportional to win probability
  const allocationWeights: Record<string, number> = {};
  for (const arm of thompsonArms) {
    allocationWeights[arm.name] = arm.winProbability;
  }

  return {
    arms: thompsonArms,
    recommendedArm: recommendedArm.name,
    allocationWeights,
  };
}

/**
 * Sample from Beta(alpha, beta) distribution using Joehnk's algorithm.
 */
function sampleBeta(alpha: number, beta: number): number {
  // For large alpha/beta, use the normal approximation
  if (alpha > 50 && beta > 50) {
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    return Math.max(0, Math.min(1, mean + Math.sqrt(variance) * randomNormal()));
  }

  // Joehnk's algorithm
  let u1: number, u2: number, x: number, y: number;
  do {
    u1 = Math.random();
    u2 = Math.random();
    x = Math.pow(u1, 1 / alpha);
    y = Math.pow(u2, 1 / beta);
  } while (x + y > 1);

  return x / (x + y);
}

/**
 * Box-Muller transform for standard normal samples.
 */
function randomNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
