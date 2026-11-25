import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookCopy,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  GitBranch,
  Info,
  Layers,
  Loader2,
  Pin,
  PinOff,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { findArabicHighlightSegments, stripDiacritics } from '../domain/arabicNormalize';
import { isUnauthenticBucket } from '../domain/gradeClassifier';
import type {
  GradeBucket,
  HadithResult,
  Locale,
  OsoulEntry,
  ReadingScale,
  ThemePreference,
} from '../domain/hadith';
import { getStrings } from '../i18n/strings';
import {
  getDesktopReaderPayload,
  getDesktopReaderPinned,
  hideDesktopReader,
  listenReaderPayload,
  openDorarHadithExternal,
  type ReaderPayload,
  setDesktopReaderPinned,
  stepDesktopReader,
} from '../services/desktopBridge';
import { DorarProvider } from '../services/dorarClient';
import {
  applyLocaleToDocument,
  applyThemeToDocument,
  loadLocale,
  loadReaderReadingScale,
  loadReaderTashkeel,
  loadThemePreference,
  saveReaderReadingScale,
  saveReaderTashkeel,
  STORAGE_KEYS,
} from '../services/preferences';
import { copyHadithText } from '../services/shareCopy';
import { GradeBadge } from './GradeBadge';

type ReaderTab = 'verdict' | 'others' | 'grade' | 'osoul' | 'alt' | 'similar';

const readerProvider = new DorarProvider();
const SCALES: readonly ReadingScale[] = ['sm', 'md', 'lg'];
const DEFAULT_MATN_RATIO = 60;
const MIN_MATN_RATIO = 30;
const MAX_MATN_RATIO = 80;

function clampMatnRatio(value: number): number {
  return Math.min(MAX_MATN_RATIO, Math.max(MIN_MATN_RATIO, value));
}

const READER_MATN_CLASS: Record<ReadingScale, string> = {
  sm: 'text-[1.4rem] leading-[1.95]',
  md: 'text-[1.72rem] leading-[2]',
  lg: 'text-[2.05rem] leading-[2.05]',
};

const GRADE_ACCENT_VAR: Record<GradeBucket, string> = {
  sahih: 'var(--sahih-ink)',
  sahih_isnad: 'var(--sahih-ink)',
  hasan: 'var(--hasan-ink)',
  hasan_isnad: 'var(--hasan-ink)',
  daif_isnad: 'var(--daif-ink)',
  daif: 'var(--daif-ink)',
  very_weak: 'var(--severe-ink)',
  munkar: 'var(--severe-ink)',
  mawdu: 'var(--mawdu-ink)',
  batil: 'var(--mawdu-ink)',
  unknown: 'var(--unknown-ink)',
};

export function HadithReaderWindow() {
  const [payload, setPayload] = useState<ReaderPayload | null>(null);
  const [locale, setLocale] = useState<Locale>(() => loadLocale());
  const [themePref, setThemePref] = useState<ThemePreference>(() => loadThemePreference());
  const [readingScale, setReadingScale] = useState<ReadingScale>(() => loadReaderReadingScale());
  const [showTashkeel, setShowTashkeel] = useState<boolean>(() => loadReaderTashkeel());
  const [matnRatio, setMatnRatio] = useState<number>(DEFAULT_MATN_RATIO);
  const [pinned, setPinned] = useState(false);
  const [activeTab, setActiveTab] = useState<ReaderTab>('verdict');
  const [justCopied, setJustCopied] = useState(false);

  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState(false);
  const [osoulData, setOsoulData] = useState<OsoulEntry[] | null>(null);
  const [altData, setAltData] = useState<HadithResult[] | null>(null);
  const [similarData, setSimilarData] = useState<HadithResult[] | null>(null);

  const fetchSeqRef = useRef(0);
  const copyTimerRef = useRef<number | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const draggingDividerRef = useRef(false);
  const matnScrollRef = useRef<HTMLElement | null>(null);
  const detailsScrollRef = useRef<HTMLDivElement | null>(null);

  const strings = useMemo(() => getStrings(locale), [locale]);

  const applyIncomingPayload = useCallback((next: ReaderPayload) => {
    fetchSeqRef.current++;
    setPayload(next);
    setLocale(next.locale);
    setThemePref(next.themePref);
    setActiveTab('verdict');
    setPanelLoading(false);
    setPanelError(false);
    setOsoulData(null);
    setAltData(null);
    setSimilarData(null);
    setJustCopied(false);
    matnScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    detailsScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-platform', 'desktop');
    document.documentElement.setAttribute('data-view', 'reader');
    let active = true;

    void getDesktopReaderPayload().then((initial) => {
      if (active && initial) applyIncomingPayload(initial);
    });
    void getDesktopReaderPinned().then((p) => {
      if (active) setPinned(p);
    });

    const unlisten = listenReaderPayload((next) => {
      if (active) applyIncomingPayload(next);
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.colorScheme) setThemePref(loadThemePreference());
      if (event.key === STORAGE_KEYS.locale) setLocale(loadLocale());
      if (event.key === STORAGE_KEYS.readerReadingScale) {
        setReadingScale(loadReaderReadingScale());
      }
      if (event.key === STORAGE_KEYS.readerTashkeel) {
        setShowTashkeel(loadReaderTashkeel());
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      active = false;
      document.documentElement.removeAttribute('data-platform');
      document.documentElement.removeAttribute('data-view');
      window.removeEventListener('storage', onStorage);
      void unlisten.then((fn) => fn());
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, [applyIncomingPayload]);

  useEffect(() => {
    applyLocaleToDocument(locale);
  }, [locale]);

  useEffect(() => {
    applyThemeToDocument(themePref);
  }, [themePref]);

  const hadith = payload?.hadith ?? null;
  const others = useMemo(() => payload?.others ?? [], [payload]);
  const highlightQuery = payload?.highlightQuery ?? '';
  const currentIndex = payload?.currentIndex;
  const totalCount = payload?.totalCount;

  const handleCopy = useCallback(async () => {
    if (!hadith) return;
    await copyHadithText(hadith, locale);
    setJustCopied(true);
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => {
      copyTimerRef.current = null;
      setJustCopied(false);
    }, 1800);
  }, [hadith, locale]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void hideDesktopReader();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        (event.key.toLowerCase() === 'c' || event.code === 'KeyC')
      ) {
        const selected = window.getSelection()?.toString();
        if (!selected || selected.length === 0) {
          event.preventDefault();
          void handleCopy();
        }
        return;
      }

      if (event.ctrlKey || event.metaKey || event.shiftKey) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="separator"]')) {
        return;
      }

      let stepDelta: -1 | 1 | null = null;
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        stepDelta = 1;
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        stepDelta = -1;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const insideTabOrButton = Boolean(
          target?.closest('[role="tablist"], [role="tab"], button'),
        );
        if (!event.altKey && insideTabOrButton) return;
        const isForward = locale === 'ar' ? event.key === 'ArrowLeft' : event.key === 'ArrowRight';
        stepDelta = isForward ? 1 : -1;
      }

      if (
        stepDelta !== null &&
        totalCount !== undefined &&
        totalCount > 1 &&
        currentIndex !== undefined &&
        currentIndex >= 0
      ) {
        event.preventDefault();
        const nextIdx = currentIndex + stepDelta;
        if (nextIdx >= 0 && nextIdx < totalCount) {
          void stepDesktopReader(stepDelta);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCopy, locale, currentIndex, totalCount]);

  const displayMatn = useMemo(
    () => (hadith ? (showTashkeel ? hadith.text : stripDiacritics(hadith.text)) : ''),
    [hadith, showTashkeel],
  );

  const segments = useMemo(
    () => (displayMatn ? findArabicHighlightSegments(displayMatn, highlightQuery) : []),
    [displayMatn, highlightQuery],
  );

  const isWeak = hadith ? isUnauthenticBucket(hadith.gradeBucket) : false;
  const isSevereUnauthentic = hadith
    ? hadith.gradeBucket === 'very_weak' ||
      hadith.gradeBucket === 'munkar' ||
      hadith.gradeBucket === 'mawdu' ||
      hadith.gradeBucket === 'batil'
    : false;
  const altSourceId = hadith
    ? hadith.hasAltSahih && hadith.dorarId
      ? hadith.dorarId
      : others.find((o) => o.hasAltSahih && o.dorarId)?.dorarId
    : undefined;
  const canShowAlt = Boolean(hadith && isWeak && altSourceId);
  const canShowOsoul = Boolean(hadith?.dorarId && hadith?.hasOsoul);
  const canShowSimilar = Boolean(hadith?.dorarId && !isWeak && !canShowAlt && hadith?.hasSimilar);

  const loadTabData = useCallback(
    async (tab: 'osoul' | 'alt' | 'similar') => {
      if (!hadith) return;
      const targetId = tab === 'alt' ? altSourceId : hadith.dorarId;
      if (!targetId) return;

      const seq = ++fetchSeqRef.current;
      setPanelError(false);

      if (tab === 'osoul' && osoulData !== null) {
        setPanelLoading(false);
        return;
      }
      if (tab === 'alt' && altData !== null) {
        setPanelLoading(false);
        return;
      }
      if (tab === 'similar' && similarData !== null) {
        setPanelLoading(false);
        return;
      }

      setPanelLoading(true);
      try {
        if (tab === 'osoul') {
          const res = await readerProvider.fetchOsoul(targetId);
          if (seq === fetchSeqRef.current) setOsoulData(res);
        } else if (tab === 'alt') {
          const res = await readerProvider.fetchAltSahih(targetId);
          if (seq === fetchSeqRef.current) setAltData(res);
        } else {
          const res = await readerProvider.fetchSimilar(targetId);
          if (seq === fetchSeqRef.current) setSimilarData(res);
        }
      } catch {
        if (seq === fetchSeqRef.current) setPanelError(true);
      } finally {
        if (seq === fetchSeqRef.current) setPanelLoading(false);
      }
    },
    [hadith, altSourceId, osoulData, altData, similarData],
  );

  const selectTab = (tab: ReaderTab) => {
    setActiveTab(tab);
    detailsScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    if (tab === 'osoul' || tab === 'alt' || tab === 'similar') {
      void loadTabData(tab);
    }
  };

  const stepScale = useCallback(
    (delta: -1 | 1) => {
      const idx = SCALES.indexOf(readingScale);
      const nextIdx = Math.min(SCALES.length - 1, Math.max(0, idx + delta));
      const next = SCALES[nextIdx];
      if (next !== readingScale) {
        setReadingScale(next);
        saveReaderReadingScale(next);
      }
    },
    [readingScale],
  );

  const toggleTashkeel = useCallback(() => {
    const next = !showTashkeel;
    setShowTashkeel(next);
    saveReaderTashkeel(next);
  }, [showTashkeel]);

  const togglePin = () => {
    void setDesktopReaderPinned(!pinned).then(setPinned);
  };

  if (!hadith) {
    return (
      <div className="desktop-window-frame">
        <div className="desktop-window-shell" />
      </div>
    );
  }

  const gradeDef = strings.gradeDefinitions[hadith.gradeBucket];
  const gradeAccentVar = GRADE_ACCENT_VAR[hadith.gradeBucket];
  const scaleIdx = SCALES.indexOf(readingScale);
  const trimmedMatn = displayMatn.trim();
  const alreadyFramed = trimmedMatn.startsWith('«') && trimmedMatn.endsWith('»');
  const cleanNarrator = hadith.narrator.trim().replace(/:$/, '');
  const showCautionBar = isSevereUnauthentic || (isWeak && canShowAlt);
  const showStepper = Boolean(
    totalCount !== undefined && totalCount > 1 && currentIndex !== undefined && currentIndex >= 0,
  );
  const canStepPrev = showStepper && (currentIndex ?? 0) > 0;
  const canStepNext = showStepper && (currentIndex ?? 0) < (totalCount ?? 0) - 1;

  return (
    <div className="desktop-window-frame">
      <div className="desktop-window-shell text-ink">
        {/* Draggable Reader Top Bar */}
        <header
          data-tauri-drag-region
          className="flex shrink-0 items-center justify-between gap-2.5 border-b border-line bg-surface px-4 py-2.5 select-none"
        >
          <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center gap-2.5">
            <GradeBadge
              bucket={hadith.gradeBucket}
              strings={strings}
              expanded={activeTab === 'grade'}
              onToggleInfo={() => selectTab(activeTab === 'grade' ? 'verdict' : 'grade')}
            />

            {showStepper && totalCount !== undefined && currentIndex !== undefined && (
              <div className="flex items-center gap-0.5 rounded-lg bg-elevated p-0.5">
                <button
                  type="button"
                  onClick={() => void stepDesktopReader(-1)}
                  disabled={!canStepPrev}
                  aria-label={strings.readerPrevHadith}
                  title={strings.readerPrevHadith}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {locale === 'ar' ? (
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
                <span className="px-1.5 text-[0.78rem] font-semibold tabular-nums text-muted">
                  {strings.readerPositionLabel(currentIndex + 1, totalCount)}
                </span>
                <button
                  type="button"
                  onClick={() => void stepDesktopReader(1)}
                  disabled={!canStepNext}
                  aria-label={strings.readerNextHadith}
                  title={strings.readerNextHadith}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {locale === 'ar' ? (
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex items-center rounded-lg bg-elevated p-0.5">
              <button
                type="button"
                onClick={() => stepScale(-1)}
                disabled={scaleIdx === 0}
                aria-label={strings.readerFontSmaller}
                title={strings.readerFontSmaller}
                className="inline-flex h-7 min-w-8 items-center justify-center rounded-md px-1.5 text-[0.82rem] font-bold text-ink/80 transition-colors hover:bg-surface hover:text-ink disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {locale === 'ar' ? 'أ-' : 'A-'}
              </button>
              <button
                type="button"
                onClick={() => stepScale(1)}
                disabled={scaleIdx === SCALES.length - 1}
                aria-label={strings.readerFontLarger}
                title={strings.readerFontLarger}
                className="inline-flex h-7 min-w-8 items-center justify-center rounded-md px-1.5 text-[0.82rem] font-bold text-ink/80 transition-colors hover:bg-surface hover:text-ink disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {locale === 'ar' ? 'أ+' : 'A+'}
              </button>
            </div>

            <button
              type="button"
              onClick={toggleTashkeel}
              aria-pressed={showTashkeel}
              aria-label={strings.readerToggleTashkeel}
              title={strings.readerToggleTashkeel}
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[0.88rem] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                showTashkeel
                  ? 'bg-brand-soft text-brand'
                  : 'bg-elevated text-ink/80 hover:bg-subtle hover:text-ink'
              }`}
            >
              {showTashkeel ? 'تَ' : 'ت'}
            </button>

            <button
              type="button"
              onClick={() => void handleCopy()}
              aria-label={justCopied ? strings.copied : strings.copy}
              title={justCopied ? strings.copied : `${strings.copy} (Ctrl+C)`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-elevated px-3 text-[0.88rem] font-semibold text-ink transition-colors hover:bg-subtle active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {justCopied ? (
                <Check className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              )}
              <span>{justCopied ? strings.copied : strings.copy}</span>
            </button>

            {hadith.dorarId && (
              <button
                type="button"
                onClick={() => {
                  if (hadith.dorarId) void openDorarHadithExternal(hadith.dorarId);
                }}
                aria-label={strings.readerOpenDorar}
                title={strings.readerOpenDorar}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={togglePin}
              aria-pressed={pinned}
              aria-label={pinned ? strings.desktopUnpin : strings.desktopPin}
              title={pinned ? strings.desktopUnpin : strings.desktopPin}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                pinned
                  ? 'bg-brand-soft text-brand'
                  : 'text-muted hover:bg-elevated hover:text-ink'
              }`}
            >
              {pinned ? (
                <Pin className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void hideDesktopReader()}
              aria-label={strings.close}
              title={`${strings.close} (Esc)`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Resizable Matn / Isnad & Scholarly Details split (default 60% / 40%) */}
        <div
          ref={splitContainerRef}
          className="flex min-h-0 flex-1 flex-col gap-1.5 px-3.5 pb-3.5 pt-2.5"
        >
          {/* Hero Matn Section */}
          <section
            ref={matnScrollRef}
            style={{
              flexGrow: matnRatio,
              flexBasis: 0,
              borderInlineStart: `2px solid ${gradeAccentVar}`,
            }}
            className="hadith-sheet flex min-h-0 w-full flex-col overflow-y-auto rounded-xl bg-surface px-5 py-3.5"
          >
            <div key={hadith.id} className="reader-content-fade my-auto w-full space-y-2.5">
              {showCautionBar && (
                <div
                  role="note"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-elevated/70 px-3 py-1.5 text-[0.82rem] text-muted"
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5 leading-snug">
                    <AlertTriangle
                      className="h-3.5 w-3.5 shrink-0 text-faint"
                      aria-hidden="true"
                    />
                    <span>{strings.readerCautionSevere}</span>
                  </span>
                  {canShowAlt && (
                    <button
                      type="button"
                      onClick={() => selectTab('alt')}
                      style={{ backgroundColor: 'var(--sahih-bg)', color: 'var(--sahih-ink)' }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.78rem] font-semibold transition-opacity hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>{strings.readerJumpAltSahih}</span>
                    </button>
                  )}
                </div>
              )}

              {cleanNarrator && (
                <div className="flex items-center gap-1.5 text-start text-[0.95rem] font-medium text-muted">
                  <User className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
                  <span>
                    {strings.narratorPrefix}{' '}
                    <span dir="rtl" lang="ar" className="font-semibold text-ink">
                      {cleanNarrator}
                    </span>
                    :
                  </span>
                </div>
              )}

              <p
                dir="rtl"
                lang="ar"
                className={`font-hadith text-start text-ink ${READER_MATN_CLASS[readingScale]}`}
              >
                {!alreadyFramed && (
                  <span aria-hidden="true" className="select-none text-faint/75">
                    «
                  </span>
                )}
                {segments.map((seg, idx) =>
                  seg.match ? (
                    <mark key={idx} className="hadith-mark">
                      {seg.text}
                    </mark>
                  ) : (
                    <span key={idx}>{seg.text}</span>
                  ),
                )}
                {!alreadyFramed && (
                  <span aria-hidden="true" className="select-none text-faint/75">
                    »
                  </span>
                )}
              </p>
            </div>
          </section>

          {/* Draggable Horizontal Divider Handle */}
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="horizontal"
            aria-valuenow={Math.round(matnRatio)}
            aria-valuemin={MIN_MATN_RATIO}
            aria-valuemax={MAX_MATN_RATIO}
            aria-label={strings.readerResizeDivider}
            title={strings.readerResizeDivider}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              draggingDividerRef.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!draggingDividerRef.current) return;
              const container = splitContainerRef.current;
              if (!container) return;
              const rect = container.getBoundingClientRect();
              if (rect.height <= 0) return;
              const next = ((event.clientY - rect.top) / rect.height) * 100;
              setMatnRatio(clampMatnRatio(next));
            }}
            onPointerUp={(event) => {
              if (!draggingDividerRef.current) return;
              draggingDividerRef.current = false;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={(event) => {
              draggingDividerRef.current = false;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onDoubleClick={() => setMatnRatio(DEFAULT_MATN_RATIO)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                setMatnRatio((prev) => clampMatnRatio(prev - 5));
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                setMatnRatio((prev) => clampMatnRatio(prev + 5));
              } else if (event.key === 'Home' || event.key === '0') {
                event.preventDefault();
                event.stopPropagation();
                setMatnRatio(DEFAULT_MATN_RATIO);
              }
            }}
            className="group relative flex h-2.5 shrink-0 cursor-row-resize select-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span
              aria-hidden="true"
              className="h-1 w-10 rounded-full bg-line-strong transition-colors group-hover:bg-faint group-active:bg-brand"
            />
          </div>

          {/* Isnad / Scholarly Details Section */}
          <section
            style={{ flexGrow: 100 - matnRatio, flexBasis: 0 }}
            className="hadith-sheet flex min-h-0 w-full flex-col overflow-hidden rounded-xl bg-surface"
          >
            <div
              role="tablist"
              className="no-scrollbar flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line bg-elevated/45 px-3 py-1.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'verdict'}
                onClick={() => selectTab('verdict')}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 py-1 text-[0.9rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  activeTab === 'verdict'
                    ? 'bg-ink text-canvas'
                    : 'bg-surface text-muted hover:bg-subtle hover:text-ink'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{strings.readerVerdictTab}</span>
              </button>

              {others.length > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'others'}
                  onClick={() => selectTab('others')}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 py-1 text-[0.9rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    activeTab === 'others'
                      ? 'bg-ink text-canvas'
                      : 'bg-surface text-muted hover:bg-subtle hover:text-ink'
                  }`}
                >
                  <BookCopy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{strings.readerOtherRulingsTab(others.length)}</span>
                </button>
              )}

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'grade'}
                onClick={() => selectTab('grade')}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 py-1 text-[0.9rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  activeTab === 'grade'
                    ? 'bg-ink text-canvas'
                    : 'bg-surface text-muted hover:bg-subtle hover:text-ink'
                }`}
              >
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{strings.readerGradeTab}</span>
              </button>

              {canShowAlt && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'alt'}
                  onClick={() => selectTab('alt')}
                  style={
                    activeTab === 'alt'
                      ? undefined
                      : { backgroundColor: 'var(--sahih-bg)', color: 'var(--sahih-ink)' }
                  }
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 py-1 text-[0.9rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    activeTab === 'alt' ? 'bg-brand text-brand-ink' : ''
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{strings.altSahihButton}</span>
                </button>
              )}

              {canShowOsoul && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'osoul'}
                  onClick={() => selectTab('osoul')}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 py-1 text-[0.9rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    activeTab === 'osoul'
                      ? 'bg-ink text-canvas'
                      : 'bg-surface text-muted hover:bg-subtle hover:text-ink'
                  }`}
                >
                  <GitBranch className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{strings.osoulButton}</span>
                </button>
              )}

              {canShowSimilar && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'similar'}
                  onClick={() => selectTab('similar')}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 py-1 text-[0.9rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    activeTab === 'similar'
                      ? 'bg-ink text-canvas'
                      : 'bg-surface text-muted hover:bg-subtle hover:text-ink'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{strings.similarButton}</span>
                </button>
              )}
            </div>

            <div
              ref={detailsScrollRef}
              role="tabpanel"
              className="min-h-0 flex-1 overflow-y-auto p-3 text-[1rem]"
            >
              <div key={`${hadith.id}:${activeTab}`} className="reader-content-fade">
                {/* Tab Panel: Verdict, Source & Recessed Takhrij */}
                {activeTab === 'verdict' && (
                  <div className="space-y-2">
                    {(hadith.rawGrade || hadith.muhaddith || hadith.source) && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(hadith.rawGrade || hadith.muhaddith) && (
                          <div
                            className={`rounded-xl border border-line bg-elevated/55 px-3 py-2${
                              !hadith.source ? ' sm:col-span-2' : ''
                            }`}
                          >
                            <p className="mb-1 text-[0.78rem] font-semibold text-muted">
                              {hadith.muhaddith ? (
                                <>
                                  {strings.verdictByPrefix}{' '}
                                  <span dir="rtl" lang="ar">
                                    {hadith.muhaddith}
                                  </span>
                                </>
                              ) : (
                                strings.readerScholarsVerdictLabel
                              )}
                            </p>
                            <p
                              dir={hadith.rawGrade ? 'rtl' : undefined}
                              lang={hadith.rawGrade ? 'ar' : undefined}
                              className="text-[0.98rem] font-semibold leading-snug text-ink"
                            >
                              {hadith.rawGrade || strings.grades[hadith.gradeBucket]}
                            </p>
                          </div>
                        )}

                        {hadith.source && (
                          <div
                            className={`rounded-xl border border-line bg-elevated/55 px-3 py-2${
                              !hadith.rawGrade && !hadith.muhaddith ? ' sm:col-span-2' : ''
                            }`}
                          >
                            <p className="mb-1 flex items-center gap-1.5 text-[0.78rem] font-semibold text-muted">
                              <BookOpen
                                className="h-3.5 w-3.5 shrink-0 text-faint"
                                aria-hidden="true"
                              />
                              <span>{strings.sourceLabel}</span>
                            </p>
                            <p
                              dir="rtl"
                              lang="ar"
                              className="tabular-nums text-[0.98rem] font-semibold leading-snug text-ink"
                            >
                              {hadith.source}
                              {hadith.pageOrNumber ? ` (${hadith.pageOrNumber})` : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {hadith.takhrij && (
                      <div className="rounded-xl border border-line bg-elevated/35 px-3 py-2">
                        <p className="text-[0.92rem] leading-relaxed text-ink/90">
                          <span className="font-semibold text-muted">{strings.takhrijLabel}: </span>
                          <span dir="rtl" lang="ar" className="tabular-nums">
                            {hadith.takhrij}
                          </span>
                        </p>
                      </div>
                    )}

                    {!hadith.rawGrade && !hadith.muhaddith && !hadith.source && !hadith.takhrij && (
                      <p className="py-1 text-muted">{strings.panelEmpty}</p>
                    )}
                  </div>
                )}

                {/* Tab Panel: Other Rulings */}
                {activeTab === 'others' && others.length > 0 && (
                  <ul className="divide-y divide-line rounded-xl border border-line bg-elevated/45 px-4 py-1">
                    {others.map((alt) => (
                      <li key={alt.id} className="py-2.5 text-[0.98rem]">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <GradeBadge bucket={alt.gradeBucket} strings={strings} size="sm" />
                          {alt.narrator && (
                            <span className="text-[0.9rem] text-muted">
                              {strings.narratorPrefix}{' '}
                              <span dir="rtl" lang="ar" className="font-semibold text-ink">
                                {alt.narrator}
                              </span>
                            </span>
                          )}
                        </div>
                        {alt.rawGrade && (
                          <p className="leading-relaxed text-muted">
                            <span className="font-semibold text-ink">
                              {alt.muhaddith ? (
                                <>
                                  {strings.verdictByPrefix}{' '}
                                  <span dir="rtl" lang="ar">
                                    {alt.muhaddith}
                                  </span>
                                  :{' '}
                                </>
                              ) : (
                                <>{strings.verdictLabel}: </>
                              )}
                            </span>
                            <span dir="rtl" lang="ar">
                              {alt.rawGrade}
                            </span>
                          </p>
                        )}
                        {alt.source && (
                          <p
                            className="mt-1 tabular-nums text-[0.9rem] text-muted"
                            dir="rtl"
                            lang="ar"
                          >
                            {alt.source}
                            {alt.pageOrNumber ? ` (${alt.pageOrNumber})` : ''}
                          </p>
                        )}
                        {alt.takhrij && (
                          <p className="mt-1 text-[0.88rem] leading-relaxed text-muted">
                            <span className="font-semibold text-ink">{strings.takhrijLabel}: </span>
                            <span dir="rtl" lang="ar" className="tabular-nums">
                              {alt.takhrij}
                            </span>
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Tab Panel: Classical Grade Definition */}
                {activeTab === 'grade' && (
                  <div>
                    <p className="mb-2 text-[1.05rem] font-semibold text-ink">
                      {strings.grades[hadith.gradeBucket]}
                    </p>
                    {gradeDef.quote && (
                      <blockquote className="mb-3">
                        <p className="font-hadith text-[1.2rem] leading-[1.9] text-ink">
                          «{gradeDef.quote}»
                        </p>
                        {gradeDef.source && (
                          <footer className="mt-1 text-[0.9rem] font-medium text-brand">
                            — {gradeDef.source}
                          </footer>
                        )}
                      </blockquote>
                    )}
                    <p
                      className={
                        gradeDef.quote
                          ? 'border-t border-line pt-2.5 leading-relaxed text-muted'
                          : 'leading-relaxed text-muted'
                      }
                    >
                      {gradeDef.summary}
                    </p>
                  </div>
                )}

                {/* Tab Panels: On-Demand Osoul / Alt Sahih / Similar */}
                {(activeTab === 'osoul' || activeTab === 'alt' || activeTab === 'similar') && (
                  <div>
                    {panelLoading && (
                      <div className="flex items-center gap-2 py-2 text-muted">
                        <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
                        <span>{strings.panelLoading}</span>
                      </div>
                    )}

                    {!panelLoading && panelError && (
                      <div className="flex items-center justify-between gap-2 py-1 text-muted">
                        <span>{strings.panelError}</span>
                        <button
                          type="button"
                          onClick={() => void loadTabData(activeTab)}
                          className="inline-flex min-h-8 items-center rounded-full bg-elevated px-3.5 py-1 text-[0.92rem] font-semibold text-brand hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          {strings.retry}
                        </button>
                      </div>
                    )}

                    {!panelLoading && !panelError && activeTab === 'osoul' && (
                      osoulData && osoulData.length > 0 ? (
                        <ul className="divide-y divide-line">
                          {osoulData.map((entry, idx) => (
                            <li
                              key={`${entry.sourceRef}-${idx}`}
                              className="py-3 first:pt-0 last:pb-0"
                            >
                              {entry.sourceRef && (
                                <p
                                  dir="rtl"
                                  lang="ar"
                                  className="mb-1 text-start text-[0.92rem] font-semibold text-brand"
                                >
                                  {entry.sourceRef}
                                </p>
                              )}
                              {entry.sanad && (
                                <p
                                  dir="rtl"
                                  lang="ar"
                                  className="mb-1.5 text-start text-[0.98rem] leading-relaxed text-muted"
                                >
                                  {entry.sanad}
                                </p>
                              )}
                              {entry.matn && (
                                <p
                                  dir="rtl"
                                  lang="ar"
                                  className="font-hadith text-start text-[1.18rem] leading-[1.95] text-ink"
                                >
                                  {entry.matn}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="py-1 text-muted">{strings.panelEmpty}</p>
                      )
                    )}

                    {!panelLoading &&
                      !panelError &&
                      (activeTab === 'alt' || activeTab === 'similar') &&
                      (() => {
                        const list = activeTab === 'alt' ? altData : similarData;
                        if (!list || list.length === 0) {
                          return <p className="py-1 text-muted">{strings.panelEmpty}</p>;
                        }
                        return (
                          <ul className="divide-y divide-line">
                            {list.slice(0, 8).map((item) => (
                              <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                                  <GradeBadge
                                    bucket={item.gradeBucket}
                                    strings={strings}
                                    size="sm"
                                  />
                                  {item.narrator && (
                                    <span className="text-[0.9rem] text-muted">
                                      {strings.narratorPrefix}{' '}
                                      <span dir="rtl" lang="ar" className="font-semibold text-ink">
                                        {item.narrator}
                                      </span>
                                    </span>
                                  )}
                                </div>
                                <p
                                  dir="rtl"
                                  lang="ar"
                                  className="font-hadith text-start text-[1.18rem] leading-[1.95] text-ink"
                                >
                                  {item.text}
                                </p>
                                {item.rawGrade && (
                                  <p className="mt-1.5 text-[0.98rem] leading-relaxed text-muted">
                                    <span className="font-semibold text-ink">
                                      {item.muhaddith ? (
                                        <>
                                          {strings.verdictByPrefix}{' '}
                                          <span dir="rtl" lang="ar">
                                            {item.muhaddith}
                                          </span>
                                          :{' '}
                                        </>
                                      ) : (
                                        <>{strings.verdictLabel}: </>
                                      )}
                                    </span>
                                    <span dir="rtl" lang="ar">
                                      {item.rawGrade}
                                    </span>
                                  </p>
                                )}
                                {item.source && (
                                  <p className="mt-1 text-[0.9rem] text-muted" dir="rtl" lang="ar">
                                    {item.source}
                                    {item.pageOrNumber ? ` (${item.pageOrNumber})` : ''}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
