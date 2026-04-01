import { PLATFORM_CREATIVE_SPECS } from '@omni-ad/shared';
import { Platform } from '@omni-ad/shared';
import { countCharacterWidth } from '@omni-ad/shared';

export interface PlatformAdaptationRequest {
  sourceContent: {
    headline: string;
    body: string;
    cta: string;
    imageUrl: string | null;
    videoUrl: string | null;
  };
  targetPlatform: string;
  targetDimensions: { width: number; height: number };
  maxHeadlineLength: number;
  maxBodyLength: number;
}

export interface AdaptedCreative {
  headline: string;
  body: string;
  cta: string;
  imageUrl: string | null;
  videoUrl: string | null;
  platform: string;
  dimensions: { width: number; height: number };
}

function truncateToCharWidth(text: string, maxWidth: number): string {
  let width = 0;
  let result = '';
  for (const char of text) {
    const charWidth = countCharacterWidth(char);
    if (width + charWidth > maxWidth) break;
    width += charWidth;
    result += char;
  }
  return result;
}

function validateDimensions(
  requested: { width: number; height: number },
  platform: string,
  specs: { dimensions: { name: string; width: number; height: number }[] },
): void {
  const match = specs.dimensions.find(
    (d) => d.width === requested.width && d.height === requested.height,
  );
  if (!match) {
    const allowed = specs.dimensions
      .map((d) => `${d.name} (${d.width}x${d.height})`)
      .join(', ');
    throw new Error(
      `Dimensions ${requested.width}x${requested.height} not supported for ${platform}. ` +
        `Allowed: ${allowed}`,
    );
  }
}

function toPlatformEnum(platform: string): Platform | null {
  const upper = platform.toUpperCase() as keyof typeof Platform;
  return Platform[upper] ?? null;
}

export async function adaptForPlatform(
  request: PlatformAdaptationRequest,
): Promise<AdaptedCreative> {
  const platformEnum = toPlatformEnum(request.targetPlatform);
  const specs = platformEnum ? PLATFORM_CREATIVE_SPECS[platformEnum] : null;

  const headlineLimit = specs?.maxHeadlineLength ?? request.maxHeadlineLength;
  const bodyLimit = specs?.maxBodyLength ?? request.maxBodyLength;

  const headline = truncateToCharWidth(request.sourceContent.headline, headlineLimit);
  const body = truncateToCharWidth(request.sourceContent.body, bodyLimit);

  if (specs) {
    validateDimensions(request.targetDimensions, request.targetPlatform, specs);
  }

  return {
    headline,
    body,
    cta: request.sourceContent.cta,
    imageUrl: request.sourceContent.imageUrl,
    videoUrl: request.sourceContent.videoUrl,
    platform: request.targetPlatform,
    dimensions: request.targetDimensions,
  };
}
