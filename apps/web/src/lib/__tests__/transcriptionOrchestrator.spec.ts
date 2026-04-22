/**
 * Unit tests for transcriptionOrchestrator.ts (phase 11).
 * Pure TypeScript — no React, no Vite runtime, no DOM.
 *
 * Run with: pnpm --filter web test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTranscriptionOrchestrator,
  type ProviderAdapter,
  type Provider,
  type OrchestratorState,
} from '../transcriptionOrchestrator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal ProviderAdapter for testing. */
function makeAdapter(
  id: Provider,
  opts: {
    shouldFail?: boolean;
    startDelayMs?: number;
    failOnStop?: boolean;
  } = {}
): ProviderAdapter {
  let active = false;
  return {
    id,
    async start(_stream, _options) {
      if (opts.startDelayMs) {
        await new Promise<void>((r) => setTimeout(r, opts.startDelayMs));
      }
      if (opts.shouldFail) {
        throw new Error(`${id} failed`);
      }
      active = true;
    },
    async stop() {
      if (opts.failOnStop) {
        throw new Error(`${id} stop failed`);
      }
      active = false;
    },
    isActive() {
      return active;
    },
  };
}

/** Makes a full adapters record with the given per-provider overrides. */
function makeAdapters(overrides: Partial<Record<Provider, ReturnType<typeof makeAdapter>>> = {}) {
  return {
    gemini: overrides.gemini ?? makeAdapter('gemini'),
    whisperx: overrides.whisperx ?? makeAdapter('whisperx'),
    'local-transformers': overrides['local-transformers'] ?? makeAdapter('local-transformers'),
  };
}

const fakeStream = {} as MediaStream;
const noopOptions = {
  onSegment: () => undefined,
  onError: () => undefined,
};

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

describe('TranscriptionOrchestrator', () => {
  // 1 ─ Happy path: preferred succeeds
  it('starts with preferred when it succeeds', async () => {
    const orch = createTranscriptionOrchestrator({
      preferred: 'gemini',
      fallbackOrder: ['whisperx', 'local-transformers'],
      fallbackTimeoutMs: 1000,
      enableFallback: true,
      adapters: makeAdapters(),
    });

    const provider = await orch.start(fakeStream, noopOptions);
    expect(provider).toBe('gemini');
    expect(orch.state).toBe('active');
    expect(orch.activeProvider).toBe('gemini');
  });

  // 2 ─ Preferred fails → first fallback used
  it('falls back to whisperx when gemini fails', async () => {
    const orch = createTranscriptionOrchestrator({
      preferred: 'gemini',
      fallbackOrder: ['whisperx', 'local-transformers'],
      fallbackTimeoutMs: 1000,
      enableFallback: true,
      adapters: makeAdapters({ gemini: makeAdapter('gemini', { shouldFail: true }) }),
    });

    const provider = await orch.start(fakeStream, noopOptions);
    expect(provider).toBe('whisperx');
    expect(orch.state).toBe('active');
    expect(orch.activeProvider).toBe('whisperx');
  });

  // 3 ─ Cascade: preferred + first fallback fail → second fallback used
  it('cascade fallback when multiple providers fail', async () => {
    const orch = createTranscriptionOrchestrator({
      preferred: 'gemini',
      fallbackOrder: ['whisperx', 'local-transformers'],
      fallbackTimeoutMs: 1000,
      enableFallback: true,
      adapters: makeAdapters({
        gemini: makeAdapter('gemini', { shouldFail: true }),
        whisperx: makeAdapter('whisperx', { shouldFail: true }),
      }),
    });

    const provider = await orch.start(fakeStream, noopOptions);
    expect(provider).toBe('local-transformers');
    expect(orch.state).toBe('active');
  });

  // 4 ─ All fail → throws, state returns to idle
  it('throws "All providers failed" when all providers fail', async () => {
    const orch = createTranscriptionOrchestrator({
      preferred: 'gemini',
      fallbackOrder: ['whisperx', 'local-transformers'],
      fallbackTimeoutMs: 1000,
      enableFallback: true,
      adapters: makeAdapters({
        gemini: makeAdapter('gemini', { shouldFail: true }),
        whisperx: makeAdapter('whisperx', { shouldFail: true }),
        'local-transformers': makeAdapter('local-transformers', { shouldFail: true }),
      }),
    });

    await expect(orch.start(fakeStream, noopOptions)).rejects.toThrow('All providers failed');
    expect(orch.state).toBe('idle');
    expect(orch.activeProvider).toBeNull();
  });

  // 5 ─ enableFallback false: preferred fails → throws immediately, state returns to idle
  it('throws immediately when fallback is disabled and preferred fails', async () => {
    const orch = createTranscriptionOrchestrator({
      preferred: 'gemini',
      fallbackOrder: ['whisperx', 'local-transformers'],
      fallbackTimeoutMs: 1000,
      enableFallback: false,
      adapters: makeAdapters({ gemini: makeAdapter('gemini', { shouldFail: true }) }),
    });

    await expect(orch.start(fakeStream, noopOptions)).rejects.toThrow();
    expect(orch.state).toBe('idle');
    // whisperx must NOT have been tried
    expect(orch.activeProvider).toBeNull();
  });

  // 6 ─ Timeout triggers fallback
  it('timeout on slow preferred triggers fallback to whisperx', async () => {
    const orch = createTranscriptionOrchestrator({
      preferred: 'gemini',
      fallbackOrder: ['whisperx', 'local-transformers'],
      fallbackTimeoutMs: 100,    // very tight
      enableFallback: true,
      adapters: makeAdapters({
        gemini: makeAdapter('gemini', { startDelayMs: 500 }), // slower than timeout
      }),
    });

    const provider = await orch.start(fakeStream, noopOptions);
    expect(provider).toBe('whisperx');
    expect(orch.state).toBe('active');
  }, 3000);

  // 7 ─ stop() transitions to idle and cleans up the adapter
  it('stop transitions to idle and deactivates the adapter', async () => {
    const geminiAdapter = makeAdapter('gemini');
    const orch = createTranscriptionOrchestrator({
      preferred: 'gemini',
      fallbackOrder: [],
      fallbackTimeoutMs: 1000,
      enableFallback: false,
      adapters: makeAdapters({ gemini: geminiAdapter }),
    });

    await orch.start(fakeStream, noopOptions);
    expect(geminiAdapter.isActive()).toBe(true);

    await orch.stop();
    expect(orch.state).toBe('idle');
    expect(orch.activeProvider).toBeNull();
    expect(geminiAdapter.isActive()).toBe(false);
  });

  // 8 ─ onTransition called for every state change
  it('onTransition is called for each state change during start + stop', async () => {
    const transitions: Array<[OrchestratorState, OrchestratorState, Provider | null]> = [];

    const orch = createTranscriptionOrchestrator({
      preferred: 'gemini',
      fallbackOrder: [],
      fallbackTimeoutMs: 1000,
      enableFallback: false,
      adapters: makeAdapters(),
      onTransition: (from, to, provider) => {
        transitions.push([from, to, provider]);
      },
    });

    await orch.start(fakeStream, noopOptions);
    // start: idle→starting, starting→active
    expect(transitions[0]).toEqual(['idle', 'starting', null]);
    expect(transitions[1]).toEqual(['starting', 'active', 'gemini']);

    await orch.stop();
    // stop: active→stopping, stopping→idle
    expect(transitions[2]).toEqual(['active', 'stopping', 'gemini']);
    expect(transitions[3]).toEqual(['stopping', 'idle', null]);

    expect(transitions).toHaveLength(4);
  });

  // 9 ─ stop() is a no-op when already idle
  it('stop() is idempotent when already idle', async () => {
    const orch = createTranscriptionOrchestrator({
      preferred: 'gemini',
      fallbackOrder: [],
      fallbackTimeoutMs: 1000,
      enableFallback: false,
      adapters: makeAdapters(),
    });

    // Should not throw
    await expect(orch.stop()).resolves.toBeUndefined();
    expect(orch.state).toBe('idle');
  });

  // 10 ─ start() throws when called while already active
  it('start() throws when orchestrator is already active', async () => {
    const orch = createTranscriptionOrchestrator({
      preferred: 'gemini',
      fallbackOrder: [],
      fallbackTimeoutMs: 1000,
      enableFallback: false,
      adapters: makeAdapters(),
    });

    await orch.start(fakeStream, noopOptions);
    await expect(orch.start(fakeStream, noopOptions)).rejects.toThrow();
  });

  // 11 ─ preferred skipped in fallbackOrder (no double-attempt)
  it('skips preferred if it appears in fallbackOrder', async () => {
    const geminiAdapter = makeAdapter('gemini', { shouldFail: true });
    const startSpy = vi.spyOn(geminiAdapter, 'start');

    const orch = createTranscriptionOrchestrator({
      preferred: 'gemini',
      fallbackOrder: ['gemini', 'whisperx'], // gemini listed again — should be skipped
      fallbackTimeoutMs: 1000,
      enableFallback: true,
      adapters: makeAdapters({ gemini: geminiAdapter }),
    });

    const provider = await orch.start(fakeStream, noopOptions);
    expect(provider).toBe('whisperx');
    // gemini.start was called exactly once (the preferred attempt, not again from fallbackOrder)
    expect(startSpy).toHaveBeenCalledTimes(1);
  });

  // 12 ─ stop() is resilient when adapter.stop() throws
  it('stop() transitions to idle even if adapter.stop() throws', async () => {
    const faultyAdapter = makeAdapter('gemini', { failOnStop: true });
    // Override: we still want isActive() to start as true after start()
    // makeAdapter with failOnStop keeps active=true after start, throws on stop
    const orch = createTranscriptionOrchestrator({
      preferred: 'gemini',
      fallbackOrder: [],
      fallbackTimeoutMs: 1000,
      enableFallback: false,
      adapters: makeAdapters({ gemini: faultyAdapter }),
    });

    await orch.start(fakeStream, noopOptions);
    // stop() should not propagate the adapter's error
    await expect(orch.stop()).resolves.toBeUndefined();
    expect(orch.state).toBe('idle');
    expect(orch.activeProvider).toBeNull();
  });
});
