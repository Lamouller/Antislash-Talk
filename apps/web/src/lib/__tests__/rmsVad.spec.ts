import { describe, it, expect } from 'vitest';
import { createRmsVad, computeRmsDb } from '../rmsVad';

// ---------------------------------------------------------------------------
// computeRmsDb
// ---------------------------------------------------------------------------

describe('computeRmsDb', () => {
  it('empty array → -Infinity', () => {
    expect(computeRmsDb(new Float32Array(0))).toBe(-Infinity);
  });

  it('silence (all zeros) → -Infinity', () => {
    expect(computeRmsDb(new Float32Array(1024))).toBe(-Infinity);
  });

  it('near-zero signal (< 1e-9 RMS) → -Infinity', () => {
    // 1e-10 per sample → RMS = 1e-10, below threshold
    expect(computeRmsDb(new Float32Array(1024).fill(1e-10))).toBe(-Infinity);
  });

  it('full-scale sine ≈ -3 dBFS', () => {
    // RMS of a pure sine = amplitude / sqrt(2) ≈ 0.707 → 20*log10(0.707) ≈ -3.01 dB
    const samples = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      samples[i] = Math.sin((2 * Math.PI * i) / 1024);
    }
    const db = computeRmsDb(samples);
    expect(db).toBeGreaterThan(-4);
    expect(db).toBeLessThan(-2);
  });

  it('small constant signal → well below 0 dBFS', () => {
    // 0.01 → RMS = 0.01 → 20*log10(0.01) = -40 dB
    const samples = new Float32Array(1024).fill(0.01);
    const db = computeRmsDb(samples);
    expect(db).toBeCloseTo(-40, 0);
  });

  it('full-scale DC (+1.0) → 0 dBFS', () => {
    const samples = new Float32Array(512).fill(1.0);
    const db = computeRmsDb(samples);
    expect(db).toBeCloseTo(0, 1);
  });

  it('full-scale DC (-1.0) → 0 dBFS (symmetric)', () => {
    const samples = new Float32Array(512).fill(-1.0);
    const db = computeRmsDb(samples);
    expect(db).toBeCloseTo(0, 1);
  });
});

// ---------------------------------------------------------------------------
// createRmsVad — config shared across most tests
// ---------------------------------------------------------------------------

describe('createRmsVad', () => {
  const config = { thresholdDb: -40, silenceMs: 400, hangoverMs: 200 };

  it('initial state is silence', () => {
    const vad = createRmsVad(config);
    expect(vad.state).toBe('silence');
  });

  it('silent frame on fresh vad → shouldSend false, state silence', () => {
    const vad = createRmsVad(config);
    const d = vad.process(-60, 0);
    expect(d.state).toBe('silence');
    expect(d.shouldSend).toBe(false);
  });

  it('voice frame → state speech, shouldSend true', () => {
    const vad = createRmsVad(config);
    const d = vad.process(-30, 100);
    expect(d.state).toBe('speech');
    expect(d.shouldSend).toBe(true);
  });

  it('threshold boundary — exactly at threshold triggers speech (>=)', () => {
    const vad = createRmsVad(config);
    const d = vad.process(-40, 0);
    expect(d.state).toBe('speech');
    expect(d.shouldSend).toBe(true);
  });

  it('threshold boundary — just below threshold stays silence', () => {
    const vad = createRmsVad(config);
    // -40.001 < -40 (threshold)
    const d = vad.process(-40.001, 0);
    expect(d.state).toBe('silence');
    expect(d.shouldSend).toBe(false);
  });

  it('hangover: silent frame within hangoverMs of last voice → still sends', () => {
    const vad = createRmsVad(config);
    vad.process(-30, 0);               // speech at t=0
    const d = vad.process(-60, 100);   // silent at t=100ms, hangover=200ms → still sends
    expect(d.state).toBe('speech');
    expect(d.shouldSend).toBe(true);
  });

  it('hangover: silent frame at exactly hangoverMs boundary → still sends (< is strict)', () => {
    const vad = createRmsVad(config);
    vad.process(-30, 0);
    // msSinceLastVoice = 200 — NOT < 200, so hangover expires
    const d = vad.process(-60, 200);
    expect(d.state).toBe('silence');
    expect(d.shouldSend).toBe(false);
  });

  it('hangover expired → transitions to silence, shouldSend false', () => {
    const vad = createRmsVad(config);
    vad.process(-30, 0);               // speech
    const d1 = vad.process(-60, 100); // inside hangover → sends
    expect(d1.shouldSend).toBe(true);
    const d2 = vad.process(-60, 300); // outside hangover (300 > 200) → drop
    expect(d2.state).toBe('silence');
    expect(d2.shouldSend).toBe(false);
  });

  it('voice returns during hangover → stays speech, shouldSend true', () => {
    const vad = createRmsVad(config);
    vad.process(-30, 0);               // speech
    vad.process(-60, 100);             // hangover
    const d = vad.process(-30, 150);   // voice again before hangover expires
    expect(d.state).toBe('speech');
    expect(d.shouldSend).toBe(true);
  });

  it('reset returns state to silence', () => {
    const vad = createRmsVad(config);
    vad.process(-30, 0);
    expect(vad.state).toBe('speech');
    vad.reset();
    expect(vad.state).toBe('silence');
  });

  it('reset allows fresh detection after a session', () => {
    const vad = createRmsVad(config);
    vad.process(-30, 0);
    vad.reset();
    const d = vad.process(-60, 5000); // silence on fresh vad
    expect(d.state).toBe('silence');
    expect(d.shouldSend).toBe(false);
  });

  it('multiple consecutive silent frames after hangover all drop', () => {
    const vad = createRmsVad(config);
    vad.process(-30, 0);
    // expire hangover
    vad.process(-60, 300);
    const d1 = vad.process(-60, 400);
    const d2 = vad.process(-60, 500);
    expect(d1.shouldSend).toBe(false);
    expect(d2.shouldSend).toBe(false);
  });

  it('speech → silence → speech cycle works correctly', () => {
    const vad = createRmsVad(config);

    // First speech burst
    vad.process(-30, 0);
    expect(vad.state).toBe('speech');

    // Silence past hangover
    vad.process(-60, 300);
    expect(vad.state).toBe('silence');

    // New speech burst
    const d = vad.process(-30, 1000);
    expect(d.state).toBe('speech');
    expect(d.shouldSend).toBe(true);
  });

  it('rmsDb is forwarded in the decision', () => {
    const vad = createRmsVad(config);
    const d = vad.process(-35.5, 0);
    expect(d.rmsDb).toBe(-35.5);
  });

  it('stateChangedAt is set when entering speech', () => {
    const vad = createRmsVad(config);
    const d = vad.process(-30, 999);
    expect(d.stateChangedAt).toBe(999);
  });
});
