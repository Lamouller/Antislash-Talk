/**
 * wsReconnect — Pure exponential backoff strategy for WebSocket reconnection.
 *
 * Intentionally free of React, DOM, and side effects so it can be unit-tested
 * without any browser / Vite context.
 *
 * Phase 8 of the transcription refactor.
 */

export interface ReconnectStrategy {
  /** Returns the next delay (ms) or null if exhausted. Read-only — does NOT consume. */
  peek(): number | null;
  /** Consumes the current attempt and returns its delay. Returns null if exhausted. */
  next(): number | null;
  /** Resets the attempt counter (call on successful connection). */
  reset(): void;
  /** Number of attempts already consumed. */
  readonly attempts: number;
}

export interface ReconnectConfig {
  /** First delay in ms. Default: 500 */
  initialDelayMs?: number;
  /** Cap for computed delay. Default: 8000 */
  maxDelayMs?: number;
  /** Maximum number of reconnection attempts. Default: 6 */
  maxAttempts?: number;
  /** Backoff multiplier. Default: 2 */
  multiplier?: number;
  /** Custom predicate. Default: defaultShouldRetry */
  shouldRetry?: (code: number, reason: string) => boolean;
}

export function createReconnectStrategy(config: ReconnectConfig = {}): ReconnectStrategy {
  const initial = config.initialDelayMs ?? 500;
  const max = config.maxDelayMs ?? 8000;
  const maxAttempts = config.maxAttempts ?? 6;
  const mult = config.multiplier ?? 2;
  let _attempts = 0;

  const computeDelay = (attempt: number): number | null => {
    if (attempt >= maxAttempts) return null;
    const raw = initial * Math.pow(mult, attempt);
    return Math.min(raw, max);
  };

  return {
    peek: () => computeDelay(_attempts),
    next: () => {
      const d = computeDelay(_attempts);
      if (d !== null) _attempts++;
      return d;
    },
    reset: () => {
      _attempts = 0;
    },
    get attempts() {
      return _attempts;
    },
  };
}

/**
 * Default retry predicate.
 * Retries on any code EXCEPT:
 *   1000 — normal close (intentional stop)
 *   1008 — policy violation (auth / rate-limit — retrying would be useless)
 */
export function defaultShouldRetry(code: number, _reason: string = ''): boolean {
  return code !== 1000 && code !== 1008;
}
