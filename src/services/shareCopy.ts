import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import type { HadithResult, Locale } from '../domain/hadith';

export function formatHadithForShare(hadith: HadithResult, locale: Locale): string {
  const lines: string[] = [hadith.text.trim(), ''];

  const sourceLine = hadith.source
    ? hadith.pageOrNumber
      ? `${hadith.source} (${hadith.pageOrNumber})`
      : hadith.source
    : '';

  if (locale === 'ar') {
    if (hadith.narrator) lines.push(`الراوي: ${hadith.narrator}`);
    if (hadith.muhaddith) lines.push(`المحدث: ${hadith.muhaddith}`);
    if (sourceLine) lines.push(`المصدر: ${sourceLine}`);
    if (hadith.rawGrade) lines.push(`الحكم: ${hadith.rawGrade}`);
    if (hadith.takhrij) lines.push(`التخريج: ${hadith.takhrij}`);
    lines.push('— تطبيق أَثَر (الموسوعة الحديثية — الدرر السنية)');
  } else {
    if (hadith.narrator) lines.push(`Narrator: ${hadith.narrator}`);
    if (hadith.muhaddith) lines.push(`Scholar: ${hadith.muhaddith}`);
    if (sourceLine) lines.push(`Source: ${sourceLine}`);
    if (hadith.rawGrade) lines.push(`Grade: ${hadith.rawGrade}`);
    if (hadith.takhrij) lines.push(`Takhrij: ${hadith.takhrij}`);
    lines.push('— Athar App (Al-Dorar Hadith Encyclopedia)');
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
