import { type VideoScript, type VideoScene } from '@omni-ad/shared';
import { generateAdImage } from './image-generator.js';
import { generateAdVideo } from './video-generator.js';

export type AspectRatio = '9:16' | '16:9' | '1:1';

export type PlatformExportTarget =
  | 'tiktok'
  | 'douyin'
  | 'instagram-reels'
  | 'youtube-shorts'
  | 'youtube'
  | 'meta-feed';

export interface VideoAssemblyRequest {
  script: VideoScript;
  brandColors: string[];
  imageStyle: string;
  aspectRatio: AspectRatio;
  platform: PlatformExportTarget;
}

export interface AssembledScene {
  order: number;
  imageUrl: string;
  videoUrl: string;
  durationSeconds: number;
  textOverlay?: string;
  transition: VideoScene['transition'];
}

export interface AssembledVideo {
  platform: PlatformExportTarget;
  aspectRatio: AspectRatio;
  totalDurationSeconds: number;
  scenes: AssembledScene[];
  /** シーン動画URLのリスト（FFmpeg未使用時はシーン毎の個別URL） */
  sceneUrls: string[];
  /** FFmpegで結合済みの場合のみ存在 */
  finalVideoUrl: string | null;
  model: string;
}

const PLATFORM_ASPECT_RATIO: Record<PlatformExportTarget, AspectRatio> = {
  tiktok: '9:16',
  douyin: '9:16',
  'instagram-reels': '9:16',
  'youtube-shorts': '9:16',
  youtube: '16:9',
  'meta-feed': '1:1',
};

const PLATFORM_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
};

function toRunwayAspectRatio(
  ratio: AspectRatio,
): '16:9' | '9:16' | '1:1' {
  return ratio;
}

function clampRunwayDuration(seconds: number): 6 | 15 | 30 {
  if (seconds <= 6) return 6;
  if (seconds <= 15) return 15;
  return 30;
}

function buildSceneImagePrompt(scene: VideoScene, imageStyle: string): string {
  const styleMap: Record<VideoScene['visualStyle'], string> = {
    'product-focus': 'product photography, clean background, professional lighting',
    lifestyle: 'lifestyle photography, natural setting, authentic feel',
    testimonial: 'portrait photography, warm lighting, approachable expression',
    'text-heavy': 'minimalist background, clean design, bold typography space',
  };
  const base = styleMap[scene.visualStyle];
  return `${scene.description}. ${base}. Style: ${imageStyle}.`;
}

async function assembleScene(
  scene: VideoScene,
  brandColors: string[],
  imageStyle: string,
  aspectRatio: AspectRatio,
): Promise<AssembledScene> {
  const dimensions = PLATFORM_DIMENSIONS[aspectRatio];

  // シーン画像生成
  const imagePrompt = buildSceneImagePrompt(scene, imageStyle);
  const images = await generateAdImage({
    prompt: imagePrompt,
    style: imageStyle,
    dimensions: [dimensions],
    brandColors,
  });

  const frameUrl = images[0]?.url;
  if (!frameUrl) {
    throw new Error(`Scene ${scene.order}: image generation returned no URL`);
  }

  // シーン動画生成
  const videoDuration = clampRunwayDuration(scene.duration);
  const video = await generateAdVideo({
    prompt: scene.description,
    durationSeconds: videoDuration,
    imageFrameUrls: [frameUrl],
    aspectRatio: toRunwayAspectRatio(aspectRatio),
  });

  return {
    order: scene.order,
    imageUrl: frameUrl,
    videoUrl: video.url,
    durationSeconds: scene.duration,
    textOverlay: scene.textOverlay,
    transition: scene.transition,
  };
}

export async function assembleVideo(
  request: VideoAssemblyRequest,
): Promise<AssembledVideo> {
  const { script, brandColors, imageStyle, aspectRatio, platform } = request;

  // シーンをシリアルで処理（Runway API負荷軽減）
  const assembledScenes: AssembledScene[] = [];
  for (const scene of script.scenes) {
    const assembled = await assembleScene(scene, brandColors, imageStyle, aspectRatio);
    assembledScenes.push(assembled);
  }

  // シーンURLを順番に並べる
  const sortedScenes = assembledScenes.sort((a, b) => a.order - b.order);
  const sceneUrls = sortedScenes.map((s) => s.videoUrl);

  return {
    platform,
    aspectRatio,
    totalDurationSeconds: script.duration,
    scenes: sortedScenes,
    sceneUrls,
    finalVideoUrl: null, // FFmpegなしのため個別シーンURLを返す
    model: 'runway-gen3a-turbo + gpt-image-1',
  };
}

/** プラットフォームのデフォルトアスペクト比を返す */
export function getPlatformAspectRatio(platform: PlatformExportTarget): AspectRatio {
  return PLATFORM_ASPECT_RATIO[platform];
}
