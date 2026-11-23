import { describe, expect, it } from 'vitest';
import {
  collapseRepeatedChars,
  convertEnKeyboardToArabic,
  findArabicHighlightSegments,
  normalizeArabic,
  normalizeCommonOrthography,
  repairSplitArabicWords,
  stripDiacritics,
  stripQueryFillers,
} from '../src/domain/arabicNormalize';

describe('stripDiacritics', () => {
  it('removes Arabic tashkeel and tatweel while keeping base letters', () => {
    expect(stripDiacritics('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ')).toBe('إنما الأعمال بالنيات');
    expect(stripDiacritics('الــنَّــارِ')).toBe('النار');
  });
});

describe('normalizeArabic', () => {
  it('normalizes hamza forms, alif maqsura, and ta marbuta', () => {
    expect(normalizeArabic('أَحمَد إِلى آدَم')).toBe('احمد الي ادم');
    expect(normalizeArabic('الصَّلاةُ عَلَى النَّبِيِّ')).toBe('الصلاه علي النبي');
  });

  it('trims and collapses multiple spaces and punctuation', () => {
    expect(normalizeArabic('   إنَّما   الأعْمالُ  ')).toBe('انما الاعمال');
  });
});

describe('collapseRepeatedChars', () => {
  it('collapses accidental triple or trailing duplicate letters like النارر', () => {
    expect(collapseRepeatedChars('النارر')).toBe('النار');
    expect(collapseRepeatedChars('الناررر')).toBe('النار');
    expect(collapseRepeatedChars('الصلاااة')).toBe('الصلاة');
  });

  it('preserves legitimate Arabic geminate words like الله and الجنة', () => {
    expect(collapseRepeatedChars('الله')).toBe('الله');
    expect(collapseRepeatedChars('الجنة')).toBe('الجنة');
    expect(collapseRepeatedChars('الليل')).toBe('الليل');
    expect(collapseRepeatedChars('مما')).toBe('مما');
  });
});

describe('findArabicHighlightSegments', () => {
  it('highlights matched words inside heavily diacritized hadith text', () => {
    const text = 'مَن استعاذَ باللهِ من النَّارِ ثلاثًا، قالت النَّارُ: اللَّهُمَّ أعِذْه';
    const segments = findArabicHighlightSegments(text, 'النار');
    const highlighted = segments.filter((s) => s.match).map((s) => s.text);

    expect(highlighted).toEqual(['النَّارِ', 'النَّارُ']);
    expect(segments.map((s) => s.text).join('')).toBe(text);
  });

  it('matches even when query uses bare alif against hamza-bearing hadith words', () => {
    const text = 'إنَّما الأعْمالُ بالنِّيّاتِ';
    const segments = findArabicHighlightSegments(text, 'انما الاعمال');
    const highlighted = segments.filter((s) => s.match).map((s) => s.text);

    expect(highlighted).toEqual(['إنَّما', 'الأعْمالُ']);
    expect(segments.map((s) => s.text).join('')).toBe(text);
  });

  it('matches substrings inside longer Arabic words with prefixes like والنار or بالنيات', () => {
    const text = 'إنَّما الأعْمالُ بالنِّيّاتِ';
    const segments = findArabicHighlightSegments(text, 'نيات');
    const highlighted = segments.filter((s) => s.match).map((s) => s.text);

    expect(highlighted).toEqual(['نِّيّاتِ']);
    expect(segments.map((s) => s.text).join('')).toBe(text);
  });

  it('returns original text unhighlighted for empty queries', () => {
    expect(findArabicHighlightSegments('حديث شريف', '   ')).toEqual([
      { text: 'حديث شريف', match: false },
    ]);
  });

  it('highlights inflected Arabic forms when exact token is absent (النية -> النيات, المؤمنون -> المؤمنين)', () => {
    const text1 = 'إنَّما الأعْمالُ بالنِّيّاتِ';
    const segs1 = findArabicHighlightSegments(text1, 'النية');
    expect(segs1.filter((s) => s.match).map((s) => s.text)).toEqual(['النِّيّاتِ']);
    expect(segs1.map((s) => s.text).join('')).toBe(text1);

    const text2 = 'مَثَلُ المُؤْمِنِينَ في تَوادِّهِمْ وتَراحُمِهِمْ';
    const segs2 = findArabicHighlightSegments(text2, 'المؤمنون');
    expect(segs2.filter((s) => s.match).map((s) => s.text)).toEqual(['المُؤْمِنِينَ']);
    expect(segs2.map((s) => s.text).join('')).toBe(text2);
  });

  it('never splits an Arabic word mid-word and respects word boundaries', () => {
    const adhan = 'إلا أنَّ المؤذِّنَ كان يقولُ : قد قامتِ الصلاةُ مرتين';
    const segs = findArabicHighlightSegments(adhan, 'كان مرة');
    const highlighted = segs.filter((s) => s.match).map((s) => s.text);
    expect(highlighted).toEqual(['كان', 'مرتين']);
    expect(segs.map((s) => s.text).join('')).toBe(adhan);

    const makan = 'جلس في مكان واسع';
    const makanSegs = findArabicHighlightSegments(makan, 'كان');
    expect(makanSegs.filter((s) => s.match)).toEqual([]);

    const wali = 'إلَّا تمثَّل لي جبريلُ ولم يكُنْ له وليٌّ من الذُّلِّ';
    const waliSegs = findArabicHighlightSegments(wali, 'الا تمثل لي جبريل');
    expect(waliSegs.filter((s) => s.match).map((s) => s.text)).toEqual([
      'إلَّا',
      'تمثَّل',
      'لي',
      'جبريلُ',
    ]);
  });
});

describe('repairSplitArabicWords', () => {
  it('rejoins detached definite article prefixes without mangling آل or ال البيت', () => {
    expect(repairSplitArabicWords('ال صلاة')).toBe('الصلاة');
    expect(repairSplitArabicWords('بال نيات')).toBe('بالنيات');
    expect(repairSplitArabicWords('وال صبر')).toBe('والصبر');
    expect(repairSplitArabicWords('آل البيت')).toBe('آل البيت');
    expect(repairSplitArabicWords('ال البيت')).toBe('ال البيت');
  });
});

describe('normalizeCommonOrthography', () => {
  it('fixes classic Arabic spelling slips and fused phrases deterministically', () => {
    expect(normalizeCommonOrthography('لاكن')).toBe('لكن');
    expect(normalizeCommonOrthography('هاذا')).toBe('هذا');
    expect(normalizeCommonOrthography('الرحمان')).toBe('الرحمن');
    expect(normalizeCommonOrthography('رسولالله')).toBe('رسول الله');
    expect(normalizeCommonOrthography('انشاء الله')).toBe('إن شاء الله');
  });
});

describe('convertEnKeyboardToArabic', () => {
  it('converts Arabic typed on English QWERTY layout while rejecting real English words and URLs', () => {
    expect(convertEnKeyboardToArabic('Hgwghm')).toBe('الصلاة');
    expect(convertEnKeyboardToArabic('hgkhv')).toBe('النار');
    expect(convertEnKeyboardToArabic('prayer')).toBeNull();
    expect(convertEnKeyboardToArabic('hadith')).toBeNull();
    expect(convertEnKeyboardToArabic('https://dorar.net')).toBeNull();
  });
});

describe('stripQueryFillers', () => {
  it('strips conversational search wrappers while keeping meaningful keywords', () => {
    expect(stripQueryFillers('حديث عن فضل الصبر على المصيبة')).toBe('الصبر المصيبة');
    expect(stripQueryFillers('ما قال الرسول عن الغضب')).toBe('الغضب');
  });
});
