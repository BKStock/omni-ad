/**
 * Shapley Value Attribution Model
 *
 * Computes fair attribution using game theory.
 * Each channel's marginal contribution across all coalitions.
 */

export interface ShapleyInput {
  channels: string[];
  conversionsByCoalition: Map<string, number>;
  totalConversions: number;
}

export interface ShapleyResult {
  channelCredits: Record<string, number>;
  totalConversions: number;
  modelType: 'shapley';
  computedAt: Date;
}

/** Canonical coalition key: sorted channel names joined by '|'. */
function coalitionKey(channels: string[]): string {
  return [...channels].sort().join('|');
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/**
 * Shapley weight for a coalition of size s out of n total channels:
 *   s! * (n - s - 1)! / n!
 */
function shapleyWeight(coalitionSize: number, n: number): number {
  return factorial(coalitionSize) * factorial(n - coalitionSize - 1) / factorial(n);
}

/**
 * Exact Shapley computation for n <= 8 channels (2^n subsets).
 */
function computeExact(input: ShapleyInput): Record<string, number> {
  const { channels, conversionsByCoalition } = input;
  const n = channels.length;
  const values: Record<string, number> = {};

  for (const channel of channels) {
    let shapleyValue = 0;
    const others = channels.filter((c) => c !== channel);

    // Enumerate all subsets of `others` (these become coalitions without `channel`)
    const numSubsets = 1 << others.length;
    for (let mask = 0; mask < numSubsets; mask++) {
      const coalition: string[] = [];
      for (let bit = 0; bit < others.length; bit++) {
        if (mask & (1 << bit)) {
          const c = others[bit];
          if (c !== undefined) coalition.push(c);
        }
      }

      const withoutKey = coalitionKey(coalition);
      const withKey = coalitionKey([...coalition, channel]);

      const vWithout = conversionsByCoalition.get(withoutKey) ?? 0;
      const vWith = conversionsByCoalition.get(withKey) ?? 0;
      const marginal = vWith - vWithout;

      const weight = shapleyWeight(coalition.length, n);
      shapleyValue += weight * marginal;
    }

    values[channel] = shapleyValue;
  }

  return values;
}

/**
 * Monte Carlo Shapley approximation for n > 8 channels.
 * Samples random permutations and estimates marginal contributions.
 */
function computeMonteCarlo(
  input: ShapleyInput,
  numSamples = 5000,
): Record<string, number> {
  const { channels, conversionsByCoalition } = input;
  const n = channels.length;
  const sumContributions: Record<string, number> = {};
  for (const c of channels) sumContributions[c] = 0;

  for (let sample = 0; sample < numSamples; sample++) {
    // Fisher-Yates shuffle for random permutation
    const perm = [...channels];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = perm[i]!;
      perm[i] = perm[j]!;
      perm[j] = tmp;
    }

    const coalition: string[] = [];
    for (const channel of perm) {
      const vWithout = conversionsByCoalition.get(coalitionKey(coalition)) ?? 0;
      coalition.push(channel);
      const vWith = conversionsByCoalition.get(coalitionKey(coalition)) ?? 0;
      sumContributions[channel] = (sumContributions[channel] ?? 0) + (vWith - vWithout);
    }
  }

  const values: Record<string, number> = {};
  for (const c of channels) {
    values[c] = (sumContributions[c] ?? 0) / numSamples;
  }
  return values;
}

function normaliseToTotalConversions(
  values: Record<string, number>,
  totalConversions: number,
): Record<string, number> {
  const sum = Object.values(values).reduce((s, v) => s + v, 0);
  if (sum === 0) {
    const n = Object.keys(values).length;
    const even = n > 0 ? totalConversions / n : 0;
    return Object.fromEntries(Object.keys(values).map((c) => [c, even]));
  }
  const scale = totalConversions / sum;
  return Object.fromEntries(Object.entries(values).map(([c, v]) => [c, v * scale]));
}

export function computeShapleyAttribution(input: ShapleyInput): ShapleyResult {
  const { channels, totalConversions } = input;

  if (channels.length === 0) {
    return {
      channelCredits: {},
      totalConversions,
      modelType: 'shapley',
      computedAt: new Date(),
    };
  }

  if (channels.length === 1) {
    const channel = channels[0]!;
    return {
      channelCredits: { [channel]: totalConversions },
      totalConversions,
      modelType: 'shapley',
      computedAt: new Date(),
    };
  }

  const rawValues =
    channels.length <= 8 ? computeExact(input) : computeMonteCarlo(input);

  const channelCredits = normaliseToTotalConversions(rawValues, totalConversions);

  return { channelCredits, totalConversions, modelType: 'shapley', computedAt: new Date() };
}
