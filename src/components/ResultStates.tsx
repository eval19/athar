import { Clock, Download, RefreshCw, SearchX, WifiOff, X } from 'lucide-react';
import type { AvailableUpdate } from '../domain/appUpdate';
import { EXAMPLE_QUERIES, type AppStrings } from '../i18n/strings';

export function ResultsSkeleton() {
  return (
    <div className="space-y-3.5" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="hadith-sheet animate-pulse rounded-2xl bg-surface p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="h-5 w-20 rounded-full bg-elevated" />
            <div className="h-4 w-28 rounded-full bg-elevated" />
          </div>
          <div className="space-y-2.5">
            <div className="h-5 w-full rounded bg-elevated" />
            <div className="h-5 w-11/12 rounded bg-elevated" />
            <div className="h-5 w-2/3 rounded bg-elevated" />
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <div className="h-3.5 w-3/4 rounded bg-elevated" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface InitialWelcomeProps {
  recentSearches: string[];
  availableUpdate?: AvailableUpdate | null;
  onSelectQuery: (query: string) => void;
  onRemoveRecent: (query: string) => void;
  onClearRecent: () => void;
  onDismissUpdate?: (version: string) => void;
  strings: AppStrings;
}

export function InitialWelcome({
  recentSearches,
  availableUpdate,
  onSelectQuery,
  onRemoveRecent,
  onClearRecent,
  onDismissUpdate,
  strings,
}: InitialWelcomeProps) {
  return (
    <div className="space-y-7 px-1 pb-2 pt-5">
      {availableUpdate && (
        <aside
          role="status"
          aria-live="polite"
          className="coach-hint-border panel-reveal rounded-2xl border bg-brand-soft px-4 py-3 text-ink"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1 space-y-2.5 py-0.5">
              <div>
                <p className="text-xs font-bold leading-snug tabular-nums text-ink">
                  {strings.updateAvailableTitle(availableUpdate.version)}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink opacity-80">
                  {strings.updateAvailableHint}
                </p>
              </div>
              <a
                href={availableUpdate.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-brand-ink transition-opacity hover:opacity-95 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-brand-soft"
              >
                <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{strings.downloadUpdate}</span>
              </a>
            </div>
            {onDismissUpdate && (
              <button
                type="button"
                onClick={() => onDismissUpdate(availableUpdate.version)}
                aria-label={strings.dismissUpdate}
                className="-me-1.5 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-brand transition-colors hover:bg-surface active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </aside>
      )}

      <section>
        <h2 className="font-hadith text-[1.45rem] font-bold leading-snug text-ink">
          {strings.emptyHeading}
        </h2>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">
          {strings.emptyBody}
        </p>

        <div className="mt-5">
          <p className="mb-2.5 text-xs font-semibold text-faint">{strings.tryExamples}</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                dir="rtl"
                lang="ar"
                onClick={() => onSelectQuery(example)}
                className="hadith-sheet inline-flex min-h-10 items-center rounded-full bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:text-brand active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      {recentSearches.length > 0 && (
        <section className="border-t border-line pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{strings.recentSearches}</span>
            </h2>
            <button
              type="button"
              onClick={onClearRecent}
              className="touch-target-y -me-2 inline-flex min-h-9 items-center rounded-full px-2.5 text-xs font-medium text-faint transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {strings.clearRecent}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <div
                key={term}
                className="inline-flex items-center rounded-full border border-line bg-canvas text-[0.8125rem] text-ink transition-colors hover:border-line-strong"
              >
                <button
                  type="button"
                  onClick={() => onSelectQuery(term)}
                  dir="rtl"
                  lang="ar"
                  className="touch-target-y inline-flex min-h-9 items-center rounded-full py-1 pe-1.5 ps-3.5 font-medium text-ink transition-colors hover:text-brand active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {term}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveRecent(term)}
                  aria-label={`${strings.clearSearch} ${term}`}
                  className="me-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-elevated hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface EmptyResultsProps {
  suggestions: string[];
  onSelectQuery: (query: string) => void;
  strings: AppStrings;
}

export function EmptyResults({
  suggestions,
  onSelectQuery,
  strings,
}: EmptyResultsProps) {
  return (
    <div role="status" className="px-4 py-12 text-center">
      <SearchX className="mx-auto mb-3 h-6 w-6 text-faint" aria-hidden="true" />
      <h2 className="text-base font-bold text-ink">{strings.noResultsHeading}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
        {strings.noResultsBody}
      </p>

      {suggestions.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-medium text-faint">{strings.didYouMean}</span>
          {suggestions.map((alt) => (
            <button
              key={alt}
              type="button"
              dir="rtl"
              lang="ar"
              onClick={() => onSelectQuery(alt)}
              className="inline-flex min-h-10 items-center rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand transition-opacity active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {alt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ErrorStateProps {
  onRetry: () => void;
  strings: AppStrings;
}

export function ErrorState({ onRetry, strings }: ErrorStateProps) {
  return (
    <div role="alert" className="px-4 py-12 text-center">
      <WifiOff className="mx-auto mb-3 h-6 w-6 text-faint" aria-hidden="true" />
      <h2 className="text-base font-bold text-ink">{strings.errorHeading}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
        {strings.errorBody}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-ink transition-opacity hover:opacity-95 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        <span>{strings.retry}</span>
      </button>
    </div>
  );
}
