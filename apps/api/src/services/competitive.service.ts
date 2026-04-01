/**
 * Competitive Intelligence Service
 *
 * Provides competitor ad analysis via Meta Ad Library API,
 * creative pattern extraction, share of voice estimation,
 * and competitive reporting.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompetitorAd {
  adId: string;
  domain: string;
  platform: string;
  headline: string;
  body: string;
  cta: string;
  mediaType: 'image' | 'video' | 'carousel';
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  estimatedSpend: SpendRange | null;
  impressions: ImpressionRange | null;
}

export interface SpendRange {
  lower: number;
  upper: number;
  currency: string;
}

export interface ImpressionRange {
  lower: number;
  upper: number;
}

export interface CreativePattern {
  theme: string;
  frequency: number;
  formats: string[];
  averageDurationDays: number;
  messagingTones: string[];
  topKeywords: string[];
}

export interface ShareOfVoiceResult {
  domain: string;
  category: string;
  estimatedSov: number;
  competitorCount: number;
  topCompetitors: SovEntry[];
  period: { start: string; end: string };
}

export interface SovEntry {
  domain: string;
  adCount: number;
  estimatedSpend: SpendRange;
  sovPercentage: number;
}

export interface CompetitiveReport {
  organizationId: string;
  generatedAt: string;
  competitors: CompetitorAnalysis[];
  insights: CompetitiveInsight[];
  recommendations: string[];
}

export interface CompetitorAnalysis {
  domain: string;
  adCount: number;
  activeAdCount: number;
  patterns: CreativePattern[];
  topFormats: FormatBreakdown[];
  estimatedMonthlySpend: SpendRange | null;
}

export interface FormatBreakdown {
  format: string;
  count: number;
  percentage: number;
}

export interface CompetitiveInsight {
  type: 'opportunity' | 'threat' | 'trend';
  title: string;
  description: string;
  actionable: boolean;
}

// ---------------------------------------------------------------------------
// Meta Ad Library API Client
// ---------------------------------------------------------------------------

interface MetaAdLibraryParams {
  searchTerms?: string;
  adReachedCountries: string;
  adType: 'ALL' | 'POLITICAL_AND_ISSUE_ADS';
  limit: number;
  searchPageIds?: string;
}

interface MetaAdLibraryResponse {
  data: MetaAdRecord[];
  paging?: { cursors: { after: string }; next: string };
}

interface MetaAdRecord {
  id: string;
  ad_creation_time: string;
  ad_delivery_start_time: string;
  ad_delivery_stop_time?: string;
  page_name: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  spend?: { lower_bound: string; upper_bound: string };
  impressions?: { lower_bound: string; upper_bound: string };
  currency?: string;
}

function isMetaAdLibraryResponse(value: unknown): value is MetaAdLibraryResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v['data']);
}

async function callMetaAdLibrary(
  params: MetaAdLibraryParams,
): Promise<MetaAdRecord[]> {
  const accessToken = process.env['META_AD_LIBRARY_TOKEN'];
  if (!accessToken) {
    throw new Error('META_AD_LIBRARY_TOKEN not configured');
  }

  const searchParams = new URLSearchParams({
    access_token: accessToken,
    ad_reached_countries: `["${params.adReachedCountries}"]`,
    ad_type: params.adType,
    limit: String(params.limit),
    fields: [
      'id',
      'ad_creation_time',
      'ad_delivery_start_time',
      'ad_delivery_stop_time',
      'page_name',
      'ad_creative_bodies',
      'ad_creative_link_captions',
      'ad_creative_link_titles',
      'ad_creative_link_descriptions',
      'spend',
      'impressions',
      'currency',
    ].join(','),
  });

  if (params.searchTerms) {
    searchParams.set('search_terms', params.searchTerms);
  }
  if (params.searchPageIds) {
    searchParams.set('search_page_ids', params.searchPageIds);
  }

  const url = `https://graph.facebook.com/v19.0/ads_archive?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'user-agent': 'OMNI-AD-CompetitiveIntel/1.0' },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta Ad Library API error ${response.status}: ${text}`);
  }

  const body: unknown = await response.json();
  if (!isMetaAdLibraryResponse(body)) {
    throw new Error('Unexpected response shape from Meta Ad Library API');
  }

  return body.data;
}

function mapMetaAdToCompetitorAd(record: MetaAdRecord, domain: string): CompetitorAd {
  const bodies = record.ad_creative_bodies ?? [];
  const titles = record.ad_creative_link_titles ?? [];
  const captions = record.ad_creative_link_captions ?? [];

  return {
    adId: record.id,
    domain,
    platform: 'meta',
    headline: titles[0] ?? '',
    body: bodies[0] ?? '',
    cta: captions[0] ?? '',
    mediaType: 'image', // Default; real impl would detect from creative assets
    startDate: record.ad_delivery_start_time,
    endDate: record.ad_delivery_stop_time ?? null,
    isActive: !record.ad_delivery_stop_time,
    estimatedSpend: record.spend
      ? {
          lower: Number(record.spend.lower_bound),
          upper: Number(record.spend.upper_bound),
          currency: record.currency ?? 'JPY',
        }
      : null,
    impressions: record.impressions
      ? {
          lower: Number(record.impressions.lower_bound),
          upper: Number(record.impressions.upper_bound),
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch competitor ads from Meta Ad Library for a given domain.
 */
export async function fetchCompetitorAds(
  domain: string,
  options: { limit?: number; country?: string } = {},
): Promise<CompetitorAd[]> {
  const limit = options.limit ?? 50;
  const country = options.country ?? 'JP';

  const records = await callMetaAdLibrary({
    searchTerms: domain,
    adReachedCountries: country,
    adType: 'ALL',
    limit,
  });

  return records.map((record) => mapMetaAdToCompetitorAd(record, domain));
}

/**
 * Analyze competitor creatives to extract patterns.
 */
export function analyzeCompetitorCreatives(ads: CompetitorAd[]): CreativePattern[] {
  if (ads.length === 0) return [];

  // Group by messaging theme (simplified: use keyword clustering)
  const themeMap = new Map<string, CompetitorAd[]>();

  for (const ad of ads) {
    const theme = extractPrimaryTheme(ad);
    const existing = themeMap.get(theme) ?? [];
    existing.push(ad);
    themeMap.set(theme, existing);
  }

  const patterns: CreativePattern[] = [];

  for (const [theme, themeAds] of themeMap) {
    const formats = [...new Set(themeAds.map((a) => a.mediaType))];
    const tones = [...new Set(themeAds.map((a) => detectTone(a.body)))];
    const keywords = extractTopKeywords(themeAds, 10);

    const durations = themeAds
      .filter((a) => a.startDate)
      .map((a) => {
        const start = new Date(a.startDate).getTime();
        const end = a.endDate ? new Date(a.endDate).getTime() : Date.now();
        return (end - start) / 86_400_000;
      });

    const avgDuration =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

    patterns.push({
      theme,
      frequency: themeAds.length,
      formats,
      averageDurationDays: Math.round(avgDuration),
      messagingTones: tones,
      topKeywords: keywords,
    });
  }

  return patterns.sort((a, b) => b.frequency - a.frequency);
}

/**
 * Estimate share of voice for a domain within a category.
 */
export async function estimateShareOfVoice(
  domain: string,
  category: string,
): Promise<ShareOfVoiceResult> {
  // Fetch ads for the domain and category
  const domainAds = await fetchCompetitorAds(domain, { limit: 100 });
  const categoryAds = await fetchCompetitorAds(category, { limit: 100 });

  // Estimate SOV based on ad counts and spend
  const allDomains = new Map<string, CompetitorAd[]>();

  for (const ad of [...domainAds, ...categoryAds]) {
    const existing = allDomains.get(ad.domain) ?? [];
    existing.push(ad);
    allDomains.set(ad.domain, existing);
  }

  const totalAds = [...allDomains.values()].reduce((sum, ads) => sum + ads.length, 0);

  const topCompetitors: SovEntry[] = [...allDomains.entries()]
    .map(([d, ads]) => ({
      domain: d,
      adCount: ads.length,
      estimatedSpend: aggregateSpend(ads),
      sovPercentage: totalAds > 0 ? (ads.length / totalAds) * 100 : 0,
    }))
    .sort((a, b) => b.adCount - a.adCount)
    .slice(0, 10);

  const domainEntry = topCompetitors.find((c) => c.domain === domain);

  return {
    domain,
    category,
    estimatedSov: domainEntry?.sovPercentage ?? 0,
    competitorCount: allDomains.size,
    topCompetitors,
    period: {
      start: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10),
      end: new Date().toISOString().slice(0, 10),
    },
  };
}

/**
 * Generate a full competitive report for an organization.
 */
export async function generateCompetitiveReport(
  organizationId: string,
  competitorDomains: string[],
): Promise<CompetitiveReport> {
  const competitors: CompetitorAnalysis[] = [];
  const allAds: CompetitorAd[] = [];

  for (const domain of competitorDomains) {
    const ads = await fetchCompetitorAds(domain, { limit: 50 });
    allAds.push(...ads);

    const patterns = analyzeCompetitorCreatives(ads);
    const activeAds = ads.filter((a) => a.isActive);

    const formatCounts = new Map<string, number>();
    for (const ad of ads) {
      const count = formatCounts.get(ad.mediaType) ?? 0;
      formatCounts.set(ad.mediaType, count + 1);
    }

    const topFormats: FormatBreakdown[] = [...formatCounts.entries()]
      .map(([format, count]) => ({
        format,
        count,
        percentage: ads.length > 0 ? (count / ads.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    competitors.push({
      domain,
      adCount: ads.length,
      activeAdCount: activeAds.length,
      patterns,
      topFormats,
      estimatedMonthlySpend: aggregateSpend(ads),
    });
  }

  const insights = generateInsights(competitors, allAds);
  const recommendations = generateRecommendations(competitors);

  return {
    organizationId,
    generatedAt: new Date().toISOString(),
    competitors,
    insights,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function extractPrimaryTheme(ad: CompetitorAd): string {
  const text = `${ad.headline} ${ad.body}`.toLowerCase();

  const themeKeywords: Record<string, readonly string[]> = {
    'セール・割引': ['セール', 'sale', '割引', 'off', '値下げ', 'discount'],
    '新商品': ['新商品', '新発売', 'new', '新作', 'リリース'],
    '期間限定': ['期間限定', '限定', 'limited', '今だけ'],
    'ブランド訴求': ['ブランド', 'brand', '品質', 'quality', 'プレミアム'],
    '季節': ['春', '夏', '秋', '冬', 'spring', 'summer', 'autumn', 'winter'],
    '機能訴求': ['機能', '性能', 'feature', 'スペック', '特徴'],
    '口コミ・実績': ['口コミ', 'レビュー', '実績', '評判', '満足度'],
    'その他': [],
  };

  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    if (theme === 'その他') continue;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return theme;
      }
    }
  }

  return 'その他';
}

function detectTone(text: string): string {
  if (/です|ます|ございます/.test(text)) return '丁寧';
  if (/だ$|だよ|だね|じゃん/.test(text)) return 'カジュアル';
  if (/ください|お願い/.test(text)) return '依頼';
  if (/!|！|限定|今すぐ/.test(text)) return '緊急';
  return 'ニュートラル';
}

function extractTopKeywords(ads: CompetitorAd[], topN: number): string[] {
  const wordCounts = new Map<string, number>();

  for (const ad of ads) {
    const text = `${ad.headline} ${ad.body}`;
    // Simple word extraction (for Japanese, a proper tokenizer like kuromoji would be better)
    const words = text.split(/[\s、。！？・\n]+/).filter((w) => w.length >= 2);

    for (const word of words) {
      const count = wordCounts.get(word) ?? 0;
      wordCounts.set(word, count + 1);
    }
  }

  return [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

function aggregateSpend(ads: CompetitorAd[]): SpendRange {
  let lower = 0;
  let upper = 0;

  for (const ad of ads) {
    if (ad.estimatedSpend) {
      lower += ad.estimatedSpend.lower;
      upper += ad.estimatedSpend.upper;
    }
  }

  return { lower, upper, currency: 'JPY' };
}

function generateInsights(
  competitors: CompetitorAnalysis[],
  _allAds: CompetitorAd[],
): CompetitiveInsight[] {
  const insights: CompetitiveInsight[] = [];

  // Check for competitors with high active ad counts (threat)
  for (const competitor of competitors) {
    if (competitor.activeAdCount > 20) {
      insights.push({
        type: 'threat',
        title: `${competitor.domain}が積極的に広告展開中`,
        description: `${competitor.domain}は現在${competitor.activeAdCount}件のアクティブ広告を配信しており、市場での存在感を高めています`,
        actionable: true,
      });
    }
  }

  // Check for format trends
  const videoCompetitors = competitors.filter((c) =>
    c.topFormats.some((f) => f.format === 'video' && f.percentage > 30),
  );

  if (videoCompetitors.length > 0) {
    insights.push({
      type: 'trend',
      title: '競合他社が動画広告を増加',
      description: `${videoCompetitors.length}社の競合が広告の30%以上を動画フォーマットで配信しています`,
      actionable: true,
    });
  }

  // Check for underserved themes (opportunity)
  const allThemes = competitors.flatMap((c) => c.patterns.map((p) => p.theme));
  const themeCounts = new Map<string, number>();
  for (const theme of allThemes) {
    const count = themeCounts.get(theme) ?? 0;
    themeCounts.set(theme, count + 1);
  }

  const lowCompetitionThemes = [...themeCounts.entries()]
    .filter(([, count]) => count <= 1)
    .map(([theme]) => theme);

  if (lowCompetitionThemes.length > 0) {
    insights.push({
      type: 'opportunity',
      title: '競合が少ないテーマを発見',
      description: `以下のテーマは競合が少なく、差別化のチャンスがあります: ${lowCompetitionThemes.join('、')}`,
      actionable: true,
    });
  }

  return insights;
}

function generateRecommendations(competitors: CompetitorAnalysis[]): string[] {
  const recommendations: string[] = [];

  // General recommendations based on competitive landscape
  const totalActiveAds = competitors.reduce((sum, c) => sum + c.activeAdCount, 0);
  const avgActiveAds = competitors.length > 0 ? totalActiveAds / competitors.length : 0;

  if (avgActiveAds > 10) {
    recommendations.push(
      '競合の広告出稿量が多いため、クリエイティブの差別化とターゲティングの精度向上を優先してください',
    );
  }

  // Check if competitors use limited-time offers
  const hasLimitedOffers = competitors.some((c) =>
    c.patterns.some((p) => p.theme === '期間限定'),
  );

  if (hasLimitedOffers) {
    recommendations.push(
      '競合が期間限定キャンペーンを展開しています。対抗施策としてタイムセールやフラッシュセールを検討してください',
    );
  }

  recommendations.push(
    '定期的な競合モニタリング（週1回）を設定し、新しいクリエイティブパターンの変化を追跡してください',
  );

  return recommendations;
}
