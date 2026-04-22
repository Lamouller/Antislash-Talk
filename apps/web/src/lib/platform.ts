import { Capacitor } from '@capacitor/core';

export type Platform = 'ios' | 'android' | 'web';

export function getPlatform(): Platform {
  const p = Capacitor.getPlatform();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Delay avant tentative d'auto-resume apres visibility change.
 * Android WebView applique un background throttle plus long que iOS/web.
 */
export function getVisibilityResumeDelayMs(): number {
  const p = getPlatform();
  return p === 'android' ? 1500 : 500;
}
