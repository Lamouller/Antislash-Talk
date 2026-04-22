/**
 * Hash d'un segment pour dedup : speaker + premiers 30 chars du texte, normalisés.
 *
 * Utilisé pour éviter les doublons lors d'un reconnect WS ou retroactive update.
 * Phase 7 — speaker mapping atomique + segment hash dedup.
 */

/**
 * Returns a stable, case-insensitive, whitespace-normalised dedup key for a
 * (speaker, text) pair.
 *
 * - speaker  : lowercased and trimmed
 * - text     : lowercased, whitespace collapsed, trimmed, sliced to 30 chars
 *
 * Null / undefined values are coerced to empty strings, so
 * segmentHash(null, null) === '::'
 */
export function segmentHash(
  speaker: string | undefined | null,
  text: string | undefined | null,
): string {
  const sp = String(speaker ?? '').toLowerCase().trim();
  const tx = String(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 30);
  return `${sp}::${tx}`;
}
