/**
 * Pure functions for speaker name detection from self-introduction patterns.
 *
 * Extracted from useGeminiTranscription.ts (createSegment inline logic).
 * Each pattern is individually testable and has a unique id for debug/metrics.
 *
 * Phase 7 — speaker mapping atomique + segment hash dedup.
 */

export interface NameDetectionResult {
  name: string;
  patternId: string;       // pour debug/metrics
  confidence: 'high' | 'medium' | 'low';
}

interface NamePattern {
  id: string;
  regex: RegExp;
  /**
   * Returns the captured name, or null if the match is invalid
   * (e.g. failed the uppercase-first-letter check).
   * match[1] is always the first capture group, match[2] the second (if any).
   */
  extract: (match: RegExpMatchArray) => string | null;
  confidence: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Blacklist: words that look like names but are not
// ---------------------------------------------------------------------------
const NAME_BLACKLIST = new Set([
  'bonjour', 'bonsoir', 'salut', 'merci', 'donc', 'voilà', 'voila', 'alors',
  'oui', 'non', 'bien', 'très', 'super', 'parfait', 'exactement',
  'effectivement', 'absolument', 'certainement', 'peut', 'être',
  'live', 'test', 'tester', 'moment', 'instant', 'section',
  'pas', 'plus', 'jamais', 'rien', 'personne', 'quelqu', 'tout',
  'ici', 'parle', 'parler', 'dit', 'dire', 'fait', 'faire',
  'suis', 'appelle', 'présent', 'présente', 'juste', 'encore',
  'moi', 'toi', 'lui', 'elle', 'eux', 'celui', 'celle', 'ceux',
  'quand', 'comme', 'avec', 'pour', 'dans', 'mais', 'cette',
  'votre', 'notre', 'leur', 'vous', 'nous', 'elles', 'ils',
  'triste', 'content', 'heureux', 'désolé', 'certain', 'vrai',
  'toujours', 'encore', 'aussi', 'vraiment',
]);

/**
 * Validates that a candidate string is an acceptable proper name:
 * - Starts with an uppercase letter
 * - Followed by at least 2 lowercase letters (including accented)
 * - Not in the blacklist
 */
function isValidName(candidate: string): boolean {
  if (!candidate || candidate.length < 3) return false;
  // First char uppercase
  if (!/^[A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇ]/.test(candidate)) return false;
  // Remainder has at least 2 lowercase chars (support hyphenated: Jean-Pierre)
  const lowerCount = (candidate.match(/[a-zéèêëàâäôöùûüïîç]/g) || []).length;
  if (lowerCount < 2) return false;
  // Blacklist check (case-insensitive)
  if (NAME_BLACKLIST.has(candidate.toLowerCase())) return false;
  return true;
}

/**
 * Builds a compound name from two match groups if both start with uppercase,
 * otherwise returns group 1 only.
 */
function buildName(match: RegExpMatchArray): string | null {
  const part1 = match[1]?.trim();
  const part2 = match[2]?.trim();
  if (!part1) return null;
  if (part2 && /^[A-ZÉÈÊËÀÂÄÔÖ]/.test(part2)) {
    return `${part1} ${part2}`;
  }
  return part1;
}

// ---------------------------------------------------------------------------
// The 14 patterns (same semantics as the inline ones in useGeminiTranscription)
// ---------------------------------------------------------------------------
export const PATTERNS: NamePattern[] = [
  // 1. "c'est [toujours/encore/aussi/bien/vraiment] Tristan qui parle/ici/à l'appareil"
  {
    id: 'cest-filler-qui-parle',
    regex: /c'est\s+(?:toujours\s+|encore\s+|aussi\s+|bien\s+|vraiment\s+)?([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})\s+(?:qui\s+parle|ici|à l'appareil)/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'high',
  },

  // 2. "là c'est Tristan" / "donc c'est Tristan"
  {
    id: 'la-donc-cest',
    regex: /(?:là|donc)\s+c'est\s+(?:toujours\s+)?([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'high',
  },

  // 3. "je suis / je m'appelle / moi c'est [Name]"
  {
    id: 'je-suis-mappelle-moi-cest',
    regex: /(?:je\s+suis|je\s+m'appelle|moi\s+c'est)\s+([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,}(?:-[A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})?)/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'high',
  },

  // 4. "ici Tristan" / "bonjour Tristan ici"
  {
    id: 'ici-bonjour',
    regex: /(?:ici|bonjour)\s+([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})(?:\s+ici)?/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'medium',
  },

  // 5. "Tristan à l'appareil" / "Tristan au micro"
  {
    id: 'name-appareil-micro',
    regex: /([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})\s+(?:à l'appareil|au micro)/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'high',
  },

  // 6. "Tristan qui parle" at start of text
  {
    id: 'name-qui-parle-start',
    regex: /^([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})\s+qui\s+parle/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'high',
  },

  // 7. ", Tristan qui parle" — after comma
  {
    id: 'comma-name-qui-parle',
    regex: /,\s*([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})\s+qui\s+parle/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'high',
  },

  // 8. ", c'est Tristan," — name surrounded by commas
  {
    id: 'comma-cest-comma',
    regex: /,\s*c'est\s+([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,}),/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'high',
  },

  // 9. "Bon/Alors/Ok/Bien/Oui/Donc, c'est Tristan" — intro starters
  {
    id: 'starter-cest',
    regex: /(?:^|[.!?]\s*)(?:bon|alors|ok|bien|oui|donc)\s*,?\s*c'est\s+([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'medium',
  },

  // 10. "c'est Jean Fabien," — compound first names
  {
    id: 'cest-compound',
    regex: /c'est\s+([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})\s+([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})\s*,/i,
    extract: (m) => buildName(m),
    confidence: 'medium',
  },

  // 11. "c'est bien/vraiment Tristan." — with filler + end punctuation
  {
    id: 'cest-bien-vraiment',
    regex: /c'est\s+(?:bien|vraiment)\s+([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})[.,!?]?$/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'high',
  },

  // 12. "c'est Tristan." — simple c'est at end of sentence
  {
    id: 'cest-simple-end',
    regex: /c'est\s+([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})[.,!?]?\s*$/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'medium',
  },

  // 13. "mon nom est / je me présente [Name]" — formal introduction
  {
    id: 'mon-nom-est',
    regex: /(?:mon nom est|je me présente,?\s*(?:je suis)?)\s+([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,}(?:\s+[A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})?)/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'high',
  },

  // 14. "Tristan à l'appareil" / "[Name] au téléphone" — telefone variant
  {
    id: 'name-telephone',
    regex: /([A-ZÉÈÊËÀÂÄÔÖÙÛÜÏÎÇA-Z][a-zéèêëàâäôöùûüïîç]{2,})\s+(?:au téléphone|au telephone)/i,
    extract: (m) => {
      const name = m[1]?.trim();
      return name && isValidName(name) ? name : null;
    },
    confidence: 'high',
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pure function: extracts a proper name from a text segment.
 * Returns null if no pattern matches or the candidate fails validation.
 *
 * Tries patterns in order; returns the first successful match.
 */
export function detectName(text: string): NameDetectionResult | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const pattern of PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (!match) continue;
    const name = pattern.extract(match);
    if (name && isValidName(name)) {
      return {
        name,
        patternId: pattern.id,
        confidence: pattern.confidence,
      };
    }
  }

  return null;
}
