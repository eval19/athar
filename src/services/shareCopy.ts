import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import { normalizeArabic } from '../domain/arabicNormalize';
import { isUnauthenticBucket } from '../domain/gradeClassifier';
import type { GradeBucket, HadithResult, Locale } from '../domain/hadith';
import { getStrings } from '../i18n/strings';

const SELF_AUTHENTICATING_PAIRS: ReadonlyArray<{ source: string; muhaddith: string }> = [
  { source: 'صحيح البخاري', muhaddith: 'البخاري' },
  { source: 'صحيح مسلم', muhaddith: 'مسلم' },
];

function unwrapOuterBrackets(raw: string): string {
  return raw.trim().replace(/^\[([^\]]+)\]$/, '$1').trim();
}

function wrapMatn(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('«') && trimmed.endsWith('»')) {
    return trimmed;
  }
  return `«${trimmed}»`;
}

function isRedundantSahihVerdict(
  hadith: HadithResult,
  cleanGrade: string,
): boolean {
  if (hadith.gradeBucket !== 'sahih') return false;
  const normGrade = normalizeArabic(cleanGrade);
  if (normGrade && normGrade !== 'صحيح') return false;

  const normSource = normalizeArabic(hadith.source);
  const normMuhaddith = normalizeArabic(hadith.muhaddith);
  return SELF_AUTHENTICATING_PAIRS.some(
    (pair) =>
      normSource === normalizeArabic(pair.source) &&
      (!normMuhaddith || normMuhaddith === normalizeArabic(pair.muhaddith)),
  );
}

function cautionLabelForBucket(bucket: GradeBucket, locale: Locale): string {
  const gradeLabel = getStrings(locale).grades[bucket];
  return locale === 'ar'
    ? `⚠️ لا يصح — ${gradeLabel}`
    : `⚠️ Caution — ${gradeLabel}`;
}

export function formatHadithForShare(hadith: HadithResult, locale: Locale): string {
  const lines: string[] = [];
  const unauthentic = isUnauthenticBucket(hadith.gradeBucket);
  const cleanGrade = unwrapOuterBrackets(hadith.rawGrade);
  const muhaddith = hadith.muhaddith.trim();
  const narrator = hadith.narrator.trim();

  if (unauthentic) {
    lines.push(cautionLabelForBucket(hadith.gradeBucket, locale));
  }

  if (narrator) {
    lines.push(locale === 'ar' ? `عن ${narrator}:` : `Narrated by ${narrator}:`);
  }

  lines.push(wrapMatn(hadith.text));

  const sourceLine = hadith.source.trim()
    ? hadith.pageOrNumber.trim()
      ? `${hadith.source.trim()} (${hadith.pageOrNumber.trim()})`
      : hadith.source.trim()
    : '';

  let verdictLine = '';
  if (unauthentic) {
    const arBucketLabel = normalizeArabic(getStrings('ar').grades[hadith.gradeBucket]);
    const normGrade = normalizeArabic(cleanGrade);
    const hasExtraNuance =
      Boolean(cleanGrade) &&
      normGrade !== arBucketLabel &&
      !arBucketLabel.includes(normGrade);

    if (hasExtraNuance && muhaddith) {
      verdictLine = `${cleanGrade} (${muhaddith})`;
    } else if (hasExtraNuance) {
      verdictLine = cleanGrade;
    } else if (muhaddith) {
      verdictLine = muhaddith;
    }
  } else if (!isRedundantSahihVerdict(hadith, cleanGrade)) {
    if (cleanGrade && muhaddith) {
      verdictLine = `${cleanGrade} (${muhaddith})`;
    } else if (cleanGrade) {
      verdictLine = cleanGrade;
    } else if (muhaddith) {
      verdictLine = muhaddith;
    }
  }

  const citationParts = [sourceLine, verdictLine].filter(Boolean);
  if (citationParts.length > 0) {
    lines.push(`— ${citationParts.join(' • ')}`);
  }

  return lines.join('\n');
}

export async function copyHadithText(hadith: HadithResult, locale: Locale): Promise<void> {
  const formatted = formatHadithForShare(hadith, locale);

  if (Capacitor.isNativePlatform()) {
    await Clipboard.write({ string: formatted });
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(formatted);
    return;
  }

  // Fallback for restricted WebView/HTTP contexts
  const textarea = document.createElement('textarea');
  textarea.value = formatted;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export async function shareHadithText(
  hadith: HadithResult,
  locale: Locale,
): Promise<'shared' | 'copied'> {
  const formatted = formatHadithForShare(hadith, locale);
  const title = locale === 'ar' ? 'حديث نبوي — أَثَر' : 'Hadith — Athar';

  if (Capacitor.isNativePlatform()) {
    await Share.share({
      title,
      text: formatted,
      dialogTitle: locale === 'ar' ? 'مشاركة الحديث' : 'Share Hadith',
    });
    return 'shared';
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share({ title, text: formatted });
    return 'shared';
  }

  await copyHadithText(hadith, locale);
  return 'copied';
}
