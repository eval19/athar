import type { FilterMode } from '../domain/hadith';
import type { AppStrings } from '../i18n/strings';

interface FilterPillsProps {
  value: FilterMode;
  onChange: (filter: FilterMode) => void;
  strings: AppStrings;
}

const FILTER_ORDER: readonly FilterMode[] = ['all', 'sahih', 'hasan', 'weak'];

export function FilterPills({ value, onChange, strings }: FilterPillsProps) {
  return (
    <div
      role="group"
      aria-label={strings.filtersLabel}
      className="no-scrollbar flex items-center gap-2 overflow-x-auto py-1.5"
    >
      {FILTER_ORDER.map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(mode)}
            className={
              active
                ? 'touch-target-y inline-flex min-h-9 shrink-0 items-center rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-canvas transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
                : 'touch-target-y inline-flex min-h-9 shrink-0 items-center rounded-full bg-elevated px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-subtle hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
            }
          >
            {strings.filters[mode]}
          </button>
        );
      })}
    </div>
  );
}
