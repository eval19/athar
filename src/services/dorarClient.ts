import { Capacitor, CapacitorHttp } from '@capacitor/core';
import {
  ARABIC_QUERY_FILLERS,
  ARABIC_STOP_WORDS,
  normalizeArabic,
  stripDiacritics,
  stripQueryFillers,
} from '../domain/arabicNormalize';
import { findConceptExpansions } from '../domain/arabicVocab';
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
import {
  learnConfirmedQueryWords,
  learnWordsFromTexts,
} from '../domain/learnedVocab';
import { rerankRelaxedResults } from '../domain/resultRerank';
import { analyzeArabicQuery, prepareProactiveQuery } from '../domain/typoSuggest';
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

export const MAX_QUERY_LENGTH = 160;
export const MAX_RESPONSE_CHARS = 2 * 1024 * 1024;
const WEB_FETCH_TIMEOUT_MS = 15_000;
const DORAR_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const ALLOWED_DORAR_HOSTS = new Set(['dorar.net', 'www.dorar.net']);

export function isValidDorarId(dorarId: string): boolean {
  return DORAR_ID_PATTERN.test(dorarId);
}

/**
 * Enforces an explicit outbound host/scheme allowlist so client HTTP calls can
 * only ever reach HTTPS dorar.net (or the local dev proxy path on web).
 */
export function assertAllowedDorarUrl(
  url: string,
  isNative = Capacitor.isNativePlatform(),
): void {
  if (!isNative && url.startsWith('/dorar-proxy/') && !url.startsWith('//')) {
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Blocked invalid outbound URL');
  }

  if (parsed.protocol !== 'https:' || !ALLOWED_DORAR_HOSTS.has(parsed.hostname)) {
    throw new Error('Blocked disallowed outbound host');
  }
}

/**
 * Re-verifies the final response URL after any HTTP redirect so native or
 * browser networking cannot silently land on an untrusted host.
 */
export function assertAllowedRedirectUrl(
  finalUrl: string | undefined,
  isNative = Capacitor.isNativePlatform(),
  webOrigin = typeof window !== 'undefined' ? window.location.origin : undefined,
): void {
  if (!finalUrl) return;
  if (!isNative && webOrigin && finalUrl.startsWith(`${webOrigin}/dorar-proxy/`)) {
    return;
  }
  assertAllowedDorarUrl(finalUrl, isNative);
}

function assertSafeResponseSize(body: string): string {
  if (body.length > MAX_RESPONSE_CHARS) {
    throw new Error('Dorar response exceeded safety limit');
  }
  return body;
}

function createAbortError(): Error {
  const err = new Error('The operation was aborted.');
  err.name = 'AbortError';
  return err;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  if (!signal) return promise;

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      },
    );
  });
}

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
  params: { query: string; filter: FilterMode; page: number; searchType?: 'w' | 'a' },
): string {
  const searchParams = new URLSearchParams();
  searchParams.set('skey', params.query.trim());
  if (params.searchType === 'a') {
    searchParams.set('st', 'a');
  }
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
  params: { query: string; filter: FilterMode; page: number; searchType?: 'w' | 'a' },
): string {
  const searchParams = new URLSearchParams();
  searchParams.set('q', params.query.trim());
  if (params.searchType === 'a') {
    searchParams.set('st', 'a');
  }
  for (const degree of degreeParamsForFilter(params.filter)) {
    searchParams.append('d[]', degree);
  }
  if (params.page > 1) {
    // Al-Dorar only paginates the #specialist tab when `all` is present alongside `page`
    searchParams.set('all', '');
    searchParams.set('page', String(params.page));
  }
  return `${webBase}/hadith/search?${searchParams.toString()}`;
}

async function defaultHttpFetch(url: string, signal?: AbortSignal): Promise<string> {
  throwIfAborted(signal);
  assertAllowedDorarUrl(url);

  if (Capacitor.isNativePlatform()) {
    const response = await raceWithAbort(
      CapacitorHttp.get({
        url,
        headers: {
          Accept: 'text/html, application/json, text/plain, */*',
        },
        connectTimeout: 12000,
        readTimeout: 15000,
      }),
      signal,
    );
    throwIfAborted(signal);
    assertAllowedRedirectUrl(response.url, true);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Dorar API error (${response.status})`);
    }
    const text =
      typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    return assertSafeResponseSize(text);
  }

  const timeoutController = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => timeoutController.abort(),
    WEB_FETCH_TIMEOUT_MS,
  );
  const onExternalAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: timeoutController.signal,
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'text/html, application/json, text/plain, */*' },
    });
    assertAllowedRedirectUrl(res.url, false);
    if (!res.ok) {
      throw new Error(`Dorar API error (${res.status})`);
    }
    return assertSafeResponseSize(await res.text());
  } finally {
    globalThis.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
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

function buildRelaxedSurfaceQuery(query: string): string {
  const rawTokens = stripDiacritics(query).trim().split(/\s+/).filter(Boolean);
  if (rawTokens.length < 2) return '';

  const seenNorm = new Set<string>();
  const content: Array<{ surface: string; normLen: number; index: number }> = [];

  for (let i = 0; i < rawTokens.length; i++) {
    const surface = rawTokens[i];
    const norm = normalizeArabic(surface);
    if (
      norm.length < 2 ||
      seenNorm.has(norm) ||
      ARABIC_STOP_WORDS.has(norm) ||
      ARABIC_QUERY_FILLERS.has(norm)
    ) {
      continue;
    }
    seenNorm.add(norm);
    content.push({ surface, normLen: norm.length, index: i });
  }

  if (content.length === 0) return '';
  if (content.length <= 5) {
    return content.map((c) => c.surface).join(' ');
  }

  const topFive = [...content]
    .sort((a, b) => (b.normLen !== a.normLen ? b.normLen - a.normLen : a.index - b.index))
    .slice(0, 5)
    .sort((a, b) => a.index - b.index);

  return topFive.map((c) => c.surface).join(' ');
}

interface FetchBackfillResult {
  items: HadithResult[];
  rawCount: number;
  lastPage: number;
  hasMore: boolean;
}

export class DorarProvider implements HadithProvider {
  readonly id = 'dorar';
  private readonly webBase: string;
  private readonly apiEndpoint: string;
  private readonly useRichWebSearch: boolean;
  private readonly fetcher: HttpFetchFn;
  private readonly cache = new Map<string, CacheEntry<SearchResponse>>();
  private readonly emptyExactKeys = new Set<string>();
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
    searchType?: 'w' | 'a',
  ): Promise<{ items: HadithResult[]; hasMore: boolean }> {
    throwIfAborted(signal);
    if (this.useRichWebSearch) {
      try {
        const webUrl = buildDorarWebSearchUrl(this.webBase, {
          query,
          filter,
          page,
          searchType,
        });
        const html = await this.fetcher(webUrl, signal);
        throwIfAborted(signal);
        const parsed = parseDorarWebSearchHtml(html, page);
        if (parsed.recognized) {
          return { items: parsed.items, hasMore: parsed.hasMore };
        }
      } catch (err) {
        if (signal?.aborted) throw err;
        // Fall back silently to legacy dorar_api.json if the HTML search page errors or changes
      }
    }

    throwIfAborted(signal);
    const apiUrl = buildDorarSearchUrl(this.apiEndpoint, {
      query,
      filter,
      page,
      searchType,
    });
    const body = await this.fetcher(apiUrl, signal);
    throwIfAborted(signal);
    return parseDorarApiResponse(body);
  }

  private async fetchWithBackfill(
    query: string,
    filter: FilterMode,
    startPage: number,
    signal?: AbortSignal,
    searchType?: 'w' | 'a',
    maxPages = MAX_BACKFILL_PAGES,
  ): Promise<FetchBackfillResult> {
    const collected: HadithResult[] = [];
    const seenIds = new Set<string>();
    let rawCount = 0;
    let currentPage = startPage;
    let lastPage = startPage;
    let hasMore = false;

    for (let step = 0; step < maxPages; step++) {
      throwIfAborted(signal);
      const parsed = await this.fetchSinglePage(
        query,
        filter,
        currentPage,
        signal,
        searchType,
      );
      throwIfAborted(signal);

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
    throwIfAborted(request.signal);
    const rawQuery = request.query.trim().slice(0, MAX_QUERY_LENGTH).trim();
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

    if (request.page > 1 || request.forceExact) {
      const directPass = await this.fetchWithBackfill(
        rawQuery,
        request.filter,
        request.page,
        request.signal,
      );
      throwIfAborted(request.signal);
      if (request.forceExact && request.page === 1) {
        const exactKey = `${rawQuery}|${request.filter}`;
        if (directPass.rawCount === 0) {
          if (this.emptyExactKeys.size >= CACHE_MAX_ENTRIES) {
            const oldest = this.emptyExactKeys.values().next().value;
            if (oldest !== undefined) this.emptyExactKeys.delete(oldest);
          }
          this.emptyExactKeys.add(exactKey);
        } else {
          this.emptyExactKeys.delete(exactKey);
        }
      }
      if (directPass.items.length > 0) {
        learnWordsFromTexts(directPass.items.map((item) => item.text));
        if (request.forceExact && request.page === 1) {
          learnConfirmedQueryWords(rawQuery);
        }
      }
      const directResult: SearchResponse = {
        items: directPass.items,
        page: directPass.lastPage,
        hasMore: directPass.hasMore,
        effectiveQuery: rawQuery,
        suggestions: [],
      };
      writeLru(this.cache, cacheKey, directResult, CACHE_MAX_ENTRIES);
      return directResult;
    }

    const tried = new Set<string>();
    const runAttempt = async (
      query: string,
      searchType: 'w' | 'a' = 'w',
      maxPages = MAX_BACKFILL_PAGES,
    ): Promise<FetchBackfillResult | null> => {
      throwIfAborted(request.signal);
      const normalized = query.trim();
      if (!normalized) return null;
      const attemptKey = `${searchType}|${normalized}`;
      if (tried.has(attemptKey)) return null;
      tried.add(attemptKey);
      return this.fetchWithBackfill(
        normalized,
        request.filter,
        1,
        request.signal,
        searchType,
        maxPages,
      );
    };

    const cacheAndReturn = (response: SearchResponse): SearchResponse => {
      throwIfAborted(request.signal);
      if (response.items.length > 0) {
        learnWordsFromTexts(response.items.map((item) => item.text));
      }
      writeLru(this.cache, cacheKey, response, CACHE_MAX_ENTRIES);
      return response;
    };

    // Stage 0: Fast deterministic cleanup & guarded keyboard rescue
    const proactive = prepareProactiveQuery(rawQuery);
    const initialQuery = proactive.changed ? proactive.query : rawQuery;
    const proactiveCorrectedFrom = proactive.changed ? rawQuery : undefined;

    // Reuse a fresh live-typing exact search cache to avoid repeating Stage 0's HTTP fetch
    if (initialQuery === rawQuery) {
      const exactCached = readLru(this.cache, `${rawQuery}|${request.filter}|1|true`);
      if (exactCached) {
        if (!this.emptyExactKeys.has(`${rawQuery}|${request.filter}`)) {
          return cacheAndReturn(exactCached);
        }
        tried.add(`w|${initialQuery}`);
      }
    }

    const firstPass = await runAttempt(initialQuery, 'w');
    if (firstPass && firstPass.rawCount > 0) {
      return cacheAndReturn({
        items: firstPass.items,
        page: firstPass.lastPage,
        hasMore: firstPass.hasMore,
        effectiveQuery: initialQuery,
        correctedFrom: proactiveCorrectedFrom,
        recoveryMode: proactiveCorrectedFrom ? 'typo' : undefined,
        suggestions: [],
      });
    }

    // Stages 1–4 strictly share a 3-attempt fallback budget
    let fallbackBudget = 3;
    const suggestion = analyzeArabicQuery(initialQuery);
    const wordCount = initialQuery.split(/\s+/).filter(Boolean).length;
    const shouldRunStage1 =
      suggestion.changed &&
      suggestion.correctedQuery !== initialQuery &&
      (wordCount < 3 || suggestion.changedWordCount <= 1 || suggestion.maxEditCost <= 0.55);

    // Stage 1: Weighted Arabic spell-correction (smart-routed for multi-word confidence)
    if (fallbackBudget > 0 && shouldRunStage1) {
      const spellPass = await runAttempt(suggestion.correctedQuery, 'w');
      if (spellPass !== null) fallbackBudget -= 1;
      if (spellPass && spellPass.rawCount > 0) {
        return cacheAndReturn({
          items: spellPass.items,
          page: spellPass.lastPage,
          hasMore: spellPass.hasMore,
          effectiveQuery: suggestion.correctedQuery,
          correctedFrom: rawQuery,
          recoveryMode: 'typo',
          suggestions: suggestion.alternatives.filter(
            (alt) => alt !== suggestion.correctedQuery,
          ),
        });
      }

      const alt2 = suggestion.alternatives.find(
        (alt) => alt !== suggestion.correctedQuery && alt !== initialQuery,
      );
      if (wordCount === 1 && fallbackBudget > 0 && alt2) {
        const altPass = await runAttempt(alt2, 'w');
        if (altPass !== null) fallbackBudget -= 1;
        if (altPass && altPass.rawCount > 0) {
          return cacheAndReturn({
            items: altPass.items,
            page: altPass.lastPage,
            hasMore: altPass.hasMore,
            effectiveQuery: alt2,
            correctedFrom: rawQuery,
            recoveryMode: 'typo',
            suggestions: suggestion.alternatives.filter((alt) => alt !== alt2),
          });
        }
      }
    }

    // Stage 2: Conversational filler stripping (always from initialQuery so failed
    // Stage 1 guesses never leak into relaxed stages)
    const stripped = stripQueryFillers(initialQuery);
    if (fallbackBudget > 0 && stripped && stripped !== initialQuery) {
      const strippedPass = await runAttempt(stripped, 'w');
      if (strippedPass !== null) fallbackBudget -= 1;
      if (strippedPass && strippedPass.rawCount > 0) {
        return cacheAndReturn({
          items: strippedPass.items,
          page: strippedPass.lastPage,
          hasMore: strippedPass.hasMore,
          effectiveQuery: stripped,
          correctedFrom: rawQuery,
          recoveryMode: 'relaxed',
          suggestions: suggestion.alternatives.filter((alt) => alt !== stripped),
        });
      }
    }

    // Stage 3: Relaxed any-word (st=a) + local fuzzy/proximity re-ranker
    const baseForRelaxed =
      stripped && stripped !== initialQuery ? stripped : initialQuery;
    const relaxedQuery = buildRelaxedSurfaceQuery(baseForRelaxed);
    if (fallbackBudget > 0 && relaxedQuery) {
      const relaxedPass = await runAttempt(relaxedQuery, 'a', 1);
      if (relaxedPass !== null) fallbackBudget -= 1;
      if (relaxedPass && relaxedPass.items.length > 0) {
        const reranked = rerankRelaxedResults(relaxedPass.items, rawQuery);
        if (reranked.items.length > 0) {
          const effectiveQuery = reranked.recoveredQuery || relaxedQuery;
          return cacheAndReturn({
            items: reranked.items,
            page: 1,
            hasMore: false,
            effectiveQuery,
            correctedFrom: rawQuery,
            recoveryMode: reranked.recoveredQuery ? 'typo' : 'relaxed',
            suggestions: suggestion.alternatives.filter((alt) => alt !== effectiveQuery),
          });
        }
      }
    }

    // Stage 4: Curated modern-to-classical Hadith concept mapping
    const concepts = findConceptExpansions(initialQuery);
    if (fallbackBudget > 0 && concepts.length > 0) {
      const conceptPass = await runAttempt(concepts[0], 'w');
      if (conceptPass !== null) fallbackBudget -= 1;
      if (conceptPass && conceptPass.rawCount > 0) {
        return cacheAndReturn({
          items: conceptPass.items,
          page: conceptPass.lastPage,
          hasMore: conceptPass.hasMore,
          effectiveQuery: concepts[0],
          correctedFrom: rawQuery,
          recoveryMode: 'concept',
          suggestions: concepts.slice(1),
        });
      }
    }

    const combinedSuggestions = Array.from(
      new Set([...suggestion.alternatives, ...concepts]),
    )
      .filter((s) => s !== rawQuery)
      .slice(0, 3);

    return cacheAndReturn({
      items: [],
      page: 1,
      hasMore: false,
      effectiveQuery: rawQuery,
      suggestions: combinedSuggestions,
    });
  }

  async fetchOsoul(dorarId: string, signal?: AbortSignal): Promise<OsoulEntry[]> {
    if (!isValidDorarId(dorarId)) return [];
    throwIfAborted(signal);
    const cached = readLru(this.osoulCache, dorarId);
    if (cached) return cached;

    const url = `${this.webBase}/h/${encodeURIComponent(dorarId)}/osoul`;
    const html = await this.fetcher(url, signal);
    throwIfAborted(signal);
    const entries = parseDorarOsoulHtml(html);
    writeLru(this.osoulCache, dorarId, entries, DETAIL_CACHE_MAX_ENTRIES);
    return entries;
  }

  async fetchAltSahih(dorarId: string, signal?: AbortSignal): Promise<HadithResult[]> {
    if (!isValidDorarId(dorarId)) return [];
    throwIfAborted(signal);
    const cacheKey = `alt:${dorarId}`;
    const cached = readLru(this.relatedCache, cacheKey);
    if (cached) return cached;

    const url = `${this.webBase}/h/${encodeURIComponent(dorarId)}?alts=1`;
    const html = await this.fetcher(url, signal);
    throwIfAborted(signal);
    const items = groupDuplicateHadiths(parseDorarRelatedHadithsHtml(html)).map(
      (g) => g.primary,
    );
    writeLru(this.relatedCache, cacheKey, items, DETAIL_CACHE_MAX_ENTRIES);
    return items;
  }

  async fetchSimilar(dorarId: string, signal?: AbortSignal): Promise<HadithResult[]> {
    if (!isValidDorarId(dorarId)) return [];
    throwIfAborted(signal);
    const cacheKey = `sim:${dorarId}`;
    const cached = readLru(this.relatedCache, cacheKey);
    if (cached) return cached;

    const url = `${this.webBase}/h/${encodeURIComponent(dorarId)}?sims=1`;
    const html = await this.fetcher(url, signal);
    throwIfAborted(signal);
    const grouped = groupDuplicateHadiths(parseDorarRelatedHadithsHtml(html))
      .map((g) => g.primary)
      .sort((a, b) => RELATED_ORDER[b.gradeBucket] - RELATED_ORDER[a.gradeBucket]);
    writeLru(this.relatedCache, cacheKey, grouped, DETAIL_CACHE_MAX_ENTRIES);
    return grouped;
  }
}
