// Creative Generation
export { generateAdText, type TextGenerationRequest, type GeneratedText } from './creative/text-generator.js';
export { generateAdImage, type ImageGenerationRequest, type GeneratedImage } from './creative/image-generator.js';
export { generateAdVideo, type VideoGenerationRequest, type GeneratedVideo } from './creative/video-generator.js';
export { adaptForPlatform, type PlatformAdaptationRequest, type AdaptedCreative } from './creative/platform-adapter.js';

// Budget Optimization
export { initializeArms, updateArm, computeAllocation, type BanditArm, type BanditConfig, type AllocationResult } from './optimization/bandit.js';
export { forecastRoas, simulateBudgetChange, type ForecastInput, type ForecastResult, type SimulationInput, type SimulationResult } from './optimization/forecaster.js';
export { executeAllocationCycle, type AllocationRequest, type AllocationConstraints } from './optimization/allocator.js';

// Attribution
export { computeMarkovAttribution, type TouchpointSequence, type AttributionResult } from './attribution/markov.js';
export { computeShapleyAttribution, type ShapleyInput, type ShapleyResult } from './attribution/shapley.js';

// Insights
export { generateInsights, type InsightInput, type Insight, type InsightType, type InsightSeverity } from './insights/index.js';

// Creative Intelligence
export { getCreativeRecommendations, recordPerformanceFeedback, type CreativeFeatures, type PerformanceFeedback, type CreativeRecommendation } from './creative-intelligence/index.js';
