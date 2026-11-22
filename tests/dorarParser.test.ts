import { describe, expect, it } from 'vitest';
import {
  parseDorarApiResponse,
  parseDorarOsoulHtml,
  parseDorarRelatedHadithsHtml,
  parseDorarWebSearchHtml,
} from '../src/domain/dorarParser';

const SAMPLE_DORAR_JSON = JSON.stringify({
  ahadith: {
    result: `
</head>
<div class="hadith">1 -  "مَن استعاذَ باللهِ من <span class="search-keys">النَّارِ</span> ثلاثًا، قالت <span class="search-keys">النَّارُ</span>: اللَّهُمَّ أعِذْه من <span class="search-keys">النَّارِ</span>".  .</div>
<div class="hadith-info">
    <span class="info-subtitle">الراوي:</span> أنس بن مالك
    <span class="info-subtitle">المحدث:</span> شعيب الأرناؤوط
    <span class="info-subtitle">المصدر:</span>  تخريج سنن أبي داود
    <span class="info-subtitle">الصفحة أو الرقم:</span>  7/414
    <span class="info-subtitle">خلاصة حكم المحدث:</span>  إسناده صحيح
</div>
--------------
<div class="hadith">2 -  إنَّ أَهلَ <span class="search-keys">النَّارِ</span> يعظَّمونَ في <span class="search-keys">النَّارِ</span>  .</div>
<div class="hadith-info">
    <span class="info-subtitle">الراوي:</span> عبدالله بن عمر
    <span class="info-subtitle">المحدث:</span> ابن عدي
    <span class="info-subtitle">المصدر:</span>  الكامل في الضعفاء
    <span class="info-subtitle">الصفحة أو الرقم:</span>  4/212
    <span class="info-subtitle">خلاصة حكم المحدث:</span>  [فيه] أبو يحيى القتات ضعيف
</div>
--------------
<a href="https://dorar.net/hadith/search?q=النار">المزيد</a>
`,
  },
});

describe('parseDorarApiResponse', () => {
  it('parses real Dorar HTML-in-JSON blocks into clean structured HadithResult items', () => {
    const parsed = parseDorarApiResponse(SAMPLE_DORAR_JSON);

    expect(parsed.items).toHaveLength(2);
    expect(parsed.hasMore).toBe(true);

    expect(parsed.items[0]).toMatchObject({
      text: '"مَن استعاذَ باللهِ من النَّارِ ثلاثًا، قالت النَّارُ: اللَّهُمَّ أعِذْه من النَّارِ".',
      narrator: 'أنس بن مالك',
      muhaddith: 'شعيب الأرناؤوط',
      source: 'تخريج سنن أبي داود',
      pageOrNumber: '7/414',
      rawGrade: 'إسناده صحيح',
      gradeBucket: 'sahih_isnad',
    });

    expect(parsed.items[1]).toMatchObject({
      narrator: 'عبدالله بن عمر',
      muhaddith: 'ابن عدي',
      source: 'الكامل في الضعفاء',
      pageOrNumber: '4/212',
      gradeBucket: 'daif',
    });
  });

  it('handles empty Dorar result payloads gracefully', () => {
    const emptyJson = JSON.stringify({
      ahadith: { result: '\n</head>\n\n<a href="#">المزيد</a>\n' },
    });

    const parsed = parseDorarApiResponse(emptyJson);
    expect(parsed.items).toEqual([]);
    expect(parsed.hasMore).toBe(false);
  });

  it('decodes HTML entities and strips residual tags safely', () => {
    const entityJson = JSON.stringify({
      ahadith: {
        result: `
<div class="hadith">1 - قَالَ &laquo;إِنَّمَا&raquo; &amp; &nbsp;الأَعْمَالُ<script>alert(1)</script></div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> عمر بن الخطاب
<span class="info-subtitle">المحدث:</span> البخاري
<span class="info-subtitle">المصدر:</span> صحيح البخاري
<span class="info-subtitle">الصفحة أو الرقم:</span> 1
<span class="info-subtitle">خلاصة حكم المحدث:</span> [صحيح]
</div>
--------------
`,
      },
    });

    const parsed = parseDorarApiResponse(entityJson);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].text).toBe('قَالَ «إِنَّمَا» & الأَعْمَالُ');
    expect(parsed.items[0].text).not.toContain('script');
    expect(parsed.items[0].text).not.toContain('alert');
  });

  it('normalizes placeholder narrator dashes such as "-" to an empty string', () => {
    const dashJson = JSON.stringify({
      ahadith: {
        result: `
<div class="hadith">1 - اتقوا الله في الصلاة</div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> -
<span class="info-subtitle">المحدث:</span> الألباني
<span class="info-subtitle">المصدر:</span> إصلاح المساجد
<span class="info-subtitle">الصفحة أو الرقم:</span> 80
<span class="info-subtitle">خلاصة حكم المحدث:</span> صحيح
</div>
--------------
`,
      },
    });

    const parsed = parseDorarApiResponse(dashJson);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].narrator).toBe('');
  });

  it('strips outer square brackets from narrator names while keeping rawGrade brackets intact', () => {
    const bracketedJson = JSON.stringify({
      ahadith: {
        result: `
<div class="hadith">1 - الصَّلاةَ الصَّلاةَ وما ملكَتْ أيمانُكم</div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> [علي بن أبي طالب]
<span class="info-subtitle">المحدث:</span> ابن كثير
<span class="info-subtitle">المصدر:</span> تفسير القرآن العظيم
<span class="info-subtitle">الصفحة أو الرقم:</span> 2/264
<span class="info-subtitle">خلاصة حكم المحدث:</span> [ثابت]
</div>
--------------
<div class="hadith">2 - مثال راوٍ مجهول</div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> [-]
<span class="info-subtitle">المحدث:</span> الألباني
<span class="info-subtitle">المصدر:</span> ضعيف الجامع
<span class="info-subtitle">الصفحة أو الرقم:</span> 10
<span class="info-subtitle">خلاصة حكم المحدث:</span> ضعيف
</div>
--------------
`,
      },
    });

    const parsed = parseDorarApiResponse(bracketedJson);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].narrator).toBe('علي بن أبي طالب');
    expect(parsed.items[0].rawGrade).toBe('[ثابت]');
    expect(parsed.items[1].narrator).toBe('');
  });

  it('generates distinct stable IDs for two long hadiths sharing an identical 48+ char prefix in the same source page', () => {
    const prefix = 'إنَّ رَسولَ اللَّهِ صَلَّى اللَّهُ عليه وسلَّمَ قالَ في خُطْبَتِهِ الكَرِيمَةِ: ';
    const makePage = (ending: string) =>
      JSON.stringify({
        ahadith: {
          result: `
<div class="hadith">1 - ${prefix}${ending}</div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> عمر بن الخطاب
<span class="info-subtitle">المحدث:</span> البخاري
<span class="info-subtitle">المصدر:</span> صحيح البخاري
<span class="info-subtitle">الصفحة أو الرقم:</span> 100
<span class="info-subtitle">خلاصة حكم المحدث:</span> [صحيح]
</div>
--------------
`,
        },
      });

    const pageA = parseDorarApiResponse(makePage('أقيموا الصلاة وآتوا الزكاة'));
    const pageB = parseDorarApiResponse(makePage('أطعموا الطعام وأفشوا السلام'));

    expect(pageA.items[0].id).not.toBe(pageB.items[0].id);
  });
});

const SAMPLE_WEB_SEARCH_HTML = `
<div id="home">لا توجد نتائج</div>
<div id="specialist">
  <div class="border-bottom py-4">
    <article><h5 class="h5-responsive"> 1 - كان الأذانُ على عهدِ رسولِ اللهِ مثنى مثنى</h5></article>
    <div class="d-block mb-2">
      <strong class="px-2">خلاصة حكم المحدث : <span class="primary-text-color">صحيح</span></strong>
      <strong class="px-2">الراوي : <span class="primary-text-color">[عبدالله بن عمر]</span></strong>
      <strong class="px-2">| المحدث : <a card-link="/hadith/mhd/1"><span class="primary-text-color">ابن الملقن</span></a></strong>
      <strong class="px-2">| المصدر : <a card-link="/hadith/book-card/2"><span class="primary-text-color">البدر المنير</span></a></strong>
      <strong class="px-2">الصفحة أو الرقم : <span class="primary-text-color">3/328</span></strong>
      <strong class="px-2">التخريج : <span class="primary-text-color">أخرجه أبو داود (510)، والنسائي (628)، وأحمد (5569) باختلاف يسير.</span></strong>
      <strong class="px-2"><a href="/h/abc123?sims=1">أحاديث مشابهة</a></strong>
      <strong class="px-2"><a href="/h/abc123/osoul">أصول الحديث</a></strong>
    </div>
  </div>
  <div class="border-bottom py-4">
    <article><h5 class="h5-responsive"> 2 - كان الأذانُ على عهدِ رسولِ اللهِ مَثْنَى والإقامةُ مَرَّةً</h5></article>
    <div class="d-block mb-2">
      <strong class="px-2">خلاصة حكم المحدث : <span class="primary-text-color">ضعيف</span></strong>
      <strong class="px-2">الراوي : <span class="primary-text-color">عبدالله بن عمر</span></strong>
      <strong class="px-2">| المحدث : <a><span class="primary-text-color">ابن أبي حاتم</span></a></strong>
      <strong class="px-2">| المصدر : <a><span class="primary-text-color">الجرح والتعديل</span></a></strong>
      <strong class="px-2">الصفحة أو الرقم : <span class="primary-text-color">9/353</span></strong>
      <strong class="px-2"><a href="/h/HfSawmZV?alts=1">الصحيح البديل</a></strong>
      <strong class="px-2"><a href="/h/HfSawmZV/osoul">أصول الحديث</a></strong>
    </div>
  </div>
  <ul class="pagination"><li class="page-item"><a class="page-link" href="?q=test&amp;page=2">2</a></li></ul>
</div>
`;

const SAMPLE_OSOUL_HTML = `
<div id="home">
  <div class="border-bottom py-4"><h5>- original</h5></div>
  <h1>أصول الحديث: </h1>
  <article><h5 class="h5-responsive"><span style="color:maroon">[سنن أبي داود] (1/ 141)</span><br><span style="color:blue">510- حدثنا محمد بن بشار، عن ابن عمر</span>، قال: (( إنما كان الأذان مثنى مثنى ))</h5></article>
  <article><h5 class="h5-responsive"><span style="color:maroon">[سنن النسائي] (2/ 3)</span><br><span style="color:blue">628- أخبرنا عمرو بن علي، عن ابن عمر</span> قال: ((كان الأذان مثنى مثنى))</h5></article>
</div>
`;

const SAMPLE_ALTS_HTML = `
<div id="home">
  <div class="border-bottom py-4">
    <article><h5 class="h5-responsive">- كان الأذانُ على عهدِ رسولِ اللهِ مَثْنَى والإقامةُ مَرَّةً</h5></article>
    <div class="d-block mb-2">
      <strong class="px-2">خلاصة حكم المحدث : <span class="primary-text-color">ضعيف</span></strong>
      <strong class="px-2">الراوي : <span class="primary-text-color">عبدالله بن عمر</span></strong>
      <strong class="px-2">| المحدث : <span class="primary-text-color">ابن أبي حاتم</span></strong>
      <strong class="px-2">| المصدر : <span class="primary-text-color">الجرح والتعديل</span></strong>
      <strong class="px-2">الصفحة أو الرقم : <span class="primary-text-color">9/353</span></strong>
    </div>
  </div>
  <div class="border-bottom py-4">
    <article><h5 class="h5-responsive">- أُمِرَ بلالٌ أن يَشفَعَ الأذانَ ويوتِرَ الإقامةَ.</h5></article>
    <div class="d-block mb-2">
      <strong class="px-2">خلاصة حكم المحدث : <span class="primary-text-color">[صحيح]</span></strong>
      <strong class="px-2">الراوي : <span class="primary-text-color">أنس بن مالك</span></strong>
      <strong class="px-2">| المحدث : <span class="primary-text-color">مسلم</span></strong>
      <strong class="px-2">| المصدر : <span class="primary-text-color">صحيح مسلم</span></strong>
      <strong class="px-2">الصفحة أو الرقم : <span class="primary-text-color">378</span></strong>
    </div>
  </div>
</div>
`;

describe('Dorar rich HTML parsers', () => {
  it('parses specialist search HTML with takhrij, dorarId, and feature flags', () => {
    const parsed = parseDorarWebSearchHtml(SAMPLE_WEB_SEARCH_HTML, 1);
    expect(parsed.recognized).toBe(true);
    expect(parsed.hasMore).toBe(true);
    expect(parsed.items).toHaveLength(2);

    expect(parsed.items[0]).toMatchObject({
      narrator: 'عبدالله بن عمر',
      muhaddith: 'ابن الملقن',
      source: 'البدر المنير',
      pageOrNumber: '3/328',
      rawGrade: 'صحيح',
      gradeBucket: 'sahih',
      takhrij: 'أخرجه أبو داود (510)، والنسائي (628)، وأحمد (5569) باختلاف يسير.',
      dorarId: 'abc123',
      hasOsoul: true,
      hasSimilar: true,
      hasAltSahih: false,
    });

    expect(parsed.items[1]).toMatchObject({
      dorarId: 'HfSawmZV',
      hasOsoul: true,
      hasAltSahih: true,
      hasSimilar: false,
    });
  });

  it('parses osoul HTML into structured sourceRef, sanad, and matn entries', () => {
    const entries = parseDorarOsoulHtml(SAMPLE_OSOUL_HTML);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      sourceRef: 'سنن أبي داود (1/ 141)',
      sanad: '510- حدثنا محمد بن بشار، عن ابن عمر',
    });
    expect(entries[0].matn).toContain('إنما كان الأذان مثنى مثنى');
  });

  it('parses related hadiths (?alts=1 / ?sims=1) skipping the source card at index 0', () => {
    const related = parseDorarRelatedHadithsHtml(SAMPLE_ALTS_HTML);
    expect(related).toHaveLength(1);
    expect(related[0]).toMatchObject({
      text: 'أُمِرَ بلالٌ أن يَشفَعَ الأذانَ ويوتِرَ الإقامةَ.',
      narrator: 'أنس بن مالك',
      muhaddith: 'مسلم',
      source: 'صحيح مسلم',
      pageOrNumber: '378',
      gradeBucket: 'sahih',
    });
  });

  it('strips _x000D_ XML artifacts and stray leading colons in osoul sanad', () => {
    const dirtyWebHtml = `
<div id="specialist">
  <div class="border-bottom py-4">
    <article><h5 class="h5-responsive"> 1 - الصَّلاةُ في المسجدِ الحرامِ</h5></article>
    <div class="d-block mb-2">
      <strong class="px-2">خلاصة حكم المحدث : <span class="primary-text-color">ضعيف</span></strong>
      <strong class="px-2">الراوي : <span class="primary-text-color">جابر</span></strong>
      <strong class="px-2">| المحدث : <span class="primary-text-color">ابن حجر</span></strong>
      <strong class="px-2">| المصدر : <span class="primary-text-color">فيض القدير</span></strong>
      <strong class="px-2">الصفحة أو الرقم : <span class="primary-text-color">4/245</span></strong>
      <strong class="px-2">التخريج : <span class="primary-text-color">أخرجه البيهقي باختلاف يسير _x000D_ وابن ماجه (1406)</span></strong>
    </div>
  </div>
</div>`;
    const parsed = parseDorarWebSearchHtml(dirtyWebHtml, 1);
    expect(parsed.items[0].takhrij).toBe('أخرجه البيهقي باختلاف يسير وابن ماجه (1406)');

    const dirtyOsoulHtml = `
<div id="home"><h1>أصول الحديث: </h1>
  <article><h5 class="h5-responsive"><span style="color:maroon">[السنن الصغير للبيهقي] (2/ 211)</span><br><span style="color:blue">: 1773 - وروينا في حديث أبي الدرداء</span>، مرفوعا: فضل الصلاة</h5></article>
</div>`;
    const osoul = parseDorarOsoulHtml(dirtyOsoulHtml);
    expect(osoul[0].sanad).toBe('1773 - وروينا في حديث أبي الدرداء');
  });
});
