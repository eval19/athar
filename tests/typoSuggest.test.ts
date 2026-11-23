import { describe, expect, it } from 'vitest';
import { suggestArabicQuery } from '../src/domain/typoSuggest';

describe('suggestArabicQuery', () => {
  it('corrects trailing duplicated letters such as النارر -> النار', () => {
    const result = suggestArabicQuery('النارر');
    expect(result.correctedQuery).toBe('النار');
    expect(result.changed).toBe(true);
  });

  it('corrects inserted typo letters such as الناور -> النار', () => {
    const result = suggestArabicQuery('الناور');
    expect(result.correctedQuery).toBe('النار');
    expect(result.changed).toBe(true);
  });

  it('corrects swapped or substituted letters in common hadith words', () => {
    expect(suggestArabicQuery('النجة').correctedQuery).toBe('الجنة');
    expect(suggestArabicQuery('الصلاخ').correctedQuery).toBe('الصلاة');
    expect(suggestArabicQuery('الرحمخ').correctedQuery).toBe('الرحمة');
  });

  it('fixes a typo inside a multi-word query while keeping valid words intact', () => {
    const result = suggestArabicQuery('عذاب الناور');
    expect(result.correctedQuery).toBe('عذاب النار');
    expect(result.changed).toBe(true);
  });

  it('leaves valid Arabic words untouched', () => {
    const result = suggestArabicQuery('النار');
    expect(result.correctedQuery).toBe('النار');
    expect(result.changed).toBe(false);
  });

  it('handles words without definite article ال as well as with ال', () => {
    expect(suggestArabicQuery('ناور').correctedQuery).toBe('نار');
    expect(suggestArabicQuery('صلاخ').correctedQuery).toBe('صلاة');
  });

  it('returns up to 3 alternative close candidates when available', () => {
    const result = suggestArabicQuery('الناور');
    expect(result.alternatives.length).toBeGreaterThanOrEqual(1);
    expect(result.alternatives[0]).toBe('النار');
  });

  it('handles common mobile keyboard slips: doubled vowels, missing letters, transpositions', () => {
    expect(suggestArabicQuery('الرسوول').correctedQuery).toBe('الرسول');
    expect(suggestArabicQuery('الجنةة').correctedQuery).toBe('الجنة');
    expect(suggestArabicQuery('الصاة').correctedQuery).toBe('الصلاة');
    expect(suggestArabicQuery('السملم').correctedQuery).toBe('المسلم');
    expect(suggestArabicQuery('الرحممة').correctedQuery).toBe('الرحمة');
  });

  it('strips standalone single-letter conjunctions like و/ف before recovering typos', () => {
    const res = suggestArabicQuery('و امامز');
    expect(res.correctedQuery).toBe('إمام');
    expect(res.changed).toBe(true);

    const validWithWaw = suggestArabicQuery('و الصلاة');
    expect(validWithWaw.correctedQuery).toBe('الصلاة');
    expect(validWithWaw.changed).toBe(true);
  });

  it('does not mistake common 3-letter Arabic particles like الا (إلا) for unrelated words', () => {
    const res = suggestArabicQuery('الا تمثل لي جبريل');
    expect(res.correctedQuery).not.toContain('ألف');
    expect(res.changed).toBe(false);
  });

  it('recovers Arabic phonetic sound-alike confusions cleanly', () => {
    expect(suggestArabicQuery('الذكات').correctedQuery).toBe('الزكاة');
    expect(suggestArabicQuery('الصلات').correctedQuery).toBe('الصلاة');
    expect(suggestArabicQuery('ضلم').correctedQuery).toBe('ظلم');
    expect(suggestArabicQuery('سبر').correctedQuery).toBe('صبر');
    expect(suggestArabicQuery('التهاره').correctedQuery).toBe('الطهارة');
    expect(suggestArabicQuery('الطهاره').changed).toBe(false);
  });

  it('fixes adjacent mobile keyboard slips and vowel omissions or additions', () => {
    expect(suggestArabicQuery('بالنايت').correctedQuery).toBe('بالنيات');
    expect(suggestArabicQuery('الاستغفرا').correctedQuery).toBe('الاستغفار');
    expect(suggestArabicQuery('التواضوع').correctedQuery).toBe('التواضع');
  });

  it('handles full Arabic prefix and suffix morphology in spell recovery', () => {
    expect(suggestArabicQuery('صلاتكمم').correctedQuery).toBe('صلاتكم');
    expect(suggestArabicQuery('قلوبهمم').correctedQuery).toBe('قلوبهم');
    expect(suggestArabicQuery('المؤمنيين').correctedQuery).toBe('المؤمنين');
  });

  it('splits fused/merged Arabic words cleanly into separate tokens', () => {
    expect(suggestArabicQuery('انماالاعمال').correctedQuery).toBe('إنما الأعمال');
    expect(suggestArabicQuery('غضالبصر').correctedQuery).toBe('غض البصر');
    expect(suggestArabicQuery('عذابالقبر').correctedQuery).toBe('عذاب القبر');
  });

  it('rescues verified wrong-keyboard Latin input while never mangling English words', () => {
    expect(suggestArabicQuery('Hgwghm')).toEqual({
      correctedQuery: 'الصلاة',
      changed: true,
      alternatives: ['الصلاة'],
    });
    expect(suggestArabicQuery('hgkhv').correctedQuery).toBe('النار');

    expect(suggestArabicQuery('prayer')).toEqual({
      correctedQuery: 'prayer',
      changed: false,
      alternatives: [],
    });
    expect(suggestArabicQuery('niyyah').changed).toBe(false);
  });

  it('refuses to rewrite unrecognized random Arabic gibberish', () => {
    const res = suggestArabicQuery('خقضصثق');
    expect(res.correctedQuery).toBe('خقضصثق');
    expect(res.changed).toBe(false);
    expect(res.alternatives).toEqual([]);
  });
});
