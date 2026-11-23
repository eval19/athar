import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';

const LIGHT_CHROME_BG = '#F6F3EC';
const DARK_CHROME_BG = '#121312';

export async function syncNativeSystemBars(resolvedScheme: 'light' | 'dark'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await EdgeToEdge.setBackgroundColor({
      color: resolvedScheme === 'dark' ? DARK_CHROME_BG : LIGHT_CHROME_BG,
    });
  } catch {
    // EdgeToEdge may be unavailable on older platforms or web
  }

  try {
    await StatusBar.setStyle({
      style: resolvedScheme === 'dark' ? Style.Dark : Style.Light,
    });
  } catch {
    // Ignore status bar style failures
  }
}
