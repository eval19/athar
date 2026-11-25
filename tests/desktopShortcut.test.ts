import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DESKTOP_SHORTCUT,
  DESKTOP_SHORTCUT_PRESETS,
  formatShortcutLabel,
  isValidShortcutId,
} from '../src/domain/desktopShortcut';
import { getStrings } from '../src/i18n/strings';
import {
  loadReaderReadingScale,
  loadReaderTashkeel,
  loadReadingScale,
  saveReaderReadingScale,
  saveReaderTashkeel,
  saveReadingScale,
  STORAGE_KEYS,
} from '../src/services/preferences';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

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
      expect(s.readerOpen.length).toBeGreaterThan(0);
      expect(s.readerVerdictTab.length).toBeGreaterThan(0);
      expect(s.readerGradeTab.length).toBeGreaterThan(0);
      expect(s.readerFontSmaller.length).toBeGreaterThan(0);
      expect(s.readerFontLarger.length).toBeGreaterThan(0);
      expect(s.readerOtherRulingsTab(3)).toContain('3');
      expect(s.readerPrevHadith.length).toBeGreaterThan(0);
      expect(s.readerNextHadith.length).toBeGreaterThan(0);
      expect(s.readerScholarsVerdictLabel.length).toBeGreaterThan(0);
      expect(s.readerPositionLabel(2, 10)).toContain('2');
      expect(s.readerPositionLabel(2, 10)).toContain('10');

      const readerEnhancementStrings = [
        s.readerToggleTashkeel,
        s.readerOpenDorar,
        s.readerResizeDivider,
        s.readerCautionSevere,
        s.readerJumpAltSahih,
      ];
      for (const value of readerEnhancementStrings) {
        expect(value.length).toBeGreaterThan(0);
        expect(value).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }

    expect(getStrings('ar').readerOtherRulingsTab(3)).toBe('أحكام أخرى (3)');
    expect(getStrings('en').readerOtherRulingsTab(3)).toBe('Other Rulings (3)');
    expect(getStrings('ar').readerPositionLabel(2, 10)).toBe('2 من 10');
    expect(getStrings('en').readerPositionLabel(2, 10)).toBe('2 of 10');
  });

  it('keeps reader reading scale storage independent from main popup reading scale', () => {
    expect(STORAGE_KEYS.readerReadingScale).not.toBe(STORAGE_KEYS.readingScale);

    const localStorage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage });
    try {
      expect(loadReadingScale()).toBe('md');
      expect(loadReaderReadingScale()).toBe('md');

      saveReadingScale('sm');
      saveReaderReadingScale('lg');

      expect(loadReadingScale()).toBe('sm');
      expect(loadReaderReadingScale()).toBe('lg');
      expect(localStorage.getItem(STORAGE_KEYS.readingScale)).toBe('sm');
      expect(localStorage.getItem(STORAGE_KEYS.readerReadingScale)).toBe('lg');

      localStorage.setItem(STORAGE_KEYS.readerReadingScale, 'xl');
      expect(loadReaderReadingScale()).toBe('md');
      expect(loadReadingScale()).toBe('sm');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('persists reader tashkeel toggle preference independently with default true', () => {
    expect(STORAGE_KEYS.readerTashkeel).toBe('athar:reader-tashkeel');

    const localStorage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage });
    try {
      expect(loadReaderTashkeel()).toBe(true);

      saveReaderTashkeel(false);
      expect(loadReaderTashkeel()).toBe(false);
      expect(localStorage.getItem(STORAGE_KEYS.readerTashkeel)).toBe('0');

      saveReaderTashkeel(true);
      expect(loadReaderTashkeel()).toBe(true);
      expect(localStorage.getItem(STORAGE_KEYS.readerTashkeel)).toBe('1');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
