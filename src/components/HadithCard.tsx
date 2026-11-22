import { memo, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronUp,
  Copy,
  GitBranch,
  Layers,
  Loader2,
  Share2,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { findArabicHighlightSegments } from '../domain/arabicNormalize';
import { isUnauthenticBucket } from '../domain/gradeClassifier';
import type { GradeBucket, HadithResult, OsoulEntry, ReadingScale } from '../domain/hadith';
import type { AppStrings } from '../i18n/strings';
import { GradeBadge } from './GradeBadge';

type ActivePanel = 'osoul' | 'alt' | 'similar' | null;

interface HadithCardProps {
  hadith: HadithResult;
  others?: HadithResult[];
  highlightQuery: string;
  readingScale: ReadingScale;
  deferred?: boolean;
  strings: AppStrings;
  onCopy: (hadith: HadithResult) => Promise<void>;
  onShare: (hadith: HadithResult) => Promise<void>;
  onFetchOsoul?: (dorarId: string) => Promise<OsoulEntry[]>;
  onFetchAltSahih?: (dorarId: string) => Promise<HadithResult[]>;
  onFetchSimilar?: (dorarId: string) => Promise<HadithResult[]>;
}

const MATN_SIZE_CLASS: Record<ReadingScale, string> = {
  sm: 'text-[1.125rem] leading-[1.95]',
  md: 'text-[1.3125rem] leading-[2.05]',
  lg: 'text-[1.5rem] leading-[2.1]',
};

export const HadithCard = memo(function HadithCard({
  hadith,
  others = [],
  highlightQuery,
  readingScale,
  deferred = false,
  strings,
  onCopy,
  onShare,
  onFetchOsoul,
  onFetchAltSahih,
  onFetchSimilar,
}: HadithCardProps) {
  const [justCopied, setJustCopied] = useState(false);
  const [showGradeHelp, setShowGradeHelp] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState(false);
  const [osoulData, setOsoulData] = useState<OsoulEntry[] | null>(null);
  const [altData, setAltData] = useState<HadithResult[] | null>(null);
  const [similarData, setSimilarData] = useState<HadithResult[] | null>(null);
  const panelSeqRef = useRef(0);

  const segments = useMemo(
    () => findArabicHighlightSegments(hadith.text, highlightQuery),
    [hadith.text, highlightQuery],
  );
  const gradeDef = strings.gradeDefinitions[hadith.gradeBucket];

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

  return (
    <article
      className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 transition-colors${
        deferred ? ' hadith-card-deferred' : ''
      }`}
    >
      {/* Row 1: Tappable authenticity pill + Sahabi narrator */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <GradeBadge
          bucket={hadith.gradeBucket}
          strings={strings}
          expanded={showGradeHelp}
          onToggleInfo={() => setShowGradeHelp((prev) => !prev)}
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

      {/* Inline classical book definition + plain summary when grade badge is tapped */}
      {showGradeHelp && (
        <div
          role="note"
          className="panel-reveal mb-3 rounded-xl border border-line bg-canvas px-3.5 py-3 text-xs"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-semibold text-ink">
              {strings.grades[hadith.gradeBucket]}
            </span>
            <button
              type="button"
              onClick={() => setShowGradeHelp(false)}
              aria-label={strings.close}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint hover:bg-elevated hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {gradeDef.quote && (
            <blockquote className="mb-2 border-s-2 border-brand ps-2.5">
              <p className="leading-relaxed text-ink">«{gradeDef.quote}»</p>
              {gradeDef.source && (
                <footer className="mt-1 text-[0.7rem] font-medium text-brand">
                  — {gradeDef.source}
                </footer>
              )}
            </blockquote>
          )}

          <p className="leading-relaxed text-muted">{gradeDef.summary}</p>
        </div>
      )}

      {/* Row 2: Hero Matn — always Arabic RTL for clean diacritic/punctuation shaping */}
      <p
        dir="rtl"
        lang="ar"
        className={`font-hadith text-start text-ink ${MATN_SIZE_CLASS[readingScale]}`}
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
                <span dir="rtl" lang="ar">
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

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              aria-label={justCopied ? strings.copied : strings.copy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
            <span dir="rtl" lang="ar">
              {hadith.takhrij}
            </span>
          </p>
        )}

        {/* Compact on-demand scholarly pills (at most 2 pills, single switchable panel) */}
        {hasActionPills && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  activePanel === 'alt'
                    ? 'border-brand bg-brand text-brand-ink'
                    : 'border-line'
                }`}
              >
                <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  activePanel === 'osoul'
                    ? 'border-ink bg-ink text-canvas'
                    : 'border-line bg-canvas text-muted hover:text-ink'
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  activePanel === 'similar'
                    ? 'border-ink bg-ink text-canvas'
                    : 'border-line bg-canvas text-muted hover:text-ink'
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
          <div
            className={`panel-reveal mt-2.5 rounded-xl border bg-canvas p-3 text-xs ${
              activePanel === 'alt' ? 'border-brand' : 'border-line'
            }`}
          >
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
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint hover:bg-elevated hover:text-ink"
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
                  className="rounded-lg border border-line bg-surface px-2.5 py-1 font-semibold text-brand"
                >
                  {strings.retry}
                </button>
              </div>
            )}

            {!panelLoading && !panelError && activePanel === 'osoul' && (
              osoulData && osoulData.length > 0 ? (
                <ul className="space-y-2.5">
                  {osoulData.map((entry, idx) => (
                    <li
                      key={`${entry.sourceRef}-${idx}`}
                      className="rounded-lg border border-line bg-surface p-2.5"
                    >
                      {entry.sourceRef && (
                        <p
                          dir="rtl"
                          lang="ar"
                          className="mb-1 text-start text-[0.72rem] font-semibold text-brand"
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
                <ul className="space-y-2.5">
                  {list.slice(0, 6).map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-line bg-surface p-2.5"
                    >
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
                          <span dir="rtl" lang="ar">
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
          <details className="other-rulings mt-3 border-t border-line pt-2.5">
            <summary className="other-rulings-summary text-xs font-semibold text-brand">
              <span>{strings.otherRulingsLabel(others.length)}</span>
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
            <ul className="mt-2.5 space-y-2">
              {others.map((alt) => (
                <li
                  key={alt.id}
                  className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs"
                >
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
                          <span dir="rtl" lang="ar">
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
