/**
 * Unit tests for lib/timestamp.ts (phase 5).
 *
 * Run with: pnpm --filter @antislash-talk/web test
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeSegmentTimestamp,
  formatTimestampMMSS,
  normalizeSegment,
  readSegmentStart,
  readSegmentEnd,
} from '../timestamp';
import type { FlagContext } from '../featureFlags';

// ---------------------------------------------------------------------------
// normalizeSegmentTimestamp
// ---------------------------------------------------------------------------

describe('normalizeSegmentTimestamp', () => {
  it('number passthrough: integer', () => expect(normalizeSegmentTimestamp(90)).toBe(90));
  it('number passthrough: float', () => expect(normalizeSegmentTimestamp(45.2)).toBe(45.2));
  it('MM:SS → seconds', () => expect(normalizeSegmentTimestamp('01:30')).toBe(90));
  it('HH:MM:SS → seconds', () => expect(normalizeSegmentTimestamp('01:02:03')).toBe(3723));
  it('M:SS with single minute digit', () => expect(normalizeSegmentTimestamp('1:05')).toBe(65));
  it('numeric string', () => expect(normalizeSegmentTimestamp('45')).toBe(45));
  it('float string', () => expect(normalizeSegmentTimestamp('1.5')).toBe(1.5));
  it('undefined → 0', () => expect(normalizeSegmentTimestamp(undefined)).toBe(0));
  it('null → 0', () => expect(normalizeSegmentTimestamp(null)).toBe(0));
  it('empty string → 0', () => expect(normalizeSegmentTimestamp('')).toBe(0));
  it('garbage string → 0', () => expect(normalizeSegmentTimestamp('abc')).toBe(0));
  it('negative number → 0', () => expect(normalizeSegmentTimestamp(-5)).toBe(0));
  it('NaN → 0', () => expect(normalizeSegmentTimestamp(NaN)).toBe(0));
  it('Infinity → 0', () => expect(normalizeSegmentTimestamp(Infinity)).toBe(0));
  it('negative Infinity → 0', () => expect(normalizeSegmentTimestamp(-Infinity)).toBe(0));
  it('zero → 0', () => expect(normalizeSegmentTimestamp(0)).toBe(0));
  it('MM:SS with zero padding', () => expect(normalizeSegmentTimestamp('00:45')).toBe(45));
  it('00:00 → 0', () => expect(normalizeSegmentTimestamp('00:00')).toBe(0));
});

// ---------------------------------------------------------------------------
// formatTimestampMMSS
// ---------------------------------------------------------------------------

describe('formatTimestampMMSS', () => {
  it('0 → "00:00"', () => expect(formatTimestampMMSS(0)).toBe('00:00'));
  it('65 → "01:05"', () => expect(formatTimestampMMSS(65)).toBe('01:05'));
  it('3723 → "01:02:03"', () => expect(formatTimestampMMSS(3723)).toBe('01:02:03'));
  it('negative → "00:00"', () => expect(formatTimestampMMSS(-1)).toBe('00:00'));
  it('NaN → "00:00"', () => expect(formatTimestampMMSS(NaN)).toBe('00:00'));
  it('90 → "01:30"', () => expect(formatTimestampMMSS(90)).toBe('01:30'));
  it('3600 → "01:00:00"', () => expect(formatTimestampMMSS(3600)).toBe('01:00:00'));
  it('floats are floored', () => expect(formatTimestampMMSS(61.9)).toBe('01:01'));
});

// ---------------------------------------------------------------------------
// normalizeSegment
// ---------------------------------------------------------------------------

describe('normalizeSegment', () => {
  it('adds startSec/endSec from numeric legacy fields', () => {
    const out = normalizeSegment({ start: 10, end: 20, text: 'hi', speaker: 'A' });
    expect(out.startSec).toBe(10);
    expect(out.endSec).toBe(20);
  });

  it('adds startSec/endSec from MM:SS string legacy fields', () => {
    const out = normalizeSegment({ start: '01:30', end: '02:00', text: 'hi', speaker: 'A' });
    expect(out.startSec).toBe(90);
    expect(out.endSec).toBe(120);
  });

  it('preserves existing valid startSec/endSec (idempotent)', () => {
    const out = normalizeSegment({ start: 10, end: 20, startSec: 30, endSec: 40, text: 'hi', speaker: 'A' });
    expect(out.startSec).toBe(30);
    expect(out.endSec).toBe(40);
  });

  it('auto-fixes when start >= end: sets endSec = startSec + 1', () => {
    const out = normalizeSegment({ start: 10, end: 5, text: 'hi', speaker: 'A' });
    expect(out.startSec).toBe(10);
    expect(out.endSec).toBe(11);
  });

  it('auto-fixes when start === end', () => {
    const out = normalizeSegment({ start: 15, end: 15, text: 'hi', speaker: 'A' });
    expect(out.startSec).toBe(15);
    expect(out.endSec).toBe(16);
  });

  it('preserves all original fields (non-destructive)', () => {
    const out = normalizeSegment({ start: '00:30', end: '00:45', text: 'bonjour', speaker: 'Alice', confidence: 0.9, isLive: true });
    expect(out.start).toBe('00:30');
    expect(out.end).toBe('00:45');
    expect(out.text).toBe('bonjour');
    expect(out.speaker).toBe('Alice');
    expect(out.confidence).toBe(0.9);
    expect(out.isLive).toBe(true);
  });

  it('handles missing start/end (both undefined → startSec=0, endSec=1)', () => {
    const out = normalizeSegment({ text: 'hi', speaker: 'A' });
    expect(out.startSec).toBe(0);
    expect(out.endSec).toBe(1); // auto-fix: 0 > 0 is false → 0 + 1
  });

  it('handles null start/end', () => {
    const out = normalizeSegment({ start: null, end: null, text: 'hi', speaker: 'A' });
    expect(out.startSec).toBe(0);
    expect(out.endSec).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// readSegmentStart / readSegmentEnd with feature flag
// ---------------------------------------------------------------------------

const masterOnCtx: FlagContext = {
  envFlags: { newTranscriptionFlow: true, normalizedTimestamps: true },
};

const masterOffCtx: FlagContext = {
  envFlags: { newTranscriptionFlow: false, normalizedTimestamps: true },
};

const flagOffCtx: FlagContext = {
  envFlags: { newTranscriptionFlow: true, normalizedTimestamps: false },
};

describe('readSegmentStart', () => {
  it('flag ON → returns startSec directly', () => {
    const seg = { start: '01:30', end: '02:00', startSec: 90, endSec: 120 };
    expect(readSegmentStart(seg, masterOnCtx)).toBe(90);
  });

  it('flag OFF (sub-flag) → normalises legacy start', () => {
    const seg = { start: '01:30', end: '02:00', startSec: 90, endSec: 120 };
    // flagOffCtx has normalizedTimestamps: false → falls back to normalise
    expect(readSegmentStart(seg, flagOffCtx)).toBe(90); // normalizeSegmentTimestamp(90) = 90
  });

  it('master kill OFF → sub-flags forced false → normalises legacy start', () => {
    const seg = { start: 45, end: 60, startSec: 45, endSec: 60 };
    expect(readSegmentStart(seg, masterOffCtx)).toBe(45);
  });

  it('no ctx → normalises via startSec fallback', () => {
    const seg = { start: '00:45', startSec: 45 };
    expect(readSegmentStart(seg)).toBe(45);
  });

  it('no ctx, no startSec → normalises legacy start string', () => {
    const seg = { start: '01:00' };
    expect(readSegmentStart(seg)).toBe(60);
  });
});

describe('readSegmentEnd', () => {
  it('flag ON → returns endSec directly', () => {
    const seg = { start: '01:30', end: '02:00', startSec: 90, endSec: 120 };
    expect(readSegmentEnd(seg, masterOnCtx)).toBe(120);
  });

  it('no ctx, no endSec → normalises legacy end string', () => {
    const seg = { end: '02:00' };
    expect(readSegmentEnd(seg)).toBe(120);
  });
});
