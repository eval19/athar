import { describe, expect, it } from 'vitest';
import { formatHadithForShare } from '../src/services/shareCopy';
import type { HadithResult } from '../src/domain/hadith';

const SAMPLE_HADITH: HadithResult = {
  id: 'h-1',
  text: 'إنَّما الأعْمالُ بالنِّيّاتِ، وإنَّما لِكُلِّ امْرِئٍ ما نَوى.',
  narrator: 'عمر بن الخطاب',
  muhaddith: 'البخاري',
  source: 'صحيح البخاري',
  pageOrNumber: '1',
  rawGrade: '[صحيح]',
  gradeBucket: 'sahih',
};

describe('formatHadithForShare', () => {
  it('formats complete Arabic hadith citation cleanly for copy/share', () => {
    const formatted = formatHadithForShare(SAMPLE_HADITH, 'ar');

    expect(formatted).toContain(SAMPLE_HADITH.text);
    expect(formatted).toContain('الراوي: عمر بن الخطاب');
    expect(formatted).toContain('المحدث: البخاري');
    expect(formatted).toContain('المصدر: صحيح البخاري (1)');
    expect(formatted).toContain('الحكم: [صحيح]');
    expect(formatted).toContain('الدرر السنية');
  });

  it('formats English metadata labels cleanly when UI locale is English', () => {
    const formatted = formatHadithForShare(SAMPLE_HADITH, 'en');

    expect(formatted).toContain(SAMPLE_HADITH.text);
    expect(formatted).toContain('Narrator: عمر بن الخطاب');
    expect(formatted).toContain('Source: صحيح البخاري (1)');
    expect(formatted).toContain('Grade: [صحيح]');
    expect(formatted).toContain('Athar');
  });

  it('omits empty optional metadata fields gracefully', () => {
    const partial: HadithResult = {
      ...SAMPLE_HADITH,
      pageOrNumber: '',
      muhaddith: '',
    };
    const formatted = formatHadithForShare(partial, 'ar');
    expect(formatted).not.toContain('المحدث:');
    expect(formatted).toContain('المصدر: صحيح البخاري');
    expect(formatted).not.toContain('()');
  });
});
