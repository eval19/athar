export interface DesktopShortcutOption {
  id: string;
  label: string;
}

export const DEFAULT_DESKTOP_SHORTCUT = 'End';

export const DESKTOP_SHORTCUT_PRESETS: readonly DesktopShortcutOption[] = [
  { id: 'End', label: 'End' },
  { id: 'Insert', label: 'Insert' },
  { id: 'F9', label: 'F9' },
  { id: 'Alt+A', label: 'Alt + A' },
  { id: 'Ctrl+Alt+H', label: 'Ctrl + Alt + H' },
];

export function formatShortcutLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_DESKTOP_SHORTCUT;
  const preset = DESKTOP_SHORTCUT_PRESETS.find(
    (item) => item.id.toLowerCase() === trimmed.toLowerCase(),
  );
  if (preset) return preset.label;
  return trimmed
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' + ');
}

export function isValidShortcutId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 32) return false;
  return /^[A-Za-z0-9+]+$/.test(trimmed);
}
