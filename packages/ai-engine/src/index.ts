// Creative Generation
export { generateAdText, type TextGenerationRequest, type GeneratedText } from './creative/text-generator.js';
export { generateAdImage, type ImageGenerationRequest, type GeneratedImage } from './creative/image-generator.js';
export { generateAdVideo, type VideoGenerationRequest, type GeneratedVideo } from './creative/video-generator.js';
export { adaptForPlatform, type PlatformAdaptationRequest, type AdaptedCreative } from './creative/platform-adapter.js';

// Video Pipeline
export { generateVideoScript, type ScriptGenerationRequest } from './creative/script-generator.js';
export {
  assembleVideo,
  getPlatformAspectRatio,
  type VideoAssemblyRequest,
  type AssembledScene,
  type AssembledVideo,
  type AspectRatio,
  type PlatformExportTarget,
} from './creative/video-assembler.js';
export {
  runVideoPipeline,
  generateAdVideoFromBrief,
  type CampaignBrief,
  type PipelineTarget,
  type PipelineRequest,
  type PipelineVariant,
  type PipelineResult,
} from './creative/pipeline.js';

// Budget Optimization
export { initializeArms, updateArm, computeAllocation, resetArm, type BanditArm, type BanditConfig, type AllocationResult } from './optimization/bandit.js';

// Creative Variant Optimization (Thompson Sampling at variant level)
export {
  initializeVariantArm,
  updateVariantArm,
  pauseVariantArm,
  markVariantScaled,
  computeVariantAllocation,
  checkSignificance,
  selectLosers,
  selectWinner,
  type VariantArm,
  type VariantAllocationResult,
  type SignificanceResult,
} from './optimization/creative-bandit.js';

// Creative Variant Generation
export {
  generateVariants,
  type CampaignBrief as VariantCampaignBrief,
  type CreativeVariant,
  type GeneratorResult,
  type Platform as AdPlatform,
  type AdFormat,
  type VisualStyle,
  type PlatformDimensions,
} from './optimization/variant-generator.js';
export { forecastRoas, simulateBudgetChange, type ForecastInput, type ForecastResult, type SimulationInput, type SimulationResult } from './optimization/forecaster.js';
export { executeAllocationCycle, type AllocationRequest, type AllocationConstraints, type PlatformMetricsSummary } from './optimization/allocator.js';

// Attribution
export { computeMarkovAttribution, type TouchpointSequence, type AttributionResult } from './attribution/markov.js';
export { computeShapleyAttribution, type ShapleyInput, type ShapleyResult } from './attribution/shapley.js';

// Insights
export { generateInsights, type InsightInput, type Insight, type InsightType, type InsightSeverity } from './insights/index.js';

// Creative Intelligence
export {
  getCreativeRecommendations,
  recordPerformanceFeedback,
  registerCreativeFeatures,
  findSimilarCreatives,
  sampleSeedPattern,
  setDbAdapter,
  getCurrentEpsilon,
  type CreativeFeatures,
  type PerformanceFeedback,
  type CreativeRecommendation,
  type WinningPattern,
  type CreativeDbAdapter,
} from './creative-intelligence/index.js';

// Japanese Seasonality Intelligence
export {
  getActiveEvents,
  getUpcomingEvents,
  getSeasonalMultiplier,
  getRecommendedKeywords,
  getRecommendedThemes,
  type SeasonalEvent,
  type IndustryImpact,
  type Industry,
} from './seasonality/japanese-calendar.js';

// Compliance
export {
  checkCreativeCompliance,
  type ComplianceResult,
  type ComplianceViolation,
  type CreativeInput,
} from './compliance/policy-checker.js';
