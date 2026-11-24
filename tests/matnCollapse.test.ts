import { describe, expect, it } from 'vitest';
import { findArabicHighlightSegments } from '../src/domain/arabicNormalize';
import {
  hasMatchOnlyBelowPreview,
  MATN_COLLAPSE_THRESHOLDS,
  measureMatnBaseLength,
  shouldCollapseMatn,
} from '../src/domain/matnCollapse';
import { getStrings } from '../src/i18n/strings';

const SHORT_HADITH =
  'إنَّما الأعْمالُ بالنِّيّاتِ، وإنَّما لِكُلِّ امْرِئٍ ما نَوَى، فمَن كانَتْ هِجْرَتُهُ إلى اللَّهِ ورَسولِهِ فهِجْرَتُهُ إلى اللَّهِ ورَسولِهِ، ومَن كانَتْ هِجْرَتُهُ لِدُنْيا يُصِيبُها أوِ امْرَأَةٍ يَتَزَوَّجُها فهِجْرَتُهُ إلى ما هاجَرَ إلَيْهِ.';

const MEDIUM_HADITH =
  'لا تحاسدوا ولا تناجشوا ولا تباغضوا ولا تدابروا ولا يبع بعضكم على بيع بعض وكونوا عباد الله إخوانا المسلم أخو المسلم لا يظلمه ولا يخذله ولا يحقره التقوى هاهنا ويشير إلى صدره ثلاث مرات بحسب امرئ من الشر أن يحقر أخاه المسلم كل المسلم على المسلم حرام دمه وماله وعرضه.';

// Heavily vocalized (~330 base chars, >550 raw chars with tashkeel): must NOT collapse at md
const HEAVILY_DIACRITIZED_MEDIUM =
  'بُنِيَ الْإِسْلَامُ عَلَى خَمْسٍ شَهَادَةِ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللَّهِ وَإِقَامِ الصَّلَاةِ وَإِيتَاءِ الزَّكَاةِ وَالْحَجِّ وَصَوْمِ رَمَضَانَ. ' +
  'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ وَالْمُهَاجِرُ مَنْ هَجَرَ مَا نَهَى اللَّهُ عَنْهُ وَخَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ وَأَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ ' +
  'وَاللَّهُ فِي عَوْنِ الْعَبْدِ مَا كَانَ الْعَبْدُ فِي عَوْنِ أَخِيهِ وَمَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ.';

// Truly long narration (~740 base chars): collapses at sm, md, and lg
const LONG_HADITH =
  'بينما نحن عند رسول الله صلى الله عليه وسلم ذات يوم إذ طلع علينا رجل شديد بياض الثياب شديد سواد الشعر لا يرى عليه أثر السفر ولا يعرفه منا أحد حتى جلس إلى النبي صلى الله عليه وسلم فأسند ركبتيه إلى ركبتيه ووضع كفيه على فخذيه وقال يا محمد أخبرني عن الإسلام فقال رسول الله صلى الله عليه وسلم الإسلام أن تشهد أن لا إله إلا الله وأن محمدا رسول الله وتقيم الصلاة وتؤتي الزكاة وتصوم رمضان وتحج البيت إن استطعت إليه سبيلا قال صدقت فعجبنا له يسأله ويصدقه قال فأخبرني عن الإيمان قال أن تؤمن بالله وملائكته وكتبه ورسله واليوم الآخر وتؤمن بالقدر خيره وشره قال صدقت قال فأخبرني عن الإحسان قال أن تعبد الله كأنك تراه فإن لم تكن تراه فإنه يراك قال فأخبرني عن الساعة قال ما المسؤول عنها بأعلم من السائل ثم انطلق فلبثت مليا ثم قال يا عمر أتدري من السائل قلت الله ورسوله أعلم قال فإنه جبريل أتاكم يعلمكم دينكم.';

describe('matnCollapse', () => {
  it('never collapses short or medium hadiths at default md scale', () => {
    expect(shouldCollapseMatn(SHORT_HADITH, 'md')).toBe(false);
    expect(shouldCollapseMatn(MEDIUM_HADITH, 'md')).toBe(false);
    expect(shouldCollapseMatn(SHORT_HADITH, 'lg')).toBe(false);
    expect(shouldCollapseMatn(MEDIUM_HADITH, 'lg')).toBe(false);
  });

  it('ignores Arabic diacritics so heavily vocalized medium hadiths stay uncollapsed', () => {
    expect(HEAVILY_DIACRITIZED_MEDIUM.length).toBeGreaterThan(MATN_COLLAPSE_THRESHOLDS.md);
    expect(measureMatnBaseLength(HEAVILY_DIACRITIZED_MEDIUM)).toBeLessThan(
      MATN_COLLAPSE_THRESHOLDS.md,
    );
    expect(shouldCollapseMatn(HEAVILY_DIACRITIZED_MEDIUM, 'md')).toBe(false);
  });

  it('collapses truly long hadiths across all reading scales', () => {
    expect(shouldCollapseMatn(LONG_HADITH, 'sm')).toBe(true);
    expect(shouldCollapseMatn(LONG_HADITH, 'md')).toBe(true);
    expect(shouldCollapseMatn(LONG_HADITH, 'lg')).toBe(true);
  });

  it('adjusts collapse threshold based on readingScale (lg collapses earlier than md and sm)', () => {
    // 410 base chars: fits comfortably at sm & md, but reaches 11+ lines at lg
    const borderline = 'هذا نص حديث متوسط الطول يوضح الفرق بين أحجام القراءة المختلفة '.repeat(7).trim();
    const baseLen = measureMatnBaseLength(borderline);
    expect(baseLen).toBeGreaterThanOrEqual(MATN_COLLAPSE_THRESHOLDS.lg);
    expect(baseLen).toBeLessThan(MATN_COLLAPSE_THRESHOLDS.md);

    expect(shouldCollapseMatn(borderline, 'sm')).toBe(false);
    expect(shouldCollapseMatn(borderline, 'md')).toBe(false);
    expect(shouldCollapseMatn(borderline, 'lg')).toBe(true);
  });

  it('detects when the earliest highlighted match only appears below the collapsed preview', () => {
    const lateMatchSegments = findArabicHighlightSegments(LONG_HADITH, 'جبريل');
    expect(hasMatchOnlyBelowPreview(lateMatchSegments, 'sm')).toBe(true);
    expect(hasMatchOnlyBelowPreview(lateMatchSegments, 'md')).toBe(true);
    expect(hasMatchOnlyBelowPreview(lateMatchSegments, 'lg')).toBe(true);
  });

  it('returns false when a match is already visible near the top of the preview', () => {
    // "رسول" appears right at the beginning AND again later — no match-below cue needed
    const earlyAndLateSegments = findArabicHighlightSegments(LONG_HADITH, 'رسول');
    expect(hasMatchOnlyBelowPreview(earlyAndLateSegments, 'sm')).toBe(false);
    expect(hasMatchOnlyBelowPreview(earlyAndLateSegments, 'md')).toBe(false);
    expect(hasMatchOnlyBelowPreview(earlyAndLateSegments, 'lg')).toBe(false);
  });

  it('returns false when there are no highlighted matches', () => {
    const noMatchSegments = findArabicHighlightSegments(LONG_HADITH, 'الصبر');
    expect(hasMatchOnlyBelowPreview(noMatchSegments, 'md')).toBe(false);
  });

  it('ignores diacritics when measuring prefix offset before the first match', () => {
    const densePrefix = 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى '.repeat(4);
    expect(densePrefix.length).toBeGreaterThan(280);
    expect(measureMatnBaseLength(densePrefix)).toBeLessThan(220);

    const text = `${densePrefix}الْإِحْسَانُ ${LONG_HADITH}`;
    const segments = findArabicHighlightSegments(text, 'الإحسان');
    expect(hasMatchOnlyBelowPreview(segments, 'md')).toBe(false);
  });

  it('provides non-empty bilingual strings for the matn toggle and cue', () => {
    const ar = getStrings('ar');
    const en = getStrings('en');
    expect(ar.showMoreMatn).toBe('عرض المزيد');
    expect(ar.showLessMatn).toBe('عرض أقل');
    expect(ar.matchBelowPreview.length).toBeGreaterThan(0);
    expect(en.showMoreMatn).toBe('Show more');
    expect(en.showLessMatn).toBe('Show less');
    expect(en.matchBelowPreview.length).toBeGreaterThan(0);
  });
});
