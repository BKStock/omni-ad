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

export function computeMarkovAttribution(
  _sequences: TouchpointSequence[]
): AttributionResult {
  // TODO: Implement Markov Chain attribution
  // Step 1: Build transition probability matrix from touchpoint sequences
  // Step 2: For each channel, compute removal effect
  //         (what % of conversions lost if channel removed)
  // Step 3: Normalize removal effects to sum to total conversions
  // Step 4: Return per-channel credit
  throw new Error('Not implemented: Markov Chain attribution model');
}
