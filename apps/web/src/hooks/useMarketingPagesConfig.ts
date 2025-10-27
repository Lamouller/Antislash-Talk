import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'antislash_hide_marketing_pages';

/**
 * Hook to determine if marketing pages should be hidden
 * 
 * Priority:
 * 1. Global config (VITE_HIDE_MARKETING_PAGES env var) - forces for all users
 * 2. User preference (hide_marketing_pages in profile) - if global not set
 * 3. LocalStorage cache - persists preference even after logout
 * 
 * @returns {object} Configuration state
 * @returns {boolean} shouldHideMarketingPages - True if marketing pages should be hidden
 * @returns {boolean} isGloballyForced - True if hiding is forced by environment variable
 * @returns {boolean} loading - True while fetching user preference
 */
export function useMarketingPagesConfig() {
  const [shouldHideMarketingPages, setShouldHideMarketingPages] = useState(false);
  const [isGloballyForced, setIsGloballyForced] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkConfig() {
      // 1. Check global environment variable (highest priority)
      const globalHideSetting = import.meta.env.VITE_HIDE_MARKETING_PAGES;
      
      if (globalHideSetting === 'true' || globalHideSetting === true) {
        setShouldHideMarketingPages(true);
        setIsGloballyForced(true);
        setLoading(false);
        return;
      }

      // 2. If not globally forced, check user preference
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // Not logged in, check localStorage cache
          const cachedPreference = localStorage.getItem(STORAGE_KEY);
          if (cachedPreference === 'true') {
            setShouldHideMarketingPages(true);
          } else {
            setShouldHideMarketingPages(false);
          }
          setIsGloballyForced(false);
          setLoading(false);
          return;
        }

        // Fetch user's preference from profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('hide_marketing_pages')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('Failed to load marketing pages preference:', error);
          setShouldHideMarketingPages(false);
          // Keep any cached value in localStorage
        } else {
          const hidePages = profile?.hide_marketing_pages ?? false;
          setShouldHideMarketingPages(hidePages);
          // Save to localStorage for persistence after logout
          localStorage.setItem(STORAGE_KEY, hidePages.toString());
        }
        
        setIsGloballyForced(false);
      } catch (error) {
        console.error('Error checking marketing pages config:', error);
        // Check localStorage as fallback
        const cachedPreference = localStorage.getItem(STORAGE_KEY);
        setShouldHideMarketingPages(cachedPreference === 'true');
        setIsGloballyForced(false);
      } finally {
        setLoading(false);
      }
    }

    checkConfig();
  }, []);

  return {
    shouldHideMarketingPages,
    isGloballyForced,
    loading,
  };
}

