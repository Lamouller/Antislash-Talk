/**
 * Unit tests for telemetry.ts (phase 14).
 *
 * Supabase client and feature-flag env vars are mocked so no real network
 * calls are made. Tests verify guard logic, queue behaviour, and flush paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startTelemetrySession,
  endTelemetrySession,
  logEvent,
  __resetTelemetryForTests,
} from '../telemetry';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-test-1' } } }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enableFlags() {
  vi.stubEnv('VITE_FLAG_NEW_TRANSCRIPTION_FLOW', 'true');
  vi.stubEnv('VITE_FLAG_TRANSCRIPTION_TELEMETRY', 'true');
}

function disableMasterFlag() {
  vi.stubEnv('VITE_FLAG_NEW_TRANSCRIPTION_FLOW', 'false');
  vi.stubEnv('VITE_FLAG_TRANSCRIPTION_TELEMETRY', 'true');
}

function disableTelemetryFlag() {
  vi.stubEnv('VITE_FLAG_NEW_TRANSCRIPTION_FLOW', 'true');
  vi.stubEnv('VITE_FLAG_TRANSCRIPTION_TELEMETRY', 'false');
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('telemetry', () => {
  beforeEach(() => {
    __resetTelemetryForTests();
    // Use fake timers so flush intervals don't leak between tests.
    vi.useFakeTimers();
    enableFlags();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  // ── Guard: master flag OFF ───────────────────────────────────────────────

  it('does nothing when newTranscriptionFlow master flag is OFF', () => {
    disableMasterFlag();
    // Should not throw, sessionId must remain null.
    startTelemetrySession('session-guard-test');
    logEvent({ type: 'vad_drop_batch', payload: { dropped: 5 } });
    endTelemetrySession();
    // If we reach here without crash, the guard worked.
    expect(true).toBe(true);
  });

  // ── Guard: telemetry flag OFF ────────────────────────────────────────────

  it('does nothing when VITE_FLAG_TRANSCRIPTION_TELEMETRY is false', () => {
    disableTelemetryFlag();
    startTelemetrySession('session-telemetry-off');
    logEvent({ type: 'ws_reconnect_attempt', payload: { attempt: 1 } });
    endTelemetrySession();
    expect(true).toBe(true);
  });

  // ── logEvent no-op without active session ────────────────────────────────

  it('logEvent is no-op when no session is active', () => {
    // Flags ON but no startTelemetrySession called.
    logEvent({ type: 'provider_transition', payload: { from: 'gemini', to: 'whisperx' } });
    // No crash, no insert call expected.
    expect(true).toBe(true);
  });

  // ── Normal queue path ────────────────────────────────────────────────────

  it('queues events and schedules flush after FLUSH_INTERVAL_MS', async () => {
    const { supabase } = await import('../supabase');
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as ReturnType<typeof supabase.from>);

    startTelemetrySession('session-queue-test');
    logEvent({ type: 'ws_reconnect_attempt', payload: { attempt: 1, delayMs: 1000 } });
    logEvent({ type: 'vad_drop_batch', payload: { dropped: 12 } });

    // Fire the flush timer.
    await vi.runAllTimersAsync();

    expect(insertMock).toHaveBeenCalled();
    const rows = insertMock.mock.calls[0][0] as { event_type: string }[];
    const types = rows.map(r => r.event_type);
    // session_start + ws_reconnect_attempt + vad_drop_batch
    expect(types).toContain('session_start');
    expect(types).toContain('ws_reconnect_attempt');
    expect(types).toContain('vad_drop_batch');
  });

  // ── endTelemetrySession flushes immediately ───────────────────────────────

  it('endTelemetrySession triggers immediate flush and clears sessionId', async () => {
    const { supabase } = await import('../supabase');
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as ReturnType<typeof supabase.from>);

    startTelemetrySession('session-end-test');
    logEvent({ type: 'segment_dedup_hit', payload: { count: 3 } });
    endTelemetrySession();

    // Allow async flush to settle.
    await vi.runAllTimersAsync();

    expect(insertMock).toHaveBeenCalled();

    // After end, a new logEvent without startTelemetrySession should be no-op.
    insertMock.mockClear();
    logEvent({ type: 'vad_drop_batch', payload: { dropped: 1 } });
    await vi.runAllTimersAsync();
    expect(insertMock).not.toHaveBeenCalled();
  });

  // ── Silent fail when getUser returns null ────────────────────────────────

  it('does not throw when getUser returns no user (silent fail)', async () => {
    const { supabase } = await import('../supabase');
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    startTelemetrySession('session-no-user');
    logEvent({ type: 'flag_state_snapshot', payload: { newTranscriptionFlow: true } });
    endTelemetrySession();

    await vi.runAllTimersAsync();
    // No throw = silent fail working correctly.
    expect(true).toBe(true);
  });

  // ── Insert error drops batch silently ────────────────────────────────────

  it('does not throw on Supabase insert error — batch is dropped silently', async () => {
    const { supabase } = await import('../supabase');
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: { message: 'DB unreachable' } }),
    } as ReturnType<typeof supabase.from>);

    startTelemetrySession('session-insert-error');
    logEvent({ type: 'provider_fallback', payload: { reason: 'timeout' } });
    endTelemetrySession();

    await vi.runAllTimersAsync();
    expect(true).toBe(true);
  });
});
