import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook to manage Screen Wake Lock API with aggressive iOS PWA fallback
 * 
 * Strategy for iOS PWA (standalone mode):
 * 1. Web Audio API with low-frequency oscillator (more reliable than silent audio files)
 * 2. Media Session API to register as active audio session
 * 3. Video element with actual content (not just silent)
 * 4. Periodic "heartbeat" to keep everything alive
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
 */

// Detect iOS and standalone mode
const getIOSInfo = () => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return { isIOS: false, isStandalone: false, isSafari: false };
  }
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = (navigator as any).standalone === true || 
    window.matchMedia('(display-mode: standalone)').matches;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  
  return { isIOS, isStandalone, isSafari };
};

export function useWakeLock() {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  
  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  // HTML elements refs
  const noSleepVideoRef = useRef<HTMLVideoElement | null>(null);
  const noSleepAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Intervals
  const keepAliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const iosInfoRef = useRef(getIOSInfo());
  const hasNativeWakeLock = useRef(
    typeof navigator !== 'undefined' && 'wakeLock' in navigator
  );

  useEffect(() => {
    iosInfoRef.current = getIOSInfo();
    const supported = hasNativeWakeLock.current || iosInfoRef.current.isIOS;
    setIsSupported(supported);

    console.log(`[Wake Lock] 🔍 Detection:`, {
      ...iosInfoRef.current,
      hasNativeWakeLock: hasNativeWakeLock.current,
      willUseFallback: !hasNativeWakeLock.current
    });
  }, []);

  /**
   * Create Web Audio oscillator - most reliable for iOS background audio
   * Uses a very low frequency (1Hz) at very low volume - inaudible but keeps audio session alive
   */
  const startWebAudioOscillator = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[Wake Lock] 🎵 Starting Web Audio oscillator...');
      
      // Create or resume AudioContext
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Create oscillator with very low frequency (sub-bass, mostly inaudible)
      oscillatorRef.current = audioContextRef.current.createOscillator();
      oscillatorRef.current.type = 'sine';
      oscillatorRef.current.frequency.setValueAtTime(1, audioContextRef.current.currentTime); // 1Hz - below human hearing
      
      // Create gain node with very low volume
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.setValueAtTime(0.001, audioContextRef.current.currentTime); // Nearly silent
      
      // Connect: oscillator -> gain -> destination
      oscillatorRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(audioContextRef.current.destination);
      
      // Start the oscillator
      oscillatorRef.current.start();
      
      console.log('[Wake Lock] ✅ Web Audio oscillator started (1Hz @ 0.001 volume)');
      return true;
    } catch (err) {
      console.error('[Wake Lock] ❌ Web Audio oscillator failed:', err);
      return false;
    }
  }, []);

  /**
   * Stop Web Audio oscillator
   */
  const stopWebAudioOscillator = useCallback(() => {
    try {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
      // Don't close AudioContext - might be reused
      console.log('[Wake Lock] 🔇 Web Audio oscillator stopped');
    } catch (err) {
      console.warn('[Wake Lock] ⚠️ Error stopping oscillator:', err);
    }
  }, []);

  /**
   * Setup Media Session API - tells iOS this is an active audio app
   */
  const setupMediaSession = useCallback(() => {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Recording in progress',
          artist: 'Antislash Talk',
          album: 'Meeting Recording',
        });
        
        // Set playback state to playing
        navigator.mediaSession.playbackState = 'playing';
        
        // Add action handlers (required for some browsers)
        navigator.mediaSession.setActionHandler('play', () => {
          console.log('[Wake Lock] 📱 Media Session: play action');
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          console.log('[Wake Lock] 📱 Media Session: pause action');
        });
        
        console.log('[Wake Lock] 📱 Media Session API configured');
      } catch (err) {
        console.warn('[Wake Lock] ⚠️ Media Session setup failed:', err);
      }
    }
  }, []);

  /**
   * Clear Media Session
   */
  const clearMediaSession = useCallback(() => {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        console.log('[Wake Lock] 📱 Media Session cleared');
      } catch (err) {
        // Ignore errors
      }
    }
  }, []);

  /**
   * Create HTML audio element with REAL audio file
   * Using an actual MP3 file is more reliable than data URIs on iOS PWA
   */
  const createAudioElement = useCallback(() => {
    if (noSleepAudioRef.current) return;

    const audio = document.createElement('audio');
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.setAttribute('loop', '');
    audio.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;';
    
    // Use a REAL audio file (30 seconds of very quiet 100Hz tone at -50dB)
    // Real files are more reliable than data URIs for iOS PWA background audio
    audio.src = '/keep-alive.mp3';
    audio.setAttribute('preload', 'auto');
    
    // Preload the audio to ensure it's ready
    audio.load();
    
    document.body.appendChild(audio);
    noSleepAudioRef.current = audio;
    console.log('[Wake Lock] 🔊 Audio element created');
  }, []);

  /**
   * Create video element - some iOS versions respond better to video
   */
  const createVideoElement = useCallback(() => {
    if (noSleepVideoRef.current) return;

    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('loop', '');
    video.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;';
    
    // Minimal MP4 video
    video.src = 'data:video/mp4;base64,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';
    
    document.body.appendChild(video);
    noSleepVideoRef.current = video;
    console.log('[Wake Lock] 🎬 Video element created');
  }, []);

  /**
   * Start aggressive iOS PWA fallback
   * Combines multiple techniques for maximum reliability
   */
  const startIOSPWAFallback = useCallback(async (): Promise<boolean> => {
    const { isStandalone } = iosInfoRef.current;
    console.log(`[Wake Lock] 🍎 Starting iOS ${isStandalone ? 'PWA' : 'Safari'} fallback...`);
    
    let success = false;

    // 1. Start Web Audio oscillator (most reliable for PWA)
    const oscillatorStarted = await startWebAudioOscillator();
    if (oscillatorStarted) success = true;

    // 2. Setup Media Session API
    setupMediaSession();

    // 3. Create and play audio element
    createAudioElement();
    if (noSleepAudioRef.current) {
      try {
        noSleepAudioRef.current.volume = 0.01; // Very quiet but not silent
        await noSleepAudioRef.current.play();
        console.log('[Wake Lock] ✅ Audio element playing');
        success = true;
      } catch (err) {
        console.warn('[Wake Lock] ⚠️ Audio element play failed:', err);
      }
    }

    // 4. Create and play video element
    createVideoElement();
    if (noSleepVideoRef.current) {
      try {
        noSleepVideoRef.current.muted = true;
        await noSleepVideoRef.current.play();
        console.log('[Wake Lock] ✅ Video element playing');
        success = true;
      } catch (err) {
        console.warn('[Wake Lock] ⚠️ Video element play failed:', err);
      }
    }

    // 5. Setup heartbeat interval - periodically "wake up" everything
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      console.log('[Wake Lock] 💓 Heartbeat - keeping audio session alive');
      
      // Touch the AudioContext
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
      
      // Restart audio if paused
      if (noSleepAudioRef.current?.paused) {
        noSleepAudioRef.current.play().catch(() => {});
      }
      
      // Restart video if paused
      if (noSleepVideoRef.current?.paused) {
        noSleepVideoRef.current.play().catch(() => {});
      }
      
      // Re-assert media session
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    }, 5000); // Every 5 seconds for PWA mode

    // 6. Setup keep-alive interval (less frequent check)
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
    }
    
    keepAliveIntervalRef.current = setInterval(() => {
      // More aggressive restart if anything stopped
      if (oscillatorRef.current === null && audioContextRef.current) {
        console.log('[Wake Lock] 🔄 Restarting oscillator...');
        startWebAudioOscillator();
      }
    }, 30000); // Every 30 seconds

    if (success) {
      setUsingFallback(true);
      setIsActive(true);
      console.log('[Wake Lock] ✅ iOS PWA fallback active with multiple strategies');
    }

    return success;
  }, [startWebAudioOscillator, setupMediaSession, createAudioElement, createVideoElement]);

  /**
   * Stop iOS fallback
   */
  const stopIOSFallback = useCallback(() => {
    console.log('[Wake Lock] 🍎 Stopping iOS fallback...');

    // Clear intervals
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }

    // Stop Web Audio
    stopWebAudioOscillator();

    // Clear Media Session
    clearMediaSession();

    // Stop and remove audio element
    if (noSleepAudioRef.current) {
      noSleepAudioRef.current.pause();
      noSleepAudioRef.current.src = '';
      noSleepAudioRef.current.remove();
      noSleepAudioRef.current = null;
    }

    // Stop and remove video element
    if (noSleepVideoRef.current) {
      noSleepVideoRef.current.pause();
      noSleepVideoRef.current.src = '';
      noSleepVideoRef.current.remove();
      noSleepVideoRef.current = null;
    }

    setUsingFallback(false);
    setIsActive(false);
    console.log('[Wake Lock] ✅ iOS fallback stopped');
  }, [stopWebAudioOscillator, clearMediaSession]);

  /**
   * Request wake lock (native or fallback)
   */
  const requestLock = useCallback(async (): Promise<boolean> => {
    // Try native Wake Lock first (not available on iOS Safari)
    if (hasNativeWakeLock.current && !iosInfoRef.current.isIOS) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setIsActive(true);
        setUsingFallback(false);

        console.log('[Wake Lock] ✅ Native screen wake lock activated');

        wakeLockRef.current.addEventListener('release', () => {
          console.log('[Wake Lock] ℹ️ Native wake lock released');
          setIsActive(false);
        });

        return true;
      } catch (err) {
        console.warn('[Wake Lock] ⚠️ Native wake lock failed, trying fallback...', err);
      }
    }

    // iOS fallback (both Safari and PWA)
    if (iosInfoRef.current.isIOS) {
      return await startIOSPWAFallback();
    }

    // Generic fallback for other browsers without Wake Lock
    return await startIOSPWAFallback();
  }, [startIOSPWAFallback]);

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
      console.log(`[Wake Lock] 👁️ Visibility changed: ${document.visibilityState}`);
      
      if (document.visibilityState === 'visible' && isActive) {
        console.log('[Wake Lock] 🔄 Page visible again, ensuring wake lock is active...');
        
        // For native wake lock
        if (hasNativeWakeLock.current && !wakeLockRef.current && !iosInfoRef.current.isIOS) {
          try {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            wakeLockRef.current.addEventListener('release', () => setIsActive(false));
            console.log('[Wake Lock] ✅ Re-acquired native wake lock');
          } catch (err) {
            console.warn('[Wake Lock] ⚠️ Failed to re-acquire native wake lock:', err);
          }
        }

        // For iOS fallback - restart everything
        if (usingFallback) {
          console.log('[Wake Lock] 🔄 Restarting iOS fallback media...');
          
          // Resume AudioContext
          if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
          }
          
          // Restart audio
          if (noSleepAudioRef.current?.paused) {
            noSleepAudioRef.current.play().catch(() => {});
          }
          
          // Restart video
          if (noSleepVideoRef.current?.paused) {
            noSleepVideoRef.current.play().catch(() => {});
          }
          
          // Re-assert media session
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
        }
      }
    };

    const handlePageHide = () => {
      console.log('[Wake Lock] 📴 Page hide event');
    };

    const handlePageShow = () => {
      if (isActive) {
        console.log('[Wake Lock] 📱 Page show event - reactivating...');
        setTimeout(handleVisibilityChange, 100);
      }
    };

    // Also handle focus/blur for PWA
    const handleFocus = () => {
      if (isActive && usingFallback) {
        console.log('[Wake Lock] 🎯 Window focus - ensuring media is playing');
        handleVisibilityChange();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isActive, usingFallback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
      stopWebAudioOscillator();
      clearMediaSession();
      
      if (noSleepAudioRef.current) {
        noSleepAudioRef.current.pause();
        noSleepAudioRef.current.remove();
      }
      if (noSleepVideoRef.current) {
        noSleepVideoRef.current.pause();
        noSleepVideoRef.current.remove();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [stopWebAudioOscillator, clearMediaSession]);

  return {
    isSupported,
    isActive,
    usingFallback,
    isIOSPWA: iosInfoRef.current.isIOS && iosInfoRef.current.isStandalone,
    requestLock,
    releaseLock
  };
}
