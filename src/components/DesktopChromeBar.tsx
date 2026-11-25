import { Pin, PinOff, X } from 'lucide-react';
import { formatShortcutLabel } from '../domain/desktopShortcut';
import type { AppStrings } from '../i18n/strings';

interface DesktopChromeBarProps {
  pinned: boolean;
  shortcut: string;
  shortcutEnabled: boolean;
  onTogglePin: () => void;
  onHide: () => void;
  strings: AppStrings;
}

export function DesktopChromeBar({
  pinned,
  shortcut,
  shortcutEnabled,
  onTogglePin,
  onHide,
  strings,
}: DesktopChromeBarProps) {
  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-3 py-1.5 select-none"
    >
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 items-center gap-2 text-[0.6875rem] font-medium text-faint"
      >
        <span data-tauri-drag-region className="truncate">
          {strings.desktopQuickSearch}
        </span>
        {shortcutEnabled && (
          <kbd
            dir="ltr"
            className="rounded border border-line-strong bg-elevated px-1.5 py-0.5 font-sans text-[0.65rem] font-semibold text-muted"
          >
            {formatShortcutLabel(shortcut)}
          </kbd>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={pinned}
          aria-label={pinned ? strings.desktopUnpin : strings.desktopPin}
          title={pinned ? strings.desktopUnpin : strings.desktopPin}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            pinned
              ? 'bg-brand-soft text-brand'
              : 'text-muted hover:bg-elevated hover:text-ink'
          }`}
        >
          {pinned ? (
            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={onHide}
          aria-label={strings.desktopHide}
          title={strings.desktopHide}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
