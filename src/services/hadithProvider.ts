import type {
  HadithResult,
  OsoulEntry,
  SearchRequest,
  SearchResponse,
} from '../domain/hadith';

/**
 * Clean abstraction for Hadith data sources.
 * v1 uses DorarProvider (Al-Dorar Hadith Encyclopedia).
 * v2 can implement MajorBooksProvider (with full Sanad ON/OFF) alongside it.
 */
export interface HadithProvider {
  readonly id: string;
  search(request: SearchRequest): Promise<SearchResponse>;
  fetchOsoul?(dorarId: string, signal?: AbortSignal): Promise<OsoulEntry[]>;
  fetchAltSahih?(dorarId: string, signal?: AbortSignal): Promise<HadithResult[]>;
  fetchSimilar?(dorarId: string, signal?: AbortSignal): Promise<HadithResult[]>;
}
