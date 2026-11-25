import type { FilterMode, HadithResult, RecoveryMode } from './hadith';

export interface FilterTabSnapshot {
  items: HadithResult[];
  page: number;
  hasMore: boolean;
  effectiveQuery: string;
  correctedFrom?: string;
  recoveryMode?: RecoveryMode;
  suggestions: string[];
  scrollY: number;
}

export interface TabSessionStore {
  queryKey: string;
  tabs: Partial<Record<FilterMode, FilterTabSnapshot>>;
}

export function normalizeTabQueryKey(query: string): string {
  return query.trim();
}

export function createTabSession(query = ''): TabSessionStore {
  return {
    queryKey: normalizeTabQueryKey(query),
    tabs: {},
  };
}

export function saveTabSnapshot(
  store: TabSessionStore,
  query: string,
  filter: FilterMode,
  snapshot: FilterTabSnapshot,
): TabSessionStore {
  const key = normalizeTabQueryKey(query);
  if (key.length < 2) return store;

  const baseTabs = store.queryKey === key ? store.tabs : {};
  return {
    queryKey: key,
    tabs: {
      ...baseTabs,
      [filter]: {
        ...snapshot,
        scrollY: Math.max(0, Math.round(snapshot.scrollY)),
      },
    },
  };
}

export function getTabSnapshot(
  store: TabSessionStore,
  query: string,
  filter: FilterMode,
): FilterTabSnapshot | null {
  const key = normalizeTabQueryKey(query);
  if (key.length < 2 || store.queryKey !== key) return null;
  return store.tabs[filter] ?? null;
}

export function resetTabScroll(
  store: TabSessionStore,
  filter: FilterMode,
): TabSessionStore {
  const existing = store.tabs[filter];
  if (!existing || existing.scrollY === 0) return store;
  return {
    ...store,
    tabs: {
      ...store.tabs,
      [filter]: {
        ...existing,
        scrollY: 0,
      },
    },
  };
}
