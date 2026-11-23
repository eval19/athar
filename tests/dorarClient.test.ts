import { describe, expect, it } from 'vitest';
import { buildDorarSearchUrl, DorarProvider } from '../src/services/dorarClient';
import type { HttpFetchFn } from '../src/services/dorarClient';

const VALID_NAR_BODY = JSON.stringify({
  ahadith: {
    result: `
<div class="hadith">1 - مَن استعاذَ باللهِ من النَّارِ ثلاثًا</div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> أنس بن مالك
<span class="info-subtitle">المحدث:</span> شعيب الأرناؤوط
<span class="info-subtitle">المصدر:</span> تخريج سنن أبي داود
<span class="info-subtitle">الصفحة أو الرقم:</span> 7/414
<span class="info-subtitle">خلاصة حكم المحدث:</span> إسناده صحيح
</div>
--------------
<a href="#">المزيد</a>
`,
  },
});

const EMPTY_BODY = JSON.stringify({
  ahadith: { result: '\n</head>\n<a href="#">المزيد</a>\n' },
});

describe('buildDorarSearchUrl', () => {
  it('builds default query URL with pagination', () => {
    const url = buildDorarSearchUrl('https://dorar.net/dorar_api.json', {
      query: 'النار',
      filter: 'all',
      page: 2,
    });
    expect(url).toContain('skey=%D8%A7%D9%84%D9%86%D8%A7%D8%B1');
    expect(url).toContain('page=2');
    expect(url).not.toContain('d%5B%5D');
  });

  it('adds both d[]=1 and d[]=2 when filter is sahih so sahih_isnad hadiths are included', () => {
    const url = buildDorarSearchUrl('https://dorar.net/dorar_api.json', {
      query: 'النيات',
      filter: 'sahih',
      page: 1,
    });
    expect(url).toContain('d%5B%5D=1');
    expect(url).toContain('d%5B%5D=2');
  });

  it('adds d[]=3 and d[]=4 when filter is weak', () => {
    const url = buildDorarSearchUrl('https://dorar.net/dorar_api.json', {
      query: 'النيات',
      filter: 'weak',
      page: 1,
    });
    expect(url).toContain('d%5B%5D=3');
    expect(url).toContain('d%5B%5D=4');
  });
});

describe('DorarProvider smart typo recovery', () => {
  it('recovers automatically when a typo query returns 0 results from Dorar', async () => {
    const requestedUrls: string[] = [];
    const fakeFetch: HttpFetchFn = async (url) => {
      requestedUrls.push(url);
      if (url.includes(encodeURIComponent('النار'))) {
        return VALID_NAR_BODY;
      }
      return EMPTY_BODY;
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    const response = await provider.search({ query: 'الناور', filter: 'all', page: 1 });

    expect(requestedUrls).toHaveLength(2);
    expect(response.items).toHaveLength(1);
    expect(response.effectiveQuery).toBe('النار');
    expect(response.correctedFrom).toBe('الناور');
  });

  it('does not auto-correct when forceExact is true', async () => {
    const requestedUrls: string[] = [];
    const fakeFetch: HttpFetchFn = async (url) => {
      requestedUrls.push(url);
      return EMPTY_BODY;
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    const response = await provider.search({
      query: 'الناور',
      filter: 'all',
      page: 1,
      forceExact: true,
    });

    expect(requestedUrls).toHaveLength(1);
    expect(response.items).toEqual([]);
    expect(response.correctedFrom).toBeUndefined();
  });

  it('proactively cleans deterministic repeated-letter typos like النارر in a single HTTP request', async () => {
    const requestedUrls: string[] = [];
    const fakeFetch: HttpFetchFn = async (url) => {
      requestedUrls.push(url);
      return VALID_NAR_BODY;
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    const response = await provider.search({ query: 'النارر', filter: 'all', page: 1 });

    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toContain(encodeURIComponent('النار'));
    expect(response.effectiveQuery).toBe('النار');
    expect(response.correctedFrom).toBe('النارر');
    expect(response.items).toHaveLength(1);
  });

  it('caches search responses in memory so switching back to a prior query/filter hits network once', async () => {
    let calls = 0;
    const fakeFetch: HttpFetchFn = async () => {
      calls++;
      return VALID_NAR_BODY;
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    const first = await provider.search({ query: 'النار', filter: 'all', page: 1 });
    const second = await provider.search({ query: 'النار', filter: 'all', page: 1 });

    expect(calls).toBe(1);
    expect(second.items).toEqual(first.items);
  });

  it('automatically backfills next pages when hasan filter returns too few matches on page 1', async () => {
    const requestedPages: number[] = [];
    const makeMixedPage = (hasanIdx: number) =>
      JSON.stringify({
        ahadith: {
          result: `
<div class="hadith">1 - حديث صحيح رقم ${hasanIdx}</div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> أبو هريرة
<span class="info-subtitle">المحدث:</span> البخاري
<span class="info-subtitle">المصدر:</span> صحيح البخاري
<span class="info-subtitle">الصفحة أو الرقم:</span> ${hasanIdx}
<span class="info-subtitle">خلاصة حكم المحدث:</span> صحيح
</div>
--------------
<div class="hadith">2 - حديث حسن رقم ${hasanIdx}</div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> أنس بن مالك
<span class="info-subtitle">المحدث:</span> الترمذي
<span class="info-subtitle">المصدر:</span> سنن الترمذي
<span class="info-subtitle">الصفحة أو الرقم:</span> ${100 + hasanIdx}
<span class="info-subtitle">خلاصة حكم المحدث:</span> إسناده حسن
</div>
--------------
<a href="#">المزيد</a>
`,
        },
      });

    const fakeFetch: HttpFetchFn = async (url) => {
      const match = url.match(/page=(\d+)/);
      const p = match ? Number(match[1]) : 1;
      requestedPages.push(p);
      return makeMixedPage(p);
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    const res = await provider.search({ query: 'الصلاة', filter: 'hasan', page: 1 });

    expect(requestedPages).toEqual([1, 2, 3]);
    expect(res.items).toHaveLength(3);
    expect(
      res.items.every(
        (item) => item.gradeBucket === 'hasan' || item.gradeBucket === 'hasan_isnad',
      ),
    ).toBe(true);
    expect(res.page).toBe(3);
    expect(res.hasMore).toBe(true);
  });

  it('strips standalone و before querying Dorar so typos like "و امامز" recover instead of matching bare و', async () => {
    const requestedUrls: string[] = [];
    const fakeFetch: HttpFetchFn = async (url) => {
      requestedUrls.push(url);
      if (url.includes(encodeURIComponent('إمام'))) {
        return VALID_NAR_BODY;
      }
      return EMPTY_BODY;
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    const response = await provider.search({ query: 'و امامز', filter: 'all', page: 1 });

    expect(requestedUrls).toHaveLength(2);
    expect(new URL(requestedUrls[0]).searchParams.get('skey')).toBe('امامز');
    expect(new URL(requestedUrls[1]).searchParams.get('skey')).toBe('إمام');
    expect(response.effectiveQuery).toBe('إمام');
    expect(response.correctedFrom).toBe('و امامز');
    expect(response.items).toHaveLength(1);
  });

  it('backfills next pages for weak filter when duplicate grouping collapses page 1 to fewer than 10 unique cards', async () => {
    const requestedPages: number[] = [];
    const makeWeakDuplicatePage = (pageNum: number) => {
      // 12 raw items per page, but only 4 unique matns (3 duplicate scholars each)
      const blocks: string[] = [];
      let idx = 1;
      for (let m = 1; m <= 4; m++) {
        for (let s = 1; s <= 3; s++) {
          blocks.push(`
<div class="hadith">${idx++} - حديث ضعيف صفحة ${pageNum} متن رقم ${m} في الصلاة</div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> أبو هريرة
<span class="info-subtitle">المحدث:</span> المحدث ${s}
<span class="info-subtitle">المصدر:</span> كتاب ${s}
<span class="info-subtitle">الصفحة أو الرقم:</span> ${pageNum * 100 + m * 10 + s}
<span class="info-subtitle">خلاصة حكم المحدث:</span> ضعيف
</div>`);
        }
      }
      return JSON.stringify({
        ahadith: {
          result: `${blocks.join('\n--------------\n')}\n--------------\n<a href="#">المزيد</a>`,
        },
      });
    };

    const fakeFetch: HttpFetchFn = async (url) => {
      const match = url.match(/page=(\d+)/);
      const p = match ? Number(match[1]) : 1;
      requestedPages.push(p);
      return makeWeakDuplicatePage(p);
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    const res = await provider.search({ query: 'الصلاة', filter: 'weak', page: 1 });

    // Page 1 = 4 unique cards, Page 2 = 8 unique cards, Page 3 = 12 unique cards (>= 10)
    expect(requestedPages).toEqual([1, 2, 3]);
    expect(res.page).toBe(3);
    expect(res.items.length).toBe(36);
  });

  it('uses rich HTML search by default and silently falls back to dorar_api.json when HTML fails', async () => {
    const requestedUrls: string[] = [];
    const fakeFetch: HttpFetchFn = async (url) => {
      requestedUrls.push(url);
      if (url.includes('/hadith/search')) {
        throw new Error('HTML endpoint unavailable');
      }
      return VALID_NAR_BODY;
    };

    const provider = new DorarProvider({
      webBase: 'https://dorar.net',
      fetcher: fakeFetch,
    });

    const res = await provider.search({ query: 'النار', filter: 'all', page: 1 });
    expect(requestedUrls[0]).toContain('https://dorar.net/hadith/search');
    expect(requestedUrls[1]).toContain('https://dorar.net/dorar_api.json');
    expect(res.items).toHaveLength(1);
  });

  it('fetches and caches osoul and alt sahih panels on demand', async () => {
    let calls = 0;
    const fakeFetch: HttpFetchFn = async (url) => {
      calls++;
      if (url.endsWith('/h/HfSawmZV/osoul')) {
        return `
<div id="home"><h1>أصول الحديث: </h1>
<article><h5 class="h5-responsive"><span style="color:maroon">[سنن أبي داود] (1/ 141)</span><br><span style="color:blue">510- حدثنا فلان عن ابن عمر</span>، قال: كان الأذان مثنى</h5></article>
</div>`;
      }
      return `
<div id="home">
  <div class="border-bottom py-4"><article><h5 class="h5-responsive">- الأصلي</h5></article><div class="d-block mb-2"><strong class="px-2">خلاصة حكم المحدث : <span class="primary-text-color">ضعيف</span></strong><strong class="px-2">الراوي : <span class="primary-text-color">ابن عمر</span></strong></div></div>
  <div class="border-bottom py-4"><article><h5 class="h5-responsive">- أُمِرَ بلالٌ أن يَشفَعَ الأذانَ</h5></article><div class="d-block mb-2"><strong class="px-2">خلاصة حكم المحدث : <span class="primary-text-color">[صحيح]</span></strong><strong class="px-2">الراوي : <span class="primary-text-color">أنس بن مالك</span></strong><strong class="px-2">| المحدث : <span class="primary-text-color">مسلم</span></strong><strong class="px-2">| المصدر : <span class="primary-text-color">صحيح مسلم</span></strong><strong class="px-2">الصفحة أو الرقم : <span class="primary-text-color">378</span></strong></div></div>
</div>`;
    };

    const provider = new DorarProvider({
      webBase: 'https://dorar.net',
      fetcher: fakeFetch,
    });

    const osoul1 = await provider.fetchOsoul('HfSawmZV');
    const osoul2 = await provider.fetchOsoul('HfSawmZV');
    expect(osoul1).toHaveLength(1);
    expect(osoul1[0].sourceRef).toBe('سنن أبي داود (1/ 141)');
    expect(osoul2).toEqual(osoul1);

    const alts1 = await provider.fetchAltSahih('HfSawmZV');
    const alts2 = await provider.fetchAltSahih('HfSawmZV');
    expect(alts1).toHaveLength(1);
    expect(alts1[0].source).toBe('صحيح مسلم');
    expect(alts2).toEqual(alts1);

    // 1 call for osoul + 1 call for alts (second calls served from cache)
    expect(calls).toBe(2);
  });

  it('recovers conversational filler queries in Stage 2 with recoveryMode relaxed', async () => {
    const requestedUrls: string[] = [];
    const fakeFetch: HttpFetchFn = async (url) => {
      requestedUrls.push(url);
      if (new URL(url).searchParams.get('skey') === 'الصبر') {
        return VALID_NAR_BODY;
      }
      return EMPTY_BODY;
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    const res = await provider.search({
      query: 'حديث عن فضل الصبر',
      filter: 'all',
      page: 1,
    });

    expect(requestedUrls).toHaveLength(2);
    expect(new URL(requestedUrls[1]).searchParams.get('skey')).toBe('الصبر');
    expect(res.items).toHaveLength(1);
    expect(res.effectiveQuery).toBe('الصبر');
    expect(res.correctedFrom).toBe('حديث عن فضل الصبر');
    expect(res.recoveryMode).toBe('relaxed');
  });

  it('recovers multi-typo phrases via Stage 3 relaxed st=a + local fuzzy re-ranking', async () => {
    const requestedUrls: string[] = [];
    const mixedStAResponse = JSON.stringify({
      ahadith: {
        result: `
<div class="hadith">1 - مَن لم يوتِرْ فليس مِنَّا</div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> أبو أيوب
<span class="info-subtitle">المحدث:</span> شعيب الأرناؤوط
<span class="info-subtitle">المصدر:</span> المسند
<span class="info-subtitle">الصفحة أو الرقم:</span> 22
<span class="info-subtitle">خلاصة حكم المحدث:</span> صحيح
</div>
--------------
<div class="hadith">2 - من غشَّنا فليسَ منَّا</div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> أبو هريرة
<span class="info-subtitle">المحدث:</span> مسلم
<span class="info-subtitle">المصدر:</span> صحيح مسلم
<span class="info-subtitle">الصفحة أو الرقم:</span> 101
<span class="info-subtitle">خلاصة حكم المحدث:</span> صحيح
</div>
--------------
<a href="#">المزيد</a>
`,
      },
    });

    const fakeFetch: HttpFetchFn = async (url) => {
      requestedUrls.push(url);
      if (new URL(url).searchParams.get('st') === 'a') {
        return mixedStAResponse;
      }
      return EMPTY_BODY;
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    const res = await provider.search({
      query: 'من غشانا فليس مننا',
      filter: 'all',
      page: 1,
    });

    expect(requestedUrls.some((u) => u.includes('st=a'))).toBe(true);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].text).toBe('من غشَّنا فليسَ منَّا');
    expect(res.effectiveQuery).toBe('من غشنا فليس منا');
    expect(res.correctedFrom).toBe('من غشانا فليس مننا');
    expect(res.recoveryMode).toBe('typo');
  });

  it('recovers modern concepts via Stage 4 curated mapping with recoveryMode concept', async () => {
    const requestedUrls: string[] = [];
    const fakeFetch: HttpFetchFn = async (url) => {
      requestedUrls.push(url);
      if (new URL(url).searchParams.get('skey') === 'الهم والحزن') {
        return VALID_NAR_BODY;
      }
      return EMPTY_BODY;
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    const res = await provider.search({
      query: 'الاكتئاب',
      filter: 'all',
      page: 1,
    });

    expect(requestedUrls).toHaveLength(2);
    expect(res.items).toHaveLength(1);
    expect(res.effectiveQuery).toBe('الهم والحزن');
    expect(res.correctedFrom).toBe('الاكتئاب');
    expect(res.recoveryMode).toBe('concept');
    expect(res.suggestions).toContain('تفريج الكرب');
  });

  it('makes only 1 HTTP call for hopeless single-token gibberish with empty state', async () => {
    const requestedUrls: string[] = [];
    const fakeFetch: HttpFetchFn = async (url) => {
      requestedUrls.push(url);
      return EMPTY_BODY;
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    const res = await provider.search({
      query: 'خقضصثق',
      filter: 'all',
      page: 1,
    });

    expect(requestedUrls).toHaveLength(1);
    expect(res.items).toEqual([]);
    expect(res.suggestions).toEqual([]);
  });

  it('recovers "فمن كانت هحىته الى الله" via Stage 1 in 2 requests without rewriting فمن/كانت', async () => {
    const requestedUrls: string[] = [];
    const hijrahBody = JSON.stringify({
      ahadith: {
        result: `
<div class="hadith">1 - إنَّما الأعمالُ بالنِّيَّةِ، فمَن كانت هجرتُه إلى اللهِ ورسولِه</div>
<div class="hadith-info">
<span class="info-subtitle">الراوي:</span> عمر بن الخطاب
<span class="info-subtitle">المحدث:</span> البخاري
<span class="info-subtitle">المصدر:</span> صحيح البخاري
<span class="info-subtitle">الصفحة أو الرقم:</span> 1
<span class="info-subtitle">خلاصة حكم المحدث:</span> صحيح
</div>
--------------
<a href="#">المزيد</a>
`,
      },
    });

    const fakeFetch: HttpFetchFn = async (url) => {
      requestedUrls.push(url);
      if (new URL(url).searchParams.get('skey') === 'فمن كانت هجرته الى الله') {
        return hijrahBody;
      }
      return EMPTY_BODY;
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    const res = await provider.search({
      query: 'فمن كانت هحىته الى الله',
      filter: 'all',
      page: 1,
    });

    expect(requestedUrls).toHaveLength(2);
    expect(res.items).toHaveLength(1);
    expect(res.effectiveQuery).toBe('فمن كانت هجرته الى الله');
    expect(res.correctedFrom).toBe('فمن كانت هحىته الى الله');
    expect(res.recoveryMode).toBe('typo');
  });

  it('reuses a cached empty forceExact lookup so idle recovery skips repeating Stage 0', async () => {
    const requestedUrls: string[] = [];
    const fakeFetch: HttpFetchFn = async (url) => {
      requestedUrls.push(url);
      if (new URL(url).searchParams.get('skey') === 'النار') {
        return VALID_NAR_BODY;
      }
      return EMPTY_BODY;
    };

    const provider = new DorarProvider({
      endpoint: 'https://dorar.net/dorar_api.json',
      fetcher: fakeFetch,
    });

    // Step 1: live-typing exact search finds 0 results (1 HTTP request)
    const exactRes = await provider.search({
      query: 'الناور',
      filter: 'all',
      page: 1,
      forceExact: true,
    });
    expect(exactRes.items).toEqual([]);
    expect(requestedUrls).toHaveLength(1);

    // Step 2: idle recovery reuses the cached Stage 0 miss and jumps straight to Stage 1 (only 1 more request)
    const recovered = await provider.search({
      query: 'الناور',
      filter: 'all',
      page: 1,
      forceExact: false,
    });
    expect(requestedUrls).toHaveLength(2);
    expect(recovered.effectiveQuery).toBe('النار');
    expect(recovered.correctedFrom).toBe('الناور');
    expect(recovered.items).toHaveLength(1);
  });
});
