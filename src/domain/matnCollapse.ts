import type { HighlightSegment } from './arabicNormalize';
import { stripDiacritics } from './arabicNormalize';
import type { ReadingScale } from './hadith';

/**
 * Minimum diacritic-stripped base character count before a Hadith matn is
 * eligible to collapse behind a "Show more" toggle.
 *
 * Tuned so short & medium narrations (~1–10 lines on mobile) stay 100% visible
 * without an extra tap, while truly long narrations (11+ lines) collapse cleanly
 * to a 7-line preview (hiding at least ~4+ lines, never collapsing for 1–2 lines).
 */
export const MATN_COLLAPSE_THRESHOLDS: Readonly<Record<ReadingScale, number>> = {
  sm: 560,
  md: 460,
  lg: 380,
};

/**
 * Conservative estimate of diacritic-stripped characters clearly visible above
 * the bottom fade of a collapsed 7-line preview on a typical phone viewport.
 * Used to cue the user when their highlighted search match only appears further down.
 */
export const MATN_PREVIEW_CHAR_ESTIMATE: Readonly<Record<ReadingScale, number>> = {
  sm: 310,
  md: 250,
  lg: 200,
};

/**
 * Minimum rendered line count required before clamping a candidate long matn to
 * 7 lines (prevents fading/collapsing on wide tablets where a 460-char hadith
 * already fits in 6–8 lines).
 */
export const MATN_MIN_LINES_TO_COLLAPSE = 9.5;

/**
 * Line offset (from top of matn) beyond which a highlighted match is in the
 * fading or hidden zone of a 7-line collapsed preview.
 */
export const MATN_CLEAR_VISIBLE_LINES = 5.2;

export function measureMatnBaseLength(text: string): number {
  return stripDiacritics(text).replace(/\s+/g, ' ').trim().length;
}

export function shouldCollapseMatn(text: string, readingScale: ReadingScale): boolean {
  return measureMatnBaseLength(text) >= MATN_COLLAPSE_THRESHOLDS[readingScale];
}

/**
 * Returns true when at least one highlighted search match exists in the matn
 * AND the earliest match starts past the visible top portion of a collapsed preview.
 * If a match is already clearly visible near the top, returns false to avoid noise.
 */
export function hasMatchOnlyBelowPreview(
  segments: readonly HighlightSegment[],
  readingScale: ReadingScale,
): boolean {
  let prefix = '';
  for (const seg of segments) {
    if (seg.match) {
      const baseOffset = stripDiacritics(prefix).replace(/\s+/g, ' ').trimStart().length;
      return baseOffset >= MATN_PREVIEW_CHAR_ESTIMATE[readingScale];
    }
    prefix += seg.text;
  }
  return false;
}
