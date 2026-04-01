/**
 * Japanese Seasonality Intelligence
 *
 * Complete Japanese seasonal calendar with industry-specific impacts
 * for marketing automation. Covers all major events, holidays,
 * and commercial seasons with demand/CPC multipliers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IndustryImpact {
  demandMultiplier: number;
  cpcMultiplier: number;
  recommendedCreativeThemes: string[];
  recommendedCopyKeywords: string[];
}

export interface SeasonalEvent {
  name: string;
  nameEn: string;
  dateRange: { start: string; end: string };
  preRampDays: number;
  postTailDays: number;
  industryImpacts: Record<string, IndustryImpact>;
}

export type Industry =
  | 'ec_fashion'
  | 'ec_food'
  | 'ec_cosmetics'
  | 'saas_b2b'
  | 'real_estate'
  | 'finance'
  | 'education'
  | 'travel'
  | 'entertainment';

const ALL_INDUSTRIES: readonly Industry[] = [
  'ec_fashion',
  'ec_food',
  'ec_cosmetics',
  'saas_b2b',
  'real_estate',
  'finance',
  'education',
  'travel',
  'entertainment',
] as const;

// ---------------------------------------------------------------------------
// Dynamic Date Calculators
// ---------------------------------------------------------------------------

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = firstDay.getDay();
  let day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return new Date(year, month - 1, day);
}

function getComingOfAgeDay(year: number): Date {
  return getNthWeekdayOfMonth(year, 1, 1, 2); // 2nd Monday of January
}

function getMothersDay(year: number): Date {
  return getNthWeekdayOfMonth(year, 5, 0, 2); // 2nd Sunday of May
}

function getFathersDay(year: number): Date {
  return getNthWeekdayOfMonth(year, 6, 0, 3); // 3rd Sunday of June
}

function getBlackFriday(year: number): Date {
  // 4th Friday of November
  return getNthWeekdayOfMonth(year, 11, 5, 4);
}

function getAutumnalEquinox(year: number): number {
  // Approximate autumnal equinox for Japan
  return Math.floor(23.2488 + 0.2422 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function getSilverWeekDates(year: number): { start: string; end: string } {
  // Silver Week occurs in September around Respect for the Aged Day (3rd Monday)
  // and Autumnal Equinox Day
  const respectForAgedDay = getNthWeekdayOfMonth(year, 9, 1, 3);
  const equinoxDay = getAutumnalEquinox(year);
  const equinoxDate = new Date(year, 8, equinoxDay);

  const start = respectForAgedDay < equinoxDate ? respectForAgedDay : equinoxDate;
  const end = respectForAgedDay > equinoxDate ? respectForAgedDay : equinoxDate;

  // Extend to cover the full weekend cluster
  const startDate = new Date(start);
  startDate.setDate(startDate.getDate() - (startDate.getDay() === 0 ? 0 : startDate.getDay()));
  const endDate = new Date(end);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  return {
    start: formatMMDD(startDate),
    end: formatMMDD(endDate),
  };
}

function formatMMDD(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Helper: build industry impacts with defaults
// ---------------------------------------------------------------------------

function buildImpacts(
  overrides: Partial<Record<Industry, Partial<IndustryImpact>>>,
  defaults: { demandMultiplier: number; cpcMultiplier: number },
): Record<string, IndustryImpact> {
  const result: Record<string, IndustryImpact> = {};
  for (const industry of ALL_INDUSTRIES) {
    const override = overrides[industry];
    result[industry] = {
      demandMultiplier: override?.demandMultiplier ?? defaults.demandMultiplier,
      cpcMultiplier: override?.cpcMultiplier ?? defaults.cpcMultiplier,
      recommendedCreativeThemes: override?.recommendedCreativeThemes ?? [],
      recommendedCopyKeywords: override?.recommendedCopyKeywords ?? [],
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Event Database
// ---------------------------------------------------------------------------

function buildJapaneseEvents(year: number): SeasonalEvent[] {
  const comingOfAgeDay = getComingOfAgeDay(year);
  const mothersDay = getMothersDay(year);
  const fathersDay = getFathersDay(year);
  const blackFriday = getBlackFriday(year);
  const silverWeek = getSilverWeekDates(year);

  return [
    // --- お正月 ---
    {
      name: 'お正月',
      nameEn: 'New Year',
      dateRange: { start: '01-01', end: '01-03' },
      preRampDays: 12,
      postTailDays: 3,
      industryImpacts: buildImpacts(
        {
          ec_fashion: {
            demandMultiplier: 2.5,
            cpcMultiplier: 1.8,
            recommendedCreativeThemes: ['福袋', '初売り', '新春セール'],
            recommendedCopyKeywords: ['福袋', '初売り', '新年', '限定', 'お正月特価'],
          },
          ec_food: {
            demandMultiplier: 3.0,
            cpcMultiplier: 2.0,
            recommendedCreativeThemes: ['おせち', 'お年賀', '新春グルメ'],
            recommendedCopyKeywords: ['おせち', 'お年賀', '新春', '年始限定'],
          },
          ec_cosmetics: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.6,
            recommendedCreativeThemes: ['新春ビューティー福袋', '新年キット'],
            recommendedCopyKeywords: ['福袋', '新春限定', 'スペシャルセット'],
          },
          travel: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.2,
            recommendedCreativeThemes: ['初詣旅行', '温泉お正月'],
            recommendedCopyKeywords: ['年末年始', '初詣', '温泉', '正月旅行'],
          },
          finance: {
            demandMultiplier: 1.8,
            cpcMultiplier: 1.5,
            recommendedCreativeThemes: ['新年の資産形成', '年始キャンペーン'],
            recommendedCopyKeywords: ['新年', '投資', '貯蓄', 'スタートダッシュ'],
          },
          entertainment: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.5,
            recommendedCreativeThemes: ['お正月特番', '年始イベント'],
            recommendedCopyKeywords: ['お正月', '年始', '特別企画'],
          },
        },
        { demandMultiplier: 1.5, cpcMultiplier: 1.3 },
      ),
    },

    // --- 成人の日 ---
    {
      name: '成人の日',
      nameEn: 'Coming of Age Day',
      dateRange: { start: formatMMDD(comingOfAgeDay), end: formatMMDD(comingOfAgeDay) },
      preRampDays: 30,
      postTailDays: 3,
      industryImpacts: buildImpacts(
        {
          ec_fashion: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.8,
            recommendedCreativeThemes: ['振袖', 'スーツ', '成人式コーデ'],
            recommendedCopyKeywords: ['成人式', '振袖', 'スーツ', '二十歳', 'お祝い'],
          },
          ec_cosmetics: {
            demandMultiplier: 1.8,
            cpcMultiplier: 1.5,
            recommendedCreativeThemes: ['成人式メイク', 'ヘアセット'],
            recommendedCopyKeywords: ['成人式', '特別な日', 'メイクアップ'],
          },
          entertainment: {
            demandMultiplier: 1.5,
            cpcMultiplier: 1.3,
            recommendedCreativeThemes: ['成人祝い', '同窓会'],
            recommendedCopyKeywords: ['二十歳', 'お祝い', '記念'],
          },
        },
        { demandMultiplier: 1.1, cpcMultiplier: 1.1 },
      ),
    },

    // --- バレンタインデー ---
    {
      name: 'バレンタインデー',
      nameEn: "Valentine's Day",
      dateRange: { start: '02-14', end: '02-14' },
      preRampDays: 25,
      postTailDays: 2,
      industryImpacts: buildImpacts(
        {
          ec_food: {
            demandMultiplier: 3.5,
            cpcMultiplier: 2.5,
            recommendedCreativeThemes: ['チョコレートギフト', '手作りチョコ', '本命チョコ'],
            recommendedCopyKeywords: ['バレンタイン', 'チョコ', '本命', '義理', '友チョコ', 'ギフト', '限定'],
          },
          ec_cosmetics: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.8,
            recommendedCreativeThemes: ['バレンタインコフレ', 'ギフトセット'],
            recommendedCopyKeywords: ['バレンタイン', 'ギフト', '限定コフレ', 'プレゼント'],
          },
          ec_fashion: {
            demandMultiplier: 1.5,
            cpcMultiplier: 1.4,
            recommendedCreativeThemes: ['デートコーデ', 'ペアアイテム'],
            recommendedCopyKeywords: ['バレンタイン', 'デート', 'ペア', 'ギフト'],
          },
          entertainment: {
            demandMultiplier: 1.8,
            cpcMultiplier: 1.5,
            recommendedCreativeThemes: ['カップルイベント', 'バレンタインデート'],
            recommendedCopyKeywords: ['バレンタイン', 'デート', 'スペシャル'],
          },
        },
        { demandMultiplier: 1.2, cpcMultiplier: 1.2 },
      ),
    },

    // --- ホワイトデー ---
    {
      name: 'ホワイトデー',
      nameEn: 'White Day',
      dateRange: { start: '03-14', end: '03-14' },
      preRampDays: 14,
      postTailDays: 2,
      industryImpacts: buildImpacts(
        {
          ec_food: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.0,
            recommendedCreativeThemes: ['お返しスイーツ', 'ホワイトデーギフト'],
            recommendedCopyKeywords: ['ホワイトデー', 'お返し', 'ギフト', 'スイーツ'],
          },
          ec_cosmetics: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.7,
            recommendedCreativeThemes: ['お返しコスメ', 'ギフトセット'],
            recommendedCopyKeywords: ['ホワイトデー', 'お返し', 'プレゼント'],
          },
          ec_fashion: {
            demandMultiplier: 1.8,
            cpcMultiplier: 1.5,
            recommendedCreativeThemes: ['ジュエリーギフト', 'アクセサリー'],
            recommendedCopyKeywords: ['ホワイトデー', 'お返し', 'ジュエリー', 'アクセサリー'],
          },
        },
        { demandMultiplier: 1.1, cpcMultiplier: 1.1 },
      ),
    },

    // --- 新生活シーズン ---
    {
      name: '新生活シーズン',
      nameEn: 'New Life Season',
      dateRange: { start: '03-01', end: '04-30' },
      preRampDays: 14,
      postTailDays: 7,
      industryImpacts: buildImpacts(
        {
          ec_fashion: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.6,
            recommendedCreativeThemes: ['新生活コーデ', '通勤スタイル', '入学式'],
            recommendedCopyKeywords: ['新生活', '新社会人', '入学', '春コーデ', 'フレッシャーズ'],
          },
          real_estate: {
            demandMultiplier: 3.0,
            cpcMultiplier: 2.5,
            recommendedCreativeThemes: ['新生活向け物件', '引越しキャンペーン'],
            recommendedCopyKeywords: ['新生活', '引越し', '一人暮らし', '新居', '賃貸'],
          },
          education: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.0,
            recommendedCreativeThemes: ['春の学び始め', 'スキルアップ'],
            recommendedCopyKeywords: ['新年度', '学び直し', 'スキルアップ', '資格取得'],
          },
          finance: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.8,
            recommendedCreativeThemes: ['新社会人の資産形成', '口座開設キャンペーン'],
            recommendedCopyKeywords: ['新生活', '口座開設', '貯金', '資産形成', 'デビュー'],
          },
          saas_b2b: {
            demandMultiplier: 1.8,
            cpcMultiplier: 1.5,
            recommendedCreativeThemes: ['新年度導入キャンペーン', '業務効率化'],
            recommendedCopyKeywords: ['新年度', '業務改善', '効率化', 'スタートアップ'],
          },
        },
        { demandMultiplier: 1.3, cpcMultiplier: 1.2 },
      ),
    },

    // --- ゴールデンウィーク ---
    {
      name: 'ゴールデンウィーク',
      nameEn: 'Golden Week',
      dateRange: { start: '04-29', end: '05-05' },
      preRampDays: 21,
      postTailDays: 3,
      industryImpacts: buildImpacts(
        {
          travel: {
            demandMultiplier: 3.5,
            cpcMultiplier: 3.0,
            recommendedCreativeThemes: ['GW旅行', '家族旅行', '海外旅行'],
            recommendedCopyKeywords: ['GW', 'ゴールデンウィーク', '旅行', '早割', '連休'],
          },
          entertainment: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.0,
            recommendedCreativeThemes: ['GWイベント', '連休特別企画'],
            recommendedCopyKeywords: ['GW', '連休', 'イベント', 'お出かけ'],
          },
          ec_fashion: {
            demandMultiplier: 1.5,
            cpcMultiplier: 1.3,
            recommendedCreativeThemes: ['GWセール', '春夏コレクション'],
            recommendedCopyKeywords: ['GW', 'セール', '春夏', '新作'],
          },
          ec_food: {
            demandMultiplier: 1.8,
            cpcMultiplier: 1.4,
            recommendedCreativeThemes: ['BBQグッズ', 'アウトドアフード'],
            recommendedCopyKeywords: ['GW', 'BBQ', 'アウトドア', 'パーティー'],
          },
        },
        { demandMultiplier: 1.2, cpcMultiplier: 1.2 },
      ),
    },

    // --- 母の日 ---
    {
      name: '母の日',
      nameEn: "Mother's Day",
      dateRange: { start: formatMMDD(mothersDay), end: formatMMDD(mothersDay) },
      preRampDays: 21,
      postTailDays: 2,
      industryImpacts: buildImpacts(
        {
          ec_food: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.0,
            recommendedCreativeThemes: ['母の日ギフト', 'スイーツギフト'],
            recommendedCopyKeywords: ['母の日', 'ありがとう', 'ギフト', 'お母さん', 'カーネーション'],
          },
          ec_cosmetics: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.0,
            recommendedCreativeThemes: ['母の日コスメギフト', 'スキンケアセット'],
            recommendedCopyKeywords: ['母の日', 'ギフト', 'スキンケア', '感謝'],
          },
          ec_fashion: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.7,
            recommendedCreativeThemes: ['母の日ファッションギフト', 'バッグ・アクセ'],
            recommendedCopyKeywords: ['母の日', 'プレゼント', 'ギフト', 'ファッション'],
          },
        },
        { demandMultiplier: 1.2, cpcMultiplier: 1.1 },
      ),
    },

    // --- 父の日 ---
    {
      name: '父の日',
      nameEn: "Father's Day",
      dateRange: { start: formatMMDD(fathersDay), end: formatMMDD(fathersDay) },
      preRampDays: 14,
      postTailDays: 2,
      industryImpacts: buildImpacts(
        {
          ec_food: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.7,
            recommendedCreativeThemes: ['父の日ギフト', 'お酒ギフト'],
            recommendedCopyKeywords: ['父の日', 'ありがとう', 'お酒', 'ギフト', 'お父さん'],
          },
          ec_fashion: {
            demandMultiplier: 1.8,
            cpcMultiplier: 1.5,
            recommendedCreativeThemes: ['父の日ファッション', 'ネクタイ・小物'],
            recommendedCopyKeywords: ['父の日', 'プレゼント', 'ネクタイ', 'メンズ'],
          },
          entertainment: {
            demandMultiplier: 1.5,
            cpcMultiplier: 1.3,
            recommendedCreativeThemes: ['家族イベント', '体験ギフト'],
            recommendedCopyKeywords: ['父の日', '家族', '体験', '思い出'],
          },
        },
        { demandMultiplier: 1.1, cpcMultiplier: 1.1 },
      ),
    },

    // --- お中元 ---
    {
      name: 'お中元',
      nameEn: 'Mid-Year Gift Season',
      dateRange: { start: '06-15', end: '07-15' },
      preRampDays: 14,
      postTailDays: 5,
      industryImpacts: buildImpacts(
        {
          ec_food: {
            demandMultiplier: 3.0,
            cpcMultiplier: 2.2,
            recommendedCreativeThemes: ['お中元ギフト', '夏のご挨拶'],
            recommendedCopyKeywords: ['お中元', '夏ギフト', 'ご挨拶', '贈り物', '感謝'],
          },
          ec_cosmetics: {
            demandMultiplier: 1.5,
            cpcMultiplier: 1.3,
            recommendedCreativeThemes: ['夏のギフトセット'],
            recommendedCopyKeywords: ['お中元', 'ギフト', 'サマーセット'],
          },
        },
        { demandMultiplier: 1.2, cpcMultiplier: 1.1 },
      ),
    },

    // --- お盆 ---
    {
      name: 'お盆',
      nameEn: 'Obon Festival',
      dateRange: { start: '08-13', end: '08-16' },
      preRampDays: 14,
      postTailDays: 3,
      industryImpacts: buildImpacts(
        {
          travel: {
            demandMultiplier: 3.0,
            cpcMultiplier: 2.5,
            recommendedCreativeThemes: ['お盆帰省', '夏休み旅行'],
            recommendedCopyKeywords: ['お盆', '帰省', '夏休み', '旅行', '早割'],
          },
          ec_food: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.6,
            recommendedCreativeThemes: ['帰省土産', 'お供え'],
            recommendedCopyKeywords: ['お盆', '帰省', '手土産', 'お供え'],
          },
          entertainment: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.5,
            recommendedCreativeThemes: ['夏祭り', '花火大会'],
            recommendedCopyKeywords: ['お盆', '夏祭り', '花火', '夏休み'],
          },
        },
        { demandMultiplier: 1.2, cpcMultiplier: 1.1 },
      ),
    },

    // --- シルバーウィーク ---
    {
      name: 'シルバーウィーク',
      nameEn: 'Silver Week',
      dateRange: silverWeek,
      preRampDays: 14,
      postTailDays: 3,
      industryImpacts: buildImpacts(
        {
          travel: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.2,
            recommendedCreativeThemes: ['秋旅行', '紅葉ツアー'],
            recommendedCopyKeywords: ['シルバーウィーク', '秋旅行', '連休', '紅葉'],
          },
          entertainment: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.6,
            recommendedCreativeThemes: ['秋のイベント', '連休レジャー'],
            recommendedCopyKeywords: ['シルバーウィーク', '連休', 'イベント', '秋'],
          },
        },
        { demandMultiplier: 1.1, cpcMultiplier: 1.1 },
      ),
    },

    // --- ハロウィン ---
    {
      name: 'ハロウィン',
      nameEn: 'Halloween',
      dateRange: { start: '10-31', end: '10-31' },
      preRampDays: 30,
      postTailDays: 1,
      industryImpacts: buildImpacts(
        {
          ec_fashion: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.6,
            recommendedCreativeThemes: ['ハロウィンコスプレ', '仮装アイテム'],
            recommendedCopyKeywords: ['ハロウィン', 'コスプレ', '仮装', '限定'],
          },
          ec_food: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.5,
            recommendedCreativeThemes: ['ハロウィンスイーツ', 'パーティーフード'],
            recommendedCopyKeywords: ['ハロウィン', 'パーティー', 'スイーツ', '限定'],
          },
          ec_cosmetics: {
            demandMultiplier: 1.8,
            cpcMultiplier: 1.5,
            recommendedCreativeThemes: ['ハロウィンメイク', '限定カラー'],
            recommendedCopyKeywords: ['ハロウィン', 'メイク', '限定', 'コスプレ'],
          },
          entertainment: {
            demandMultiplier: 2.5,
            cpcMultiplier: 1.8,
            recommendedCreativeThemes: ['ハロウィンイベント', 'ホラーナイト'],
            recommendedCopyKeywords: ['ハロウィン', 'イベント', 'パーティー', '仮装'],
          },
        },
        { demandMultiplier: 1.1, cpcMultiplier: 1.1 },
      ),
    },

    // --- 七五三 ---
    {
      name: '七五三',
      nameEn: 'Shichi-Go-San',
      dateRange: { start: '11-15', end: '11-15' },
      preRampDays: 45,
      postTailDays: 7,
      industryImpacts: buildImpacts(
        {
          ec_fashion: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.7,
            recommendedCreativeThemes: ['七五三衣装', '着物・袴'],
            recommendedCopyKeywords: ['七五三', '着物', '袴', 'お祝い', '記念'],
          },
          entertainment: {
            demandMultiplier: 1.8,
            cpcMultiplier: 1.4,
            recommendedCreativeThemes: ['七五三撮影', '記念写真'],
            recommendedCopyKeywords: ['七五三', '記念撮影', 'フォトスタジオ', '家族'],
          },
        },
        { demandMultiplier: 1.0, cpcMultiplier: 1.0 },
      ),
    },

    // --- ブラックフライデー ---
    {
      name: 'ブラックフライデー',
      nameEn: 'Black Friday',
      dateRange: { start: formatMMDD(blackFriday), end: formatMMDD(blackFriday) },
      preRampDays: 7,
      postTailDays: 3,
      industryImpacts: buildImpacts(
        {
          ec_fashion: {
            demandMultiplier: 3.0,
            cpcMultiplier: 2.5,
            recommendedCreativeThemes: ['ブラックフライデーセール', '大幅値下げ'],
            recommendedCopyKeywords: ['ブラックフライデー', 'セール', '最大○○%OFF', '限定', '特価'],
          },
          ec_food: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.8,
            recommendedCreativeThemes: ['ブラックフライデー特価', 'まとめ買い'],
            recommendedCopyKeywords: ['ブラックフライデー', '特価', 'まとめ買い', 'お得'],
          },
          ec_cosmetics: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.0,
            recommendedCreativeThemes: ['コスメ大特価', 'ブラックフライデー限定'],
            recommendedCopyKeywords: ['ブラックフライデー', 'セール', '限定', 'お得'],
          },
          saas_b2b: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.8,
            recommendedCreativeThemes: ['年間プラン割引', 'ブラックフライデーセール'],
            recommendedCopyKeywords: ['ブラックフライデー', '年間割引', '特別価格', 'セール'],
          },
        },
        { demandMultiplier: 1.5, cpcMultiplier: 1.3 },
      ),
    },

    // --- お歳暮 ---
    {
      name: 'お歳暮',
      nameEn: 'Year-End Gift Season',
      dateRange: { start: '12-01', end: '12-20' },
      preRampDays: 14,
      postTailDays: 3,
      industryImpacts: buildImpacts(
        {
          ec_food: {
            demandMultiplier: 3.0,
            cpcMultiplier: 2.2,
            recommendedCreativeThemes: ['お歳暮ギフト', '冬のご挨拶'],
            recommendedCopyKeywords: ['お歳暮', '冬ギフト', 'ご挨拶', '贈り物', '感謝'],
          },
          ec_cosmetics: {
            demandMultiplier: 1.5,
            cpcMultiplier: 1.3,
            recommendedCreativeThemes: ['冬のギフトセット'],
            recommendedCopyKeywords: ['お歳暮', 'ギフト', 'ウィンターセット'],
          },
        },
        { demandMultiplier: 1.2, cpcMultiplier: 1.1 },
      ),
    },

    // --- クリスマス ---
    {
      name: 'クリスマス',
      nameEn: 'Christmas',
      dateRange: { start: '12-25', end: '12-25' },
      preRampDays: 30,
      postTailDays: 1,
      industryImpacts: buildImpacts(
        {
          ec_fashion: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.2,
            recommendedCreativeThemes: ['クリスマスギフト', 'ジュエリー', '冬コーデ'],
            recommendedCopyKeywords: ['クリスマス', 'プレゼント', 'ギフト', '限定', 'ジュエリー'],
          },
          ec_food: {
            demandMultiplier: 3.0,
            cpcMultiplier: 2.5,
            recommendedCreativeThemes: ['クリスマスケーキ', 'パーティーフード'],
            recommendedCopyKeywords: ['クリスマス', 'ケーキ', 'パーティー', '限定', '予約'],
          },
          ec_cosmetics: {
            demandMultiplier: 3.0,
            cpcMultiplier: 2.5,
            recommendedCreativeThemes: ['クリスマスコフレ', 'ホリデーコレクション'],
            recommendedCopyKeywords: ['クリスマス', 'コフレ', 'ホリデー', '限定', 'ギフト'],
          },
          entertainment: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.0,
            recommendedCreativeThemes: ['クリスマスイベント', 'イルミネーション'],
            recommendedCopyKeywords: ['クリスマス', 'イベント', 'イルミネーション', 'デート'],
          },
        },
        { demandMultiplier: 1.5, cpcMultiplier: 1.3 },
      ),
    },

    // --- 年末商戦 ---
    {
      name: '年末商戦',
      nameEn: 'Year-End Sales Season',
      dateRange: { start: '12-01', end: '12-31' },
      preRampDays: 7,
      postTailDays: 0,
      industryImpacts: buildImpacts(
        {
          ec_fashion: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.0,
            recommendedCreativeThemes: ['年末セール', '冬物クリアランス'],
            recommendedCopyKeywords: ['年末', 'セール', 'クリアランス', '最終', '在庫一掃'],
          },
          ec_food: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.0,
            recommendedCreativeThemes: ['年越し準備', '年末特売'],
            recommendedCopyKeywords: ['年末', '年越し', '大晦日', '特売', 'おせち予約'],
          },
          ec_cosmetics: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.8,
            recommendedCreativeThemes: ['年末ベストコスメ', 'まとめ買い'],
            recommendedCopyKeywords: ['年末', 'ベストコスメ', 'まとめ買い', 'セール'],
          },
          finance: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.8,
            recommendedCreativeThemes: ['年末調整', '確定拠出年金'],
            recommendedCopyKeywords: ['年末', '節税', '確定拠出', 'ふるさと納税', '駆け込み'],
          },
          saas_b2b: {
            demandMultiplier: 1.5,
            cpcMultiplier: 1.3,
            recommendedCreativeThemes: ['年度末予算消化', '駆け込み導入'],
            recommendedCopyKeywords: ['年末', '予算消化', '導入', '今年中'],
          },
        },
        { demandMultiplier: 1.5, cpcMultiplier: 1.4 },
      ),
    },

    // --- ボーナス月 (6月) ---
    {
      name: 'ボーナス月（夏）',
      nameEn: 'Summer Bonus Season',
      dateRange: { start: '06-01', end: '06-30' },
      preRampDays: 7,
      postTailDays: 14,
      industryImpacts: buildImpacts(
        {
          ec_fashion: {
            demandMultiplier: 1.8,
            cpcMultiplier: 1.5,
            recommendedCreativeThemes: ['ボーナスで贅沢', '自分へのご褒美'],
            recommendedCopyKeywords: ['ボーナス', 'ご褒美', '贅沢', 'プレミアム'],
          },
          travel: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.8,
            recommendedCreativeThemes: ['夏旅行予約', 'ボーナス旅行'],
            recommendedCopyKeywords: ['ボーナス', '夏旅行', '早割', '予約'],
          },
          finance: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.0,
            recommendedCreativeThemes: ['ボーナス運用', '資産形成'],
            recommendedCopyKeywords: ['ボーナス', '運用', '投資', '貯蓄', '資産形成'],
          },
          real_estate: {
            demandMultiplier: 1.5,
            cpcMultiplier: 1.3,
            recommendedCreativeThemes: ['住宅購入', 'ボーナス頭金'],
            recommendedCopyKeywords: ['ボーナス', '住宅', '頭金', 'マイホーム'],
          },
        },
        { demandMultiplier: 1.3, cpcMultiplier: 1.2 },
      ),
    },

    // --- ボーナス月 (12月) ---
    {
      name: 'ボーナス月（冬）',
      nameEn: 'Winter Bonus Season',
      dateRange: { start: '12-01', end: '12-31' },
      preRampDays: 7,
      postTailDays: 7,
      industryImpacts: buildImpacts(
        {
          ec_fashion: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.6,
            recommendedCreativeThemes: ['冬のご褒美', 'プレミアムアイテム'],
            recommendedCopyKeywords: ['ボーナス', 'ご褒美', '冬', 'プレミアム'],
          },
          travel: {
            demandMultiplier: 2.0,
            cpcMultiplier: 1.8,
            recommendedCreativeThemes: ['年末旅行', '冬休み旅行'],
            recommendedCopyKeywords: ['ボーナス', '年末', '旅行', '冬休み'],
          },
          finance: {
            demandMultiplier: 2.5,
            cpcMultiplier: 2.0,
            recommendedCreativeThemes: ['冬のボーナス運用', '新NISA準備'],
            recommendedCopyKeywords: ['ボーナス', '運用', '投資', 'NISA', '年末'],
          },
          real_estate: {
            demandMultiplier: 1.5,
            cpcMultiplier: 1.3,
            recommendedCreativeThemes: ['年末駆け込み', 'ボーナス頭金'],
            recommendedCopyKeywords: ['ボーナス', '住宅', '年末', 'マイホーム'],
          },
        },
        { demandMultiplier: 1.4, cpcMultiplier: 1.3 },
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Event Cache (lazily built per year)
// ---------------------------------------------------------------------------

const eventCache = new Map<number, SeasonalEvent[]>();

function getEventsForYear(year: number): SeasonalEvent[] {
  const cached = eventCache.get(year);
  if (cached) return cached;

  const events = buildJapaneseEvents(year);
  eventCache.set(year, events);
  return events;
}

// ---------------------------------------------------------------------------
// Date Matching Helpers
// ---------------------------------------------------------------------------

function parseMMDD(mmdd: string, year: number): Date {
  const [monthStr, dayStr] = mmdd.split('-');
  if (!monthStr || !dayStr) {
    throw new Error(`Invalid MM-DD format: ${mmdd}`);
  }
  return new Date(year, Number(monthStr) - 1, Number(dayStr));
}

function isDateInRange(
  date: Date,
  start: string,
  end: string,
  preRampDays: number,
  postTailDays: number,
): boolean {
  const year = date.getFullYear();
  const startDate = parseMMDD(start, year);
  const endDate = parseMMDD(end, year);

  const extendedStart = new Date(startDate);
  extendedStart.setDate(extendedStart.getDate() - preRampDays);

  const extendedEnd = new Date(endDate);
  extendedEnd.setDate(extendedEnd.getDate() + postTailDays);

  return date >= extendedStart && date <= extendedEnd;
}



// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all active events for a given date (including pre-ramp and post-tail periods).
 */
export function getActiveEvents(date: Date): SeasonalEvent[] {
  const events = getEventsForYear(date.getFullYear());
  return events.filter((event) =>
    isDateInRange(
      date,
      event.dateRange.start,
      event.dateRange.end,
      event.preRampDays,
      event.postTailDays,
    ),
  );
}

/**
 * Get upcoming events within a specified number of days ahead.
 */
export function getUpcomingEvents(date: Date, daysAhead: number): SeasonalEvent[] {
  const events = getEventsForYear(date.getFullYear());
  const futureDate = new Date(date);
  futureDate.setDate(futureDate.getDate() + daysAhead);

  return events.filter((event) => {
    const eventStart = parseMMDD(event.dateRange.start, date.getFullYear());
    const preRampStart = new Date(eventStart);
    preRampStart.setDate(preRampStart.getDate() - event.preRampDays);

    return preRampStart > date && preRampStart <= futureDate;
  });
}

/**
 * Get the composite seasonal multiplier for a given date, industry, and platform.
 * Combines overlapping events using the maximum multiplier.
 */
export function getSeasonalMultiplier(
  date: Date,
  industry: string,
  _platform: string,
): number {
  const activeEvents = getActiveEvents(date);

  if (activeEvents.length === 0) return 1.0;

  let maxDemandMultiplier = 1.0;

  for (const event of activeEvents) {
    const impact = event.industryImpacts[industry];
    if (!impact) continue;

    // Apply a ramp-up/tail-off factor based on proximity to core dates
    const factor = computeProximityFactor(
      date,
      event.dateRange.start,
      event.dateRange.end,
      event.preRampDays,
      event.postTailDays,
    );

    const effectiveMultiplier = 1 + (impact.demandMultiplier - 1) * factor;
    maxDemandMultiplier = Math.max(maxDemandMultiplier, effectiveMultiplier);
  }

  return Math.round(maxDemandMultiplier * 100) / 100;
}

/**
 * Compute a proximity factor (0-1) based on how close a date is to the core event period.
 * 1.0 during the core period, ramping up from 0 during pre-ramp, tapering to 0 during post-tail.
 */
function computeProximityFactor(
  date: Date,
  start: string,
  end: string,
  preRampDays: number,
  postTailDays: number,
): number {
  const year = date.getFullYear();
  const startDate = parseMMDD(start, year);
  const endDate = parseMMDD(end, year);

  // During core period
  if (date >= startDate && date <= endDate) return 1.0;

  // Pre-ramp period
  const preRampStart = new Date(startDate);
  preRampStart.setDate(preRampStart.getDate() - preRampDays);
  if (date >= preRampStart && date < startDate) {
    const daysUntilStart = (startDate.getTime() - date.getTime()) / 86_400_000;
    return Math.max(0, 1 - daysUntilStart / preRampDays);
  }

  // Post-tail period
  const postTailEnd = new Date(endDate);
  postTailEnd.setDate(postTailEnd.getDate() + postTailDays);
  if (date > endDate && date <= postTailEnd) {
    const daysSinceEnd = (date.getTime() - endDate.getTime()) / 86_400_000;
    return Math.max(0, 1 - daysSinceEnd / postTailDays);
  }

  return 0;
}

/**
 * Get recommended ad copy keywords for a given date and industry.
 */
export function getRecommendedKeywords(date: Date, industry: string): string[] {
  const activeEvents = getActiveEvents(date);
  const keywords = new Set<string>();

  for (const event of activeEvents) {
    const impact = event.industryImpacts[industry];
    if (!impact) continue;
    for (const keyword of impact.recommendedCopyKeywords) {
      keywords.add(keyword);
    }
  }

  return [...keywords];
}

/**
 * Get recommended creative themes for a given date and industry.
 */
export function getRecommendedThemes(date: Date, industry: string): string[] {
  const activeEvents = getActiveEvents(date);
  const themes = new Set<string>();

  for (const event of activeEvents) {
    const impact = event.industryImpacts[industry];
    if (!impact) continue;
    for (const theme of impact.recommendedCreativeThemes) {
      themes.add(theme);
    }
  }

  return [...themes];
}
