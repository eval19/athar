import { describe, expect, it } from 'vitest';
import { formatHadithForShare } from '../src/services/shareCopy';
import type { HadithResult } from '../src/domain/hadith';

const BUKHARI_HADITH: HadithResult = {
  id: 'h-1',
  text: 'إنَّما الأعْمالُ بالنِّيّاتِ، وإنَّما لِكُلِّ امْرِئٍ ما نَوى.',
  narrator: 'عمر بن الخطاب',
  muhaddith: 'البخاري',
  source: 'صحيح البخاري',
  pageOrNumber: '1',
  rawGrade: '[صحيح]',
  gradeBucket: 'sahih',
};

const GRADED_HADITH: HadithResult = {
  id: 'h-2',
  text: 'تبسُّمُكَ في وجهِ أخيكَ لكَ صدقةٌ.',
  narrator: 'أبو ذر الغفاري',
  muhaddith: 'الألباني',
  source: 'سنن الترمذي',
  pageOrNumber: '1956',
  rawGrade: 'صحيح',
  gradeBucket: 'sahih',
};

const WEAK_HADITH: HadithResult = {
  id: 'h-3',
  text: 'اطلبوا العلم ولو بالصين.',
  narrator: 'أنس بن مالك',
  muhaddith: 'الألباني',
  source: 'السلسلة الضعيفة',
  pageOrNumber: '416',
  rawGrade: 'باطل',
  gradeBucket: 'batil',
};

describe('formatHadithForShare (clean Option 2 style)', () => {
  it('formats Bukhari/Muslim sahih hadith cleanly without redundant verdict or app watermark', () => {
    const formatted = formatHadithForShare(BUKHARI_HADITH, 'ar');

    expect(formatted).toBe(
      [
        'عن عمر بن الخطاب:',
        '«إنَّما الأعْمالُ بالنِّيّاتِ، وإنَّما لِكُلِّ امْرِئٍ ما نَوى.»',
        '— صحيح البخاري (1)',
      ].join('\n'),
    );
  });

  it('includes scholar verdict concisely on non-Bukhari/Muslim collections', () => {
    const formatted = formatHadithForShare(GRADED_HADITH, 'ar');

    expect(formatted).toBe(
      [
        'عن أبو ذر الغفاري:',
        '«تبسُّمُكَ في وجهِ أخيكَ لكَ صدقةٌ.»',
        '— سنن الترمذي (1956) • صحيح (الألباني)',
      ].join('\n'),
    );
  });

  it('places a clear top caution line on weak/fabricated narrations without repeating the grade label', () => {
    const formatted = formatHadithForShare(WEAK_HADITH, 'ar');

    expect(formatted).toBe(
      [
        '⚠️ لا يصح — باطل / لا أصل له',
        'عن أنس بن مالك:',
        '«اطلبوا العلم ولو بالصين.»',
        '— السلسلة الضعيفة (416) • الألباني',
      ].join('\n'),
    );
  });

  it('preserves nuanced scholar verdicts on weak hadiths when they add detail', () => {
    const nuancedWeak: HadithResult = {
      ...WEAK_HADITH,
      rawGrade: 'إسناده ضعيف لانقطاعه',
      gradeBucket: 'daif_isnad',
    };
    const formatted = formatHadithForShare(nuancedWeak, 'ar');

    expect(formatted).toBe(
      [
        '⚠️ لا يصح — إسناده ضعيف',
        'عن أنس بن مالك:',
        '«اطلبوا العلم ولو بالصين.»',
        '— السلسلة الضعيفة (416) • إسناده ضعيف لانقطاعه (الألباني)',
      ].join('\n'),
    );
  });

  it('formats English locale cleanly for both authentic and unauthentic hadiths', () => {
    expect(formatHadithForShare(BUKHARI_HADITH, 'en')).toBe(
      [
        'Narrated by عمر بن الخطاب:',
        '«إنَّما الأعْمالُ بالنِّيّاتِ، وإنَّما لِكُلِّ امْرِئٍ ما نَوى.»',
        '— صحيح البخاري (1)',
      ].join('\n'),
    );

    expect(formatHadithForShare(WEAK_HADITH, 'en')).toBe(
      [
        '⚠️ Caution — Baseless',
        'Narrated by أنس بن مالك:',
        '«اطلبوا العلم ولو بالصين.»',
        '— السلسلة الضعيفة (416) • الألباني',
      ].join('\n'),
    );
  });

  it('omits empty optional metadata fields and avoids double-wrapping guillemets', () => {
    const partial: HadithResult = {
      ...BUKHARI_HADITH,
      text: '«نص حديث محاط بأقواس.»',
      narrator: '',
      pageOrNumber: '',
      muhaddith: '',
    };
    const formatted = formatHadithForShare(partial, 'ar');

    expect(formatted).toBe(['«نص حديث محاط بأقواس.»', '— صحيح البخاري'].join('\n'));
    expect(formatted).not.toContain('()');
    expect(formatted).not.toContain('««');
  });
});
