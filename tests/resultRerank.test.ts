import { describe, expect, it } from 'vitest';
import type { HadithResult } from '../src/domain/hadith';
import { rerankRelaxedResults } from '../src/domain/resultRerank';

function makeHadith(
  id: string,
  text: string,
  gradeBucket: HadithResult['gradeBucket'] = 'sahih',
): HadithResult {
  return {
    id,
    text,
    narrator: 'أبو هريرة',
    muhaddith: 'مسلم',
    source: 'صحيح مسلم',
    pageOrNumber: id,
    rawGrade: 'صحيح',
    gradeBucket,
  };
}

describe('rerankRelaxedResults', () => {
  it('floats true fuzzy match to #1, drops unrelated Witr noise, and recovers classic spelling', () => {
    const items = [
      makeHadith(
        'w1',
        'مَن لم يوتِرْ فليس مِنَّا [يعني حديث: الوِترُ حَقٌّ، فمَن لم يُوتِرْ فليس مِنَّا]',
      ),
      makeHadith('w2', 'مَن لَم يوترْ فليسَ منَّا'),
      makeHadith(
        'g1',
        'من غشَّنا فليسَ منَّا [يعني حديث: مَن حَمَلَ عليْنا السِّلاحَ فليسَ مِنَّا، ومَن غَشَّنا فليسَ مِنَّا.]',
      ),
      makeHadith('g2', 'من غشَّنا فليسَ منَّا'),
    ];

    const res = rerankRelaxedResults(items, 'من غشانا فليس مننا');

    expect(res.items.map((i) => i.id)).toEqual(['g1', 'g2']);
    expect(res.recoveredQuery).toBe('من غشنا فليس منا');
    expect(res.topScore).toBeGreaterThan(0.85);
  });

  it('surfaces "إنما الأعمال بالنيات" #1 for "انما الاعمال بالنايت" and recovers clean hamza spelling', () => {
    const items = [
      makeHadith('o1', 'إنَّما الأعمالُ بالخَواتيمِ'),
      makeHadith('n1', 'إنَّما الأعْمالُ بالنِّيَّةِ، وإنما لامرئٍ ما نوى'),
      makeHadith('n2', 'إنَّما الأعْمالُ بالنِّيّاتِ وإنما لكلِّ امرئٍ ما نَوَى'),
    ];

    const res = rerankRelaxedResults(items, 'انما الاعمال بالنايت');

    expect(res.items[0].id).toBe('n2');
    expect(res.items.map((i) => i.id)).not.toContain('o1');
    expect(res.recoveredQuery).toBe('إنما الأعمال بالنيات');
  });

  it('enforces strict relevance floor so completely unrelated hadiths are rejected', () => {
    const items = [
      makeHadith('u1', 'إنَّما الأعْمالُ بالنِّيّاتِ'),
      makeHadith('u2', 'مَن يُرِدِ اللهُ به خيرًا يفقِّهْه في الدِّينِ'),
    ];

    const res = rerankRelaxedResults(items, 'خقضصثق وزمبرق');

    expect(res.items).toEqual([]);
    expect(res.recoveredQuery).toBeUndefined();
    expect(res.topScore).toBe(0);
  });

  it('blocks unrelated Medina/Allah cards when stopwords cannot match fuzzy and second content word misses', () => {
    const items = [
      makeHadith(
        'm1',
        'المدينةُ حَرمٌ آمِنٌ [ يعني حديث: أهْوَى رسولُ اللهِ صلَّى اللهُ عليه وسلَّمَ بيدِهِ إلى المدينةِ، فقال: إنَّها حَرَمٌ آمِنٌ .]',
      ),
      makeHadith('m2', 'أنتَ الذي أنعمَ اللهُ عليه بالهدايةِ إلى دينِهِ'),
    ];

    const res = rerankRelaxedResults(items, 'فمن كانت هحىته الى الله');

    expect(res.items).toEqual([]);
    expect(res.recoveredQuery).toBeUndefined();
  });
});
