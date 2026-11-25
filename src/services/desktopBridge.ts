import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { DEFAULT_DESKTOP_SHORTCUT } from '../domain/desktopShortcut';

export interface DesktopState {
  shortcut: string;
  shortcutEnabled: boolean;
  pinned: boolean;
  autostart: boolean;
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
