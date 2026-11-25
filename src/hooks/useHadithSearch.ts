import { useCallback, useEffect, useRef, useState } from 'react';
import type { FilterMode, HadithResult, RecoveryMode } from '../domain/hadith';
import { clearLearnedWords } from '../domain/learnedVocab';
import { DorarProvider } from '../services/dorarClient';
import {
  clearRecentSearches,
  loadRecentSearches,
  pushRecentSearch,
  removeRecentSearch,
} from '../services/preferences';

const provider = new DorarProvider();

export function useHadithSearch() {
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [inputValue, setInputValue] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [effectiveQuery, setEffectiveQuery] = useState('');
  const [correctedFrom, setCorrectedFrom] = useState<string | undefined>(undefined);
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');

  const [items, setItems] = useState<HadithResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const filterRef = useRef<FilterMode>(filter);
  const inputRef = useRef(inputValue);
  const skipNextDebounceRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const idleRecoveryTimerRef = useRef<number | null>(null);
  const runSearchRef = useRef<
    (
      queryText: string,
      filterMode: FilterMode,
      pageNum: number,
      options?: { append?: boolean; forceExact?: boolean; liveExact?: boolean },
    ) => Promise<void>
  >(async () => undefined);

  filterRef.current = filter;
  inputRef.current = inputValue;

  const clearPendingTimers = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (idleRecoveryTimerRef.current !== null) {
      window.clearTimeout(idleRecoveryTimerRef.current);
      idleRecoveryTimerRef.current = null;
    }
  }, []);

  const resetResults = useCallback(() => {
    clearPendingTimers();
    abortRef.current?.abort();
    setActiveQuery('');
    setEffectiveQuery('');
    setCorrectedFrom(undefined);
    setRecoveryMode(undefined);
    setSuggestions([]);
    setItems([]);
    setHasMore(false);
    setHasError(false);
    setIsLoading(false);
    setIsLoadingMore(false);
  }, [clearPendingTimers]);

  const executeSearch = useCallback(
    async (
      queryText: string,
      filterMode: FilterMode,
      pageNum: number,
      options: { append?: boolean; forceExact?: boolean; liveExact?: boolean } = {},
    ) => {
      clearPendingTimers();
      const trimmed = queryText.trim();
      if (trimmed.length < 2) {
        resetResults();
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++requestSeqRef.current;

      setHasError(false);
      if (options.append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setActiveQuery(trimmed);
      }

      let deferLoadingClear = false;

      try {
        const res = await provider.search({
          query: trimmed,
          filter: filterMode,
          page: pageNum,
          forceExact: options.forceExact || options.liveExact,
          signal: controller.signal,
        });

        if (seq !== requestSeqRef.current) return;

        // While typing, keep exact misses calm without flashing an empty screen or
        // rewriting mid-word (e.g. الصلا -> الصلة); upgrade to full recovery once idle.
        if (!options.append && options.liveExact && res.items.length === 0) {
          deferLoadingClear = true;
          idleRecoveryTimerRef.current = window.setTimeout(() => {
            idleRecoveryTimerRef.current = null;
            void runSearchRef.current(trimmed, filterMode, 1);
          }, 650);
          return;
        }

        if (options.append) {
          setItems((prev) => {
            const seen = new Set(prev.map((item) => item.id));
            return [...prev, ...res.items.filter((item) => !seen.has(item.id))];
          });
        } else {
          setItems(res.items);
          setEffectiveQuery(res.effectiveQuery);
          setCorrectedFrom(res.correctedFrom);
          setRecoveryMode(res.recoveryMode);
          setSuggestions(res.suggestions);
          if (res.items.length > 0) {
            setRecentSearches((prev) => pushRecentSearch(prev, res.effectiveQuery));
          }
        }

        setPage(res.page);
        setHasMore(res.hasMore);
      } catch (err) {
        if (controller.signal.aborted || seq !== requestSeqRef.current) return;
        if (import.meta.env.DEV) {
          console.error('Search error:', err);
        }
        if (!options.append) {
          setItems([]);
          setHasMore(false);
          setHasError(true);
        }
      } finally {
        if (seq === requestSeqRef.current) {
          if (!deferLoadingClear) {
            setIsLoading(false);
          }
          setIsLoadingMore(false);
        }
      }
    },
    [clearPendingTimers, resetResults],
  );

  runSearchRef.current = executeSearch;

  // Live typing uses calm exact-only debounce (420ms); full recovery fires on submit or +650ms idle.
  useEffect(() => {
    clearPendingTimers();
    const trimmed = inputValue.trim();
    if (trimmed.length === 0) {
      resetResults();
      return;
    }
    if (trimmed.length < 2) {
      setIsLoading(false);
      return;
    }

    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void executeSearch(trimmed, filterRef.current, 1, { liveExact: true });
    }, 420);

    return () => clearPendingTimers();
  }, [inputValue, executeSearch, resetResults, clearPendingTimers]);

  const handleSetFilter = useCallback(
    (nextFilter: FilterMode) => {
      if (nextFilter === filterRef.current) return;
      filterRef.current = nextFilter;
      setFilter(nextFilter);
      const trimmed = inputRef.current.trim();
      if (trimmed.length >= 2) {
        void executeSearch(trimmed, nextFilter, 1);
      }
    },
    [executeSearch],
  );

  const submitSearch = useCallback(
    (value: string) => {
      void executeSearch(value, filterRef.current, 1);
    },
    [executeSearch],
  );

  const selectQuery = useCallback(
    (query: string) => {
      if (query !== inputRef.current) {
        skipNextDebounceRef.current = true;
      }
      setInputValue(query);
      void executeSearch(query, filterRef.current, 1);
    },
    [executeSearch],
  );

  const searchExact = useCallback(
    (original: string) => {
      if (original !== inputRef.current) {
        skipNextDebounceRef.current = true;
      }
      setInputValue(original);
      void executeSearch(original, filterRef.current, 1, { forceExact: true });
    },
    [executeSearch],
  );

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || !effectiveQuery) return;
    void executeSearch(effectiveQuery, filterRef.current, page + 1, {
      append: true,
      forceExact: true,
    });
  }, [isLoadingMore, hasMore, effectiveQuery, executeSearch, page]);

  const removeRecent = useCallback((term: string) => {
    setRecentSearches((prev) => removeRecentSearch(prev, term));
  }, []);

  const clearRecent = useCallback(() => {
    clearLearnedWords();
    setRecentSearches(clearRecentSearches());
  }, []);

  const resetHome = useCallback(() => {
    setInputValue('');
    setFilter('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const fetchOsoul = useCallback(
    (dorarId: string) => provider.fetchOsoul(dorarId),
    [],
  );

  const fetchAltSahih = useCallback(
    (dorarId: string) => provider.fetchAltSahih(dorarId),
    [],
  );

  const fetchSimilar = useCallback(
    (dorarId: string) => provider.fetchSimilar(dorarId),
    [],
  );

  return {
    inputValue,
    setInputValue,
    activeQuery,
    effectiveQuery,
    correctedFrom,
    recoveryMode,
    suggestions,
    filter,
    setFilter: handleSetFilter,
    items,
    hasMore,
    isLoading,
    isLoadingMore,
    hasError,
    recentSearches,
    hasSearched: activeQuery.length >= 2,
    submitSearch,
    selectQuery,
    searchExact,
    loadMore,
    retry: () => void executeSearch(inputValue, filter, 1),
    removeRecent,
    clearRecent,
    resetHome,
    fetchOsoul,
    fetchAltSahih,
    fetchSimilar,
  };
}
