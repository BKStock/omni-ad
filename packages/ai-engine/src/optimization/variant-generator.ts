/**
 * Creative Variant Generator
 *
 * Generates 50–200 creative variant combinations from a campaign brief.
 * Combinations span: headline × body × CTA × visual style × format.
 * Each variant is validated against platform constraints before being returned.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Platform = 'google' | 'meta' | 'tiktok' | 'twitter' | 'line' | 'yahoo_japan';
export type AdFormat = 'feed' | 'story' | 'banner' | 'search' | 'video' | 'carousel';
export type VisualStyle =
  | 'photo_lifestyle'
  | 'photo_product'
  | 'illustration'
  | 'typography_only'
  | 'ugc_style'
  | 'minimal_clean';

export interface CampaignBrief {
  campaignId: string;
  brand: string;
  product: string;
  /** 1–3 sentence value proposition */
  valueProposition: string;
  targetAudience: string;
  industry: string;
  platforms: Platform[];
  formats: AdFormat[];
  /** Additional headline seeds (optional) */
  headlineSeeds?: string[];
  /** Additional body copy seeds (optional) */
  bodySeeds?: string[];
  /** CTA options the brand wants to test (optional; falls back to defaults) */
  ctaOverrides?: string[];
  maxVariants?: number;
}

export interface CreativeVariant {
  variantId: string;
  campaignId: string;
  platform: Platform;
  format: AdFormat;
  headline: string;
  body: string;
  cta: string;
  visualStyle: VisualStyle;
  /** Validation errors; empty array means the variant is valid */
  validationErrors: string[];
  isValid: boolean;
  /** Dimension constraints for this platform × format */
  dimensions: PlatformDimensions;
  /** Estimated character counts */
  charCounts: { headline: number; body: number; cta: number };
}

export interface PlatformDimensions {
  width: number;
  height: number;
  aspectRatio: string;
  maxHeadlineChars: number;
  maxBodyChars: number;
  maxCtaChars: number;
}

export interface GeneratorResult {
  variants: CreativeVariant[];
  totalGenerated: number;
  validCount: number;
  invalidCount: number;
  /** Breakdown by platform */
  byPlatform: Record<Platform, number>;
  /** Breakdown by format */
  byFormat: Record<AdFormat, number>;
}

// ─── Platform constraints ─────────────────────────────────────────────────────

const PLATFORM_DIMENSIONS: Record<Platform, Partial<Record<AdFormat, PlatformDimensions>>> = {
  google: {
    search: { width: 0, height: 0, aspectRatio: 'N/A', maxHeadlineChars: 30, maxBodyChars: 90, maxCtaChars: 20 },
    banner: { width: 1200, height: 628, aspectRatio: '1.91:1', maxHeadlineChars: 30, maxBodyChars: 90, maxCtaChars: 20 },
    video: { width: 1920, height: 1080, aspectRatio: '16:9', maxHeadlineChars: 15, maxBodyChars: 70, maxCtaChars: 15 },
  },
  meta: {
    feed: { width: 1080, height: 1080, aspectRatio: '1:1', maxHeadlineChars: 40, maxBodyChars: 125, maxCtaChars: 20 },
    story: { width: 1080, height: 1920, aspectRatio: '9:16', maxHeadlineChars: 40, maxBodyChars: 125, maxCtaChars: 20 },
    carousel: { width: 1080, height: 1080, aspectRatio: '1:1', maxHeadlineChars: 40, maxBodyChars: 125, maxCtaChars: 20 },
    video: { width: 1080, height: 1080, aspectRatio: '1:1', maxHeadlineChars: 40, maxBodyChars: 125, maxCtaChars: 20 },
  },
  tiktok: {
    feed: { width: 1080, height: 1920, aspectRatio: '9:16', maxHeadlineChars: 50, maxBodyChars: 150, maxCtaChars: 20 },
    video: { width: 1080, height: 1920, aspectRatio: '9:16', maxHeadlineChars: 50, maxBodyChars: 150, maxCtaChars: 20 },
  },
  twitter: {
    feed: { width: 1200, height: 628, aspectRatio: '1.91:1', maxHeadlineChars: 70, maxBodyChars: 280, maxCtaChars: 25 },
    banner: { width: 1500, height: 500, aspectRatio: '3:1', maxHeadlineChars: 70, maxBodyChars: 280, maxCtaChars: 25 },
  },
  line: {
    feed: { width: 1200, height: 628, aspectRatio: '1.91:1', maxHeadlineChars: 40, maxBodyChars: 100, maxCtaChars: 20 },
    banner: { width: 1200, height: 628, aspectRatio: '1.91:1', maxHeadlineChars: 40, maxBodyChars: 100, maxCtaChars: 20 },
  },
  yahoo_japan: {
    feed: { width: 1200, height: 628, aspectRatio: '1.91:1', maxHeadlineChars: 30, maxBodyChars: 90, maxCtaChars: 20 },
    banner: { width: 728, height: 90, aspectRatio: '8.09:1', maxHeadlineChars: 25, maxBodyChars: 80, maxCtaChars: 15 },
    search: { width: 0, height: 0, aspectRatio: 'N/A', maxHeadlineChars: 30, maxBodyChars: 90, maxCtaChars: 20 },
  },
};

const DEFAULT_DIMENSIONS: PlatformDimensions = {
  width: 1200, height: 628, aspectRatio: '1.91:1',
  maxHeadlineChars: 40, maxBodyChars: 120, maxCtaChars: 20,
};

function getDimensions(platform: Platform, format: AdFormat): PlatformDimensions {
  return PLATFORM_DIMENSIONS[platform]?.[format] ?? DEFAULT_DIMENSIONS;
}

// ─── Content pools ────────────────────────────────────────────────────────────

const DEFAULT_CTAS = [
  '今すぐ試す',
  '詳細を見る',
  '無料で始める',
  '申し込む',
  '購入する',
  '資料請求',
  '限定オファー',
  'もっと見る',
];

const VISUAL_STYLES: VisualStyle[] = [
  'photo_lifestyle',
  'photo_product',
  'illustration',
  'typography_only',
  'ugc_style',
  'minimal_clean',
];

/**
 * Generates headline variants from brief seeds.
 * Returns 4–8 unique headline strings.
 */
function buildHeadlines(brief: CampaignBrief): string[] {
  const bases = brief.headlineSeeds ?? [];
  const generated = [
    `${brief.product}で${brief.targetAudience}の悩みを解決`,
    `【限定】${brief.product}を今すぐ体験`,
    `${brief.brand}の${brief.product}が選ばれる理由`,
    `${brief.targetAudience}に最適な${brief.product}`,
    `${brief.product}で成果を最大化`,
    `話題の${brief.product}、${brief.brand}より`,
    `${brief.targetAudience}向け${brief.product}特別価格`,
    `${brief.product}の効果を実感してください`,
  ];
  const pool = [...new Set([...bases, ...generated])];
  return pool.slice(0, 10);
}

/**
 * Generates body copy variants from brief seeds.
 * Returns 4–8 unique body strings.
 */
function buildBodies(brief: CampaignBrief): string[] {
  const bases = brief.bodySeeds ?? [];
  const generated = [
    brief.valueProposition,
    `${brief.targetAudience}に選ばれている${brief.product}。今すぐお試しください。`,
    `${brief.brand}の${brief.product}は${brief.industry}業界で実績No.1。`,
    `特別キャンペーン実施中。期間限定でお得にご利用いただけます。`,
    `多くの${brief.targetAudience}が実感した効果をあなたも体験してみませんか。`,
    `${brief.product}で毎日の生活をより便利に、より豊かに。`,
    `初回限定特典あり。まずは無料でお試しください。`,
    `${brief.industry}のプロが選ぶ${brief.product}。信頼と実績の${brief.brand}。`,
  ];
  const pool = [...new Set([...bases, ...generated])];
  return pool.slice(0, 10);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateVariant(
  headline: string,
  body: string,
  cta: string,
  dims: PlatformDimensions,
): string[] {
  const errors: string[] = [];
  if (headline.length > dims.maxHeadlineChars) {
    errors.push(`見出し超過: ${headline.length}/${dims.maxHeadlineChars}文字`);
  }
  if (body.length > dims.maxBodyChars) {
    errors.push(`本文超過: ${body.length}/${dims.maxBodyChars}文字`);
  }
  if (cta.length > dims.maxCtaChars) {
    errors.push(`CTA超過: ${cta.length}/${dims.maxCtaChars}文字`);
  }
  return errors;
}

// ─── ID generation ────────────────────────────────────────────────────────────

function makeVariantId(
  campaignId: string,
  platform: Platform,
  format: AdFormat,
  index: number,
): string {
  return `${campaignId}_${platform}_${format}_v${String(index).padStart(4, '0')}`;
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generates 50–200 creative variants from a campaign brief.
 *
 * Strategy: iterate platform × format × headline × body × CTA × visual style.
 * When the full Cartesian product exceeds maxVariants we sample systematically
 * (every N-th combination) to preserve diversity across all dimensions.
 */
export function generateVariants(brief: CampaignBrief): GeneratorResult {
  const maxVariants = Math.min(Math.max(brief.maxVariants ?? 150, 50), 200);

  const headlines = buildHeadlines(brief);
  const bodies = buildBodies(brief);
  const ctas = brief.ctaOverrides ?? DEFAULT_CTAS;

  // Build all (platform, format) pairs requested
  const platformFormats: { platform: Platform; format: AdFormat }[] = [];
  for (const platform of brief.platforms) {
    for (const format of brief.formats) {
      // Only include combinations that have known dimension configs
      if (PLATFORM_DIMENSIONS[platform]?.[format] || brief.platforms.length === 1) {
        platformFormats.push({ platform, format });
      }
    }
  }
  if (platformFormats.length === 0) {
    for (const platform of brief.platforms) {
      for (const format of brief.formats) {
        platformFormats.push({ platform, format });
      }
    }
  }

  // Total Cartesian product size
  const totalCombinations =
    platformFormats.length * headlines.length * bodies.length * ctas.length * VISUAL_STYLES.length;

  // Sampling step: skip every N-th entry to fit within maxVariants
  const step = totalCombinations <= maxVariants ? 1 : Math.ceil(totalCombinations / maxVariants);

  const variants: CreativeVariant[] = [];
  let globalIdx = 0;
  let emittedIdx = 0;

  outer: for (const { platform, format } of platformFormats) {
    for (const headline of headlines) {
      for (const body of bodies) {
        for (const cta of ctas) {
          for (const visualStyle of VISUAL_STYLES) {
            if (globalIdx % step === 0) {
              const dims = getDimensions(platform, format);
              const errors = validateVariant(headline, body, cta, dims);
              variants.push({
                variantId: makeVariantId(brief.campaignId, platform, format, emittedIdx),
                campaignId: brief.campaignId,
                platform,
                format,
                headline,
                body,
                cta,
                visualStyle,
                validationErrors: errors,
                isValid: errors.length === 0,
                dimensions: dims,
                charCounts: {
                  headline: headline.length,
                  body: body.length,
                  cta: cta.length,
                },
              });
              emittedIdx++;
              if (emittedIdx >= maxVariants) break outer;
            }
            globalIdx++;
          }
        }
      }
    }
  }

  // Aggregate statistics
  const byPlatform: Record<Platform, number> = {} as Record<Platform, number>;
  const byFormat: Record<AdFormat, number> = {} as Record<AdFormat, number>;

  for (const v of variants) {
    byPlatform[v.platform] = (byPlatform[v.platform] ?? 0) + 1;
    byFormat[v.format] = (byFormat[v.format] ?? 0) + 1;
  }

  const validCount = variants.filter((v) => v.isValid).length;

  return {
    variants,
    totalGenerated: variants.length,
    validCount,
    invalidCount: variants.length - validCount,
    byPlatform,
    byFormat,
  };
}
