import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook to manage Screen Wake Lock API with iOS fallback
 * Prevents the device screen from turning off during recording
 * 
 * Strategy:
 * 1. Use native Wake Lock API if available (Chrome, Edge, Android)
 * 2. Fallback to NoSleep pattern for iOS (video + audio workaround)
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
 * @see https://github.com/richtr/NoSleep.js (inspiration for iOS fallback)
 */

// Base64 encoded minimal MP4 video (1x1 pixel, silent, ~1 second loop)
// This is the NoSleep.js pattern - a video is more reliable than audio on iOS
const NOSLEEP_VIDEO_BASE64 = 'data:video/mp4;base64,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';

// Longer silent audio (10 seconds of silence) for better iOS compatibility
const SILENT_AUDIO_BASE64 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export function useWakeLock() {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const noSleepVideoRef = useRef<HTMLVideoElement | null>(null);
  const noSleepAudioRef = useRef<HTMLAudioElement | null>(null);
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect iOS
  const isIOS = useRef(
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream
  );

  // Detect if native Wake Lock is available
  const hasNativeWakeLock = useRef(
    typeof navigator !== 'undefined' && 'wakeLock' in navigator
  );

  useEffect(() => {
    // On iOS or browsers without Wake Lock, we use fallback
    const supported = hasNativeWakeLock.current || isIOS.current;
    setIsSupported(supported);

    console.log(`[Wake Lock] 🔍 Detection:`, {
      isIOS: isIOS.current,
      hasNativeWakeLock: hasNativeWakeLock.current,
      willUseFallback: !hasNativeWakeLock.current && isIOS.current
    });
  }, []);

  /**
   * Create NoSleep elements (video + audio) for iOS fallback
   */
  const createNoSleepElements = useCallback(() => {
    // Create video element (most reliable for iOS)
    if (!noSleepVideoRef.current) {
      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('muted', '');
      video.setAttribute('loop', '');
      video.setAttribute('title', 'NoSleep');
      video.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none;';
      
      // Use the base64 video
      video.src = NOSLEEP_VIDEO_BASE64;
      
      document.body.appendChild(video);
      noSleepVideoRef.current = video;
      console.log('[Wake Lock] 🎬 NoSleep video element created');
    }

    // Create audio element as backup
    if (!noSleepAudioRef.current) {
      const audio = document.createElement('audio');
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');
      audio.setAttribute('loop', '');
      audio.style.cssText = 'position:fixed;left:-100px;top:-100px;';
      
      audio.src = SILENT_AUDIO_BASE64;
      
      document.body.appendChild(audio);
      noSleepAudioRef.current = audio;
      console.log('[Wake Lock] 🔇 NoSleep audio element created');
    }
  }, []);

  /**
   * Start iOS fallback (NoSleep pattern)
   */
  const startIOSFallback = useCallback(async (): Promise<boolean> => {
    console.log('[Wake Lock] 🍎 Starting iOS fallback (NoSleep pattern)...');
    
    createNoSleepElements();

    try {
      // Try to play video first (more reliable)
      if (noSleepVideoRef.current) {
        noSleepVideoRef.current.muted = true;
        await noSleepVideoRef.current.play();
        console.log('[Wake Lock] ✅ NoSleep video playing');
      }

      // Also try audio as backup
      if (noSleepAudioRef.current) {
        noSleepAudioRef.current.volume = 0.001; // Near-silent but not muted
        try {
          await noSleepAudioRef.current.play();
          console.log('[Wake Lock] ✅ NoSleep audio playing');
        } catch (audioErr) {
          console.warn('[Wake Lock] ⚠️ Audio fallback failed (non-critical):', audioErr);
        }
      }

      // Keep-alive interval: periodically "touch" the media elements
      // This helps prevent iOS from suspending the app in standalone mode
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
      }
      
      keepAliveIntervalRef.current = setInterval(() => {
        if (noSleepVideoRef.current && noSleepVideoRef.current.paused) {
          console.log('[Wake Lock] 🔄 Restarting paused video...');
          noSleepVideoRef.current.play().catch(() => {});
        }
        if (noSleepAudioRef.current && noSleepAudioRef.current.paused) {
          console.log('[Wake Lock] 🔄 Restarting paused audio...');
          noSleepAudioRef.current.play().catch(() => {});
        }
      }, 15000); // Check every 15 seconds

      setUsingFallback(true);
      setIsActive(true);
      return true;

    } catch (err) {
      console.error('[Wake Lock] ❌ iOS fallback failed:', err);
      return false;
    }
  }, [createNoSleepElements]);

  /**
   * Stop iOS fallback
   */
  const stopIOSFallback = useCallback(() => {
    console.log('[Wake Lock] 🍎 Stopping iOS fallback...');

    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }

    if (noSleepVideoRef.current) {
      noSleepVideoRef.current.pause();
      noSleepVideoRef.current.currentTime = 0;
    }

    if (noSleepAudioRef.current) {
      noSleepAudioRef.current.pause();
      noSleepAudioRef.current.currentTime = 0;
    }

    setUsingFallback(false);
    setIsActive(false);
    console.log('[Wake Lock] ✅ iOS fallback stopped');
  }, []);

  /**
   * Request wake lock (native or fallback)
   */
  const requestLock = useCallback(async (): Promise<boolean> => {
    // Try native Wake Lock first
    if (hasNativeWakeLock.current) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setIsActive(true);
        setUsingFallback(false);

        console.log('[Wake Lock] ✅ Native screen wake lock activated');

        // Handle wake lock release (e.g., when tab becomes hidden)
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[Wake Lock] ℹ️ Native wake lock released');
          setIsActive(false);
        });

        return true;
      } catch (err) {
        console.warn('[Wake Lock] ⚠️ Native wake lock failed, trying fallback...', err);
      }
    }

    // Fallback for iOS and unsupported browsers
    if (isIOS.current) {
      return await startIOSFallback();
    }

    console.warn('[Wake Lock] ❌ No wake lock method available');
    return false;
  }, [startIOSFallback]);

  /**
   * Release wake lock
   */
  const releaseLock = useCallback(async () => {
    // Release native wake lock
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
        console.log('[Wake Lock] 🔓 Native wake lock released');
      } catch (err) {
        console.error('[Wake Lock] ❌ Failed to release native wake lock:', err);
      }
    }

    // Stop iOS fallback
    if (usingFallback) {
      stopIOSFallback();
    }
  }, [usingFallback, stopIOSFallback]);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isActive) {
        console.log('[Wake Lock] 🔄 Page visible again, checking wake lock status...');
        
        // For native wake lock
        if (hasNativeWakeLock.current && !wakeLockRef.current) {
          console.log('[Wake Lock] 🔄 Re-acquiring native wake lock...');
          try {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            wakeLockRef.current.addEventListener('release', () => {
              setIsActive(false);
            });
          } catch (err) {
            console.warn('[Wake Lock] ⚠️ Failed to re-acquire native wake lock:', err);
          }
        }

        // For iOS fallback - restart media if paused
        if (usingFallback) {
          console.log('[Wake Lock] 🔄 Restarting iOS fallback media...');
          if (noSleepVideoRef.current?.paused) {
            noSleepVideoRef.current.play().catch(() => {});
          }
          if (noSleepAudioRef.current?.paused) {
            noSleepAudioRef.current.play().catch(() => {});
          }
        }
      }
    };

    // Also handle pagehide for iOS standalone mode
    const handlePageHide = () => {
      console.log('[Wake Lock] 📴 Page hide event - app may be suspended');
    };

    const handlePageShow = () => {
      if (isActive) {
        console.log('[Wake Lock] 📱 Page show event - reactivating wake lock...');
        // Small delay to let the page fully render
        setTimeout(() => {
          handleVisibilityChange();
        }, 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [isActive, usingFallback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseLock();

      // Remove DOM elements
      if (noSleepVideoRef.current) {
        noSleepVideoRef.current.remove();
        noSleepVideoRef.current = null;
      }
      if (noSleepAudioRef.current) {
        noSleepAudioRef.current.remove();
        noSleepAudioRef.current = null;
      }
    };
  }, [releaseLock]);

  return {
    isSupported,
    isActive,
    usingFallback,
    requestLock,
    releaseLock
  };
}
