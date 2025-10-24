import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

export function useFrameworkReady() {
  const isReady = useRef(false);

  useEffect(() => {
    // Prevent multiple calls
    if (isReady.current) return;
    isReady.current = true;

    // Ensure window exists (web platform check)
    if (typeof window !== 'undefined' && window.frameworkReady) {
      try {
        window.frameworkReady();
      } catch (error) {
        console.error('Framework ready callback failed:', error);
      }
    }
  }, []); // Empty dependency array ensures this runs once on mount
}