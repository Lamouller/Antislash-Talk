import { describe, it, expect } from 'vitest';
import { detectName, PATTERNS } from '../nameDetectionPatterns';

// ---------------------------------------------------------------------------
// Core self-introduction patterns
// ---------------------------------------------------------------------------

describe('detectName — pattern: je-suis-mappelle-moi-cest', () => {
  it("Je m'appelle Tristan → Tristan", () => {
    expect(detectName("Je m'appelle Tristan")?.name).toBe('Tristan');
  });

  it('Je suis Marie → Marie', () => {
    expect(detectName('Je suis Marie')?.name).toBe('Marie');
  });

  it("Moi c'est Élodie → Élodie", () => {
    expect(detectName("Moi c'est Élodie")?.name).toBe('Élodie');
  });

  it("Je m'appelle Jean-Pierre → Jean-Pierre (hyphenated)", () => {
    expect(detectName("Je m'appelle Jean-Pierre")?.name).toBe('Jean-Pierre');
  });

  it("Je m'appelle Hélène → Hélène (accented uppercase)", () => {
    expect(detectName("Je m'appelle Hélène")?.name).toBe('Hélène');
  });
});

describe("detectName — pattern: cest-filler-qui-parle", () => {
  it("C'est Tristan qui parle → Tristan", () => {
    expect(detectName("C'est Tristan qui parle")?.name).toBe('Tristan');
  });

  it("C'est bien Tristan qui parle → Tristan (avec filler)", () => {
    expect(detectName("C'est bien Tristan qui parle")?.name).toBe('Tristan');
  });

  it("C'est toujours Tristan ici → Tristan (filler toujours)", () => {
    expect(detectName("C'est toujours Tristan ici")?.name).toBe('Tristan');
  });

  it("C'est encore Marie à l'appareil → Marie", () => {
    expect(detectName("C'est encore Marie à l'appareil")?.name).toBe('Marie');
  });
});

describe("detectName — pattern: cest-bien-vraiment", () => {
  it("C'est bien Tristan → Tristan", () => {
    expect(detectName("C'est bien Tristan")?.name).toBe('Tristan');
  });

  it("C'est vraiment Sophie. → Sophie", () => {
    expect(detectName("C'est vraiment Sophie.")?.name).toBe('Sophie');
  });
});

describe("detectName — pattern: cest-simple-end", () => {
  it("C'est Tristan. → Tristan", () => {
    expect(detectName("C'est Tristan.")?.name).toBe('Tristan');
  });

  it("Bonjour, c'est Marie! → Marie", () => {
    expect(detectName("Bonjour, c'est Marie!")?.name).toBe('Marie');
  });
});

describe("detectName — pattern: name-appareil-micro", () => {
  it("Tristan à l'appareil → Tristan", () => {
    expect(detectName("Tristan à l'appareil")?.name).toBe('Tristan');
  });

  it("Marie au micro → Marie", () => {
    expect(detectName("Marie au micro")?.name).toBe('Marie');
  });
});

describe("detectName — pattern: name-telephone", () => {
  it("Tristan au téléphone → Tristan", () => {
    expect(detectName("Tristan au téléphone")?.name).toBe('Tristan');
  });
});

describe("detectName — pattern: name-qui-parle-start", () => {
  it("Tristan qui parle → Tristan (début de phrase)", () => {
    expect(detectName("Tristan qui parle")?.name).toBe('Tristan');
  });
});

describe("detectName — pattern: comma-name-qui-parle", () => {
  it(", Marie qui parle → Marie (après virgule)", () => {
    expect(detectName(", Marie qui parle")?.name).toBe('Marie');
  });
});

describe("detectName — pattern: comma-cest-comma", () => {
  it(", c'est Tristan, → Tristan", () => {
    expect(detectName(", c'est Tristan,")?.name).toBe('Tristan');
  });
});

describe("detectName — pattern: starter-cest", () => {
  it("Bon, c'est Marie → Marie", () => {
    expect(detectName("Bon, c'est Marie")?.name).toBe('Marie');
  });

  it("Alors c'est Tristan → Tristan", () => {
    expect(detectName("Alors c'est Tristan")?.name).toBe('Tristan');
  });
});

describe("detectName — pattern: cest-compound", () => {
  it("C'est Jean Fabien, → Jean Fabien (prénom composé)", () => {
    expect(detectName("C'est Jean Fabien,")?.name).toBe('Jean Fabien');
  });
});

describe("detectName — pattern: ici-bonjour", () => {
  it("Bonjour Sophie ici → Sophie", () => {
    expect(detectName("Bonjour Sophie ici")?.name).toBe('Sophie');
  });

  it("Ici Tristan → Tristan", () => {
    expect(detectName("Ici Tristan")?.name).toBe('Tristan');
  });
});

describe("detectName — pattern: la-donc-cest", () => {
  it("Là c'est Tristan → Tristan", () => {
    expect(detectName("Là c'est Tristan")?.name).toBe('Tristan');
  });

  it("Donc c'est Marie → Marie", () => {
    expect(detectName("Donc c'est Marie")?.name).toBe('Marie');
  });
});

describe("detectName — pattern: mon-nom-est", () => {
  it("Mon nom est Tristan → Tristan", () => {
    expect(detectName("Mon nom est Tristan")?.name).toBe('Tristan');
  });

  it("Je me présente, je suis Marie → Marie", () => {
    expect(detectName("Je me présente, je suis Marie")?.name).toBe('Marie');
  });
});

// ---------------------------------------------------------------------------
// Blacklist & false positive protection
// ---------------------------------------------------------------------------

describe('detectName — blacklist & false positives', () => {
  it("blacklist: 'Bonjour' n'est pas un nom → null", () => {
    // "ici Bonjour" would match pattern 4 but Bonjour is blacklisted
    expect(detectName("Ici Bonjour")).toBeNull();
  });

  it("blacklist: 'Merci' n'est pas un nom", () => {
    expect(detectName("Je m'appelle Merci")).toBeNull();
  });

  it("blacklist: 'Voilà' n'est pas un nom", () => {
    expect(detectName("C'est Voilà.")).toBeNull();
  });

  it("blacklist: 'Alors' n'est pas un nom", () => {
    expect(detectName("Je suis Alors")).toBeNull();
  });

  it('mot tout en minuscule → null', () => {
    expect(detectName('je parle doucement')).toBeNull();
  });

  it('texte vide → null', () => {
    expect(detectName('')).toBeNull();
  });

  it('non défini (string vide whitespace) → null', () => {
    expect(detectName('   ')).toBeNull();
  });

  it('phrase ordinaire sans introduction → null', () => {
    expect(detectName('Voici une phrase normale sans présentation.')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Result structure
// ---------------------------------------------------------------------------

describe('detectName — résultat structuré', () => {
  it("retourne un patternId valide", () => {
    const result = detectName("Je m'appelle Tristan");
    expect(result).not.toBeNull();
    expect(result?.patternId).toBe('je-suis-mappelle-moi-cest');
  });

  it("retourne une confidence non vide", () => {
    const result = detectName("C'est Tristan qui parle");
    expect(['high', 'medium', 'low']).toContain(result?.confidence);
  });
});

// ---------------------------------------------------------------------------
// PATTERNS export accessible pour tests unitaires isolés
// ---------------------------------------------------------------------------

describe('PATTERNS export', () => {
  it('contient exactement 14 patterns', () => {
    expect(PATTERNS).toHaveLength(14);
  });

  it('tous les patterns ont un id unique', () => {
    const ids = PATTERNS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tous les patterns ont une regex valide', () => {
    for (const p of PATTERNS) {
      expect(p.regex).toBeInstanceOf(RegExp);
    }
  });
});
