/**
 * Strip control chars, newlines, markdown/quote chars, cap length.
 * Prevents prompt injection via user-controlled speaker names.
 */
export function sanitizeSpeakerName(name: string | null | undefined): string {
  const raw = String(name ?? '');
  const cleaned = raw
    .replace(/[\r\n\u2028\u2029]/g, ' ')
    .replace(/[`'"\\]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 64)
    .trim();
  return cleaned || 'Unknown';
}

/**
 * Normalize segment text for safe injection into LLM prompts.
 * Strips newlines (preserves content), caps at 4000 chars.
 */
export function sanitizeSegmentForPrompt(text: string | null | undefined): string {
  return String(text ?? '').replace(/\r?\n/g, ' ').slice(0, 4000);
}
