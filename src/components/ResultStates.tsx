import { Clock, RefreshCw, SearchX, Sparkles, WifiOff, X } from 'lucide-react';
import { EXAMPLE_QUERIES, type AppStrings } from '../i18n/strings';

export function ResultsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-line bg-surface p-5"
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
  onSelectQuery: (query: string) => void;
  onRemoveRecent: (query: string) => void;
  onClearRecent: () => void;
  strings: AppStrings;
}

export function InitialWelcome({
  recentSearches,
  onSelectQuery,
  onRemoveRecent,
  onClearRecent,
  strings,
}: InitialWelcomeProps) {
  return (
    <div className="space-y-5 pt-3">
      {recentSearches.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{strings.recentSearches}</span>
            </h2>
            <button
              type="button"
              onClick={onClearRecent}
              className="text-xs font-medium text-faint transition-colors hover:text-ink"
            >
              {strings.clearRecent}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <div
                key={term}
                className="inline-flex items-center rounded-full border border-line bg-canvas text-xs text-ink"
              >
                <button
                  type="button"
                  onClick={() => onSelectQuery(term)}
                  dir="rtl"
                  lang="ar"
                  className="py-1.5 ps-3 pe-1.5 font-medium hover:text-brand"
                >
                  {term}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveRecent(term)}
                  aria-label={`${strings.clearSearch} ${term}`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-faint hover:text-ink"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-ink">{strings.emptyHeading}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{strings.emptyBody}</p>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-faint">{strings.tryExamples}</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                dir="rtl"
                lang="ar"
                onClick={() => onSelectQuery(example)}
                className="rounded-full border border-line bg-canvas px-3.5 py-1.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand active:scale-95"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>
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
    <div
      role="status"
      className="rounded-2xl border border-line bg-surface px-5 py-10 text-center"
    >
      <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-elevated text-muted">
        <SearchX className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="text-base font-bold text-ink">{strings.noResultsHeading}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
        {strings.noResultsBody}
      </p>

      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-medium text-faint">{strings.didYouMean}</span>
          {suggestions.map((alt) => (
            <button
              key={alt}
              type="button"
              dir="rtl"
              lang="ar"
              onClick={() => onSelectQuery(alt)}
              className="rounded-full border border-brand bg-brand-soft px-3.5 py-1 text-sm font-semibold text-brand"
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
    <div
      role="alert"
      className="rounded-2xl border border-line bg-surface px-5 py-10 text-center"
    >
      <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-elevated text-muted">
        <WifiOff className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="text-base font-bold text-ink">{strings.errorHeading}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
        {strings.errorBody}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-ink transition-opacity hover:opacity-95 active:scale-95"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        <span>{strings.retry}</span>
      </button>
    </div>
  );
}
