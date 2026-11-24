import {
  parseUpdateStorageState,
  type UpdateStorageState,
} from '../domain/appUpdate';
import {
  type GradeHintState,
  parseGradeHintState,
} from '../domain/gradeHint';
import type { Locale, ReadingScale, ThemePreference } from '../domain/hadith';

export const STORAGE_KEYS = {
  colorScheme: 'athar:color-scheme',
  locale: 'athar:locale',
  readingScale: 'athar:reading-scale',
  recentSearches: 'athar:recent-searches',
  gradeHint: 'athar:grade-hint',
  learnedWords: 'athar:learned-words',
  updateState: 'athar:update-state',
} as const;

const MAX_RECENT = 6;

function safeGet(key: string): string | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable; continue cleanly in-memory
  }
}

function safeRemove(key: string): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

export function loadThemePreference(): ThemePreference {
  const saved = safeGet(STORAGE_KEYS.colorScheme);
  if (saved === 'light' || saved === 'dark') return saved;
  return 'system';
}

export function saveThemePreference(pref: ThemePreference): void {
  if (pref === 'system') {
    safeRemove(STORAGE_KEYS.colorScheme);
  } else {
    safeSet(STORAGE_KEYS.colorScheme, pref);
  }
}

export function applyThemeToDocument(pref: ThemePreference): 'light' | 'dark' {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = pref === 'system' ? 'light dark' : pref;
  }

  if (pref === 'system') {
    document.documentElement.removeAttribute('data-theme');
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', pref);
  return pref;
}

export function loadLocale(): Locale {
  const saved = safeGet(STORAGE_KEYS.locale);
  if (saved === 'ar' || saved === 'en') return saved;
  return 'ar';
}

export function saveLocale(locale: Locale): void {
  safeSet(STORAGE_KEYS.locale, locale);
}

export function applyLocaleToDocument(locale: Locale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

export function loadReadingScale(): ReadingScale {
  const saved = safeGet(STORAGE_KEYS.readingScale);
  if (saved === 'sm' || saved === 'md' || saved === 'lg') return saved;
  return 'md';
}

export function saveReadingScale(scale: ReadingScale): void {
  safeSet(STORAGE_KEYS.readingScale, scale);
}

export function loadRecentSearches(): string[] {
  const raw = safeGet(STORAGE_KEYS.recentSearches);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentSearch(current: string[], query: string): string[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return current;
  const next = [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, MAX_RECENT);
  safeSet(STORAGE_KEYS.recentSearches, JSON.stringify(next));
  return next;
}

export function removeRecentSearch(current: string[], query: string): string[] {
  const next = current.filter((item) => item !== query);
  safeSet(STORAGE_KEYS.recentSearches, JSON.stringify(next));
  return next;
}

export function clearRecentSearches(): string[] {
  safeRemove(STORAGE_KEYS.recentSearches);
  return [];
}

export function loadGradeHintState(): GradeHintState {
  return parseGradeHintState(safeGet(STORAGE_KEYS.gradeHint));
}

export function saveGradeHintState(state: GradeHintState): void {
  safeSet(STORAGE_KEYS.gradeHint, JSON.stringify(state));
}

export function loadLearnedWords(): string[] {
  const raw = safeGet(STORAGE_KEYS.learnedWords);
  if (!raw) return [];
  return raw.split(/\s+/).filter((word) => word.length >= 3);
}

export function saveLearnedWords(words: string[]): void {
  if (words.length === 0) {
    safeRemove(STORAGE_KEYS.learnedWords);
    return;
  }
  safeSet(STORAGE_KEYS.learnedWords, words.join(' '));
}

export function loadUpdateState(): UpdateStorageState {
  return parseUpdateStorageState(safeGet(STORAGE_KEYS.updateState));
}

export function saveUpdateState(state: UpdateStorageState): void {
  safeSet(STORAGE_KEYS.updateState, JSON.stringify(state));
}
