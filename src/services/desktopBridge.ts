import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { DEFAULT_DESKTOP_SHORTCUT } from '../domain/desktopShortcut';
import type { HadithResult, Locale, ReadingScale, ThemePreference } from '../domain/hadith';

export interface DesktopState {
  shortcut: string;
  shortcutEnabled: boolean;
  pinned: boolean;
  autostart: boolean;
}

export interface ReaderPayload {
  hadith: HadithResult;
  others: HadithResult[];
  highlightQuery: string;
  locale: Locale;
  readingScale: ReadingScale;
  themePref: ThemePreference;
}

export const DEFAULT_DESKTOP_STATE: DesktopState = {
  shortcut: DEFAULT_DESKTOP_SHORTCUT,
  shortcutEnabled: true,
  pinned: false,
  autostart: false,
};

export function isTauriDesktop(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>)
  );
}

export function isReaderView(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('view') === 'reader';
}

export async function desktopFetch(
  url: string,
  options?: { accept?: string; maxBytes?: number },
): Promise<string> {
  return invoke<string>('desktop_fetch', {
    url,
    accept: options?.accept,
    maxBytes: options?.maxBytes,
  });
}

export async function getDesktopState(): Promise<DesktopState> {
  if (!isTauriDesktop()) return DEFAULT_DESKTOP_STATE;
  return invoke<DesktopState>('get_desktop_state');
}

export async function hideDesktopWindow(): Promise<void> {
  if (!isTauriDesktop()) return;
  await invoke('hide_window');
}

export async function setDesktopPinned(pinned: boolean): Promise<DesktopState> {
  if (!isTauriDesktop()) return { ...DEFAULT_DESKTOP_STATE, pinned };
  return invoke<DesktopState>('set_pinned', { pinned });
}

export async function setDesktopShortcut(
  shortcut: string,
  enabled: boolean,
): Promise<DesktopState> {
  if (!isTauriDesktop()) {
    return { ...DEFAULT_DESKTOP_STATE, shortcut, shortcutEnabled: enabled };
  }
  return invoke<DesktopState>('set_shortcut', { shortcut, enabled });
}

export async function setDesktopAutostart(enabled: boolean): Promise<DesktopState> {
  if (!isTauriDesktop()) return { ...DEFAULT_DESKTOP_STATE, autostart: enabled };
  return invoke<DesktopState>('set_autostart', { enabled });
}

export async function listenFocusSearch(callback: () => void): Promise<UnlistenFn> {
  if (!isTauriDesktop()) return () => {};
  return listen('athar:focus-search', () => callback());
}

export async function listenDesktopState(
  callback: (state: DesktopState) => void,
): Promise<UnlistenFn> {
  if (!isTauriDesktop()) return () => {};
  return listen<DesktopState>('athar:desktop-state', (event) => {
    callback(event.payload);
  });
}

export async function openDesktopReader(payload: ReaderPayload): Promise<void> {
  if (!isTauriDesktop()) return;
  await invoke('open_reader', { payload });
}

export async function getDesktopReaderPayload(): Promise<ReaderPayload | null> {
  if (!isTauriDesktop()) return null;
  return invoke<ReaderPayload | null>('get_reader_payload');
}

export async function hideDesktopReader(): Promise<void> {
  if (!isTauriDesktop()) return;
  await invoke('hide_reader');
}

export async function getDesktopReaderPinned(): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  return invoke<boolean>('get_reader_pinned');
}

export async function setDesktopReaderPinned(pinned: boolean): Promise<boolean> {
  if (!isTauriDesktop()) return pinned;
  return invoke<boolean>('set_reader_pinned', { pinned });
}

export async function listenReaderPayload(
  callback: (payload: ReaderPayload) => void,
): Promise<UnlistenFn> {
  if (!isTauriDesktop()) return () => {};
  return listen<ReaderPayload>('athar:reader-payload', (event) => {
    callback(event.payload);
  });
}

export async function listenReaderClosed(callback: () => void): Promise<UnlistenFn> {
  if (!isTauriDesktop()) return () => {};
  return listen('athar:reader-closed', () => callback());
}
