export type GradeBucket =
  | 'sahih'
  | 'sahih_isnad'
  | 'hasan'
  | 'hasan_isnad'
  | 'daif_isnad'
  | 'daif'
  | 'very_weak'
  | 'munkar'
  | 'mawdu'
  | 'batil'
  | 'unknown';

export type FilterMode = 'all' | 'sahih' | 'hasan' | 'weak';

export type Locale = 'ar' | 'en';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ReadingScale = 'sm' | 'md' | 'lg';

export interface HadithResult {
  id: string;
  text: string;
  narrator: string;
  muhaddith: string;
  source: string;
  pageOrNumber: string;
  rawGrade: string;
  gradeBucket: GradeBucket;
  takhrij?: string;
  dorarId?: string;
  hasOsoul?: boolean;
  hasAltSahih?: boolean;
  hasSimilar?: boolean;
}

export interface OsoulEntry {
  sourceRef: string;
  sanad: string;
  matn: string;
}

export interface GroupedHadith {
  primary: HadithResult;
  others: HadithResult[];
}

export interface SearchRequest {
  query: string;
  filter: FilterMode;
  page: number;
  forceExact?: boolean;
  signal?: AbortSignal;
}

export type RecoveryMode = 'typo' | 'relaxed' | 'concept';

export interface SearchResponse {
  items: HadithResult[];
  page: number;
  hasMore: boolean;
  effectiveQuery: string;
  correctedFrom?: string;
  recoveryMode?: RecoveryMode;
  suggestions: string[];
}
