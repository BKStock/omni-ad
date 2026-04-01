/**
 * Returns 0 when denominator is zero to avoid NaN/Infinity in metric calcs.
 */
function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function calculateRoas(revenue: number, spend: number): number {
  return safeDivide(revenue, spend);
}

export function calculateCtr(clicks: number, impressions: number): number {
  return safeDivide(clicks, impressions);
}

export function calculateCpc(spend: number, clicks: number): number {
  return safeDivide(spend, clicks);
}

export function calculateCpa(spend: number, conversions: number): number {
  return safeDivide(spend, conversions);
}

export function formatCurrency(amount: number, currency = 'JPY'): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount);
}

/**
 * Counts the display width of a string for ad platform character limits.
 * Full-width characters (CJK, full-width punctuation, etc.) count as 2;
 * half-width characters count as 1.
 */
export function countCharacterWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    width += isFullWidth(code) ? 2 : 1;
  }
  return width;
}

function isFullWidth(code: number): boolean {
  return (
    // CJK Unified Ideographs and extensions
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df) ||
    // Hiragana / Katakana
    (code >= 0x3040 && code <= 0x30ff) ||
    // Full-width Latin and half-width/full-width forms
    (code >= 0xff01 && code <= 0xff60) ||
    // CJK Compatibility Ideographs
    (code >= 0xf900 && code <= 0xfaff) ||
    // CJK Symbols and Punctuation
    (code >= 0x3000 && code <= 0x303f) ||
    // Enclosed CJK Letters and Months / CJK Compatibility
    (code >= 0x3200 && code <= 0x33ff) ||
    // Katakana Phonetic Extensions
    (code >= 0x31f0 && code <= 0x31ff) ||
    // Hangul
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0x1100 && code <= 0x11ff) ||
    // Bopomofo
    (code >= 0x02ea && code <= 0x02eb) ||
    (code >= 0x3105 && code <= 0x312f)
  );
}
