import { describe, expect, it } from 'vitest';
import { groupDuplicateHadiths } from '../src/domain/groupHadiths';
import type { HadithResult } from '../src/domain/hadith';

function makeHadith(overrides: Partial<HadithResult> & { id: string }): HadithResult {
  return {
    text: 'إذا قام أحدكم إلى الصلاة فليسكن أطرافه',
    narrator: 'أبو بكر الصديق',
    muhaddith: 'المناوي',
    source: 'فيض القدير',
    pageOrNumber: '783',
    rawGrade: 'ضعيف',
    gradeBucket: 'daif',
    ...overrides,
  };
}

describe('groupDuplicateHadiths', () => {
  it('merges hadiths whose normalized matn matches despite diacritics and punctuation', () => {
    const items: HadithResult[] = [
      makeHadith({
        id: '1',
        text: 'إذا قام أحدكم إلى الصَّلاةِ فليُسكِّنْ أطرافَه ولا يتميَّلْ كما تتميَّلُ اليهودُ.',
        source: 'فيض القدير',
        muhaddith: 'زين الدين المناوي',
      }),
      makeHadith({
        id: '2',
        text: 'إذا قام أحدُكم إلى الصلاةِ، فَلْيُسَكِّنْ أطرافَه، ولا يَتميَّلْ كما يَتميَّلُ اليهودُ.',
        source: 'التنوير شرح الجامع الصغير',
        muhaddith: 'الصنعاني',
      }),
    ];

    const grouped = groupDuplicateHadiths(items);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].primary.id).toBe('1');
    expect(grouped[0].others).toHaveLength(1);
    expect(grouped[0].others[0].source).toBe('التنوير شرح الجامع الصغير');
  });

  it('promotes Sahihayn or stronger authentic grading to primary within a merged group', () => {
    const items: HadithResult[] = [
      makeHadith({
        id: 'a',
        text: 'إنَّما الأعْمالُ بالنِّيّاتِ',
        source: 'مجموع الفتاوى',
        muhaddith: 'ابن تيمية',
        rawGrade: 'صحيح',
        gradeBucket: 'sahih',
      }),
      makeHadith({
        id: 'b',
        text: 'إنما الأعمال بالنيات',
        source: 'صحيح البخاري',
        muhaddith: 'البخاري',
        rawGrade: '[صحيح]',
        gradeBucket: 'sahih',
      }),
    ];

    const grouped = groupDuplicateHadiths(items);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].primary.source).toBe('صحيح البخاري');
    expect(grouped[0].others).toHaveLength(1);
    expect(grouped[0].others[0].source).toBe('مجموع الفتاوى');
  });

  it('keeps distinct hadiths as separate groups in original order', () => {
    const items: HadithResult[] = [
      makeHadith({ id: '1', text: 'إنما الأعمال بالنيات' }),
      makeHadith({ id: '2', text: 'اتقوا الله في الصلاة' }),
    ];

    const grouped = groupDuplicateHadiths(items);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].others).toHaveLength(0);
    expect(grouped[1].others).toHaveLength(0);
  });

  it('does not add identical duplicate citations into others', () => {
    const items: HadithResult[] = [
      makeHadith({ id: '1' }),
      makeHadith({ id: '2' }),
    ];

    const grouped = groupDuplicateHadiths(items);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].others).toHaveLength(0);
  });

  it('preserves distinct Sahabi narrators when grouping identical matns across routes', () => {
    const items: HadithResult[] = [
      makeHadith({
        id: 'ali',
        text: 'الصَّلاةَ الصَّلاةَ وما ملكَتْ أيمانُكم',
        narrator: 'علي بن أبي طالب',
        muhaddith: 'ابن كثير',
        source: 'تفسير القرآن العظيم',
        pageOrNumber: '2/264',
        rawGrade: 'ثابت',
        gradeBucket: 'sahih',
      }),
      makeHadith({
        id: 'anas',
        text: 'الصَّلاةَ الصَّلاةَ وما مَلَكَت أيمانُكم',
        narrator: 'أنس بن مالك',
        muhaddith: 'ابن القيسراني',
        source: 'ذخيرة الحفاظ',
        pageOrNumber: '3/1552',
        rawGrade: '[فيه] بحر السقاء متروك الحديث',
        gradeBucket: 'very_weak',
      }),
    ];

    const grouped = groupDuplicateHadiths(items);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].primary.narrator).toBe('علي بن أبي طالب');
    expect(grouped[0].others).toHaveLength(1);
    expect(grouped[0].others[0].narrator).toBe('أنس بن مالك');
  });

  it('promotes explicit weak/munkar gradings above ungraded descriptive notes (unknown)', () => {
    const items: HadithResult[] = [
      makeHadith({
        id: 'tabarani',
        text: 'مِن تمامِ الصَّلاةِ الصَّلاةُ في النَّعلينِ',
        narrator: 'عبدالله بن مسعود',
        muhaddith: 'الطبراني',
        source: 'المعجم الأوسط',
        pageOrNumber: '1/54',
        rawGrade: 'لم يرو هذا الحديث عن مغيرة إلا علي بن عاصم تفرد به موسى بن أبي سهل',
        gradeBucket: 'unknown',
      }),
      makeHadith({
        id: 'albani',
        text: 'من تمام الصلاة الصلاة في النعلين',
        narrator: 'عبدالله بن مسعود',
        muhaddith: 'الألباني',
        source: 'ضعيف الجامع',
        pageOrNumber: '5360',
        rawGrade: 'ضعيف',
        gradeBucket: 'daif',
      }),
      makeHadith({
        id: 'uqayli',
        text: 'من تمام الصلاة الصلاة في النعلين',
        narrator: 'عبدالله بن مسعود',
        muhaddith: 'العقيلي',
        source: 'الضعفاء الكبير',
        pageOrNumber: '3/250',
        rawGrade: 'منكر',
        gradeBucket: 'munkar',
      }),
    ];

    const grouped = groupDuplicateHadiths(items);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].primary.gradeBucket).toBe('daif');
    expect(grouped[0].primary.muhaddith).toBe('الألباني');
    expect(grouped[0].others).toHaveLength(2);
  });
});
