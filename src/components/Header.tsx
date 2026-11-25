import { SlidersHorizontal } from 'lucide-react';
import type { Locale } from '../domain/hadith';
import type { AppStrings } from '../i18n/strings';
import { AtharLogo } from './AtharLogo';

interface HeaderProps {
  locale: Locale;
  strings: AppStrings;
  onToggleLocale: () => void;
  onOpenSettings: () => void;
  onResetHome: () => void;
}

export function Header({
  locale,
  strings,
  onToggleLocale,
  onOpenSettings,
  onResetHome,
}: HeaderProps) {
  return (
    <header className="safe-pt safe-px">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 py-1">
        <button
          type="button"
          onClick={onResetHome}
          className="group flex min-w-0 items-center gap-3 rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {locale === 'ar' ? (
            <>
              <h1 className="flex shrink-0 items-center">
                <AtharLogo
                  variant="mark"
                  className="h-9 w-auto text-ink transition-transform duration-150 group-active:scale-95"
                />
                <span className="sr-only">{strings.appName}</span>
              </h1>
              <p className="truncate text-xs text-muted">{strings.appSubtitle}</p>
            </>
          ) : (
            <>
              <AtharLogo
                variant="mark"
                className="h-8 w-auto shrink-0 text-ink transition-transform duration-150 group-active:scale-95"
              />
              <div className="min-w-0">
                <h1 className="font-hadith text-[1.4rem] font-bold leading-none text-ink">
                  {strings.appName}
                </h1>
                <p className="mt-0.5 truncate text-xs text-muted">{strings.appSubtitle}</p>
              </div>
            </>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleLocale}
            aria-label={strings.switchLangLabel}
            className="inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-full px-2.5 text-xs font-semibold text-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 active:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {strings.switchLangShort}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={strings.settingsButtonLabel}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 active:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <SlidersHorizontal className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
