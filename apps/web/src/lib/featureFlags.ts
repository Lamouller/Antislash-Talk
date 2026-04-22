/**
 * Feature flags infrastructure for the transcription refactor (phase 0+).
 *
 * Resolution priority (highest to lowest):
 *   1. User profile override (profiles.feature_flags jsonb) — per-user opt-in/opt-out
 *   2. Env var (VITE_FLAG_*) — build-time kill-switch or forced activation
 *   3. Default → false
 *
 * Exception: if `newTranscriptionFlow` (master) resolves to false, ALL sub-flags
 * are forced to false regardless of env or user settings.
 */

export type FlagKey =
  | 'newTranscriptionFlow'   // master kill-switch — must be ON for any sub-flag to matter
  | 'providerMutex'          // phase 11
  | 'unifiedMicStream'       // phase 10
  | 'clientVAD'              // phase 9
  | 'wsReconnect'            // phase 8
  | 'speakerLockDedup'       // phase 7
  | 'normalizedTimestamps'   // phase 5
  | 'micRouteHandling';      // phase 12.5

export type FlagSource = 'env' | 'user' | 'default';

export interface ResolvedFlag {
  value: boolean;
  source: FlagSource;
}

export interface FlagContext {
  envFlags: Partial<Record<FlagKey, boolean>>;
  userFlags?: Partial<Record<FlagKey, boolean>>;
}

/** Converts a FlagKey to its corresponding VITE_FLAG_* env var name. */
export function flagKeyToEnvName(key: FlagKey): string {
  // camelCase → SCREAMING_SNAKE_CASE, then prefix with VITE_FLAG_
  // Two-pass replacement handles acronyms like "VAD" (clientVAD → CLIENT_VAD):
  //   pass 1: insert _ before an uppercase letter that follows a lowercase  (camelCase boundary)
  //   pass 2: insert _ before an uppercase letter that is followed by lowercase (acronymEnd boundary)
  const screaming = key
    .replace(/([a-z])([A-Z])/g, '$1_$2')       // e.g. client|VAD, new|Transcription
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2') // e.g. NE|W_Transcription stays clean
    .toUpperCase();
  return `VITE_FLAG_${screaming}`;
}

/**
 * Reads all VITE_FLAG_* env vars at runtime and returns a partial flag map.
 * Only flags explicitly set to 'true' or '1' are included (and set to true).
 * Flags set to anything else are included as false.
 * Unset flags are excluded (undefined) so the resolver knows to fall through.
 */
export function readEnvFlags(): Partial<Record<FlagKey, boolean>> {
  const allKeys: FlagKey[] = [
    'newTranscriptionFlow',
    'providerMutex',
    'unifiedMicStream',
    'clientVAD',
    'wsReconnect',
    'speakerLockDedup',
    'normalizedTimestamps',
    'micRouteHandling',
  ];

  const result: Partial<Record<FlagKey, boolean>> = {};

  for (const key of allKeys) {
    const envName = flagKeyToEnvName(key);
    // import.meta.env keys are statically replaced by Vite at build time.
    // We access them via the env object to keep Vite's static analysis happy.
    const raw: string | undefined = (import.meta.env as Record<string, string | undefined>)[envName];

    if (raw !== undefined) {
      result[key] = raw === 'true' || raw === '1';
    }
    // If undefined, we leave it out so resolveFlag knows to skip this source.
  }

  return result;
}

/**
 * Returns true if the master kill-switch (newTranscriptionFlow) is OFF,
 * meaning all sub-flags must be treated as false.
 */
export function isMasterKillActive(ctx: FlagContext): boolean {
  const masterResolved = _resolveRaw('newTranscriptionFlow', ctx);
  return !masterResolved.value;
}

/**
 * Resolves a single flag within a context.
 *
 * Priority:
 *   user setting (if defined) > env var (if defined) > default (false)
 *
 * If the master flag (newTranscriptionFlow) is OFF, all sub-flags are forced
 * to false — the master itself is always resolved as-is.
 */
export function resolveFlag(key: FlagKey, ctx: FlagContext): ResolvedFlag {
  // The master flag bypasses the kill-switch check (it IS the switch).
  if (key !== 'newTranscriptionFlow' && isMasterKillActive(ctx)) {
    return { value: false, source: 'default' };
  }
  return _resolveRaw(key, ctx);
}

/** Resolves all known flags at once. */
export function resolveAllFlags(ctx: FlagContext): Record<FlagKey, ResolvedFlag> {
  const allKeys: FlagKey[] = [
    'newTranscriptionFlow',
    'providerMutex',
    'unifiedMicStream',
    'clientVAD',
    'wsReconnect',
    'speakerLockDedup',
    'normalizedTimestamps',
    'micRouteHandling',
  ];

  return Object.fromEntries(
    allKeys.map((key) => [key, resolveFlag(key, ctx)])
  ) as Record<FlagKey, ResolvedFlag>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Resolves a flag without applying the master kill-switch. */
function _resolveRaw(key: FlagKey, ctx: FlagContext): ResolvedFlag {
  const userVal = ctx.userFlags?.[key];
  if (userVal !== undefined) {
    return { value: userVal, source: 'user' };
  }

  const envVal = ctx.envFlags[key];
  if (envVal !== undefined) {
    return { value: envVal, source: 'env' };
  }

  return { value: false, source: 'default' };
}
