/**
 * Timestamp utilities for transcription segments (phase 5).
 *
 * Problem: Gemini enhancement returns timestamps as "MM:SS" strings while
 * Whisper/local returns numeric seconds. UI consumers crash on mixed types.
 *
 * Strategy: add secondary fields startSec/endSec (always numeric) alongside
 * the legacy start/end fields. Feature flag `normalizedTimestamps` lets
 * consumers opt-in progressively via readSegmentStart/readSegmentEnd.
 */

import { resolveFlag } from './featureFlags';
import type { FlagContext } from './featureFlags';

// ---------------------------------------------------------------------------
// Core normalizer
// ---------------------------------------------------------------------------

/**
 * Normalises any timestamp representation to seconds (number >= 0).
 * Accepts: number, "MM:SS", "HH:MM:SS", "SS.mmm", null, undefined.
 * Always returns a finite number >= 0 — never NaN, never negative.
 */
export function normalizeSegmentTimestamp(ts: number | string | undefined | null): number {
  if (ts === null || ts === undefined) return 0;
  if (typeof ts === 'number') return Number.isFinite(ts) ? Math.max(0, ts) : 0;

  const s = String(ts).trim();
  if (!s) return 0;

  // "HH:MM:SS" or "MM:SS" (or "M:SS" etc.)
  if (/^\d+:\d{1,2}(:\d{1,2})?$/.test(s)) {
    const parts = s.split(':').map(p => parseInt(p, 10));
    if (parts.some(p => isNaN(p))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }

  // Plain number string or "SS.mmm"
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

/**
 * Formats seconds to "MM:SS" or "HH:MM:SS" if >= 1h.
 */
export function formatTimestampMMSS(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const s = Math.floor(seconds);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hh > 0) return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  return `${pad(mm)}:${pad(ss)}`;
}

// ---------------------------------------------------------------------------
// Segment normalizer
// ---------------------------------------------------------------------------

export interface SegmentWithTimestamps {
  start?: number | string | null;
  end?: number | string | null;
  startSec?: number;
  endSec?: number;
  [key: string]: unknown;
}

/**
 * Enriches a segment with numeric startSec/endSec fields derived from
 * whatever format start/end happen to be in (string "MM:SS" or number).
 *
 * - Idempotent: if startSec/endSec are already finite numbers, they are preserved.
 * - Auto-fix: if start >= end after normalisation, endSec is set to startSec + 1.
 * - Non-destructive: legacy start/end fields are kept as-is.
 */
export function normalizeSegment<T extends SegmentWithTimestamps>(
  seg: T
): T & { startSec: number; endSec: number } {
  const startSec =
    typeof seg.startSec === 'number' && Number.isFinite(seg.startSec)
      ? seg.startSec
      : normalizeSegmentTimestamp(seg.start);

  const rawEndSec =
    typeof seg.endSec === 'number' && Number.isFinite(seg.endSec)
      ? seg.endSec
      : normalizeSegmentTimestamp(seg.end);

  // Guard: if start >= end, auto-fix to start + 1 (avoids zero-duration segments)
  const endSec = rawEndSec > startSec ? rawEndSec : startSec + 1;

  return { ...seg, startSec, endSec };
}

// ---------------------------------------------------------------------------
// Feature-flag-aware accessors
// ---------------------------------------------------------------------------

/**
 * Returns the start time in seconds for a segment.
 *
 * When ctx is provided and the `normalizedTimestamps` flag is ON, returns
 * startSec directly (always a clean number). Otherwise falls back to
 * normalising the legacy start field (or startSec if present).
 */
export function readSegmentStart(seg: SegmentWithTimestamps, ctx?: FlagContext): number {
  if (ctx) {
    const flag = resolveFlag('normalizedTimestamps', ctx);
    if (flag.value && typeof seg.startSec === 'number' && Number.isFinite(seg.startSec)) {
      return seg.startSec;
    }
  }
  // Fallback: prefer startSec if already computed, else normalise legacy field
  return normalizeSegmentTimestamp(seg.startSec ?? seg.start);
}

/**
 * Returns the end time in seconds for a segment.
 *
 * Same flag-gating logic as readSegmentStart.
 */
export function readSegmentEnd(seg: SegmentWithTimestamps, ctx?: FlagContext): number {
  if (ctx) {
    const flag = resolveFlag('normalizedTimestamps', ctx);
    if (flag.value && typeof seg.endSec === 'number' && Number.isFinite(seg.endSec)) {
      return seg.endSec;
    }
  }
  return normalizeSegmentTimestamp(seg.endSec ?? seg.end);
}
