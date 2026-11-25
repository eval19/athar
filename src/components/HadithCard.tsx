import { memo, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GitBranch,
  Layers,
  Loader2,
  Share2,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { findArabicHighlightSegments } from '../domain/arabicNormalize';
import { isUnauthenticBucket } from '../domain/gradeClassifier';
import type { GradeBucket, HadithResult, OsoulEntry, ReadingScale } from '../domain/hadith';
import {
  hasMatchOnlyBelowPreview,
  MATN_CLEAR_VISIBLE_LINES,
  MATN_MIN_LINES_TO_COLLAPSE,
  shouldCollapseMatn,
} from '../domain/matnCollapse';
import type { AppStrings } from '../i18n/strings';
import { GradeBadge } from './GradeBadge';

type ActivePanel = 'osoul' | 'alt' | 'similar' | null;

interface HadithCardProps {
  hadith: HadithResult;
  others?: HadithResult[];
  highlightQuery: string;
  readingScale: ReadingScale;
  deferred?: boolean;
  showGradeHint?: boolean;
  strings: AppStrings;
  onCopy: (hadith: HadithResult) => Promise<void>;
  onShare: (hadith: HadithResult) => Promise<void>;
  onGradeBadgeOpened?: () => void;
  onDismissGradeHint?: () => void;
  onFetchOsoul?: (dorarId: string) => Promise<OsoulEntry[]>;
  onFetchAltSahih?: (dorarId: string) => Promise<HadithResult[]>;
  onFetchSimilar?: (dorarId: string) => Promise<HadithResult[]>;
}

const MATN_SIZE_CLASS: Record<ReadingScale, string> = {
  sm: 'matn-scale-sm text-[1.125rem] leading-[1.95]',
  md: 'matn-scale-md text-[1.3125rem] leading-[2.05]',
  lg: 'matn-scale-lg text-[1.5rem] leading-[2.1]',
};

export const HadithCard = memo(function HadithCard({
  hadith,
  others = [],
  highlightQuery,
  readingScale,
  deferred = false,
  showGradeHint = false,
  strings,
  onCopy,
  onShare,
  onGradeBadgeOpened,
  onDismissGradeHint,
  onFetchOsoul,
  onFetchAltSahih,
  onFetchSimilar,
}: HadithCardProps) {
  const [justCopied, setJustCopied] = useState(false);
  const [showGradeHelp, setShowGradeHelp] = useState(false);
  const [matnExpanded, setMatnExpanded] = useState(false);
  const [fitsWithoutClamp, setFitsWithoutClamp] = useState(false);
  const [measuredMatchBelow, setMeasuredMatchBelow] = useState<boolean | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState(false);
  const [osoulData, setOsoulData] = useState<OsoulEntry[] | null>(null);
  const [altData, setAltData] = useState<HadithResult[] | null>(null);
  const [similarData, setSimilarData] = useState<HadithResult[] | null>(null);
  const panelSeqRef = useRef(0);
  const articleRef = useRef<HTMLElement | null>(null);
  const matnRef = useRef<HTMLParagraphElement | null>(null);
  const matnId = useId();

  const segments = useMemo(
    () => findArabicHighlightSegments(hadith.text, highlightQuery),
    [hadith.text, highlightQuery],
  );
  const isLongCandidate = useMemo(
    () => shouldCollapseMatn(hadith.text, readingScale),
    [hadith.text, readingScale],
  );
  const fallbackMatchBelow = useMemo(
    () => (isLongCandidate ? hasMatchOnlyBelowPreview(segments, readingScale) : false),
    [isLongCandidate, segments, readingScale],
  );
  const showMatnToggle = isLongCandidate && !fitsWithoutClamp;
  const isMatnCollapsed = showMatnToggle && !matnExpanded;
  const matchBelowPreview = measuredMatchBelow ?? fallbackMatchBelow;
  const gradeDef = strings.gradeDefinitions[hadith.gradeBucket];

  useLayoutEffect(() => {
    if (!isLongCandidate) {
      setFitsWithoutClamp(false);
      setMeasuredMatchBelow(null);
      return;
    }

    const el = matnRef.current;
    if (!el) return;

    const measure = () => {
      const fullHeight = el.getBoundingClientRect().height;
      if (fullHeight === 0) return;
      const lineHeight = Number.parseFloat(window.getComputedStyle(el).lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;

      const fits = fullHeight < lineHeight * MATN_MIN_LINES_TO_COLLAPSE;
      setFitsWithoutClamp(fits);

      if (fits || matnExpanded || !segments.some((seg) => seg.match)) {
        setMeasuredMatchBelow(false);
        return;
      }

      const firstMark = el.querySelector('mark');
      if (!firstMark) {
        setMeasuredMatchBelow(false);
        return;
      }

      const pTop = el.getBoundingClientRect().top;
      const markTop = firstMark.getBoundingClientRect().top;
      setMeasuredMatchBelow(markTop - pTop >= lineHeight * MATN_CLEAR_VISIBLE_LINES);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLongCandidate, segments, matnExpanded]);

  const otherBucketCounts = useMemo(() => {
    const bucketCountMap = new Map<GradeBucket, number>();
    for (const alt of others) {
      bucketCountMap.set(alt.gradeBucket, (bucketCountMap.get(alt.gradeBucket) ?? 0) + 1);
    }
    return Array.from(bucketCountMap.entries()).map(([bucket, count]) => ({
      bucket,
      count,
    }));
  }, [others]);

  const isWeak = isUnauthenticBucket(hadith.gradeBucket);
  const altSourceId =
    hadith.hasAltSahih && hadith.dorarId
      ? hadith.dorarId
      : others.find((o) => o.hasAltSahih && o.dorarId)?.dorarId;
  const canShowAlt = Boolean(isWeak && altSourceId && onFetchAltSahih);
  const canShowOsoul = Boolean(hadith.dorarId && hadith.hasOsoul && onFetchOsoul);
  const canShowSimilar = Boolean(
    hadith.dorarId && !isWeak && !canShowAlt && hadith.hasSimilar && onFetchSimilar,
  );
  const hasActionPills = canShowAlt || canShowOsoul || canShowSimilar;

  const loadPanel = async (panel: Exclude<ActivePanel, null>) => {
    const targetId = panel === 'alt' ? altSourceId : hadith.dorarId;
    if (!targetId) return;

    const seq = ++panelSeqRef.current;
    setPanelError(false);
    if (panel === 'osoul' && osoulData !== null) {
      setPanelLoading(false);
      return;
    }
    if (panel === 'alt' && altData !== null) {
      setPanelLoading(false);
      return;
    }
    if (panel === 'similar' && similarData !== null) {
      setPanelLoading(false);
      return;
    }

    setPanelLoading(true);
    try {
      if (panel === 'osoul' && onFetchOsoul) {
        const res = await onFetchOsoul(targetId);
        if (seq === panelSeqRef.current) setOsoulData(res);
      } else if (panel === 'alt' && onFetchAltSahih) {
        const res = await onFetchAltSahih(targetId);
        if (seq === panelSeqRef.current) setAltData(res);
      } else if (panel === 'similar' && onFetchSimilar) {
        const res = await onFetchSimilar(targetId);
        if (seq === panelSeqRef.current) setSimilarData(res);
      }
    } catch {
      if (seq === panelSeqRef.current) setPanelError(true);
    } finally {
      if (seq === panelSeqRef.current) setPanelLoading(false);
    }
  };

  const togglePanel = (panel: Exclude<ActivePanel, null>) => {
    if (activePanel === panel) {
      panelSeqRef.current++;
      setActivePanel(null);
      setPanelLoading(false);
      setPanelError(false);
      return;
    }
    setActivePanel(panel);
    void loadPanel(panel);
  };

  const handleCopy = async () => {
    await onCopy(hadith);
    setJustCopied(true);
    window.setTimeout(() => setJustCopied(false), 1800);
  };

  const handleToggleGradeHelp = () => {
    setShowGradeHelp((prev) => !prev);
    onGradeBadgeOpened?.();
  };

  const handleOpenGradeFromHint = () => {
    setShowGradeHelp(true);
    onGradeBadgeOpened?.();
  };

  const handleToggleMatn = () => {
    const collapsing = matnExpanded;
    setMatnExpanded((prev) => !prev);
    if (collapsing) {
      window.requestAnimationFrame(() => {
        const card = articleRef.current;
        if (card && card.getBoundingClientRect().top < 120) {
          card.scrollIntoView({ block: 'nearest' });
        }
      });
    }
  };

  return (
    <article
      ref={articleRef}
      className={`hadith-sheet scroll-mt-32 rounded-2xl bg-surface px-4 py-4 transition-colors sm:px-5 sm:py-5${
        deferred ? ' hadith-card-deferred' : ''
      }`}
    >
      {/* Row 1: Tappable authenticity pill + Sahabi narrator */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <GradeBadge
          bucket={hadith.gradeBucket}
          strings={strings}
          expanded={showGradeHelp}
          hintPulse={showGradeHint && !showGradeHelp}
          onToggleInfo={handleToggleGradeHelp}
        />

        {hadith.narrator && (
          <div className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
            <User className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
            <span className="truncate">
              {strings.narratorPrefix}{' '}
              <span dir="rtl" lang="ar" className="font-semibold text-ink">
                {hadith.narrator}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Gentle contextual first-time discovery callout pointing to the grade badge */}
      {showGradeHint && !showGradeHelp && (
        <div role="status" className="coach-hint-reveal relative mb-3">
          <span
            aria-hidden="true"
            className="coach-hint-border pointer-events-none absolute -top-[5px] start-5 h-2.5 w-2.5 rotate-45 border-l border-t bg-brand-soft"
          />
          <div className="coach-hint-border flex items-center justify-between gap-2 rounded-xl border bg-brand-soft px-3 py-2 text-xs text-ink">
            <button
              type="button"
              onClick={handleOpenGradeFromHint}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-start font-medium text-ink transition-opacity active:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
              <span className="leading-snug">{strings.gradeHintPrompt}</span>
            </button>
            <button
              type="button"
              onClick={onDismissGradeHint}
              aria-label={strings.dismissHint}
              className="touch-target -me-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Inline classical book definition + plain summary when grade badge is tapped */}
      {showGradeHelp && (
        <div
          role="note"
          className="panel-reveal mb-4 rounded-xl bg-elevated px-3.5 py-3 text-xs"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-semibold text-ink">
              {strings.grades[hadith.gradeBucket]}
            </span>
            <button
              type="button"
              onClick={() => setShowGradeHelp(false)}
              aria-label={strings.close}
              className="touch-target -me-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {gradeDef.quote && (
            <blockquote className="mb-2.5">
              <p className="font-hadith text-[0.98rem] leading-[1.85] text-ink">
                «{gradeDef.quote}»
              </p>
              {gradeDef.source && (
                <footer className="mt-1 text-[0.72rem] font-medium text-brand">
                  — {gradeDef.source}
                </footer>
              )}
            </blockquote>
          )}

          <p
            className={
              gradeDef.quote
                ? 'border-t border-line pt-2 leading-relaxed text-muted'
                : 'leading-relaxed text-muted'
            }
          >
            {gradeDef.summary}
          </p>
        </div>
      )}

      {/* Row 2: Hero Matn — always Arabic RTL for clean diacritic/punctuation shaping */}
      <div
        dir="rtl"
        lang="ar"
        className={`font-hadith text-start text-ink ${MATN_SIZE_CLASS[readingScale]}${
          isMatnCollapsed ? ' matn-clamped' : ''
        }`}
      >
        <p ref={matnRef} id={matnId} className="py-0.5">
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
      </div>

      {showMatnToggle && (
        <div
          className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${
            matnExpanded ? 'mt-2.5' : 'mt-0.5'
          }`}
        >
          <button
            type="button"
            aria-expanded={matnExpanded}
            aria-controls={matnId}
            onClick={handleToggleMatn}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              matnExpanded
                ? 'bg-elevated text-muted hover:bg-subtle hover:text-ink'
                : 'bg-brand-soft text-brand hover:bg-elevated'
            }`}
          >
            <span>{matnExpanded ? strings.showLessMatn : strings.showMoreMatn}</span>
            {matnExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
          </button>

          {isMatnCollapsed && matchBelowPreview && (
            <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-medium text-muted">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <span>{strings.matchBelowPreview}</span>
            </span>
          )}
        </div>
      )}

      {/* Row 3: Scholar-Attributed Verbatim Verdict + Source + Minimal Copy/Share Actions */}
      <div className="mt-4 border-t border-line pt-3">
        {hadith.rawGrade && (
          <p className="mb-2 text-xs leading-relaxed text-muted">
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {hadith.source && (
              <span className="inline-flex items-center gap-1 font-medium text-ink">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
                <span dir="rtl" lang="ar" className="tabular-nums">
                  {hadith.source}
                  {hadith.pageOrNumber ? ` (${hadith.pageOrNumber})` : ''}
                </span>
              </span>
            )}
            {!hadith.rawGrade && hadith.muhaddith && (
              <>
                <span aria-hidden="true" className="text-faint">
                  •
                </span>
                <span dir="rtl" lang="ar" className="text-muted">
                  {hadith.muhaddith}
                </span>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={handleCopy}
              aria-label={justCopied ? strings.copied : strings.copy}
              className="touch-target-y inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {justCopied ? (
                <Check className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{justCopied ? strings.copied : strings.copy}</span>
            </button>

            <button
              type="button"
              onClick={() => void onShare(hadith)}
              aria-label={strings.share}
              className="touch-target-y inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{strings.share}</span>
            </button>
          </div>
        </div>

        {/* Inline Takhrij (primary Sunan/Musnad collections) when provided by Al-Dorar */}
        {hadith.takhrij && (
          <p className="mt-2 text-xs leading-relaxed text-muted">
            <span className="font-semibold text-ink">{strings.takhrijLabel}: </span>
            <span dir="rtl" lang="ar" className="tabular-nums">
              {hadith.takhrij}
            </span>
          </p>
        )}

        {/* Compact on-demand scholarly pills (at most 2 pills, single switchable panel) */}
        {hasActionPills && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {canShowAlt && (
              <button
                type="button"
                aria-expanded={activePanel === 'alt'}
                onClick={() => togglePanel('alt')}
                style={
                  activePanel === 'alt'
                    ? undefined
                    : { backgroundColor: 'var(--sahih-bg)', color: 'var(--sahih-ink)' }
                }
                className={`touch-target-y inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  activePanel === 'alt' ? 'bg-brand text-brand-ink' : ''
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{strings.altSahihButton}</span>
                {activePanel === 'alt' && (
                  <ChevronUp className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
              </button>
            )}

            {canShowOsoul && (
              <button
                type="button"
                aria-expanded={activePanel === 'osoul'}
                onClick={() => togglePanel('osoul')}
                className={`touch-target-y inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  activePanel === 'osoul'
                    ? 'bg-ink text-canvas'
                    : 'bg-elevated text-muted hover:bg-subtle hover:text-ink'
                }`}
              >
                <GitBranch className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{strings.osoulButton}</span>
                {activePanel === 'osoul' && (
                  <ChevronUp className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
              </button>
            )}

            {canShowSimilar && (
              <button
                type="button"
                aria-expanded={activePanel === 'similar'}
                onClick={() => togglePanel('similar')}
                className={`touch-target-y inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  activePanel === 'similar'
                    ? 'bg-ink text-canvas'
                    : 'bg-elevated text-muted hover:bg-subtle hover:text-ink'
                }`}
              >
                <Layers className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{strings.similarButton}</span>
                {activePanel === 'similar' && (
                  <ChevronUp className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
        )}

        {/* Single active expandable scholarly panel */}
        {activePanel && (
          <div className="panel-reveal mt-3 rounded-xl bg-elevated px-3.5 py-3 text-xs">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span
                className={`font-semibold ${
                  activePanel === 'alt' ? 'text-brand' : 'text-ink'
                }`}
              >
                {activePanel === 'osoul'
                  ? strings.osoulTitle
                  : activePanel === 'alt'
                    ? strings.altSahihTitle
                    : strings.similarTitle}
              </span>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                aria-label={strings.close}
                className="touch-target -me-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {panelLoading && (
              <div className="flex items-center gap-2 py-2 text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" aria-hidden="true" />
                <span>{strings.panelLoading}</span>
              </div>
            )}

            {!panelLoading && panelError && (
              <div className="flex items-center justify-between gap-2 py-1 text-muted">
                <span>{strings.panelError}</span>
                <button
                  type="button"
                  onClick={() => void loadPanel(activePanel)}
                  className="hadith-sheet touch-target-y inline-flex min-h-9 items-center rounded-full bg-surface px-3.5 py-1.5 font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {strings.retry}
                </button>
              </div>
            )}

            {!panelLoading && !panelError && activePanel === 'osoul' && (
              osoulData && osoulData.length > 0 ? (
                <ul className="divide-y divide-line">
                  {osoulData.map((entry, idx) => (
                    <li
                      key={`${entry.sourceRef}-${idx}`}
                      className="py-3 first:pt-1 last:pb-0"
                    >
                      {entry.sourceRef && (
                        <p
                          dir="rtl"
                          lang="ar"
                          className="mb-1 text-start text-[0.72rem] font-semibold tabular-nums text-brand"
                        >
                          {entry.sourceRef}
                        </p>
                      )}
                      {entry.sanad && (
                        <p
                          dir="rtl"
                          lang="ar"
                          className="mb-1.5 text-start text-[0.78rem] leading-relaxed text-muted"
                        >
                          {entry.sanad}
                        </p>
                      )}
                      {entry.matn && (
                        <p
                          dir="rtl"
                          lang="ar"
                          className="font-hadith text-start text-[1.02rem] leading-[1.9] text-ink"
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

            {!panelLoading && !panelError && (activePanel === 'alt' || activePanel === 'similar') && (() => {
              const list = activePanel === 'alt' ? altData : similarData;
              if (!list || list.length === 0) {
                return <p className="py-1 text-muted">{strings.panelEmpty}</p>;
              }
              return (
                <ul className="divide-y divide-line">
                  {list.slice(0, 6).map((item) => (
                    <li key={item.id} className="py-3 first:pt-1 last:pb-0">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                        <GradeBadge bucket={item.gradeBucket} strings={strings} size="sm" />
                        {item.narrator && (
                          <div className="inline-flex min-w-0 items-center gap-1 text-[0.7rem] font-medium text-muted">
                            <User className="h-3 w-3 shrink-0 text-faint" aria-hidden="true" />
                            <span className="truncate">
                              {strings.narratorPrefix}{' '}
                              <span dir="rtl" lang="ar" className="font-semibold text-ink">
                                {item.narrator}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                      <p
                        dir="rtl"
                        lang="ar"
                        className="font-hadith text-start text-[1.02rem] leading-[1.9] text-ink"
                      >
                        {item.text}
                      </p>
                      {item.rawGrade && (
                        <p className="mt-1.5 text-[0.72rem] leading-relaxed text-muted">
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
                        <p className="mt-1 inline-flex items-center gap-1 text-[0.7rem] text-muted">
                          <BookOpen className="h-3 w-3 shrink-0 text-faint" aria-hidden="true" />
                          <span dir="rtl" lang="ar" className="tabular-nums">
                            {item.source}
                            {item.pageOrNumber ? ` (${item.pageOrNumber})` : ''}
                          </span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        )}

        {/* Native <details> disclosure for grouped duplicate scholars/sources */}
        {others.length > 0 && (
          <details className="other-rulings mt-3 border-t border-line pt-2">
            <summary className="other-rulings-summary min-h-10 rounded-lg py-1 text-xs font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <span className="tabular-nums">{strings.otherRulingsLabel(others.length)}</span>
              {otherBucketCounts.length > 0 && (
                <span className="ms-auto flex flex-wrap items-center gap-1">
                  {otherBucketCounts.slice(0, 3).map(({ bucket, count }) => (
                    <GradeBadge
                      key={bucket}
                      bucket={bucket}
                      count={count}
                      strings={strings}
                      size="sm"
                    />
                  ))}
                </span>
              )}
            </summary>
            <ul className="mt-2.5 divide-y divide-line rounded-xl bg-elevated px-3.5 py-1 text-xs">
              {others.map((alt) => (
                <li key={alt.id} className="py-2.5">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                    <GradeBadge bucket={alt.gradeBucket} strings={strings} size="sm" />
                    {alt.narrator && (
                      <div className="inline-flex min-w-0 items-center gap-1 text-[0.72rem] font-medium text-muted">
                        <User className="h-3 w-3 shrink-0 text-faint" aria-hidden="true" />
                        <span className="truncate">
                          {strings.narratorPrefix}{' '}
                          <span dir="rtl" lang="ar" className="font-semibold text-ink">
                            {alt.narrator}
                          </span>
                        </span>
                      </div>
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
                  {(alt.source || (!alt.rawGrade && alt.muhaddith)) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.7rem] text-muted">
                      {alt.source && (
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="h-3 w-3 shrink-0 text-faint" aria-hidden="true" />
                          <span dir="rtl" lang="ar" className="tabular-nums">
                            {alt.source}
                            {alt.pageOrNumber ? ` (${alt.pageOrNumber})` : ''}
                          </span>
                        </span>
                      )}
                      {!alt.rawGrade && alt.muhaddith && (
                        <span dir="rtl" lang="ar">{alt.muhaddith}</span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
});
