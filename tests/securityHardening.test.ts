import { describe, expect, it, vi } from 'vitest';
import { parseDorarApiResponse, parseDorarWebSearchHtml } from '../src/domain/dorarParser';
import {
  clearLearnedWords,
  hasLearnedExactWord,
  learnConfirmedQueryWords,
} from '../src/domain/learnedVocab';
import {
  assertAllowedDorarUrl,
  assertAllowedRedirectUrl,
  DorarProvider,
  isValidDorarId,
  MAX_QUERY_LENGTH,
} from '../src/services/dorarClient';

describe('securityHardening', () => {
  it('safely handles out-of-range and surrogate numeric HTML entities without throwing', () => {
    const hostilePayload = JSON.stringify({
      ahadith: {
        result:
          '<div>1 - حديث &#x9999999; و &#999999999; و &#xD800; <script>alert(1)</script><br/>' +
          'الراوي: أنس المحدث: البخاري المصدر: صحيح البخاري الصفحة أو الرقم: 1 خلاصة حكم المحدث: صحيح</div>',
      },
    });

    const parsed = parseDorarApiResponse(hostilePayload);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].text).not.toContain('<script>');
    expect(parsed.items[0].text).not.toContain('alert(1)');
  });

  it('strips script/style tags and HTML injection from web search cards', () => {
    const html = `
      <div id="specialist">
        <div class="border-bottom">
          <h5>1 - نص الحديث <img src=x onerror=alert(1)><script>evil()</script></h5>
          <strong>الراوي: <span class="primary-text-color">أنس</span></strong>
          <strong>المحدث: <span class="primary-text-color">مسلم</span></strong>
          <strong>المصدر: <span class="primary-text-color">صحيح مسلم</span></strong>
          <strong>الصفحة أو الرقم: <span class="primary-text-color">10</span></strong>
          <strong>خلاصة حكم المحدث: <span class="primary-text-color">صحيح</span></strong>
        </div>
      </div>
    `;

    const parsed = parseDorarWebSearchHtml(html, 1);
    expect(parsed.recognized).toBe(true);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].text).toBe('نص الحديث');
  });

  it('strictly allowlists outbound URLs to HTTPS dorar.net (or web dev proxy)', () => {
    expect(() => assertAllowedDorarUrl('https://dorar.net/hadith/search?q=test', true)).not.toThrow();
    expect(() => assertAllowedDorarUrl('https://www.dorar.net/h/abc123/osoul', true)).not.toThrow();
    expect(() => assertAllowedDorarUrl('/dorar-proxy/hadith/search?q=test', false)).not.toThrow();

    // Block cleartext HTTP, arbitrary external hosts, protocol-relative URLs, and native proxy bypass
    expect(() => assertAllowedDorarUrl('http://dorar.net/hadith/search?q=test', true)).toThrow();
    expect(() => assertAllowedDorarUrl('https://evil.example/dorar.net', true)).toThrow();
    expect(() => assertAllowedDorarUrl('https://dorar.net.evil.example/', true)).toThrow();
    expect(() => assertAllowedDorarUrl('javascript:alert(1)', false)).toThrow();
    expect(() => assertAllowedDorarUrl('file:///etc/passwd', true)).toThrow();
    expect(() => assertAllowedDorarUrl('//evil.example/dorar-proxy/', false)).toThrow();
    expect(() => assertAllowedDorarUrl('/dorar-proxy/hadith/search?q=test', true)).toThrow();
  });

  it('re-verifies final redirect destinations on native and web dev proxy safely', () => {
    expect(() =>
      assertAllowedRedirectUrl('https://dorar.net/hadith/search?q=test', true),
    ).not.toThrow();
    expect(() =>
      assertAllowedRedirectUrl('https://www.dorar.net/h/abc123/osoul', true),
    ).not.toThrow();
    expect(() =>
      assertAllowedRedirectUrl(
        'http://localhost:5178/dorar-proxy/hadith/search?q=test',
        false,
        'http://localhost:5178',
      ),
    ).not.toThrow();
    expect(() => assertAllowedRedirectUrl(undefined, true)).not.toThrow();

    expect(() =>
      assertAllowedRedirectUrl('https://attacker.example/phish', true),
    ).toThrow();
    expect(() =>
      assertAllowedRedirectUrl('http://dorar.net/hadith/search?q=test', true),
    ).toThrow();
    expect(() =>
      assertAllowedRedirectUrl(
        'http://localhost:5178/other/path',
        false,
        'http://localhost:5178',
      ),
    ).toThrow();
  });

  it('validates dorarId strictly and makes 0 HTTP calls for invalid IDs', async () => {
    expect(isValidDorarId('abc123_XY-9')).toBe(true);
    expect(isValidDorarId('../etc/passwd')).toBe(false);
    expect(isValidDorarId('abc?evil=1')).toBe(false);
    expect(isValidDorarId('a'.repeat(65))).toBe(false);
    expect(isValidDorarId('')).toBe(false);

    const fetcher = vi.fn(async () => '');
    const provider = new DorarProvider({ webBase: 'https://dorar.net', fetcher });

    expect(await provider.fetchOsoul('../admin')).toEqual([]);
    expect(await provider.fetchAltSahih('foo/bar')).toEqual([]);
    expect(await provider.fetchSimilar('id#frag')).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('caps oversized search queries at MAX_QUERY_LENGTH before querying Dorar', async () => {
    const calledUrls: string[] = [];
    const provider = new DorarProvider({
      webBase: 'https://dorar.net',
      fetcher: async (url) => {
        calledUrls.push(url);
        return '<div id="specialist"></div>';
      },
    });

    const hugeQuery = 'الرحمة '.repeat(100);
    expect(hugeQuery.length).toBeGreaterThan(MAX_QUERY_LENGTH);

    const res = await provider.search({
      query: hugeQuery,
      filter: 'all',
      page: 1,
      forceExact: true,
    });

    expect(res.effectiveQuery.length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
    expect(calledUrls.length).toBeGreaterThan(0);
    const parsedUrl = new URL(calledUrls[0]);
    expect((parsedUrl.searchParams.get('q') ?? '').length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
  });

  it('wipes learned vocabulary cleanly when clearing local search data', () => {
    clearLearnedWords();
    learnConfirmedQueryWords('التكافل');
    expect(hasLearnedExactWord('التكافل')).toBe(true);

    clearLearnedWords();
    expect(hasLearnedExactWord('التكافل')).toBe(false);
  });
});
