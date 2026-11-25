import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  GitBranch,
  Info,
  Layers,
  Loader2,
  Minus,
  Pin,
  PinOff,
  Plus,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { findArabicHighlightSegments } from '../domain/arabicNormalize';
import { isUnauthenticBucket } from '../domain/gradeClassifier';
import type { HadithResult, Locale, OsoulEntry, ReadingScale, ThemePreference } from '../domain/hadith';
import { getStrings } from '../i18n/strings';
import {
  getDesktopReaderPayload,
  getDesktopReaderPinned,
  hideDesktopReader,
  listenReaderPayload,
  type ReaderPayload,
  setDesktopReaderPinned,
} from '../services/desktopBridge';
import { DorarProvider } from '../services/dorarClient';
import {
  applyLocaleToDocument,
  applyThemeToDocument,
  loadLocale,
  loadReadingScale,
  loadThemePreference,
  STORAGE_KEYS,
} from '../services/preferences';
import { copyHadithText } from '../services/shareCopy';
import { GradeBadge } from './GradeBadge';

type ReaderTab = 'verdict' | 'grade' | 'osoul' | 'alt' | 'similar';

const readerProvider = new DorarProvider();
const SCALES: readonly ReadingScale[] = ['sm', 'md', 'lg'];

const READER_MATN_CLASS: Record<ReadingScale, string> = {
  sm: 'text-[1.15rem] leading-[2]',
  md: 'text-[1.35rem] leading-[2.08]',
  lg: 'text-[1.58rem] leading-[2.12]',
};

export function HadithReaderWindow() {
  const [payload, setPayload] = useState<ReaderPayload | null>(null);
  const [locale, setLocale] = useState<Locale>(() => loadLocale());
  const [themePref, setThemePref] = useState<ThemePreference>(() => loadThemePreference());
  const [readingScale, setReadingScale] = useState<ReadingScale>(() => loadReadingScale());
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
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

  const strings = useMemo(() => getStrings(locale), [locale]);

  const applyIncomingPayload = useCallback((next: ReaderPayload) => {
    fetchSeqRef.current++;
    setPayload(next);
    setLocale(next.locale);
    setThemePref(next.themePref);
    setReadingScale(next.readingScale);
    setActiveTab('verdict');
    setPanelLoading(false);
    setPanelError(false);
    setOsoulData(null);
    setAltData(null);
    setSimilarData(null);
    setJustCopied(false);
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-platform', 'desktop');
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
    };
    window.addEventListener('storage', onStorage);

    return () => {
      active = false;
      document.documentElement.removeAttribute('data-platform');
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void hideDesktopReader();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const hadith = payload?.hadith ?? null;
  const others = useMemo(() => payload?.others ?? [], [payload]);
  const highlightQuery = payload?.highlightQuery ?? '';

  const segments = useMemo(
    () => (hadith ? findArabicHighlightSegments(hadith.text, highlightQuery) : []),
    [hadith, highlightQuery],
  );

  const isWeak = hadith ? isUnauthenticBucket(hadith.gradeBucket) : false;
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
    if (tab === 'osoul' || tab === 'alt' || tab === 'similar') {
      void loadTabData(tab);
    }
  };

  const handleCopy = async () => {
    if (!hadith) return;
    await copyHadithText(hadith, locale);
    setJustCopied(true);
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => {
      copyTimerRef.current = null;
      setJustCopied(false);
    }, 1800);
  };

  const stepScale = (delta: -1 | 1) => {
    const idx = SCALES.indexOf(readingScale);
    const nextIdx = Math.min(SCALES.length - 1, Math.max(0, idx + delta));
    setReadingScale(SCALES[nextIdx]);
  };

  const togglePin = () => {
    void setDesktopReaderPinned(!pinned).then(setPinned);
  };

  if (!hadith) {
    return <div className="h-dvh bg-canvas" />;
  }

  const gradeDef = strings.gradeDefinitions[hadith.gradeBucket];
  const scaleIdx = SCALES.indexOf(readingScale);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
      {/* Draggable Reader Top Bar */}
      <header
        data-tauri-drag-region
        className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 select-none"
      >
        <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center gap-2.5">
          <GradeBadge
            bucket={hadith.gradeBucket}
            strings={strings}
            expanded={activeTab === 'grade'}
            onToggleInfo={() => selectTab(activeTab === 'grade' ? 'verdict' : 'grade')}
          />

          {hadith.narrator && (
            <div
              data-tauri-drag-region
              className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted"
            >
              <User className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
              <span data-tauri-drag-region className="truncate">
                {strings.narratorPrefix}{' '}
                <span dir="rtl" lang="ar" className="font-semibold text-ink">
                  {hadith.narrator}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <div className="flex items-center rounded-lg bg-elevated p-0.5">
            <button
              type="button"
              onClick={() => stepScale(-1)}
              disabled={scaleIdx === 0}
              aria-label={strings.readerFontSmaller}
              title={strings.readerFontSmaller}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => stepScale(1)}
              disabled={scaleIdx === SCALES.length - 1}
              aria-label={strings.readerFontLarger}
              title={strings.readerFontLarger}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label={justCopied ? strings.copied : strings.copy}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-elevated px-2.5 text-xs font-semibold text-ink transition-colors hover:bg-subtle active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {justCopied ? (
              <Check className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            )}
            <span>{justCopied ? strings.copied : strings.copy}</span>
          </button>

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

      {/* Scrollable Centered Reading Canvas */}
      <div ref={scrollBodyRef} className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-[66ch] space-y-5">
          {/* Full Un-clamped Hero Matn */}
          <section className="hadith-sheet rounded-2xl bg-surface px-6 py-5">
            <p
              dir="rtl"
              lang="ar"
              className={`font-hadith text-start text-ink ${READER_MATN_CLASS[readingScale]}`}
            >
              {segments.map((seg, idx) =>
                seg.match ? (
                  <mark key={idx} className="hadith-mark">
                    {seg.text}
                  </mark>
                ) : (
                  <span key={idx}>{seg.text}</span>
                ),
              )}
            </p>
          </section>

          {/* Horizontal Scholarly Detail Tabs */}
          <section className="space-y-3">
            <div
              role="tablist"
              className="no-scrollbar flex flex-wrap items-center gap-1.5 border-b border-line pb-2.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'verdict'}
                onClick={() => selectTab('verdict')}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  activeTab === 'verdict'
                    ? 'bg-ink text-canvas'
                    : 'bg-elevated text-muted hover:bg-subtle hover:text-ink'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{strings.readerVerdictTab}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'grade'}
                onClick={() => selectTab('grade')}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  activeTab === 'grade'
                    ? 'bg-ink text-canvas'
                    : 'bg-elevated text-muted hover:bg-subtle hover:text-ink'
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
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
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
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    activeTab === 'osoul'
                      ? 'bg-ink text-canvas'
                      : 'bg-elevated text-muted hover:bg-subtle hover:text-ink'
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
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    activeTab === 'similar'
                      ? 'bg-ink text-canvas'
                      : 'bg-elevated text-muted hover:bg-subtle hover:text-ink'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{strings.similarButton}</span>
                </button>
              )}
            </div>

            {/* Tab Panel: Verdict, Source, Takhrij & Stacked Rulings */}
            {activeTab === 'verdict' && (
              <div className="space-y-3 rounded-2xl bg-surface p-4 text-xs hadith-sheet">
                {hadith.rawGrade && (
                  <p className="leading-relaxed text-muted">
                    <span className="font-semibold text-ink">
                      {hadith.muhaddith ? (
                        <>
                          {strings.verdictByPrefix}{' '}
                          <span dir="rtl" lang="ar">
                            {hadith.muhaddith}
                          </span>
                          :{' '}
                        </>
                      ) : (
                        <>{strings.verdictLabel}: </>
                      )}
                    </span>
                    <span dir="rtl" lang="ar">
                      {hadith.rawGrade}
                    </span>
                  </p>
                )}

                {hadith.source && (
                  <p className="inline-flex items-center gap-1.5 font-medium text-ink">
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
                    <span dir="rtl" lang="ar" className="tabular-nums">
                      {hadith.source}
                      {hadith.pageOrNumber ? ` (${hadith.pageOrNumber})` : ''}
                    </span>
                  </p>
                )}

                {hadith.takhrij && (
                  <p className="border-t border-line pt-2.5 leading-relaxed text-muted">
                    <span className="font-semibold text-ink">{strings.takhrijLabel}: </span>
                    <span dir="rtl" lang="ar" className="tabular-nums">
                      {hadith.takhrij}
                    </span>
                  </p>
                )}

                {others.length > 0 && (
                  <div className="border-t border-line pt-3">
                    <p className="mb-2 text-[0.72rem] font-semibold text-brand">
                      {strings.otherRulingsLabel(others.length)}
                    </p>
                    <ul className="divide-y divide-line rounded-xl bg-elevated px-3.5 py-1">
                      {others.map((alt) => (
                        <li key={alt.id} className="py-2.5">
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-1.5">
                            <GradeBadge bucket={alt.gradeBucket} strings={strings} size="sm" />
                            {alt.narrator && (
                              <span className="text-[0.72rem] text-muted">
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
                            <p className="mt-1 text-[0.7rem] text-muted" dir="rtl" lang="ar">
                              {alt.source}
                              {alt.pageOrNumber ? ` (${alt.pageOrNumber})` : ''}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Tab Panel: Classical Grade Definition */}
            {activeTab === 'grade' && (
              <div className="rounded-2xl bg-surface p-4 text-xs hadith-sheet">
                <p className="mb-2 font-semibold text-ink">{strings.grades[hadith.gradeBucket]}</p>
                {gradeDef.quote && (
                  <blockquote className="mb-3">
                    <p className="font-hadith text-[1.05rem] leading-[1.9] text-ink">
                      «{gradeDef.quote}»
                    </p>
                    {gradeDef.source && (
                      <footer className="mt-1 text-[0.75rem] font-medium text-brand">
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
              <div className="rounded-2xl bg-surface p-4 text-xs hadith-sheet">
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
                      className="inline-flex min-h-8 items-center rounded-full bg-elevated px-3.5 py-1 font-semibold text-brand hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {strings.retry}
                    </button>
                  </div>
                )}

                {!panelLoading && !panelError && activeTab === 'osoul' && (
                  osoulData && osoulData.length > 0 ? (
                    <ul className="divide-y divide-line">
                      {osoulData.map((entry, idx) => (
                        <li key={`${entry.sourceRef}-${idx}`} className="py-3 first:pt-0 last:pb-0">
                          {entry.sourceRef && (
                            <p
                              dir="rtl"
                              lang="ar"
                              className="mb-1 text-start text-[0.75rem] font-semibold text-brand"
                            >
                              {entry.sourceRef}
                            </p>
                          )}
                          {entry.sanad && (
                            <p
                              dir="rtl"
                              lang="ar"
                              className="mb-1.5 text-start text-[0.8rem] leading-relaxed text-muted"
                            >
                              {entry.sanad}
                            </p>
                          )}
                          {entry.matn && (
                            <p
                              dir="rtl"
                              lang="ar"
                              className="font-hadith text-start text-[1.08rem] leading-[1.95] text-ink"
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
                  (activeTab === 'alt' || activeTab === 'similar') && (() => {
                    const list = activeTab === 'alt' ? altData : similarData;
                    if (!list || list.length === 0) {
                      return <p className="py-1 text-muted">{strings.panelEmpty}</p>;
                    }
                    return (
                      <ul className="divide-y divide-line">
                        {list.slice(0, 8).map((item) => (
                          <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                              <GradeBadge bucket={item.gradeBucket} strings={strings} size="sm" />
                              {item.narrator && (
                                <span className="text-[0.72rem] text-muted">
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
                              className="font-hadith text-start text-[1.08rem] leading-[1.95] text-ink"
                            >
                              {item.text}
                            </p>
                            {item.rawGrade && (
                              <p className="mt-1.5 leading-relaxed text-muted">
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
                              <p className="mt-1 text-[0.72rem] text-muted" dir="rtl" lang="ar">
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
          </section>
        </div>
      </div>
    </div>
  );
}
