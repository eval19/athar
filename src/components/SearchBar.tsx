import { useRef } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import type { AppStrings } from '../i18n/strings';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onClear: () => void;
  isLoading: boolean;
  strings: AppStrings;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  isLoading,
  strings,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inputRef.current?.blur();
    onSubmit(value);
  };

  const handleClear = () => {
    onClear();
    inputRef.current?.focus();
  };

  return (
    <search className="w-full">
      <form
        onSubmit={handleSubmit}
        role="search"
        className="search-bar-shell flex items-center gap-2 rounded-2xl bg-surface p-1.5"
      >
        <div className="flex h-10 w-9 shrink-0 items-center justify-center text-muted">
          {isLoading ? (
            <Loader2 className="h-[1.125rem] w-[1.125rem] animate-spin text-brand" aria-hidden="true" />
          ) : (
            <Search className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
          )}
        </div>

        <input
          ref={inputRef}
          type="search"
          dir="rtl"
          lang="ar"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={strings.searchPlaceholder}
          aria-label={strings.searchPlaceholder}
          className="h-10 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-faint focus:outline-none"
        />

        {value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={strings.clearSearch}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <button
          type="submit"
          disabled={value.trim().length < 2}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink transition-opacity hover:opacity-95 active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {strings.searchButton}
        </button>
      </form>
    </search>
  );
}
