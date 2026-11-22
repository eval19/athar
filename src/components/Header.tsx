import { SlidersHorizontal } from 'lucide-react';
import type { AppStrings } from '../i18n/strings';
import { AtharLogo } from './AtharLogo';

interface HeaderProps {
  strings: AppStrings;
  onToggleLocale: () => void;
  onOpenSettings: () => void;
  onResetHome: () => void;
}

export function Header({
  strings,
  onToggleLocale,
  onOpenSettings,
  onResetHome,
}: HeaderProps) {
  return (
    <header className="safe-pt safe-px bg-canvas">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 py-2">
        <button
          type="button"
          onClick={onResetHome}
          className="group flex items-center gap-3 rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <AtharLogo className="h-9 w-9 shrink-0 transition-transform duration-150 group-active:scale-95" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight tracking-tight text-ink">
              {strings.appName}
            </h1>
            <p className="truncate text-xs text-muted">{strings.appSubtitle}</p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleLocale}
            aria-label={strings.switchLangLabel}
            className="inline-flex h-9 min-w-[2.5rem] items-center justify-center rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-ink transition-colors hover:bg-elevated active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {strings.switchLangShort}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={strings.settingsButtonLabel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
