/**
 * Telemetry batcher for transcription flow refactor (phase 14).
 *
 * Guards:
 *   - Only active when `newTranscriptionFlow` master flag is ON.
 *   - Only sends to Supabase when VITE_FLAG_TRANSCRIPTION_TELEMETRY=true.
 *   - Silent fail on any network / auth error — no retry.
 *   - No PII in payloads — only counters and state labels.
 */

import { supabase } from './supabase';
import { resolveFlag, readEnvFlags } from './featureFlags';
import { getPlatform } from './platform';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TranscriptionEventType =
  | 'session_start'
  | 'session_end'
  | 'ws_reconnect_attempt'
  | 'ws_reconnect_success'
  | 'ws_reconnect_exhausted'
  | 'vad_drop_batch'
  | 'provider_transition'
  | 'provider_fallback'
  | 'stream_count_snapshot'
  | 'segment_dedup_hit'
  | 'mic_route_change'
  | 'flag_state_snapshot';

export interface TranscriptionEvent {
  type: TranscriptionEventType;
  payload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface QueuedEvent extends TranscriptionEvent {
  sessionId: string;
  queuedAt: number;
}

interface TelemetryState {
  queue: QueuedEvent[];
  sessionId: string | null;
  flushTimer: ReturnType<typeof setTimeout> | null;
}

// ---------------------------------------------------------------------------
// Module-level state (singleton)
// ---------------------------------------------------------------------------

const state: TelemetryState = {
  queue: [],
  sessionId: null,
  flushTimer: null,
};

const FLUSH_INTERVAL_MS = 5_000;
const MAX_QUEUE_SIZE = 50;

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

function isEnabled(): boolean {
  const envFlags = readEnvFlags();
  const masterOn = resolveFlag('newTranscriptionFlow', { envFlags }).value;
  if (!masterOn) return false;
  return (import.meta.env as Record<string, string | undefined>)['VITE_FLAG_TRANSCRIPTION_TELEMETRY'] === 'true';
}

// ---------------------------------------------------------------------------
// Client meta
// ---------------------------------------------------------------------------

function buildClientMeta(): Record<string, unknown> {
  const envFlags = readEnvFlags();
  return {
    platform: getPlatform(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    ts: Date.now(),
    flags: envFlags,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Call at the beginning of a recording session. sessionId should be a UUID. */
export function startTelemetrySession(sessionId: string): void {
  if (!isEnabled()) return;
  state.sessionId = sessionId;
  state.queue = [];
  logEvent({ type: 'session_start', payload: {} });
}

/** Call when the recording session ends. Triggers a final flush. */
export function endTelemetrySession(): void {
  if (!isEnabled()) return;
  logEvent({ type: 'session_end', payload: {} });
  flush(true);
  state.sessionId = null;
}

/**
 * Enqueue a telemetry event.
 * No-op if the master flag is OFF, telemetry flag is OFF, or no active session.
 */
export function logEvent(event: TranscriptionEvent): void {
  if (!isEnabled() || !state.sessionId) return;
  state.queue.push({
    ...event,
    sessionId: state.sessionId,
    queuedAt: Date.now(),
  });
  if (state.queue.length >= MAX_QUEUE_SIZE) {
    flush();
  } else if (!state.flushTimer) {
    state.flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
  }
}

// ---------------------------------------------------------------------------
// Internal flush
// ---------------------------------------------------------------------------

async function flush(final = false): Promise<void> {
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = null;
  }
  if (state.queue.length === 0) return;

  const batch = state.queue.splice(0);
  const clientMeta = buildClientMeta();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // no user → skip silently

    const rows = batch.map(e => ({
      user_id: user.id,
      session_id: e.sessionId,
      event_type: e.type,
      payload: e.payload ?? {},
      client_meta: clientMeta,
    }));

    const { error } = await supabase.from('transcription_events').insert(rows);
    if (error) {
      console.debug('[Telemetry] insert error, dropping batch:', error.message);
      // No retry — avoid spamming if the DB is down.
    }
  } catch (err) {
    console.debug('[Telemetry] flush failed silently:', err);
  }

  if (!final && state.queue.length > 0) {
    state.flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
  }
}

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/** Resets internal state. For tests only — not for production use. */
export function __resetTelemetryForTests(): void {
  state.queue = [];
  state.sessionId = null;
  if (state.flushTimer) clearTimeout(state.flushTimer);
  state.flushTimer = null;
}
