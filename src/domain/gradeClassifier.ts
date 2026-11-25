import { normalizeArabic } from './arabicNormalize';
import type { GradeBucket } from './hadith';

export interface GradeSummary {
  bucket: GradeBucket;
  rawVerdict: string;
}

const SPLIT_MARKER_PATTERN =
  /(الشطر|للشطر|شطره|بعضه|دون|الا ان|الا قوله|الا لفظ|والاول|والثاني|اوله|اخره|ولكن|لكن|غير ان|وله شاهد|شاهدان|بعضها|فيما عدا)/;

const CORROBORATED_PATTERN = /(يقوي|يتقوي|له شاهد|شاهدان|شواهد|له متابع)/;

/**
 * Single source of truth for negated positive scholar verdicts so compound-split
 * stripping, weak-chain detection, and weak-verdict detection can never drift apart.
 */
const POSITIVE_QUALITIES =
  '(?:صحيحه?|ثابته?|قويه?|جيده?|حسنه?|صالحه?|مقبوله?|محفوظه?|متصله?)';

const NEGATED_POSITIVE_SOURCE =
  `(?:ليس(?:ت)? (?:ب|بال)?${POSITIVE_QUALITIES}|غير ${POSITIVE_QUALITIES}|(?:لا|لم) (?:يصح|تصح|يثبت|تثبت|يحسن|يقوي))`;

const NEGATED_POSITIVE_GLOBAL = new RegExp(NEGATED_POSITIVE_SOURCE, 'g');

/**
 * Non-grading exclusion notes (e.g. "ليس على شرط الشيخين", "ليس في الصحيحين")
 * that must not falsely match positive Sahih substrings like "علي شرط" or "صحيح".
 */
const NON_GRADING_EXCLUSION_PATTERN =
  /(?:ليس(?:ت)? علي شرط(?:\s+\S+){0,2}|غير علي شرط(?:\s+\S+){0,2}|ليس(?:ت)? في الصحيح(?:ين)?|لم يخرج(?:ه|اه|وه)? في الصحيح(?:ين)?|في غير الصحيح(?:ين)?)/g;

const NEGATED_MAWDU_PATTERN = /(ليس بموضوع|غير موضوع|لا يحكم عليه بالوضع)/g;
const NEGATED_DAIF_PATTERN = /(?:ليس(?:ت)? بضعيفه?|غير ضعيفه?)/g;

const MAWDU_PATTERN = /(موضوع|مكذوب|(?:^|\s)(?:كذب|كذاب)(?:\s|$)|وضاع|مختلق|مصنوع)/;
const BATIL_PATTERN =
  /(باطل|لا اصل له|ليس له اصل|لا يصح له اصل|لا اعرف له اصل|لا نعرف له اصل|لا يعلم له اصل|لا نعلم له اصل)/;
const MUNKAR_PATTERN = /(منكر|انكره)/;
const VERY_WEAK_PATTERN =
  /(ضعيف جدا|شديد الضعف|(?:^|\s)واه(?:\s|$)|واهي|متروك|ساقط|تالف|هالك|مطروح|ذاهب الحديث|لا يتطرق اليه احتمال التحسين)/;

const DAIF_PATTERN = new RegExp(
  `(?:${NEGATED_POSITIVE_SOURCE}|ضعيف|ضعفه|ضعيفي|(?:^|\\s)شاذ(?:\\s|$)|معلول|منقطع|معضل|مرسل|مردود|(?:^|\\s)(?:خطا|اخطا|غلط)(?:\\s|$)|مضطرب|مجهول|فيه لين|لا شيء|لا شي في الحديث|ليس بشيء|ليس بشي)`,
);

const ISNAD_DAIF_PATTERN = new RegExp(
  `(?:اسناده ضعيف|ضعيف الاسناد|اسناد ضعيف|اسناده منقطع|اسناده مرسل|اسناده مظلم|سنده ضعيف|سند ضعيف|(?:اسناده|سنده) ${NEGATED_POSITIVE_SOURCE})`,
);

const ISNAD_SAHIH_PATTERN =
  /(اسناده صحيح|صحيح الاسناد|اسناد صحيح|رجاله ثقات|رجال الصحيح|اسناده علي شرط|اسناده ثابت)/;
const ISNAD_HASAN_PATTERN =
  /(اسناده حسن|حسن الاسناد|اسناده جيد|جيد الاسناد|اسناده قوي|اسناد قوي|اسناده لا باس به|اسناده صالح)/;

const SAHIH_PATTERN =
  /(صحيح|متواتر|اخرجه في صحيحه|علي شرط|ثابت|محفوظ|رجاله ثقات|رجال الصحيح|مجمع علي صحته|ثبت في)/;
const HASAN_PATTERN = /(حسن|جيد|مقبول|لا باس به|صالح|قوي|مقارب)/;

export function isSahihBucket(bucket: GradeBucket): boolean {
  return bucket === 'sahih' || bucket === 'sahih_isnad';
}

export function isHasanBucket(bucket: GradeBucket): boolean {
  return bucket === 'hasan' || bucket === 'hasan_isnad';
}

export function isUnauthenticBucket(bucket: GradeBucket): boolean {
  return (
    bucket === 'daif_isnad' ||
    bucket === 'daif' ||
    bucket === 'very_weak' ||
    bucket === 'munkar' ||
    bucket === 'mawdu' ||
    bucket === 'batil'
  );
}

function isCompoundSplitVerdict(normalized: string): boolean {
  if (!SPLIT_MARKER_PATTERN.test(normalized)) return false;

  const forPositiveCheck = normalized
    .replace(NEGATED_POSITIVE_GLOBAL, ' ')
    .replace(NON_GRADING_EXCLUSION_PATTERN, ' ');
  const forDaifCheck = normalized.replace(NEGATED_DAIF_PATTERN, ' ');
  const forMawduCheck = normalized.replace(NEGATED_MAWDU_PATTERN, ' ');

  const hasPositive =
    SAHIH_PATTERN.test(forPositiveCheck) ||
    HASAN_PATTERN.test(forPositiveCheck) ||
    CORROBORATED_PATTERN.test(forPositiveCheck);
  const hasNegative =
    MAWDU_PATTERN.test(forMawduCheck) ||
    BATIL_PATTERN.test(normalized) ||
    MUNKAR_PATTERN.test(normalized) ||
    VERY_WEAK_PATTERN.test(normalized) ||
    DAIF_PATTERN.test(forDaifCheck);

  return hasPositive && hasNegative;
}

export function classifyVerdict(rawVerdict: string): GradeSummary {
  const trimmed = rawVerdict.trim();
  if (!trimmed) {
    return { bucket: 'unknown', rawVerdict: '' };
  }

  const normalized = normalizeArabic(trimmed);

  // Compound/split rulings (e.g. "ضعيف والشطر الثاني صحيح") require reading the full scholar quote
  if (isCompoundSplitVerdict(normalized)) {
    return { bucket: 'unknown', rawVerdict: trimmed };
  }

  const forMawduCheck = normalized.replace(NEGATED_MAWDU_PATTERN, ' ');
  if (MAWDU_PATTERN.test(forMawduCheck)) {
    return { bucket: 'mawdu', rawVerdict: trimmed };
  }

  if (BATIL_PATTERN.test(normalized)) {
    return { bucket: 'batil', rawVerdict: trimmed };
  }

  if (MUNKAR_PATTERN.test(normalized)) {
    return { bucket: 'munkar', rawVerdict: trimmed };
  }

  if (VERY_WEAK_PATTERN.test(normalized)) {
    return { bucket: 'very_weak', rawVerdict: trimmed };
  }

  const forDaifCheck = normalized.replace(NEGATED_DAIF_PATTERN, ' ');
  if (ISNAD_DAIF_PATTERN.test(forDaifCheck)) {
    return { bucket: 'daif_isnad', rawVerdict: trimmed };
  }

  if (DAIF_PATTERN.test(forDaifCheck)) {
    return { bucket: 'daif', rawVerdict: trimmed };
  }

  const forPositiveCheck = normalized.replace(NON_GRADING_EXCLUSION_PATTERN, ' ');

  if (ISNAD_SAHIH_PATTERN.test(forPositiveCheck)) {
    return { bucket: 'sahih_isnad', rawVerdict: trimmed };
  }

  // Handle combined rulings like "حسن صحيح" as Sahih
  if (SAHIH_PATTERN.test(forPositiveCheck)) {
    return { bucket: 'sahih', rawVerdict: trimmed };
  }

  if (ISNAD_HASAN_PATTERN.test(forPositiveCheck)) {
    return { bucket: 'hasan_isnad', rawVerdict: trimmed };
  }

  if (HASAN_PATTERN.test(forPositiveCheck)) {
    return { bucket: 'hasan', rawVerdict: trimmed };
  }

  return { bucket: 'unknown', rawVerdict: trimmed };
}
