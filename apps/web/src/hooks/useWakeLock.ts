import { useEffect, useRef, useState } from 'react';

/**
 * Hook to manage Screen Wake Lock API
 * Prevents the device screen from turning off during recording
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
 */
export function useWakeLock() {
    const [isSupported, setIsSupported] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    useEffect(() => {
        // Check if Wake Lock API is supported
        setIsSupported('wakeLock' in navigator);
    }, []);

    const requestLock = async () => {
        if (!isSupported) {
            console.warn('[Wake Lock] API not supported in this browser');
            return false;
        }

        try {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            setIsActive(true);

            console.log('[Wake Lock] ✅ Screen wake lock activated');

            // Handle wake lock release (e.g., when tab becomes hidden)
            wakeLockRef.current.addEventListener('release', () => {
                console.log('[Wake Lock] ℹ️ Wake lock released');
                setIsActive(false);
            });

            return true;
        } catch (err) {
            console.error('[Wake Lock] ❌ Failed to acquire wake lock:', err);
            setIsActive(false);
            return false;
        }
    };

    const releaseLock = async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
                setIsActive(false);
                console.log('[Wake Lock] 🔓 Wake lock manually released');
            } catch (err) {
                console.error('[Wake Lock] ❌ Failed to release wake lock:', err);
            }
        }
    };

    // Re-acquire wake lock when page becomes visible again
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && isActive && !wakeLockRef.current) {
                console.log('[Wake Lock] 🔄 Page visible again, re-acquiring wake lock...');
                await requestLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            releaseLock();
        };
    }, [isActive]);

    return {
        isSupported,
        isActive,
        requestLock,
        releaseLock
    };
}
