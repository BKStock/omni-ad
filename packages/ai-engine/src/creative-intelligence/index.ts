/**
 * Creative Intelligence Engine
 *
 * Learns what creative patterns work for specific audience segments on specific platforms.
 *
 * v1: Heuristic quartile-based analysis (in-memory).
 * v2: pgvector similarity search + epsilon-greedy feedback loop for variant generation.
 *
 * Database layer (v2) is opt-in via `setDbAdapter`. When no adapter is provided,
 * the engine falls back to the v1 in-memory store so existing callers are unaffected.
 */

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

/** Persisted winning pattern for future variant generation seeding */
export interface WinningPattern {
  patternId: string;
  platform: string;
  audienceSegment: string;
  /** Feature fields that characterise the winner */
  emotionalTone: string;
  ctaType: string;
  layoutPattern: string;
  keigoLevel: string;
  hasFace: boolean;
  textDensity: number;
  /** Average CTR across examples that form this pattern */
  avgCtr: number;
  /** How many creatives support this pattern */
  sampleSize: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Optional database adapter for v2 persistence.
 * Implement this interface and register via `setDbAdapter` to enable pgvector
 * similarity search and winning-pattern persistence.
 */
export interface CreativeDbAdapter {
  /** Upsert embedding in the `creative_embeddings` table */
  upsertEmbedding(features: CreativeFeatures): Promise<void>;
  /** Find top-K similar embeddings via cosine similarity (pgvector <=> operator) */
  findSimilar(embedding: number[], topK: number): Promise<CreativeFeatures[]>;
  /** Upsert a winning pattern record */
  upsertWinningPattern(pattern: WinningPattern): Promise<void>;
  /** Retrieve winning patterns for a platform + audience segment */
  getWinningPatterns(platform: string, audienceSegment: string): Promise<WinningPattern[]>;
}

// ─── Module-level state ───────────────────────────────────────────────────────

/** v1 in-memory fallback stores */
const feedbackStore: PerformanceFeedback[] = [];
const featuresStore: Map<string, CreativeFeatures> = new Map();

let dbAdapter: CreativeDbAdapter | null = null;

/**
 * Register a database adapter to enable v2 pgvector persistence.
 * Safe to call multiple times; the last adapter wins.
 */
export function setDbAdapter(adapter: CreativeDbAdapter): void {
  dbAdapter = adapter;
}

// ─── Epsilon-greedy config ────────────────────────────────────────────────────

/**
 * Epsilon-greedy exploration rate for variant generation feedback loop.
 * ε = probability of choosing a random (exploratory) pattern instead of the
 * known best (exploitative) pattern when seeding new variants.
 */
const EPSILON_INITIAL = 0.2;
const EPSILON_MIN = 0.05;
/** Reduce epsilon by this fraction for each new winning pattern persisted */
const EPSILON_DECAY = 0.01;

let currentEpsilon = EPSILON_INITIAL;

export function getCurrentEpsilon(): number {
  return currentEpsilon;
}

function decayEpsilon(): void {
  currentEpsilon = Math.max(EPSILON_MIN, currentEpsilon - EPSILON_DECAY);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function computeQuartileBoundaries(
  feedbacks: PerformanceFeedback[],
): { q25: number; q75: number } {
  const ctrs = feedbacks.map((f) => f.ctr).sort((a, b) => a - b);
  return { q25: percentile(ctrs, 25), q75: percentile(ctrs, 75) };
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

  const dominantOf = <T extends string>(items: T[]): T | undefined =>
    Array.from(
      items.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<T, number>()),
    ).sort((a, b) => b[1] - a[1])[0]?.[0];

  const tone = dominantOf(features.map((f) => f.emotionalTone));
  if (tone) patterns.push(`感情トーン: ${tone}`);

  const cta = dominantOf(features.map((f) => f.ctaType));
  if (cta) patterns.push(`CTAタイプ: ${cta}`);

  const layout = dominantOf(features.map((f) => f.layoutPattern));
  if (layout) patterns.push(`レイアウト: ${layout}`);

  const faceRate = features.filter((f) => f.hasFace).length / features.length;
  if (faceRate >= 0.6) patterns.push('人物画像の使用（60%以上）');
  else if (faceRate <= 0.2) patterns.push('人物画像なし（20%以下）');

  const avgDensity = features.reduce((s, f) => s + f.textDensity, 0) / features.length;
  if (avgDensity > 0.6) patterns.push('テキスト密度: 高');
  else if (avgDensity < 0.3) patterns.push('テキスト密度: 低');

  const keigo = dominantOf(features.map((f) => f.keigoLevel));
  if (keigo) patterns.push(`敬語レベル: ${keigo}`);

  return patterns;
}

// ─── Pattern persistence (v2) ─────────────────────────────────────────────────

/**
 * Derives a WinningPattern from a set of high-performing creative features and
 * persists it to the DB (when an adapter is available).
 * Also decays epsilon so future variant generation exploits known winners more.
 */
async function persistWinningPattern(
  positiveExamples: CreativeFeatures[],
  positiveFeedbacks: PerformanceFeedback[],
  platform: string,
  audienceSegment: string,
): Promise<void> {
  if (!dbAdapter || positiveExamples.length === 0) return;

  const avgCtr =
    positiveFeedbacks.reduce((s, f) => s + f.ctr, 0) / positiveFeedbacks.length;

  const dominant = <T extends string>(arr: T[]): T =>
    (Array.from(
      arr.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<T, number>()),
    ).sort((a, b) => b[1] - a[1])[0]?.[0]) ?? ('' as T);

  const pattern: WinningPattern = {
    patternId: `${platform}_${audienceSegment}_${Date.now()}`,
    platform,
    audienceSegment,
    emotionalTone: dominant(positiveExamples.map((f) => f.emotionalTone)),
    ctaType: dominant(positiveExamples.map((f) => f.ctaType)),
    layoutPattern: dominant(positiveExamples.map((f) => f.layoutPattern)),
    keigoLevel: dominant(positiveExamples.map((f) => f.keigoLevel)),
    hasFace: positiveExamples.filter((f) => f.hasFace).length / positiveExamples.length >= 0.5,
    textDensity:
      positiveExamples.reduce((s, f) => s + f.textDensity, 0) / positiveExamples.length,
    avgCtr,
    sampleSize: positiveExamples.length,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await dbAdapter.upsertWinningPattern(pattern);
  decayEpsilon();
}

// ─── Epsilon-greedy variant seeding ──────────────────────────────────────────

/**
 * Returns a WinningPattern to seed the next generation of variants.
 *
 * With probability (1 - ε): returns the best known pattern (exploit).
 * With probability ε: returns a random pattern (explore).
 *
 * Falls back to `null` when no patterns are persisted yet.
 */
export async function sampleSeedPattern(
  platform: string,
  audienceSegment: string,
): Promise<WinningPattern | null> {
  if (!dbAdapter) return null;

  const patterns = await dbAdapter.getWinningPatterns(platform, audienceSegment);
  if (patterns.length === 0) return null;

  if (Math.random() < currentEpsilon) {
    // Explore: random pattern
    return patterns[Math.floor(Math.random() * patterns.length)] ?? null;
  }

  // Exploit: highest avgCtr
  return patterns.reduce((best, p) => (p.avgCtr > best.avgCtr ? p : best), patterns[0]!);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getCreativeRecommendations(
  _organizationId: string,
  platform: string,
  audienceSegment: string,
): Promise<CreativeRecommendation> {
  const relevantFeedback = feedbackStore.filter(
    (f) => f.platform === platform && f.audienceSegment === audienceSegment,
  );

  if (relevantFeedback.length < 4) {
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
    const f = featuresStore.get(id);
    if (f) positiveExamples.push(f);
  }
  for (const id of lowIds) {
    const f = featuresStore.get(id);
    if (f) negativeExamples.push(f);
  }

  // v2: persist winning patterns and upsert embeddings in DB
  if (dbAdapter && positiveExamples.length > 0) {
    const positiveFeedbacks = relevantFeedback.filter((f) => highIds.has(f.creativeId));
    await persistWinningPattern(positiveExamples, positiveFeedbacks, platform, audienceSegment);
    for (const feat of positiveExamples) {
      await dbAdapter.upsertEmbedding(feat);
    }
  }

  return {
    positiveExamples,
    negativeExamples,
    recommendedPatterns: extractPatterns(positiveExamples),
    avoidPatterns: extractPatterns(negativeExamples),
  };
}

export async function recordPerformanceFeedback(feedback: PerformanceFeedback): Promise<void> {
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
 * Also upserts the embedding into pgvector when a DB adapter is configured.
 */
export async function registerCreativeFeatures(features: CreativeFeatures): Promise<void> {
  featuresStore.set(features.creativeId, features);
  if (dbAdapter) {
    await dbAdapter.upsertEmbedding(features);
  }
}

/**
 * Find creatives similar to the given embedding via pgvector cosine similarity.
 * Returns empty array when no DB adapter is configured (graceful degradation).
 */
export async function findSimilarCreatives(
  embedding: number[],
  topK = 10,
): Promise<CreativeFeatures[]> {
  if (!dbAdapter) return [];
  return dbAdapter.findSimilar(embedding, topK);
}
