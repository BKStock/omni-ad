import { type VideoScript } from '@omni-ad/shared';
import { generateVideoScript, type ScriptGenerationRequest } from './script-generator.js';
import {
  assembleVideo,
  getPlatformAspectRatio,
  type AssembledVideo,
  type PlatformExportTarget,
} from './video-assembler.js';

export interface CampaignBrief {
  productName: string;
  productDescription: string;
  targetAudience: string;
  goal: string;
  language: 'ja' | 'en';
  keigoLevel: 'casual' | 'polite' | 'formal';
  brandColors: string[];
  imageStyle: string;
}

export interface PipelineTarget {
  platform: PlatformExportTarget;
  durationSeconds: number;
}

export interface PipelineRequest {
  brief: CampaignBrief;
  targets: PipelineTarget[];
  /** マルチバリアント: フック・スタイル別に複数バリアントを生成 */
  variantCount?: number;
}

export interface PipelineVariant {
  variantIndex: number;
  script: VideoScript;
  videos: AssembledVideo[];
}

export interface PipelineResult {
  productName: string;
  variants: PipelineVariant[];
  totalVideosGenerated: number;
}

const HOOK_STYLES = [
  'problem-solution hook',
  'curiosity hook',
  'testimonial hook',
  'offer hook',
];

const IMAGE_STYLES = [
  'cinematic, high contrast',
  'bright, clean, minimal',
  'warm, natural, authentic',
  'bold, graphic, modern',
];

function buildScriptRequest(
  brief: CampaignBrief,
  target: PipelineTarget,
  variantIndex: number,
): ScriptGenerationRequest {
  const hookStyle = HOOK_STYLES[variantIndex % HOOK_STYLES.length] ?? HOOK_STYLES[0];
  const goalWithHook = `${brief.goal} — use a ${hookStyle}`;

  return {
    productName: brief.productName,
    productDescription: brief.productDescription,
    targetAudience: brief.targetAudience,
    goal: goalWithHook,
    durationSeconds: target.durationSeconds,
    language: brief.language,
    keigoLevel: brief.keigoLevel,
    platform: target.platform,
    brandColors: brief.brandColors,
  };
}

function getImageStyle(variantIndex: number, briefStyle: string): string {
  if (briefStyle) return briefStyle;
  return IMAGE_STYLES[variantIndex % IMAGE_STYLES.length] ?? IMAGE_STYLES[0] ?? 'cinematic';
}

async function generateVariant(
  brief: CampaignBrief,
  targets: PipelineTarget[],
  variantIndex: number,
): Promise<PipelineVariant> {
  // 最初のターゲットのスクリプトを生成（マルチターゲットは同スクリプトを再利用）
  const primaryTarget = targets[0];
  if (!primaryTarget) throw new Error('At least one pipeline target is required');

  const scriptRequest = buildScriptRequest(brief, primaryTarget, variantIndex);
  const script = await generateVideoScript(scriptRequest);

  const imageStyle = getImageStyle(variantIndex, brief.imageStyle);

  // 各ターゲットプラットフォーム向けに動画を組み立て（並列）
  const videos = await Promise.all(
    targets.map(async (target) => {
      const aspectRatio = getPlatformAspectRatio(target.platform);
      return assembleVideo({
        script,
        brandColors: brief.brandColors,
        imageStyle,
        aspectRatio,
        platform: target.platform,
      });
    }),
  );

  return { variantIndex, script, videos };
}

export async function runVideoPipeline(request: PipelineRequest): Promise<PipelineResult> {
  const { brief, targets, variantCount = 1 } = request;

  if (targets.length === 0) throw new Error('At least one pipeline target is required');
  if (variantCount < 1 || variantCount > 4) {
    throw new Error('variantCount must be between 1 and 4');
  }

  // バリアントをシリアルで生成（API制限考慮）
  const variants: PipelineVariant[] = [];
  for (let i = 0; i < variantCount; i++) {
    const variant = await generateVariant(brief, targets, i);
    variants.push(variant);
  }

  const totalVideosGenerated = variants.reduce((sum, v) => sum + v.videos.length, 0);

  return {
    productName: brief.productName,
    variants,
    totalVideosGenerated,
  };
}

/** シングルターゲット・シングルバリアントの簡易API */
export async function generateAdVideoFromBrief(
  brief: CampaignBrief,
  platform: PlatformExportTarget,
  durationSeconds: number,
): Promise<AssembledVideo> {
  const result = await runVideoPipeline({
    brief,
    targets: [{ platform, durationSeconds }],
    variantCount: 1,
  });

  const firstVariant = result.variants[0];
  if (!firstVariant) throw new Error('Pipeline returned no variants');

  const firstVideo = firstVariant.videos[0];
  if (!firstVideo) throw new Error('Pipeline returned no videos');

  return firstVideo;
}
