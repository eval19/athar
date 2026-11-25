import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Info, Loader2 } from 'lucide-react';
import {
  getSettingsUpdate,
  getVisibleLandingUpdate,
  type UpdateStorageState,
} from './domain/appUpdate';
import {
  markGradeHintDiscovered,
  recordGradeHintShown,
  shouldShowGradeHint,
} from './domain/gradeHint';
import { groupDuplicateHadiths } from './domain/groupHadiths';
import type {
  HadithResult,
  Locale,
  ReadingScale,
  ThemePreference,
} from './domain/hadith';
import {
  createScrollHeaderState,
  HEADER_DEFAULT_HIDE_AFTER_Y,
  type ScrollHeaderState,
  stepScrollHeader,
} from './domain/scrollHeader';
import { useHadithSearch } from './hooks/useHadithSearch';
import { getStrings } from './i18n/strings';
import {
  DEFAULT_DESKTOP_STATE,
  type DesktopState,
  getDesktopState,
  hideDesktopWindow,
  isTauriDesktop,
  listenDesktopState,
  listenFocusSearch,
  setDesktopAutostart,
  setDesktopPinned,
  setDesktopShortcut,
} from './services/desktopBridge';
import { syncNativeSystemBars } from './services/nativeChrome';
import {
  applyLocaleToDocument,
  applyThemeToDocument,
  loadGradeHintState,
  loadLocale,
  loadReadingScale,
  loadThemePreference,
  loadUpdateState,
  saveGradeHintState,
  saveLocale,
  saveReadingScale,
  saveThemePreference,
  STORAGE_KEYS,
} from './services/preferences';
import { copyHadithText, shareHadithText } from './services/shareCopy';
import {
  APP_VERSION,
  checkForAppUpdate,
  dismissLandingUpdate,
} from './services/updateChecker';
import { DesktopChromeBar } from './components/DesktopChromeBar';
import { FilterPills } from './components/FilterPills';
import { HadithCard } from './components/HadithCard';
import { Header } from './components/Header';
import { InfoDialog, type ManualUpdateStatus } from './components/InfoDialog';
import {
  EmptyResults,
  ErrorState,
  InitialWelcome,
  ResultsSkeleton,
} from './components/ResultStates';
import { SearchBar } from './components/SearchBar';

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => loadLocale());
  const [themePref, setThemePref] = useState<ThemePreference>(() => loadThemePreference());
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  );
  const [readingScale, setReadingScale] = useState<ReadingScale>(() => loadReadingScale());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showGradeHint, setShowGradeHint] = useState(false);
  const sessionHintCheckedRef = useRef(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [pageScrolled, setPageScrolled] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(64);
  const headerWrapRef = useRef<HTMLDivElement | null>(null);
  const headerHeightRef = useRef(64);
  const scrollHeaderRef = useRef<ScrollHeaderState>(createScrollHeaderState(0));
  const [updateState, setUpdateState] = useState<UpdateStorageState>(() => loadUpdateState());
  const [manualUpdateStatus, setManualUpdateStatus] = useState<ManualUpdateStatus>('idle');
  const isDesktop = isTauriDesktop();
  const [desktopState, setDesktopState] = useState<DesktopState>(DEFAULT_DESKTOP_STATE);
  const [desktopShortcutError, setDesktopShortcutError] = useState(false);
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);

  const landingUpdate = useMemo(
    () => getVisibleLandingUpdate(updateState, APP_VERSION),
    [updateState],
  );
  const settingsUpdate = useMemo(
    () => getSettingsUpdate(updateState, APP_VERSION),
    [updateState],
  );

  // Quiet background stable-release check (at most once per 24h, after initial paint)
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void checkForAppUpdate().then((outcome) => {
        if (active) setUpdateState(outcome.state);
      });
    }, 1500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const handleDismissUpdate = useCallback((version: string) => {
    setUpdateState(dismissLandingUpdate(version));
  }, []);

  const handleManualUpdateCheck = useCallback(() => {
    setManualUpdateStatus('checking');
    void checkForAppUpdate({ force: true }).then((outcome) => {
      setUpdateState(outcome.state);
      if (outcome.status === 'update-available') {
        setManualUpdateStatus('idle');
      } else if (outcome.status === 'up-to-date') {
        setManualUpdateStatus('up-to-date');
      } else if (outcome.status === 'error') {
        setManualUpdateStatus('error');
      }
    });
  }, []);

  const revealHeader = useCallback(() => {
    scrollHeaderRef.current = createScrollHeaderState(
      typeof window !== 'undefined' ? window.scrollY : 0,
    );
    setHeaderHidden(false);
  }, []);

  const search = useHadithSearch();
  const strings = useMemo(() => getStrings(locale), [locale]);
  const groupedItems = useMemo(
    () => groupDuplicateHadiths(search.items),
    [search.items],
  );

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2200);
  }, []);

  useEffect(() => {
    applyLocaleToDocument(locale);
    saveLocale(locale);
  }, [locale]);

  useEffect(() => {
    const resolved = applyThemeToDocument(themePref);
    void syncNativeSystemBars(resolved);
  }, [themePref, systemScheme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = (event: MediaQueryListEvent) =>
      setSystemScheme(event.matches ? 'dark' : 'light');
    media.addEventListener('change', onMediaChange);

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.colorScheme) setThemePref(loadThemePreference());
      if (event.key === STORAGE_KEYS.locale) setLocale(loadLocale());
    };
    window.addEventListener('storage', onStorage);

    return () => {
      media.removeEventListener('change', onMediaChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const { inputValue, setInputValue } = search;

  useEffect(() => {
    if (!isDesktop) return;
    document.documentElement.setAttribute('data-platform', 'desktop');
    let active = true;
    void getDesktopState().then((st) => {
      if (active) setDesktopState(st);
    });

    const unlistenState = listenDesktopState((st) => {
      if (active) setDesktopState(st);
    });
    const unlistenFocus = listenFocusSearch(() => {
      if (!active) return;
      revealHeader();
      setSearchFocusSignal((n) => n + 1);
    });

    return () => {
      active = false;
      document.documentElement.removeAttribute('data-platform');
      void unlistenState.then((fn) => fn());
      void unlistenFocus.then((fn) => fn());
    };
  }, [isDesktop, revealHeader]);

  useEffect(() => {
    if (!isDesktop) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || settingsOpen) return;
      event.preventDefault();
      if (inputValue.trim().length > 0) {
        setInputValue('');
      } else {
        void hideDesktopWindow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDesktop, settingsOpen, inputValue, setInputValue]);

  const handleToggleDesktopPin = useCallback(() => {
    void setDesktopPinned(!desktopState.pinned).then(setDesktopState);
  }, [desktopState.pinned]);

  const handleDesktopShortcutChange = useCallback((shortcut: string, enabled: boolean) => {
    setDesktopShortcutError(false);
    void setDesktopShortcut(shortcut, enabled)
      .then((next) => setDesktopState(next))
      .catch(() => setDesktopShortcutError(true));
  }, []);

  const handleDesktopAutostartChange = useCallback((enabled: boolean) => {
    void setDesktopAutostart(enabled)
      .then((next) => setDesktopState(next))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapacitorApp.addListener('backButton', () => {
      if (settingsOpen) {
        setSettingsOpen(false);
      } else if (inputValue.trim().length > 0) {
        setInputValue('');
      } else {
        void CapacitorApp.exitApp();
      }
    });
    return () => {
      void listener.then((h) => h.remove());
    };
  }, [settingsOpen, inputValue, setInputValue]);

  const handleCopy = useCallback(
    async (hadith: HadithResult) => {
      await copyHadithText(hadith, locale);
      showToast(strings.copied);
    },
    [locale, showToast, strings.copied],
  );

  const handleShare = useCallback(
    async (hadith: HadithResult) => {
      try {
        const outcome = await shareHadithText(hadith, locale);
        if (outcome === 'copied') showToast(strings.sharedCopiedFallback);
      } catch {
        // User dismissed native share sheet
      }
    },
    [locale, showToast, strings.sharedCopiedFallback],
  );

  // Show the contextual grade-badge hint on the first result card once per 3-day cadence until discovered
  useEffect(() => {
    if (
      sessionHintCheckedRef.current ||
      search.isLoading ||
      search.hasError ||
      groupedItems.length === 0
    ) {
      return;
    }
    sessionHintCheckedRef.current = true;
    const state = loadGradeHintState();
    const now = Date.now();
    if (shouldShowGradeHint(state, now)) {
      saveGradeHintState(recordGradeHintShown(state, now));
      setShowGradeHint(true);
    }
  }, [search.isLoading, search.hasError, groupedItems.length]);

  const handleGradeBadgeOpened = useCallback(() => {
    const current = loadGradeHintState();
    if (!current.discovered) {
      saveGradeHintState(markGradeHintDiscovered(current));
    }
    setShowGradeHint(false);
  }, []);

  const handleDismissGradeHint = useCallback(() => {
    setShowGradeHint(false);
  }, []);

  useLayoutEffect(() => {
    const el = headerWrapRef.current;
    if (!el) return;

    const updateHeight = () => {
      const nextHeight = Math.ceil(el.getBoundingClientRect().height);
      if (nextHeight > 0) {
        headerHeightRef.current = nextHeight;
        setHeaderHeight(nextHeight);
      }
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (settingsOpen) {
      revealHeader();
      return;
    }

    let rafId = 0;

    const handleScroll = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        if (isDesktop) {
          setHeaderHidden(false);
          setPageScrolled(window.scrollY > 4);
          return;
        }
        const next = stepScrollHeader(scrollHeaderRef.current, {
          scrollY: window.scrollY,
          viewportHeight: window.innerHeight,
          documentHeight: document.documentElement.scrollHeight,
          hideAfterY: Math.max(headerHeightRef.current, HEADER_DEFAULT_HIDE_AFTER_Y),
        });
        scrollHeaderRef.current = next;
        setHeaderHidden(next.hidden);
        setPageScrolled(window.scrollY > 12);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
    };
  }, [isDesktop, settingsOpen, revealHeader]);

  useLayoutEffect(() => {
    if (!search.scrollCommand) return;
    const { top, behavior } = search.scrollCommand;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const effectiveBehavior: ScrollBehavior =
      behavior === 'smooth' && !prefersReducedMotion ? 'smooth' : 'auto';

    const syncChromeToScroll = () => {
      const actualY = window.scrollY;
      scrollHeaderRef.current = createScrollHeaderState(actualY);
      setHeaderHidden(false);
      setPageScrolled(actualY > 12);
    };

    window.scrollTo({ top, behavior: effectiveBehavior });

    if (effectiveBehavior === 'auto') {
      syncChromeToScroll();
      if (top > 0 && window.scrollY < top - 24) {
        const rafId = window.requestAnimationFrame(() => {
          window.scrollTo({ top, behavior: 'auto' });
          syncChromeToScroll();
        });
        return () => window.cancelAnimationFrame(rafId);
      }
    } else if (top === 0) {
      revealHeader();
    }
  }, [search.scrollCommand, revealHeader]);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <div
        className={`top-chrome-shell sticky top-0 z-20${
          pageScrolled ? ' top-chrome-scrolled' : ''
        }${headerHidden ? ' top-chrome-collapsed' : ''}`}
        style={{ '--header-collapse-y': `${headerHeight}px` } as CSSProperties}
      >
        {isDesktop && (
          <DesktopChromeBar
            pinned={desktopState.pinned}
            shortcut={desktopState.shortcut}
            shortcutEnabled={desktopState.shortcutEnabled}
            onTogglePin={handleToggleDesktopPin}
            onHide={() => void hideDesktopWindow()}
            strings={strings}
          />
        )}
        <div ref={headerWrapRef} className="top-header-cap" onFocusCapture={revealHeader}>
          <Header
            locale={locale}
            strings={strings}
            onToggleLocale={() => setLocale((prev) => (prev === 'ar' ? 'en' : 'ar'))}
            onOpenSettings={() => setSettingsOpen(true)}
            onResetHome={() => {
              revealHeader();
              search.resetHome();
            }}
          />
        </div>

        <div className="top-dock-cap">
          <div className="safe-px mx-auto max-w-2xl space-y-2 pb-2 pt-1.5">
            <SearchBar
              value={search.inputValue}
              onChange={search.setInputValue}
              onSubmit={search.submitSearch}
              onClear={() => search.setInputValue('')}
              isLoading={search.isLoading}
              focusSignal={searchFocusSignal}
              strings={strings}
            />
            <FilterPills value={search.filter} onChange={search.setFilter} strings={strings} />
          </div>
        </div>
      </div>

      <main className="safe-px safe-pb mx-auto max-w-2xl pt-2">
        {search.correctedFrom && !search.isLoading && search.items.length > 0 && (
          <div
            role="status"
            className="mb-3.5 rounded-2xl bg-brand-soft px-4 py-3 text-xs text-ink"
          >
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-medium leading-relaxed">
                  {search.recoveryMode === 'concept'
                    ? strings.conceptBanner(search.effectiveQuery, search.correctedFrom)
                    : search.recoveryMode === 'relaxed'
                      ? strings.relaxedBanner(search.effectiveQuery, search.correctedFrom)
                      : strings.correctedBanner(search.effectiveQuery, search.correctedFrom)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => search.searchExact(search.correctedFrom!)}
                    className="hadith-sheet inline-flex min-h-9 items-center rounded-full bg-surface px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-elevated active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {strings.searchExactInstead(search.correctedFrom)}
                  </button>
                  {search.suggestions.map((alt) => (
                    <button
                      key={alt}
                      type="button"
                      dir="rtl"
                      lang="ar"
                      onClick={() => search.selectQuery(alt)}
                      className="hadith-sheet inline-flex min-h-9 items-center rounded-full bg-surface px-3.5 py-1.5 text-xs font-semibold text-brand transition-opacity hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {!search.hasSearched && !search.isLoading && (
          <InitialWelcome
            recentSearches={search.recentSearches}
            availableUpdate={landingUpdate}
            onSelectQuery={search.selectQuery}
            onRemoveRecent={search.removeRecent}
            onClearRecent={search.clearRecent}
            onDismissUpdate={handleDismissUpdate}
            strings={strings}
          />
        )}

        {search.isLoading && <ResultsSkeleton />}

        {!search.isLoading && search.hasError && (
          <ErrorState onRetry={search.retry} strings={strings} />
        )}

        {!search.isLoading && !search.hasError && search.hasSearched && search.items.length === 0 && (
          <EmptyResults
            suggestions={search.suggestions}
            onSelectQuery={search.selectQuery}
            strings={strings}
          />
        )}

        {!search.isLoading && !search.hasError && groupedItems.length > 0 && (
          <section aria-label={strings.resultsCount(groupedItems.length, search.hasMore)}>
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-xs font-medium tabular-nums text-faint">
                {strings.resultsCount(groupedItems.length, search.hasMore)}
              </p>
              <p className="text-[0.7rem] text-faint" dir="rtl" lang="ar">
                الدرر السنية
              </p>
            </div>

            <div className="space-y-3.5">
              {groupedItems.map((group, idx) => (
                <HadithCard
                  key={group.primary.id}
                  hadith={group.primary}
                  others={group.others}
                  highlightQuery={search.effectiveQuery || search.activeQuery}
                  readingScale={readingScale}
                  deferred={idx >= 3}
                  showGradeHint={idx === 0 && showGradeHint}
                  strings={strings}
                  onCopy={handleCopy}
                  onShare={handleShare}
                  onGradeBadgeOpened={handleGradeBadgeOpened}
                  onDismissGradeHint={handleDismissGradeHint}
                  onFetchOsoul={search.fetchOsoul}
                  onFetchAltSahih={search.fetchAltSahih}
                  onFetchSimilar={search.fetchSimilar}
                />
              ))}
            </div>

            <div className="mt-6 flex justify-center">
              {search.hasMore ? (
                <button
                  type="button"
                  onClick={search.loadMore}
                  disabled={search.isLoadingMore}
                  className="hadith-sheet inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-surface px-6 text-sm font-semibold text-ink transition-colors hover:bg-elevated active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {search.isLoadingMore && (
                    <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
                  )}
                  <span>{search.isLoadingMore ? strings.loadingMore : strings.loadMore}</span>
                </button>
              ) : (
                <p className="py-2 text-xs text-faint">{strings.endOfResults}</p>
              )}
            </div>
          </section>
        )}
      </main>

      <InfoDialog
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setManualUpdateStatus('idle');
        }}
        locale={locale}
        onLocaleChange={setLocale}
        themePref={themePref}
        systemScheme={systemScheme}
        onThemeChange={(pref) => {
          setThemePref(pref);
          saveThemePreference(pref);
        }}
        readingScale={readingScale}
        onReadingScaleChange={(scale) => {
          setReadingScale(scale);
          saveReadingScale(scale);
        }}
        availableUpdate={settingsUpdate}
        updateCheckStatus={manualUpdateStatus}
        onCheckForUpdates={handleManualUpdateCheck}
        desktop={
          isDesktop
            ? {
                state: desktopState,
                shortcutError: desktopShortcutError,
                onShortcutChange: handleDesktopShortcutChange,
                onAutostartChange: handleDesktopAutostartChange,
              }
            : undefined
        }
        strings={strings}
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.25rem)' }}
        >
          <div className="toast-reveal rounded-full bg-ink px-4 py-2 text-xs font-semibold text-canvas shadow-md">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}
