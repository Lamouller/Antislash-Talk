/**
 * TranscriptionOrchestrator — phase 11
 *
 * State machine guaranteeing exactly 1 active provider at a time.
 * States: idle → starting → active → fallback → stopping → idle
 *
 * The invariant is: state === 'active' ⟹ exactly one ProviderAdapter.isActive() === true.
 *
 * Usage:
 *   const orch = createTranscriptionOrchestrator(config);
 *   const provider = await orch.start(stream, options); // preferred or fallback
 *   await orch.stop();
 */

export type Provider = 'gemini' | 'whisperx' | 'local-transformers';

export type OrchestratorState = 'idle' | 'starting' | 'active' | 'fallback' | 'stopping';

export interface ProviderStartOptions {
  onSegment: (segment: unknown) => void;
  onError: (error: Error) => void;
}

export interface ProviderAdapter {
  /** Unique provider identifier. */
  id: Provider;
  /**
   * Attempts to start the provider. Must throw (or reject) on failure.
   * The orchestrator races this promise against fallbackTimeoutMs.
   */
  start(stream: MediaStream, options: ProviderStartOptions): Promise<void>;
  /**
   * Stops the provider and cleans up resources.
   * Must be idempotent — safe to call multiple times.
   */
  stop(): Promise<void>;
  /** Returns true if the provider is currently active and streaming. */
  isActive(): boolean;
}

export interface OrchestratorConfig {
  /** Provider to try first. */
  preferred: Provider;
  /** Ordered list of providers to try after preferred fails (preferred is skipped if present). */
  fallbackOrder: Provider[];
  /** Milliseconds before a start() attempt is considered timed out. Default: 5000. */
  fallbackTimeoutMs: number;
  /** If false, disables cascade fallback and throws immediately when preferred fails. Default: true. */
  enableFallback: boolean;
  /** Adapters keyed by provider id. */
  adapters: Record<Provider, ProviderAdapter>;
  /**
   * Optional callback fired on every state transition.
   * Must NOT perform blocking work (fire-and-forget only).
   */
  onTransition?: (
    from: OrchestratorState,
    to: OrchestratorState,
    provider: Provider | null
  ) => void;
}

export interface TranscriptionOrchestrator {
  /** Starts the pipeline. Returns the provider that became active. */
  start(stream: MediaStream, options: ProviderStartOptions): Promise<Provider>;
  /** Stops the currently active provider, if any. */
  stop(): Promise<void>;
  /** Current state of the orchestrator. */
  get state(): OrchestratorState;
  /** Currently active provider, or null if idle. */
  get activeProvider(): Provider | null;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTranscriptionOrchestrator(
  config: OrchestratorConfig
): TranscriptionOrchestrator {
  let _state: OrchestratorState = 'idle';
  let _active: Provider | null = null;

  // Internal: mutate state + fire onTransition (non-blocking)
  const transition = (
    next: OrchestratorState,
    provider: Provider | null = _active
  ): void => {
    const prev = _state;
    _state = next;
    _active = provider;
    // onTransition must not block — we call it synchronously but without await
    try {
      config.onTransition?.(prev, next, provider);
    } catch (err) {
      console.warn('[Orchestrator] onTransition threw:', err);
    }
  };

  /**
   * Attempts to start a single provider within the timeout.
   * Returns true if the provider started successfully and reports isActive().
   * Returns false on any failure (timeout, throw, isActive() === false).
   * Cleans up the adapter (best-effort) before returning false.
   */
  const tryProvider = async (
    provider: Provider,
    stream: MediaStream,
    options: ProviderStartOptions
  ): Promise<boolean> => {
    const adapter = config.adapters[provider];
    if (!adapter) {
      console.warn(`[Orchestrator] No adapter registered for provider: ${provider}`);
      return false;
    }

    try {
      await Promise.race([
        adapter.start(stream, options),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout after ${config.fallbackTimeoutMs}ms`)),
            config.fallbackTimeoutMs
          )
        ),
      ]);

      if (!adapter.isActive()) {
        // start() resolved but the adapter did not self-report as active
        console.warn(
          `[Orchestrator] ${provider} start() resolved but isActive() === false — treating as failure`
        );
        try {
          await adapter.stop();
        } catch {
          // best-effort cleanup
        }
        return false;
      }

      return true;
    } catch (err) {
      console.warn(`[Orchestrator] ${provider} failed:`, err);
      try {
        await adapter.stop();
      } catch {
        // best-effort cleanup — ignore secondary errors
      }
      return false;
    }
  };

  return {
    async start(stream: MediaStream, options: ProviderStartOptions): Promise<Provider> {
      if (_state !== 'idle' && _state !== 'fallback') {
        throw new Error(
          `[Orchestrator] Cannot start: orchestrator is in state '${_state}'. Call stop() first.`
        );
      }

      transition('starting', null);

      // --- Attempt preferred provider ---
      if (await tryProvider(config.preferred, stream, options)) {
        transition('active', config.preferred);
        return config.preferred;
      }

      // --- Preferred failed ---
      if (!config.enableFallback) {
        transition('idle', null);
        throw new Error(
          `[Orchestrator] Preferred provider '${config.preferred}' failed and fallback is disabled.`
        );
      }

      // --- Cascade through fallback list ---
      transition('fallback', null);

      for (const provider of config.fallbackOrder) {
        // Skip preferred if it appears in the fallback list (user misconfiguration guard)
        if (provider === config.preferred) continue;

        if (await tryProvider(provider, stream, options)) {
          transition('active', provider);
          return provider;
        }
      }

      // --- All providers exhausted ---
      transition('idle', null);
      throw new Error('[Orchestrator] All providers failed.');
    },

    async stop(): Promise<void> {
      if (_state === 'idle') return;

      const providerToStop = _active;
      transition('stopping', providerToStop);

      if (providerToStop) {
        try {
          await config.adapters[providerToStop].stop();
        } catch (err) {
          console.warn('[Orchestrator] stop() failed for provider:', providerToStop, err);
        }
      }

      transition('idle', null);
    },

    get state(): OrchestratorState {
      return _state;
    },

    get activeProvider(): Provider | null {
      return _active;
    },
  };
}
