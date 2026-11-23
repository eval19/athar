import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HadithResult } from '../src/domain/hadith';
import {
  clearLearnedWordsForTests,
  hasLearnedExactWord,
  learnWordsFromTexts,
} from '../src/domain/learnedVocab';
import { rerankRelaxedResults } from '../src/domain/resultRerank';
import { analyzeArabicQuery, suggestArabicQuery } from '../src/domain/typoSuggest';
import { DorarProvider } from '../src/services/dorarClient';
import type { HttpFetchFn } from '../src/services/dorarClient';

function makeHadith(id: string, text: string): HadithResult {
  return {
    id,
    text,
    narrator: 'أبو هريرة',
    muhaddith: 'مسلم',
    source: 'صحيح مسلم',
    pageOrNumber: id,
    rawGrade: 'صحيح',
    gradeBucket: 'sahih',
  };
}

describe('16-phrase real Hadith accuracy benchmark', () => {
  beforeEach(() => clearLearnedWordsForTests());
  afterEach(() => clearLearnedWordsForTests());

  it('keeps all 12 well-spelled famous Hadith phrases completely uncorrupted', () => {
    const cleanPhrases = [
      'المسلم من سلم',
      'الطهور شطر الايمان',
      'لا تغضب',
      'الدين النصيحه',
      'تبسمك في وجه اخيك',
      'الكلمه الطيبه صدقه',
      'احب الاعمال الى الله',
      'من حسن اسلام المرء تركه ما لا يعنيه',
      'اتق الله حيثما كنت',
      'خيركم من تعلم القران',
      'المؤمن القوي',
      'الجنه تحت اقدام الامهات',
    ];

    for (const phrase of cleanPhrases) {
      const res = suggestArabicQuery(phrase);
      expect(res.changed, `Expected "${phrase}" to stay uncorrupted, got "${res.correctedQuery}"`).toBe(false);
      expect(res.correctedQuery).toBe(phrase);
    }
  });

  it('recovers common mobile Arabic shorthand accurately without hallucinating unrelated words', () => {
    expect(suggestArabicQuery('الحيا من الايمان').correctedQuery).toBe('الحياء من الايمان');
    expect(suggestArabicQuery('يسرو ولا تعسرو').correctedQuery).toBe('يسروا ولا تعسروا');
    expect(suggestArabicQuery('ارحمو من في الارض').correctedQuery).toBe('ارحموا من في الارض');
  });

  it('fixes dropped final hamza after alef across high-frequency Hadith nouns', () => {
    expect(suggestArabicQuery('الدعا').correctedQuery).toBe('الدعاء');
    expect(suggestArabicQuery('البلا').correctedQuery).toBe('البلاء');
    expect(suggestArabicQuery('الما').correctedQuery).toBe('الماء');
    expect(suggestArabicQuery('السما').correctedQuery).toBe('السماء');
  });

  it('exercises multi-word restraint on sentences with multiple unlisted words and lets Stage 3 recover', () => {
    // Two unlisted classical words (المعونة, المؤنة) alongside a real Hadith sentence
    const query = 'ان المعونة تأتي العبد على قدر المؤنة';
    const analysis = analyzeArabicQuery(query);
    expect(analysis.changedWordCount).toBeLessThanOrEqual(1);

    // Real 8-word Hadith with 1 typo at the end recovers cleanly via Stage 3 re-ranking
    const items = [
      makeHadith('h1', 'من حُسنِ إسلامِ المرءِ تركُه ما لا يَعنيه'),
      makeHadith('h2', 'من أحبَّ للهِ وأبغضَ للهِ فقد استكمل الإيمانَ'),
    ];
    const reranked = rerankRelaxedResults(items, 'من حسن اسلام المرء تركه ما لا يعنبه');
    expect(reranked.items.map((i) => i.id)).toEqual(['h1']);
    expect(reranked.recoveredQuery).toBe('من حسن إسلام المرء تركه ما لا يعنيه');
  });
});

describe('on-device exact-word shield (learnedVocab)', () => {
  beforeEach(() => clearLearnedWordsForTests());
  afterEach(() => clearLearnedWordsForTests());

  it('protects seen classical words from future false rewrites without making them fuzzy targets', () => {
    learnWordsFromTexts(['والشزن القلق والحركة للسجود']);
    expect(hasLearnedExactWord('الشزن')).toBe(true);
    expect(hasLearnedExactWord('شزن')).toBe(true);

    // Learned word is never corrupted
    expect(suggestArabicQuery('الشزن').changed).toBe(false);
    // Learned word never hijacks unrelated typos
    expect(suggestArabicQuery('الشزم').correctedQuery).not.toBe('الشزن');
  });

  it('learns confirmed forceExact query words only when Al-Dorar returns results', async () => {
    const okBody = JSON.stringify({
      ahadith: {
        result: `
<div class="hadith">1 - حديث فيه لفظ ترياق مبارك</div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> أنس
<span class="info-subtitle">المحدث:</span> البخاري
<span class="info-subtitle">المصدر:</span> صحيح البخاري
<span class="info-subtitle">الصفحة أو الرقم:</span> 1
<span class="info-subtitle">خلاصة حكم المحدث:</span> صحيح
</div>`,
      },
    });
    const emptyBody = JSON.stringify({ ahadith: { result: '' } });

    const fetcher: HttpFetchFn = async (url) => {
      if (new URL(url).searchParams.get('skey') === 'ترياق') return okBody;
      return emptyBody;
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher,
    });

    await provider.search({ query: 'ترياق', filter: 'all', page: 1, forceExact: true });
    expect(hasLearnedExactWord('ترياق')).toBe(true);

    await provider.search({ query: 'خقضصثق', filter: 'all', page: 1, forceExact: true });
    expect(hasLearnedExactWord('خقضصثق')).toBe(false);
  });
});
