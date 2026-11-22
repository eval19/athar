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
      className="no-scrollbar flex items-center gap-2 overflow-x-auto py-1"
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
                ? 'shrink-0 rounded-full border border-brand bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-ink transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
                : 'shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
            }
          >
            {strings.filters[mode]}
          </button>
        );
      })}
    </div>
  );
}
