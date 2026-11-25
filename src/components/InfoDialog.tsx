import { useEffect, useId, useRef } from 'react';
import { Download, Loader2, Monitor, Moon, RefreshCw, Sun, X } from 'lucide-react';
import type { AvailableUpdate } from '../domain/appUpdate';
import type { Locale, ReadingScale, ThemePreference } from '../domain/hadith';
import type { AppStrings } from '../i18n/strings';
import { AtharLogo } from './AtharLogo';

export type ManualUpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'error';

interface InfoDialogProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  themePref: ThemePreference;
  systemScheme: 'light' | 'dark';
  onThemeChange: (pref: ThemePreference) => void;
  readingScale: ReadingScale;
  onReadingScaleChange: (scale: ReadingScale) => void;
  availableUpdate: AvailableUpdate | null;
  updateCheckStatus: ManualUpdateStatus;
  onCheckForUpdates: () => void;
  strings: AppStrings;
}

const SCALES: readonly ReadingScale[] = ['sm', 'md', 'lg'];

let cachedSupportsDisplayTransition: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (cachedSupportsDisplayTransition !== undefined) {
    return cachedSupportsDisplayTransition;
  }
  if (
    typeof window === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  void getComputedStyle(probe).display;
  probe.style.display = 'none';
  cachedSupportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return cachedSupportsDisplayTransition;
}

function supportsTopLayerExit(): boolean {
  return Boolean(window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay());
}

async function closeTopLayerDialog(dialog: HTMLDialogElement): Promise<void> {
  if (!dialog.open) return;
  if (!supportsTopLayerExit()) {
    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations?.({ subtree: true }) ?? [];
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => window.setTimeout(resolve, 400)),
      ]);
    }
    if (!dialog.hasAttribute('data-closing')) return;
    dialog.removeAttribute('data-closing');
  }
  if (dialog.open) dialog.close();
}

export function InfoDialog({
  open,
  onClose,
  locale,
  onLocaleChange,
  themePref,
  systemScheme,
  onThemeChange,
  readingScale,
  onReadingScaleChange,
  availableUpdate,
  updateCheckStatus,
  onCheckForUpdates,
  strings,
}: InfoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.removeAttribute('data-closing');
      dialog.showModal();
    } else if (!open && dialog.open) {
      void closeTopLayerDialog(dialog);
    }
  }, [open]);

  // Light-dismiss fallback & animated exit interception for browsers without full top-layer exit support
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      dialog.removeAttribute('data-closing');
      onClose();
    };
    const handleCancel = (event: Event) => {
      if (!supportsTopLayerExit()) {
        event.preventDefault();
        void closeTopLayerDialog(dialog);
      }
    };

    dialog.addEventListener('close', handleNativeClose);
    dialog.addEventListener('cancel', handleCancel);

    if ('closedBy' in HTMLDialogElement.prototype) {
      return () => {
        dialog.removeEventListener('close', handleNativeClose);
        dialog.removeEventListener('cancel', handleCancel);
      };
    }

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const insideContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!insideContent) {
        void closeTopLayerDialog(dialog);
      }
    };

    dialog.addEventListener('click', handleBackdropClick);
    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  const themeOptions: Array<{
    value: ThemePreference;
    label: string;
    icon: typeof Sun;
  }> = [
    {
      value: 'system',
      label:
        systemScheme === 'dark'
          ? strings.systemCurrentlyDark
          : strings.systemCurrentlyLight,
      icon: Monitor,
    },
    { value: 'light', label: strings.themes.light, icon: Sun },
    { value: 'dark', label: strings.themes.dark, icon: Moon },
  ];

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby={titleId}
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <AtharLogo className="h-7 w-7" />
            <h2 id={titleId} className="text-base font-bold text-ink">
              {strings.settingsTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={strings.close}
            className="-me-1.5 inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          {/* Language */}
          <section>
            <h3 className="mb-2 text-xs font-semibold text-muted">
              {strings.languageSection}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(['ar', 'en'] as const).map((lang) => {
                const active = locale === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onLocaleChange(lang)}
                    className={
                      active
                        ? 'min-h-10 rounded-xl border border-brand bg-brand-soft px-3 py-2 text-sm font-semibold text-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
                        : 'min-h-10 rounded-xl border border-transparent bg-elevated px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
                    }
                  >
                    {lang === 'ar' ? 'العربية' : 'English'}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Appearance (3-state: System / Light / Dark) */}
          <section>
            <h3 className="mb-2 text-xs font-semibold text-muted">
              {strings.themeSection}
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {themeOptions.map(({ value, label, icon: Icon }) => {
                const active = themePref === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onThemeChange(value)}
                    className={
                      active
                        ? 'flex min-h-11 items-center gap-2.5 rounded-xl border border-brand bg-brand-soft px-3.5 py-2.5 text-start text-sm font-semibold text-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
                        : 'flex min-h-11 items-center gap-2.5 rounded-xl border border-transparent bg-elevated px-3.5 py-2.5 text-start text-sm font-medium text-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Hadith Reading Size */}
          <section>
            <h3 className="mb-2 text-xs font-semibold text-muted">
              {strings.readingSizeSection}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {SCALES.map((scale) => {
                const active = readingScale === scale;
                return (
                  <button
                    key={scale}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onReadingScaleChange(scale)}
                    className={
                      active
                        ? 'min-h-10 rounded-xl border border-brand bg-brand-soft px-3 py-2 text-xs font-semibold text-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
                        : 'min-h-10 rounded-xl border border-transparent bg-elevated px-3 py-2 text-xs font-medium text-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
                    }
                  >
                    {strings.readingSizes[scale]}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Source & Attribution */}
          <section className="border-t border-line pt-4">
            <h3 className="mb-1 text-xs font-semibold text-ink">
              {strings.aboutSection}
            </h3>
            <p className="text-xs leading-relaxed text-muted">
              {strings.aboutCredit}
            </p>
            <p className="mt-2 text-[0.7rem] font-medium tabular-nums text-faint">
              {strings.appName} • {strings.aboutVersion}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              {availableUpdate ? (
                <a
                  href={availableUpdate.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold tabular-nums text-brand-ink transition-opacity hover:opacity-95 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {strings.downloadUpdate} ({availableUpdate.version})
                  </span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onCheckForUpdates}
                  disabled={updateCheckStatus === 'checking'}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-elevated px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-subtle hover:text-ink active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {updateCheckStatus === 'checking' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {updateCheckStatus === 'checking'
                      ? strings.checkingForUpdates
                      : strings.checkForUpdates}
                  </span>
                </button>
              )}

              {!availableUpdate && updateCheckStatus === 'up-to-date' && (
                <span role="status" className="text-xs font-medium text-brand">
                  {strings.upToDate}
                </span>
              )}
              {!availableUpdate && updateCheckStatus === 'error' && (
                <span role="status" className="text-xs font-medium text-muted">
                  {strings.updateCheckFailed}
                </span>
              )}
            </div>
          </section>
        </div>
      </div>
    </dialog>
  );
}
