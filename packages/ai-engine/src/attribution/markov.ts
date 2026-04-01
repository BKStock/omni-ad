/**
 * Markov Chain Attribution Model
 *
 * Computes channel attribution using the "removal effect"
 * of each channel in the conversion path.
 */

export interface TouchpointSequence {
  visitorId: string;
  touchpoints: { channel: string; timestamp: Date }[];
  converted: boolean;
}

export interface AttributionResult {
  channelCredits: Record<string, number>;
  totalConversions: number;
  modelType: 'markov';
  computedAt: Date;
}

type TransitionMatrix = Map<string, Map<string, number>>;

const STATE_START = '__start__';
const STATE_CONVERSION = '__conversion__';
const STATE_NULL = '__null__';

function buildTransitionCounts(sequences: TouchpointSequence[]): TransitionMatrix {
  const counts: TransitionMatrix = new Map();

  const increment = (from: string, to: string): void => {
    if (!counts.has(from)) counts.set(from, new Map());
    const row = counts.get(from)!;
    row.set(to, (row.get(to) ?? 0) + 1);
  };

  for (const seq of sequences) {
    const channels = seq.touchpoints.map((t) => t.channel);
    if (channels.length === 0) continue;

    const firstChannel = channels[0];
    if (firstChannel === undefined) continue;
    increment(STATE_START, firstChannel);

    for (let i = 0; i < channels.length - 1; i++) {
      const from = channels[i];
      const to = channels[i + 1];
      if (from !== undefined && to !== undefined) {
        increment(from, to);
      }
    }

    const lastChannel = channels[channels.length - 1];
    if (lastChannel !== undefined) {
      increment(lastChannel, seq.converted ? STATE_CONVERSION : STATE_NULL);
    }
  }

  return counts;
}

function normaliseCounts(counts: TransitionMatrix): TransitionMatrix {
  const matrix: TransitionMatrix = new Map();

  for (const [from, targets] of counts) {
    const row: Map<string, number> = new Map();
    const total = Array.from(targets.values()).reduce((s, v) => s + v, 0);
    for (const [to, count] of targets) {
      row.set(to, total > 0 ? count / total : 0);
    }
    matrix.set(from, row);
  }

  return matrix;
}

/**
 * Walk the Markov chain starting from STATE_START.
 * Returns the probability of reaching STATE_CONVERSION.
 * Uses iterative steady-state computation (convergence walk).
 */
function conversionProbability(
  matrix: TransitionMatrix,
  removedChannel: string | null = null,
): number {
  // State distribution: probability of being at each state
  let dist: Map<string, number> = new Map([[STATE_START, 1.0]]);
  let conversionProb = 0;

  const MAX_ITERATIONS = 200;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const next: Map<string, number> = new Map();
    let totalMass = 0;

    for (const [state, prob] of dist) {
      if (prob < 1e-12) continue;
      if (state === STATE_CONVERSION || state === STATE_NULL) continue;

      // If state is the removed channel, all its traffic goes to null
      if (removedChannel !== null && state === removedChannel) {
        next.set(STATE_NULL, (next.get(STATE_NULL) ?? 0) + prob);
        continue;
      }

      const transitions = matrix.get(state);
      if (!transitions) {
        next.set(STATE_NULL, (next.get(STATE_NULL) ?? 0) + prob);
        continue;
      }

      for (const [to, transProb] of transitions) {
        if (transProb === 0) continue;
        // If target is the removed channel, redirect to null
        const actualTo =
          removedChannel !== null && to === removedChannel && to !== STATE_CONVERSION
            ? STATE_NULL
            : to;

        if (actualTo === STATE_CONVERSION) {
          conversionProb += prob * transProb;
        } else if (actualTo !== STATE_NULL) {
          next.set(actualTo, (next.get(actualTo) ?? 0) + prob * transProb);
          totalMass += prob * transProb;
        }
      }
    }

    dist = next;
    if (totalMass < 1e-10) break;
  }

  return conversionProb;
}

export function computeMarkovAttribution(
  sequences: TouchpointSequence[],
): AttributionResult {
  if (sequences.length === 0) {
    return {
      channelCredits: {},
      totalConversions: 0,
      modelType: 'markov',
      computedAt: new Date(),
    };
  }

  const totalConversions = sequences.filter((s) => s.converted).length;

  // Collect unique channels
  const channels = new Set<string>();
  for (const seq of sequences) {
    for (const t of seq.touchpoints) channels.add(t.channel);
  }

  if (channels.size === 0) {
    return {
      channelCredits: {},
      totalConversions,
      modelType: 'markov',
      computedAt: new Date(),
    };
  }

  const counts = buildTransitionCounts(sequences);
  const matrix = normaliseCounts(counts);

  const baselineProb = conversionProbability(matrix, null);

  // Single-touch shortcut: if only one channel, it gets all credit
  if (channels.size === 1) {
    const channel = Array.from(channels)[0]!;
    return {
      channelCredits: { [channel]: totalConversions },
      totalConversions,
      modelType: 'markov',
      computedAt: new Date(),
    };
  }

  // Removal effects
  const removalEffects: Record<string, number> = {};
  for (const channel of channels) {
    const removedProb = conversionProbability(matrix, channel);
    // removal effect = fractional drop in conversion probability
    removalEffects[channel] =
      baselineProb > 0 ? Math.max(0, (baselineProb - removedProb) / baselineProb) : 0;
  }

  // Normalise removal effects to sum to 1
  const totalEffect = Object.values(removalEffects).reduce((s, v) => s + v, 0);
  const channelCredits: Record<string, number> = {};

  for (const channel of channels) {
    const share = totalEffect > 0 ? (removalEffects[channel] ?? 0) / totalEffect : 1 / channels.size;
    channelCredits[channel] = share * totalConversions;
  }

  return { channelCredits, totalConversions, modelType: 'markov', computedAt: new Date() };
}
