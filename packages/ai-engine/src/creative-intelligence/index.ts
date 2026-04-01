/**
 * Creative Intelligence Engine
 *
 * Learns what creative patterns work for specific
 * audience segments on specific platforms.
 *
 * v1: Heuristic quartile-based analysis.
 * v2 will add pgvector similarity search.
 */

export interface CreativeFeatures {
  creativeId: string;
  embedding: number[];
  dominantColors: string[];
  textDensity: number;
  hasFace: boolean;
  emotionalTone: string;
  keigoLevel: string;
  ctaType: string;
  layoutPattern: string;
}

export interface PerformanceFeedback {
  creativeId: string;
  platform: string;
  audienceSegment: string;
  ctr: number;
  cvr: number;
  roas: number;
  impressions: number;
}

export interface CreativeRecommendation {
  positiveExamples: CreativeFeatures[];
  negativeExamples: CreativeFeatures[];
  recommendedPatterns: string[];
  avoidPatterns: string[];
}

/** In-memory store for v1. A real implementation persists to the DB. */
const feedbackStore: PerformanceFeedback[] = [];
const featuresStore: Map<string, CreativeFeatures> = new Map();

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function computeQuartileBoundaries(
  feedbacks: PerformanceFeedback[],
): { q25: number; q75: number } {
  const ctrs = feedbacks.map((f) => f.ctr).sort((a, b) => a - b);
  return {
    q25: percentile(ctrs, 25),
    q75: percentile(ctrs, 75),
  };
}

function separatePerformers(
  feedbacks: PerformanceFeedback[],
  q25: number,
  q75: number,
): { highIds: Set<string>; lowIds: Set<string> } {
  const highIds = new Set<string>();
  const lowIds = new Set<string>();
  for (const f of feedbacks) {
    if (f.ctr >= q75) highIds.add(f.creativeId);
    else if (f.ctr <= q25) lowIds.add(f.creativeId);
  }
  return { highIds, lowIds };
}

function extractPatterns(features: CreativeFeatures[]): string[] {
  if (features.length === 0) return [];

  const patterns: string[] = [];

  // Emotional tone frequency
  const toneCounts = new Map<string, number>();
  for (const f of features) {
    toneCounts.set(f.emotionalTone, (toneCounts.get(f.emotionalTone) ?? 0) + 1);
  }
  const dominantTone = Array.from(toneCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (dominantTone) patterns.push(`感情トーン: ${dominantTone[0]}`);

  // CTA type frequency
  const ctaCounts = new Map<string, number>();
  for (const f of features) ctaCounts.set(f.ctaType, (ctaCounts.get(f.ctaType) ?? 0) + 1);
  const dominantCta = Array.from(ctaCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (dominantCta) patterns.push(`CTAタイプ: ${dominantCta[0]}`);

  // Layout pattern frequency
  const layoutCounts = new Map<string, number>();
  for (const f of features)
    layoutCounts.set(f.layoutPattern, (layoutCounts.get(f.layoutPattern) ?? 0) + 1);
  const dominantLayout = Array.from(layoutCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (dominantLayout) patterns.push(`レイアウト: ${dominantLayout[0]}`);

  // Face presence
  const faceRate = features.filter((f) => f.hasFace).length / features.length;
  if (faceRate >= 0.6) patterns.push('人物画像の使用（60%以上）');
  else if (faceRate <= 0.2) patterns.push('人物画像なし（20%以下）');

  // Text density
  const avgDensity = features.reduce((s, f) => s + f.textDensity, 0) / features.length;
  if (avgDensity > 0.6) patterns.push('テキスト密度: 高');
  else if (avgDensity < 0.3) patterns.push('テキスト密度: 低');

  // Keigo level
  const keigoCounts = new Map<string, number>();
  for (const f of features) keigoCounts.set(f.keigoLevel, (keigoCounts.get(f.keigoLevel) ?? 0) + 1);
  const dominantKeigo = Array.from(keigoCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  if (dominantKeigo) patterns.push(`敬語レベル: ${dominantKeigo[0]}`);

  return patterns;
}

export async function getCreativeRecommendations(
  _organizationId: string,
  platform: string,
  audienceSegment: string,
): Promise<CreativeRecommendation> {
  const relevantFeedback = feedbackStore.filter(
    (f) => f.platform === platform && f.audienceSegment === audienceSegment,
  );

  if (relevantFeedback.length < 4) {
    // Not enough data — return empty recommendation with generic advice
    return {
      positiveExamples: [],
      negativeExamples: [],
      recommendedPatterns: [
        'まだデータが少ないため、A/Bテストを開始してパフォーマンスデータを蓄積してください',
        'プラットフォーム推奨のベストプラクティスに従ってください',
      ],
      avoidPatterns: [],
    };
  }

  const { q25, q75 } = computeQuartileBoundaries(relevantFeedback);
  const { highIds, lowIds } = separatePerformers(relevantFeedback, q25, q75);

  const positiveExamples: CreativeFeatures[] = [];
  const negativeExamples: CreativeFeatures[] = [];

  for (const id of highIds) {
    const features = featuresStore.get(id);
    if (features) positiveExamples.push(features);
  }

  for (const id of lowIds) {
    const features = featuresStore.get(id);
    if (features) negativeExamples.push(features);
  }

  const recommendedPatterns = extractPatterns(positiveExamples);
  const avoidPatterns = extractPatterns(negativeExamples);

  return { positiveExamples, negativeExamples, recommendedPatterns, avoidPatterns };
}

export async function recordPerformanceFeedback(feedback: PerformanceFeedback): Promise<void> {
  // Upsert: replace existing entry for same creativeId+platform+audienceSegment
  const existingIdx = feedbackStore.findIndex(
    (f) =>
      f.creativeId === feedback.creativeId &&
      f.platform === feedback.platform &&
      f.audienceSegment === feedback.audienceSegment,
  );

  if (existingIdx >= 0) {
    feedbackStore[existingIdx] = feedback;
  } else {
    feedbackStore.push(feedback);
  }
}

/**
 * Register creative features for a given creative ID.
 * Called when a creative is first generated or analysed.
 */
export function registerCreativeFeatures(features: CreativeFeatures): void {
  featuresStore.set(features.creativeId, features);
}
