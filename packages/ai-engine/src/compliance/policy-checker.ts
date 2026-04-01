/**
 * Platform Policy Compliance Checker
 *
 * Validates ad creatives against platform-specific policies and
 * Japan-specific regulations (薬機法, 景品表示法).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComplianceViolation {
  severity: 'error' | 'warning' | 'info';
  rule: string;
  description: string;
  recommendation: string;
  platform: string;
}

export interface ComplianceResult {
  passed: boolean;
  violations: ComplianceViolation[];
}

export interface CreativeInput {
  headline: string;
  body: string;
  cta: string;
  imageTextPercentage?: number;
  landingPageUrl?: string;
  industry?: string;
}

type Platform = 'meta' | 'google' | 'x' | 'tiktok' | 'line_yahoo' | 'amazon' | 'microsoft';

// ---------------------------------------------------------------------------
// Prohibited Content Patterns
// ---------------------------------------------------------------------------

/** Keywords prohibited across all platforms */
const UNIVERSAL_PROHIBITED_KEYWORDS: readonly string[] = [
  // Weapons
  '銃', '拳銃', 'ライフル', '弾薬', '武器販売',
  'firearms', 'ammunition', 'weapons for sale',
  // Illegal drugs
  '違法薬物', '大麻販売', '覚醒剤', 'ドラッグ販売',
  'illegal drugs', 'buy marijuana', 'buy cocaine',
  // Gambling (unlicensed)
  '違法ギャンブル', '無許可カジノ',
  'illegal gambling', 'unlicensed casino',
  // Discrimination
  '差別', 'ヘイト',
  // Counterfeit
  '偽ブランド', 'コピー品', 'スーパーコピー', 'レプリカ販売',
];

// ---------------------------------------------------------------------------
// Japan-Specific Regulation Patterns
// ---------------------------------------------------------------------------

/**
 * 薬機法 (Pharmaceutical and Medical Device Act)
 * Prohibits unsubstantiated health/medical claims in advertising.
 */
const YAKKI_HO_VIOLATION_PATTERNS: readonly RegExp[] = [
  /確実に(?:治|治る|治します|痩せ|痩せる|痩せます)/,
  /100%(?:効果|治療|改善)/,
  /奇跡の(?:薬|サプリ|治療)/,
  /がん(?:が治る|を治す|に効く)/,
  /医者(?:いらず|が認めた)/,
  /(?:完治|完全治癒|根治)(?:する|します|できる)/,
  /(?:副作用|リスク)(?:なし|ゼロ|がない)/,
  /(?:飲むだけ|塗るだけ)で(?:治る|痩せる|若返る)/,
  /(?:即効|即座に)(?:効く|治る|改善)/,
  /(?:世界初|日本初|業界初)の(?:治療|療法|サプリ)/,
];

const YAKKI_HO_WARNING_PATTERNS: readonly RegExp[] = [
  /(?:シミ|シワ|たるみ)(?:が消える|がなくなる|を除去)/,
  /(?:アンチエイジング|若返り)(?:効果|作用)/,
  /(?:ダイエット|減量)(?:効果|に成功)/,
  /(?:美白|ホワイトニング)(?:効果抜群|で真っ白)/,
  /(?:育毛|発毛)(?:効果|に成功|確実)/,
];

/**
 * 景品表示法 (Act against Unjustifiable Premiums and Misleading Representations)
 * Prohibits misleading representations about products/services.
 */
const KEIHIN_HYOJI_VIOLATION_PATTERNS: readonly RegExp[] = [
  /(?:業界|世界|日本)(?:No\.?1|ナンバーワン|一位|1位)/,
  /(?:最安値|最安|激安|破格|底値)(?:保証|確約)/,
  /(?:今だけ|期間限定)(?:無料|タダ|0円)/,
  /(?:必ず|確実に|絶対に)(?:儲かる|稼げる|利益)/,
  /(?:先着|残り)(?:\d+(?:名|個|台|本))(?:限り|のみ)/,
];

const KEIHIN_HYOJI_WARNING_PATTERNS: readonly RegExp[] = [
  /(?:満足度|顧客満足)(?:\d+%|No\.?1)/,
  /(?:口コミ|レビュー)(?:No\.?1|1位|ランキング1位)/,
  /(?:売上|販売実績)(?:No\.?1|1位)/,
  /(?:今なら|本日限り|本日中)/,
];

// ---------------------------------------------------------------------------
// Platform-Specific Rules
// ---------------------------------------------------------------------------

interface PlatformRules {
  maxHeadlineLength: number;
  maxBodyLength: number;
  maxImageTextPercentage: number;
  additionalProhibited: readonly string[];
}

const PLATFORM_RULES: Record<Platform, PlatformRules> = {
  meta: {
    maxHeadlineLength: 40,
    maxBodyLength: 125,
    maxImageTextPercentage: 20,
    additionalProhibited: ['before/after', 'ビフォーアフター'],
  },
  google: {
    maxHeadlineLength: 30,
    maxBodyLength: 90,
    maxImageTextPercentage: 100,
    additionalProhibited: ['click here', 'ここをクリック'],
  },
  x: {
    maxHeadlineLength: 70,
    maxBodyLength: 280,
    maxImageTextPercentage: 100,
    additionalProhibited: [],
  },
  tiktok: {
    maxHeadlineLength: 100,
    maxBodyLength: 100,
    maxImageTextPercentage: 20,
    additionalProhibited: ['ビフォーアフター'],
  },
  line_yahoo: {
    maxHeadlineLength: 25,
    maxBodyLength: 90,
    maxImageTextPercentage: 20,
    additionalProhibited: [],
  },
  amazon: {
    maxHeadlineLength: 50,
    maxBodyLength: 150,
    maxImageTextPercentage: 100,
    additionalProhibited: ['最安値', 'best price guarantee'],
  },
  microsoft: {
    maxHeadlineLength: 30,
    maxBodyLength: 90,
    maxImageTextPercentage: 100,
    additionalProhibited: [],
  },
};

// ---------------------------------------------------------------------------
// Core Compliance Check
// ---------------------------------------------------------------------------

/**
 * Validate a creative against platform policies and Japan-specific regulations.
 */
export function checkCreativeCompliance(
  creative: CreativeInput,
  platform: Platform,
): ComplianceResult {
  const violations: ComplianceViolation[] = [];
  const rules = PLATFORM_RULES[platform];

  // 1. Character length checks
  checkCharacterLimits(creative, rules, platform, violations);

  // 2. Image text ratio (Meta, TikTok, LINE/Yahoo)
  checkImageTextRatio(creative, rules, platform, violations);

  // 3. Universal prohibited content
  checkProhibitedContent(creative, platform, rules, violations);

  // 4. Japan-specific: 薬機法
  checkYakkiHo(creative, platform, violations);

  // 5. Japan-specific: 景品表示法
  checkKeihinHyoji(creative, platform, violations);

  // 6. CTA validation
  checkCtaCompliance(creative, platform, violations);

  const hasErrors = violations.some((v) => v.severity === 'error');

  return {
    passed: !hasErrors,
    violations,
  };
}

// ---------------------------------------------------------------------------
// Individual Check Functions
// ---------------------------------------------------------------------------

function checkCharacterLimits(
  creative: CreativeInput,
  rules: PlatformRules,
  platform: Platform,
  violations: ComplianceViolation[],
): void {
  if (creative.headline.length > rules.maxHeadlineLength) {
    violations.push({
      severity: 'error',
      rule: 'character_limit_headline',
      description: `ヘッドラインが${rules.maxHeadlineLength}文字の制限を超えています（現在: ${creative.headline.length}文字）`,
      recommendation: `ヘッドラインを${rules.maxHeadlineLength}文字以内に短縮してください`,
      platform,
    });
  }

  if (creative.body.length > rules.maxBodyLength) {
    violations.push({
      severity: 'error',
      rule: 'character_limit_body',
      description: `本文が${rules.maxBodyLength}文字の制限を超えています（現在: ${creative.body.length}文字）`,
      recommendation: `本文を${rules.maxBodyLength}文字以内に短縮してください`,
      platform,
    });
  }
}

function checkImageTextRatio(
  creative: CreativeInput,
  rules: PlatformRules,
  platform: Platform,
  violations: ComplianceViolation[],
): void {
  if (
    creative.imageTextPercentage !== undefined &&
    creative.imageTextPercentage > rules.maxImageTextPercentage
  ) {
    violations.push({
      severity: rules.maxImageTextPercentage < 100 ? 'error' : 'warning',
      rule: 'image_text_ratio',
      description: `画像内のテキスト割合が${rules.maxImageTextPercentage}%を超えています（現在: ${creative.imageTextPercentage}%）`,
      recommendation: `画像内のテキストを${rules.maxImageTextPercentage}%以下に削減してください。テキストオーバーレイを減らすか、テキストをキャプションに移動してください`,
      platform,
    });
  }
}

function checkProhibitedContent(
  creative: CreativeInput,
  platform: Platform,
  rules: PlatformRules,
  violations: ComplianceViolation[],
): void {
  const fullText = `${creative.headline} ${creative.body} ${creative.cta}`.toLowerCase();

  for (const keyword of UNIVERSAL_PROHIBITED_KEYWORDS) {
    if (fullText.includes(keyword.toLowerCase())) {
      violations.push({
        severity: 'error',
        rule: 'prohibited_content',
        description: `禁止コンテンツが検出されました: 「${keyword}」`,
        recommendation: `「${keyword}」を含むコンテンツはすべてのプラットフォームで禁止されています。削除してください`,
        platform,
      });
    }
  }

  for (const keyword of rules.additionalProhibited) {
    if (fullText.includes(keyword.toLowerCase())) {
      violations.push({
        severity: 'error',
        rule: 'platform_prohibited_content',
        description: `${platform}で禁止されているコンテンツが検出されました: 「${keyword}」`,
        recommendation: `「${keyword}」は${platform}のポリシーに違反します。別の表現に変更してください`,
        platform,
      });
    }
  }
}

function checkYakkiHo(
  creative: CreativeInput,
  platform: Platform,
  violations: ComplianceViolation[],
): void {
  const fullText = `${creative.headline} ${creative.body}`;

  for (const pattern of YAKKI_HO_VIOLATION_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      violations.push({
        severity: 'error',
        rule: 'yakki_ho_violation',
        description: `薬機法違反の可能性: 「${match[0]}」- 未承認の医薬品的効能効果の表示は禁止されています`,
        recommendation: '医薬品的な効能効果を暗示する表現を削除し、「個人の感想です」「効果には個人差があります」などの注釈を追加してください',
        platform,
      });
    }
  }

  for (const pattern of YAKKI_HO_WARNING_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      violations.push({
        severity: 'warning',
        rule: 'yakki_ho_warning',
        description: `薬機法に抵触する可能性: 「${match[0]}」- 効能効果を過度に強調する表現`,
        recommendation: '表現を穏やかにし、「※個人の感想です」「※効果には個人差があります」などの注釈を検討してください',
        platform,
      });
    }
  }
}

function checkKeihinHyoji(
  creative: CreativeInput,
  platform: Platform,
  violations: ComplianceViolation[],
): void {
  const fullText = `${creative.headline} ${creative.body}`;

  for (const pattern of KEIHIN_HYOJI_VIOLATION_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      violations.push({
        severity: 'error',
        rule: 'keihin_hyoji_violation',
        description: `景品表示法違反の可能性: 「${match[0]}」- 優良誤認・有利誤認表示の疑い`,
        recommendation: '根拠データの明示（調査名、調査期間、調査対象など）が必要です。根拠がない場合は表現を変更してください',
        platform,
      });
    }
  }

  for (const pattern of KEIHIN_HYOJI_WARNING_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      violations.push({
        severity: 'warning',
        rule: 'keihin_hyoji_warning',
        description: `景品表示法に抵触する可能性: 「${match[0]}」- 根拠のない優良表示`,
        recommendation: '具体的な調査データや出典を注釈として追加することを推奨します',
        platform,
      });
    }
  }
}

function checkCtaCompliance(
  creative: CreativeInput,
  platform: Platform,
  violations: ComplianceViolation[],
): void {
  const cta = creative.cta.toLowerCase();

  // Deceptive CTAs
  const deceptiveCtas = ['今すぐ受け取る', '当選おめでとう', '賞品を受け取る'];
  for (const deceptive of deceptiveCtas) {
    if (cta.includes(deceptive.toLowerCase())) {
      violations.push({
        severity: 'error',
        rule: 'deceptive_cta',
        description: `欺瞞的なCTAが検出されました: 「${deceptive}」`,
        recommendation: '明確で正直なCTAに変更してください（例: 「詳しく見る」「今すぐ購入」）',
        platform,
      });
    }
  }

  // Empty CTA warning
  if (cta.trim().length === 0) {
    violations.push({
      severity: 'info',
      rule: 'missing_cta',
      description: 'CTAが設定されていません',
      recommendation: '明確なCTAを追加することで、クリック率の向上が期待できます',
      platform,
    });
  }
}
