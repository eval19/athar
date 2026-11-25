import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESKTOP_SHORTCUT,
  DESKTOP_SHORTCUT_PRESETS,
  formatShortcutLabel,
  isValidShortcutId,
} from '../src/domain/desktopShortcut';
import { getStrings } from '../src/i18n/strings';

describe('desktopShortcut', () => {
  it('defaults to the End key and includes End in presets', () => {
    expect(DEFAULT_DESKTOP_SHORTCUT).toBe('End');
    expect(DESKTOP_SHORTCUT_PRESETS.some((p) => p.id === 'End')).toBe(true);
  });

  it('formats preset and custom shortcuts cleanly', () => {
    expect(formatShortcutLabel('End')).toBe('End');
    expect(formatShortcutLabel('Alt+A')).toBe('Alt + A');
    expect(formatShortcutLabel('Ctrl+Alt+H')).toBe('Ctrl + Alt + H');
    expect(formatShortcutLabel('  ')).toBe('End');
  });

  it('validates shortcut identifiers strictly', () => {
    expect(isValidShortcutId('End')).toBe(true);
    expect(isValidShortcutId('Ctrl+Alt+H')).toBe(true);
    expect(isValidShortcutId('')).toBe(false);
    expect(isValidShortcutId('End; rm -rf /')).toBe(false);
  });

  it('provides Arabic and English desktop UI strings', () => {
    for (const locale of ['ar', 'en'] as const) {
      const s = getStrings(locale);
      expect(s.desktopQuickSearch.length).toBeGreaterThan(0);
      expect(s.desktopPin.length).toBeGreaterThan(0);
      expect(s.desktopUnpin.length).toBeGreaterThan(0);
      expect(s.desktopHide.length).toBeGreaterThan(0);
      expect(s.desktopSection.length).toBeGreaterThan(0);
      expect(s.desktopShortcutLabel.length).toBeGreaterThan(0);
      expect(s.desktopShortcutEnabled.length).toBeGreaterThan(0);
      expect(s.desktopAutostart.length).toBeGreaterThan(0);
      expect(s.desktopShortcutError.length).toBeGreaterThan(0);
    }
  });
});
