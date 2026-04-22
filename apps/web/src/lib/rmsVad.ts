/**
 * rmsVad.ts — Client-side Voice Activity Detection based on RMS energy.
 *
 * Pure function, no Web Audio API dependencies — testable in isolation.
 * Used by useGeminiTranscription (phase 9) when the `clientVAD` flag is ON.
 *
 * Algorithm:
 *   - Each audio frame is evaluated against a dB threshold.
 *   - If RMS >= thresholdDb → frame is "voice".
 *   - If frame is silent but we were just in speech, a hangover window
 *     (hangoverMs) keeps shouldSend=true to avoid clipping phrase endings.
 *   - After hangoverMs of continuous silence, state transitions to 'silence'
 *     and frames are dropped until voice resumes.
 */

export interface RmsVadConfig {
  /** Energy threshold in dBFS (e.g. -40). Frames at or above = voice. */
  thresholdDb: number;
  /** Milliseconds of continuous silence before declaring "speech ended". */
  silenceMs: number;
  /** Milliseconds to keep sending after last voiced frame (prevents cutting phrase endings). */
  hangoverMs: number;
}

export type VadState = 'silence' | 'speech';

export interface VadDecision {
  /** Current VAD state after processing this frame. */
  state: VadState;
  /** Whether the current frame should be sent to the WebSocket. */
  shouldSend: boolean;
  /** RMS energy of the frame in dBFS (for debug / metrics). */
  rmsDb: number;
  /** Timestamp (ms) of the last state transition. */
  stateChangedAt: number;
}

export interface RmsVad {
  /** Evaluate a single frame. `nowMs` should be `performance.now()` or `Date.now()`. */
  process(rmsDb: number, nowMs: number): VadDecision;
  /** Reset internal state (e.g. for a new recording session). */
  reset(): void;
  /** Current VAD state. */
  get state(): VadState;
}

// ---------------------------------------------------------------------------
// computeRmsDb
// ---------------------------------------------------------------------------

/**
 * Computes the root-mean-square (RMS) energy of a Float32Array sample buffer
 * and returns the result in dBFS (dB relative to full scale).
 *
 * Returns -Infinity for empty or silent buffers (all zeros / near-zero).
 */
export function computeRmsDb(samples: Float32Array): number {
  if (samples.length === 0) return -Infinity;

  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }

  const rms = Math.sqrt(sum / samples.length);

  // Guard against log10(0) — treat as silence.
  if (rms < 1e-9) return -Infinity;

  return 20 * Math.log10(rms);
}

// ---------------------------------------------------------------------------
// createRmsVad
// ---------------------------------------------------------------------------

export function createRmsVad(config: RmsVadConfig): RmsVad {
  let currentState: VadState = 'silence';
  let lastVoiceAt = 0;
  let silenceStartedAt = 0;
  let stateChangedAt = 0;

  return {
    process(rmsDb: number, nowMs: number): VadDecision {
      const isVoiceFrame = rmsDb >= config.thresholdDb;

      if (isVoiceFrame) {
        lastVoiceAt = nowMs;

        if (currentState === 'silence') {
          // Transition: silence → speech
          currentState = 'speech';
          stateChangedAt = nowMs;
        }

        return { state: currentState, shouldSend: true, rmsDb, stateChangedAt };
      }

      // Silent frame — determine whether we are still in the hangover window.
      if (currentState === 'speech') {
        const msSinceLastVoice = nowMs - lastVoiceAt;

        if (msSinceLastVoice < config.hangoverMs) {
          // Still within hangover: keep sending to preserve phrase endings.
          return { state: currentState, shouldSend: true, rmsDb, stateChangedAt };
        }

        // Hangover expired → transition: speech → silence
        currentState = 'silence';
        silenceStartedAt = nowMs;
        stateChangedAt = nowMs;

        return { state: currentState, shouldSend: false, rmsDb, stateChangedAt };
      }

      // Already in silence: drop the frame.
      return { state: currentState, shouldSend: false, rmsDb, stateChangedAt: silenceStartedAt };
    },

    reset() {
      currentState = 'silence';
      lastVoiceAt = 0;
      silenceStartedAt = 0;
      stateChangedAt = 0;
    },

    get state(): VadState {
      return currentState;
    },
  };
}
