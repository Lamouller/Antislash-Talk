import { useState, useEffect } from 'react';

/**
 * Types de modes d'affichage possibles
 */
export type DisplayMode = 'browser' | 'standalone' | 'twa';

/**
 * Hook pour détecter le mode d'exécution de l'application
 * 
 * - browser: Exécuté dans Safari/Chrome normal
 * - standalone: Lancé depuis un raccourci sur l'écran d'accueil (PWA)
 * - twa: Trusted Web Activity (Android)
 * 
 * @returns {object} Informations sur le mode d'affichage
 */
export function useDisplayMode() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('browser');
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    // Détection iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Détection Safari
    const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsSafari(safari);

    // Détection du mode standalone
    const detectDisplayMode = (): DisplayMode => {
      // iOS Safari standalone mode (propriété propriétaire Apple)
      if ((navigator as any).standalone === true) {
        console.log('[useDisplayMode] 📱 iOS Standalone mode detected (navigator.standalone)');
        return 'standalone';
      }

      // Standard PWA display-mode media query
      if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('[useDisplayMode] 📱 Standalone mode detected (display-mode media query)');
        return 'standalone';
      }

      // Trusted Web Activity (Android)
      if (window.matchMedia('(display-mode: fullscreen)').matches) {
        console.log('[useDisplayMode] 📱 TWA/Fullscreen mode detected');
        return 'twa';
      }

      // Document referrer check (certains navigateurs)
      if (document.referrer.startsWith('android-app://')) {
        console.log('[useDisplayMode] 📱 TWA detected via referrer');
        return 'twa';
      }

      console.log('[useDisplayMode] 🌐 Browser mode detected');
      return 'browser';
    };

    const mode = detectDisplayMode();
    setDisplayMode(mode);

    // Écouter les changements de mode (ex: installation PWA pendant l'utilisation)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        console.log('[useDisplayMode] 🔄 Switched to standalone mode');
        setDisplayMode('standalone');
      } else {
        console.log('[useDisplayMode] 🔄 Switched to browser mode');
        setDisplayMode('browser');
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return {
    displayMode,
    isStandalone: displayMode === 'standalone' || displayMode === 'twa',
    isBrowser: displayMode === 'browser',
    isIOS,
    isSafari,
    isIOSStandalone: isIOS && displayMode === 'standalone',
    // Utile pour savoir si on doit appliquer des workarounds iOS
    needsIOSWorkarounds: isIOS && (displayMode === 'standalone' || isSafari)
  };
}
