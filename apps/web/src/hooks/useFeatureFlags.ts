import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  readEnvFlags,
  resolveAllFlags,
  type FlagKey,
  type FlagSource,
  type FlagContext,
} from '../lib/featureFlags';

const CACHE_TTL_MS = 60_000; // 60 seconds — avoid refetching on every render

export interface UseFeatureFlagsResult {
  /** Resolved boolean value per flag. */
  flags: Record<FlagKey, boolean>;
  /** Source of the resolved value per flag. Useful for debugging. */
  sources: Record<FlagKey, FlagSource>;
  /** True while fetching user profile from Supabase. */
  isLoading: boolean;
  /** Invalidates the 60s cache and re-fetches the user profile. */
  refresh: () => Promise<void>;
}

/** Builds a flat Record<FlagKey, boolean> from resolved flags. */
function flattenResolved(
  resolved: ReturnType<typeof resolveAllFlags>
): { flags: Record<FlagKey, boolean>; sources: Record<FlagKey, FlagSource> } {
  const flags = {} as Record<FlagKey, boolean>;
  const sources = {} as Record<FlagKey, FlagSource>;

  for (const [key, res] of Object.entries(resolved) as [FlagKey, { value: boolean; source: FlagSource }][]) {
    flags[key] = res.value;
    sources[key] = res.source;
  }

  return { flags, sources };
}

/** Returns env-only flags (used as fallback when no auth or error). */
function resolveFromEnvOnly(): ReturnType<typeof flattenResolved> {
  const ctx: FlagContext = { envFlags: readEnvFlags(), userFlags: {} };
  return flattenResolved(resolveAllFlags(ctx));
}

/**
 * Hook that resolves feature flags from:
 *   1. User profile (profiles.feature_flags jsonb) — fetched once, cached 60s
 *   2. Env vars (VITE_FLAG_*) — read at runtime
 *   3. Default (false)
 *
 * If the user is not authenticated, or Supabase is unreachable, falls back
 * to env vars only — never throws.
 */
export function useFeatureFlags(): UseFeatureFlagsResult {
  const envFlags = readEnvFlags();

  const [isLoading, setIsLoading] = useState(true);
  const [flags, setFlags] = useState<Record<FlagKey, boolean>>(resolveFromEnvOnly().flags);
  const [sources, setSources] = useState<Record<FlagKey, FlagSource>>(resolveFromEnvOnly().sources);

  // Cache invalidation: store the timestamp of the last successful fetch.
  const lastFetchRef = useRef<number>(0);

  const fetchAndResolve = useCallback(async (force = false): Promise<void> => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < CACHE_TTL_MS) {
      // Still within cache window — skip network call.
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const resolved = resolveFromEnvOnly();
        setFlags(resolved.flags);
        setSources(resolved.sources);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('feature_flags')
        .eq('id', user.id)
        .single();

      if (error) {
        if (import.meta.env.DEV) {
          console.debug('[useFeatureFlags] Failed to load profile feature_flags, using env only:', error.message);
        }
        const resolved = resolveFromEnvOnly();
        setFlags(resolved.flags);
        setSources(resolved.sources);
        return;
      }

      // profile.feature_flags is typed as Json (any object). We cast safely.
      const userFlags = (profile?.feature_flags ?? {}) as Partial<Record<FlagKey, boolean>>;

      const ctx: FlagContext = { envFlags, userFlags };
      const { flags: nextFlags, sources: nextSources } = flattenResolved(resolveAllFlags(ctx));

      setFlags(nextFlags);
      setSources(nextSources);
      lastFetchRef.current = Date.now();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.debug('[useFeatureFlags] Unexpected error, using env only:', err);
      }
      const resolved = resolveFromEnvOnly();
      setFlags(resolved.flags);
      setSources(resolved.sources);
    } finally {
      setIsLoading(false);
    }
  }, []);  // envFlags is stable across renders (built from import.meta.env)

  useEffect(() => {
    fetchAndResolve();
  }, [fetchAndResolve]);

  const refresh = useCallback(async (): Promise<void> => {
    await fetchAndResolve(true);
  }, [fetchAndResolve]);

  return { flags, sources, isLoading, refresh };
}
