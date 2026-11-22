import { normalizeArabic } from './arabicNormalize';
import type { GradeBucket } from './hadith';

export interface GradeSummary {
  bucket: GradeBucket;
  rawVerdict: string;
}

const SPLIT_MARKER_PATTERN =
  /(الشطر|للشطر|شطره|بعضه|دون|الا ان|الا قوله|الا لفظ|والاول|والثاني|اوله|اخره|ولكن|لكن|غير ان|وله شاهد|شاهدان|بعضها|فيما عدا)/;

const CORROBORATED_PATTERN = /(يقوي|يتقوي)/;

const NEGATED_SAHIH_PATTERN =
  /(ليس بصحيح|غير صحيح|لا يصح|لم يصح|ليس بثابت|لم يثبت|لا يثبت)/g;

const NEGATED_MAWDU_PATTERN = /(ليس بموضوع|غير موضوع|لا يحكم عليه بالوضع)/g;

const MAWDU_PATTERN = /(موضوع|مكذوب|(?:^|\s)(?:كذب|كذاب)(?:\s|$)|وضاع|مختلق|مصنوع)/;
const BATIL_PATTERN =
  /(باطل|لا اصل له|ليس له اصل|لا يصح له اصل|لا اعرف له اصل|لا نعرف له اصل|لا يعلم له اصل|لا نعلم له اصل)/;
const MUNKAR_PATTERN = /(منكر|انكره)/;
const VERY_WEAK_PATTERN =
  /(ضعيف جدا|شديد الضعف|(?:^|\s)واه(?:\s|$)|واهي|متروك|ساقط|تالف|هالك|مطروح|ذاهب الحديث|لا يتطرق اليه احتمال التحسين)/;
const DAIF_PATTERN =
  /(ليس بصحيح|غير صحيح|لا يصح|لم يصح|لم يثبت|لا يثبت|ضعيف|ضعفه|ضعيفي|غير محفوظ|(?:^|\s)شاذ(?:\s|$)|معلول|منقطع|معضل|مرسل|مردود|(?:^|\s)(?:خطا|اخطا|غلط)(?:\s|$)|مضطرب|مجهول|فيه لين|لا شيء|لا شي في الحديث|ليس بشيء|ليس بشي)/;

const ISNAD_DAIF_PATTERN =
  /(اسناده ضعيف|ضعيف الاسناد|اسناد ضعيف|اسناده غير صحيح|اسناده لا يصح|اسناده منقطع|اسناده مرسل|اسناده مظلم|سنده ضعيف|سند ضعيف)/;
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

  const withoutNegatedPositive = normalized.replace(NEGATED_SAHIH_PATTERN, ' ');
  const hasPositive =
    SAHIH_PATTERN.test(withoutNegatedPositive) ||
    HASAN_PATTERN.test(withoutNegatedPositive) ||
    CORROBORATED_PATTERN.test(withoutNegatedPositive);
  const hasNegative =
    MAWDU_PATTERN.test(normalized) ||
    BATIL_PATTERN.test(normalized) ||
    MUNKAR_PATTERN.test(normalized) ||
    VERY_WEAK_PATTERN.test(normalized) ||
    DAIF_PATTERN.test(normalized);

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

  if (ISNAD_DAIF_PATTERN.test(normalized)) {
    return { bucket: 'daif_isnad', rawVerdict: trimmed };
  }

  if (DAIF_PATTERN.test(normalized)) {
    return { bucket: 'daif', rawVerdict: trimmed };
  }

  if (ISNAD_SAHIH_PATTERN.test(normalized)) {
    return { bucket: 'sahih_isnad', rawVerdict: trimmed };
  }

  // Handle combined rulings like "حسن صحيح" as Sahih
  if (SAHIH_PATTERN.test(normalized)) {
    return { bucket: 'sahih', rawVerdict: trimmed };
  }

  if (ISNAD_HASAN_PATTERN.test(normalized)) {
    return { bucket: 'hasan_isnad', rawVerdict: trimmed };
  }

  if (HASAN_PATTERN.test(normalized)) {
    return { bucket: 'hasan', rawVerdict: trimmed };
  }

  return { bucket: 'unknown', rawVerdict: trimmed };
}
