import { Capacitor, CapacitorHttp } from '@capacitor/core';
import {
  collapseRepeatedChars,
  stripDiacritics,
  stripStandaloneConjunctions,
} from '../domain/arabicNormalize';
import {
  parseDorarApiResponse,
  parseDorarOsoulHtml,
  parseDorarRelatedHadithsHtml,
  parseDorarWebSearchHtml,
} from '../domain/dorarParser';
import {
  isHasanBucket,
  isSahihBucket,
  isUnauthenticBucket,
} from '../domain/gradeClassifier';
import { groupDuplicateHadiths } from '../domain/groupHadiths';
import { suggestArabicQuery } from '../domain/typoSuggest';
import type {
  FilterMode,
  HadithResult,
  OsoulEntry,
  SearchRequest,
  SearchResponse,
} from '../domain/hadith';
import type { HadithProvider } from './hadithProvider';

export type HttpFetchFn = (url: string, signal?: AbortSignal) => Promise<string>;

export interface DorarProviderOptions {
  /** Legacy JSON endpoint override (forces JSON-only mode when webBase is omitted). */
  endpoint?: string;
  /** Rich web base URL (e.g. "https://dorar.net" or "/dorar-proxy"). */
  webBase?: string;
  fetcher?: HttpFetchFn;
}

const DEFAULT_NATIVE_WEB_BASE = 'https://dorar.net';
const DEFAULT_WEB_DEV_BASE = '/dorar-proxy';

const CACHE_MAX_ENTRIES = 30;
const DETAIL_CACHE_MAX_ENTRIES = 40;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MIN_BACKFILL_GROUPS = 10;
const MAX_BACKFILL_PAGES = 3;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

function degreeParamsForFilter(filter: FilterMode): string[] {
  switch (filter) {
    case 'sahih':
      // Include both d[]=1 (hadith graded authentic) and d[]=2 (chain graded authentic)
      return ['1', '2'];
    case 'hasan':
      // Dorar groups authentic & hasan rulings under 1 & 2; we refine locally to hasan + hasan_isnad
      return ['1', '2'];
    case 'weak':
      // Include both d[]=3 (hadith weak/munkar/mawdu/batil) and d[]=4 (chain weak)
      return ['3', '4'];
    case 'all':
    default:
      return [];
  }
}

export function buildDorarSearchUrl(
  baseEndpoint: string,
  params: { query: string; filter: FilterMode; page: number },
): string {
  const searchParams = new URLSearchParams();
  searchParams.set('skey', params.query.trim());
  if (params.page > 1) {
    searchParams.set('page', String(params.page));
  }
  for (const degree of degreeParamsForFilter(params.filter)) {
    searchParams.append('d[]', degree);
  }
  return `${baseEndpoint}?${searchParams.toString()}`;
}

export function buildDorarWebSearchUrl(
  webBase: string,
  params: { query: string; filter: FilterMode; page: number },
): string {
  const searchParams = new URLSearchParams();
  searchParams.set('q', params.query.trim());
  if (params.page > 1) {
    searchParams.set('page', String(params.page));
  }
  for (const degree of degreeParamsForFilter(params.filter)) {
    searchParams.append('d[]', degree);
  }
  return `${webBase}/hadith/search?${searchParams.toString()}`;
}

async function defaultHttpFetch(url: string, signal?: AbortSignal): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      headers: {
        Accept: 'text/html, application/json, text/plain, */*',
      },
      connectTimeout: 12000,
      readTimeout: 15000,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Dorar API error (${response.status})`);
    }
    return typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data);
  }

  const res = await fetch(url, {
    method: 'GET',
    signal,
    headers: { Accept: 'text/html, application/json, text/plain, */*' },
  });
  if (!res.ok) {
    throw new Error(`Dorar API error (${res.status})`);
  }
  return res.text();
}

function applyClientFilterRefinement(
  items: HadithResult[],
  filter: FilterMode,
): HadithResult[] {
  if (filter === 'sahih') {
    return items.filter((item) => isSahihBucket(item.gradeBucket));
  }
  if (filter === 'hasan') {
    return items.filter((item) => isHasanBucket(item.gradeBucket));
  }
  if (filter === 'weak') {
    return items.filter((item) => isUnauthenticBucket(item.gradeBucket));
  }
  return items;
}

function readLru<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function writeLru<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  maxEntries: number,
): void {
  if (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

const RELATED_ORDER: Record<HadithResult['gradeBucket'], number> = {
  sahih: 85,
  sahih_isnad: 80,
  hasan: 75,
  hasan_isnad: 70,
  daif_isnad: 45,
  daif: 40,
  very_weak: 30,
  munkar: 25,
  batil: 15,
  mawdu: 10,
  unknown: 20,
};

export class DorarProvider implements HadithProvider {
  readonly id = 'dorar';
  private readonly webBase: string;
  private readonly apiEndpoint: string;
  private readonly useRichWebSearch: boolean;
  private readonly fetcher: HttpFetchFn;
  private readonly cache = new Map<string, CacheEntry<SearchResponse>>();
  private readonly osoulCache = new Map<string, CacheEntry<OsoulEntry[]>>();
  private readonly relatedCache = new Map<string, CacheEntry<HadithResult[]>>();

  constructor(options: DorarProviderOptions = {}) {
    const defaultBase = Capacitor.isNativePlatform()
      ? DEFAULT_NATIVE_WEB_BASE
      : DEFAULT_WEB_DEV_BASE;

    this.webBase = (options.webBase ?? defaultBase).replace(/\/+$/, '');
    this.apiEndpoint = options.endpoint ?? `${this.webBase}/dorar_api.json`;
    // Respect explicit legacy JSON endpoint override when webBase wasn't provided
    this.useRichWebSearch = Boolean(options.webBase || !options.endpoint);
    this.fetcher = options.fetcher ?? defaultHttpFetch;
  }

  private async fetchSinglePage(
    query: string,
    filter: FilterMode,
    page: number,
    signal?: AbortSignal,
  ): Promise<{ items: HadithResult[]; hasMore: boolean }> {
    if (this.useRichWebSearch) {
      try {
        const webUrl = buildDorarWebSearchUrl(this.webBase, { query, filter, page });
        const html = await this.fetcher(webUrl, signal);
        const parsed = parseDorarWebSearchHtml(html, page);
        if (parsed.recognized) {
          return { items: parsed.items, hasMore: parsed.hasMore };
        }
      } catch (err) {
        if (signal?.aborted) throw err;
        // Fall back silently to legacy dorar_api.json if the HTML search page errors or changes
      }
    }

    const apiUrl = buildDorarSearchUrl(this.apiEndpoint, { query, filter, page });
    const body = await this.fetcher(apiUrl, signal);
    return parseDorarApiResponse(body);
  }

  private async fetchWithBackfill(
    query: string,
    filter: FilterMode,
    startPage: number,
    signal?: AbortSignal,
  ): Promise<{
    items: HadithResult[];
    rawCount: number;
    lastPage: number;
    hasMore: boolean;
  }> {
    const collected: HadithResult[] = [];
    const seenIds = new Set<string>();
    let rawCount = 0;
    let currentPage = startPage;
    let lastPage = startPage;
    let hasMore = false;

    for (let step = 0; step < MAX_BACKFILL_PAGES; step++) {
      const parsed = await this.fetchSinglePage(query, filter, currentPage, signal);

      rawCount += parsed.items.length;
      lastPage = currentPage;
      hasMore = parsed.hasMore;

      const filtered = applyClientFilterRefinement(parsed.items, filter);
      for (const item of filtered) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          collected.push(item);
        }
      }

      if (!hasMore || parsed.items.length === 0) break;

      const groupedCount = groupDuplicateHadiths(collected).length;
      if (groupedCount >= MIN_BACKFILL_GROUPS) break;

      // For "all", only backfill when duplicate grouping actually collapsed cards on this page
      if (filter === 'all' && groupedCount === collected.length) break;

      currentPage += 1;
    }

    return { items: collected, rawCount, lastPage, hasMore };
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    const rawQuery = request.query.trim();
    if (!rawQuery) {
      return {
        items: [],
        page: request.page,
        hasMore: false,
        effectiveQuery: '',
        suggestions: [],
      };
    }

    const cacheKey = `${rawQuery}|${request.filter}|${request.page}|${Boolean(request.forceExact)}`;
    const cached = readLru(this.cache, cacheKey);
    if (cached) return cached;

    // Proactive cleanup for stray standalone conjunctions ("و امامز" -> "امامز")
    // and deterministic repeated-letter typos ("النارر" -> "النار")
    let initialQuery = rawQuery;
    let proactiveCorrectedFrom: string | undefined;
    if (request.page === 1 && !request.forceExact) {
      const stripped = stripDiacritics(rawQuery).trim();
      const withoutConjunctions = stripStandaloneConjunctions(stripped);
      const collapsed = collapseRepeatedChars(withoutConjunctions);
      if (collapsed && collapsed !== stripped) {
        initialQuery = collapsed;
        proactiveCorrectedFrom = rawQuery;
      }
    }

    const firstPass = await this.fetchWithBackfill(
      initialQuery,
      request.filter,
      request.page,
      request.signal,
    );

    if (firstPass.rawCount > 0 || request.page > 1 || request.forceExact) {
      const result: SearchResponse = {
        items: firstPass.items,
        page: firstPass.lastPage,
        hasMore: firstPass.hasMore,
        effectiveQuery: initialQuery,
        correctedFrom: proactiveCorrectedFrom,
        suggestions: [],
      };
      writeLru(this.cache, cacheKey, result, CACHE_MAX_ENTRIES);
      return result;
    }

    // Zero results on page 1 -> attempt forgiving fuzzy Arabic vocabulary recovery (e.g. الناور -> النار)
    const suggestion = suggestArabicQuery(initialQuery);
    if (!suggestion.changed || suggestion.correctedQuery === initialQuery) {
      const emptyResult: SearchResponse = {
        items: [],
        page: request.page,
        hasMore: false,
        effectiveQuery: rawQuery,
        suggestions: suggestion.alternatives,
      };
      writeLru(this.cache, cacheKey, emptyResult, CACHE_MAX_ENTRIES);
      return emptyResult;
    }

    const recoveredPass = await this.fetchWithBackfill(
      suggestion.correctedQuery,
      request.filter,
      1,
      request.signal,
    );

    if (recoveredPass.rawCount > 0) {
      const recoveredResult: SearchResponse = {
        items: recoveredPass.items,
        page: recoveredPass.lastPage,
        hasMore: recoveredPass.hasMore,
        effectiveQuery: suggestion.correctedQuery,
        correctedFrom: rawQuery,
        suggestions: suggestion.alternatives.filter(
          (alt) => alt !== suggestion.correctedQuery,
        ),
      };
      writeLru(this.cache, cacheKey, recoveredResult, CACHE_MAX_ENTRIES);
      return recoveredResult;
    }

    const fallbackEmpty: SearchResponse = {
      items: [],
      page: 1,
      hasMore: false,
      effectiveQuery: rawQuery,
      suggestions: suggestion.alternatives,
    };
    writeLru(this.cache, cacheKey, fallbackEmpty, CACHE_MAX_ENTRIES);
    return fallbackEmpty;
  }

  async fetchOsoul(dorarId: string, signal?: AbortSignal): Promise<OsoulEntry[]> {
    const cached = readLru(this.osoulCache, dorarId);
    if (cached) return cached;

    const url = `${this.webBase}/h/${encodeURIComponent(dorarId)}/osoul`;
    const html = await this.fetcher(url, signal);
    const entries = parseDorarOsoulHtml(html);
    writeLru(this.osoulCache, dorarId, entries, DETAIL_CACHE_MAX_ENTRIES);
    return entries;
  }

  async fetchAltSahih(dorarId: string, signal?: AbortSignal): Promise<HadithResult[]> {
    const cacheKey = `alt:${dorarId}`;
    const cached = readLru(this.relatedCache, cacheKey);
    if (cached) return cached;

    const url = `${this.webBase}/h/${encodeURIComponent(dorarId)}?alts=1`;
    const html = await this.fetcher(url, signal);
    const items = groupDuplicateHadiths(parseDorarRelatedHadithsHtml(html)).map(
      (g) => g.primary,
    );
    writeLru(this.relatedCache, cacheKey, items, DETAIL_CACHE_MAX_ENTRIES);
    return items;
  }

  async fetchSimilar(dorarId: string, signal?: AbortSignal): Promise<HadithResult[]> {
    const cacheKey = `sim:${dorarId}`;
    const cached = readLru(this.relatedCache, cacheKey);
    if (cached) return cached;

    const url = `${this.webBase}/h/${encodeURIComponent(dorarId)}?sims=1`;
    const html = await this.fetcher(url, signal);
    const grouped = groupDuplicateHadiths(parseDorarRelatedHadithsHtml(html))
      .map((g) => g.primary)
      .sort((a, b) => RELATED_ORDER[b.gradeBucket] - RELATED_ORDER[a.gradeBucket]);
    writeLru(this.relatedCache, cacheKey, grouped, DETAIL_CACHE_MAX_ENTRIES);
    return grouped;
  }
}
