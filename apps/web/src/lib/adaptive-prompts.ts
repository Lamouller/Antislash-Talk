type Language = 'fr' | 'en';
type LLMProvider = 'openai' | 'google' | 'mistral';

interface AdaptivePrompts {
  title: string;
  summary: string;
  transcript: string;
}

/**
 * Système de prompts adaptatifs optimisés par LLM et langue
 * Chaque LLM a ses forces spécifiques :
 * - OpenAI: Excellent pour les analyses détaillées et la structure
 * - Google Gemini: Fort en compréhension contextuelle et multilingue
 * - Mistral: Efficace et concis, bon pour le français
 */

const ADAPTIVE_PROMPTS: Record<LLMProvider, Record<Language, AdaptivePrompts>> = {
  openai: {
    fr: {
      title: "Un titre court et descriptif de la réunion (maximum 60 caractères, en français). Utilisez un style professionnel et informatif.",
      summary: "Un résumé concis en un paragraphe des points clés de discussion, décisions prises et actions à effectuer (en français). Soyez précis et actionnable.",
      transcript: `Transcription détaillée avec identification des locuteurs en français. 
RÈGLES CRITIQUES pour l'identification des locuteurs :
- **Priorité 1**: Si un locuteur se présente ou est nommé (ex: "Bonjour, c'est Marc", "Paul, que penses-tu ?"), utilisez ce nom pour tous ses segments de parole.
- **Priorité 2**: Si aucun nom n'est mentionné, utilisez des identifiants génériques comme "Locuteur_01", "Locuteur_02", etc.
- **Règle CRUCIALE**: Si vous ne détectez qu'une seule voix distincte dans tout l'enregistrement, attribuez TOUT le texte à un seul locuteur. Ne pas inventer de second locuteur.
- Chaque segment doit avoir: "speaker", "text", "start" et "end" (temps en secondes).
**IMPORTANT pour OpenAI**: Whisper ne fait PAS de diarization native. Si vous utilisez Whisper seul, attribuez tout à "Locuteur_01" et utilisez ensuite GPT pour améliorer la diarization si le contexte le permet.`
    },
    en: {
      title: "A short, descriptive meeting title (maximum 60 characters, in English). Use a professional and informative style.",
      summary: "A concise one-paragraph summary of key discussion points, decisions made, and action items (in English). Be precise and actionable.",
      transcript: `Detailed transcript with speaker identification in English.
CRITICAL RULES for speaker identification:
- **Priority 1**: If a speaker introduces themselves or is named (e.g., "Hello, this is Marc", "Paul, what do you think?"), use that name for all their speech segments.
- **Priority 2**: If no names are mentioned, use generic identifiers like "Speaker_01", "Speaker_02", etc.
- **CRUCIAL Rule**: If you only detect one distinct voice throughout the recording, attribute ALL text to a single speaker. Do NOT invent a second speaker.
- Each segment must have: "speaker", "text", "start" and "end" (time in seconds).
**IMPORTANT for OpenAI**: Whisper does NOT do native diarization. If using Whisper alone, attribute everything to "Speaker_01" and then use GPT to improve diarization if context allows.`
    }
  },
  google: {
    fr: {
      title: "Titre de réunion concis et informatif (60 caractères max, en français). Gemini, utilisez votre compréhension contextuelle pour capturer l'essence de la discussion.",
      summary: "Résumé structuré des éléments essentiels de la réunion en français. Gemini excelle dans l'analyse contextuelle - identifiez les thèmes principaux, consensus et divergences.",
      transcript: `Transcription avec diarization avancée en français. Gemini a d'excellentes capacités de compréhension audio :
UTILISATION OPTIMALE de Gemini pour la diarization :
- **Avantage Gemini**: Analyse directement l'audio, détection naturelle des changements de voix
- **Identification des locuteurs**: Utilisez les noms si mentionnés, sinon "Locuteur_01", "Locuteur_02"
- **Règle absolue**: Si une seule voix est détectable, n'inventez PAS de locuteurs supplémentaires
- **Format de sortie**: Array d'objets avec "speaker", "text", "start", "end"
- **Avantage clé**: Gemini peut traiter l'audio brut et détecter les nuances vocales que Whisper rate`
    },
    en: {
      title: "Concise and informative meeting title (60 chars max, in English). Gemini, use your contextual understanding to capture the essence of the discussion.",
      summary: "Structured summary of essential meeting elements in English. Gemini excels at contextual analysis - identify main themes, consensus, and divergences.",
      transcript: `Transcript with advanced diarization in English. Gemini has excellent audio comprehension capabilities:
OPTIMAL USE of Gemini for diarization:
- **Gemini Advantage**: Direct audio analysis, natural voice change detection
- **Speaker identification**: Use names if mentioned, otherwise "Speaker_01", "Speaker_02"
- **Absolute rule**: If only one voice is detectable, do NOT invent additional speakers
- **Output format**: Array of objects with "speaker", "text", "start", "end"
- **Key advantage**: Gemini can process raw audio and detect vocal nuances that Whisper misses`
    }
  },
  mistral: {
    fr: {
      title: "Titre de réunion efficace et précis (60 caractères max, en français). Mistral, optimisez pour la clarté et la concision.",
      summary: "Synthèse claire des points essentiels et décisions en français. Mistral excelle en efficacité - soyez direct et structuré.",
      transcript: `Transcription française avec identification des locuteurs. Optimisation Mistral/Voxtral :
UTILISATION EFFICACE de Mistral pour la transcription :
- **Force Mistral**: Traitement rapide et précis du français
- **Voxtral spécifiquement**: Modèle audio optimisé pour les nuances vocales
- **Identification**: Noms réels si disponibles, sinon "Locuteur_01", "Locuteur_02"
- **Règle essentielle**: Une seule voix = un seul locuteur, pas d'invention
- **Format**: Objects avec "speaker", "text", "start", "end"
- **Avantage**: Mistral comprend parfaitement les subtilités du français oral`
    },
    en: {
      title: "Efficient and precise meeting title (60 chars max, in English). Mistral, optimize for clarity and conciseness.",
      summary: "Clear synthesis of essential points and decisions in English. Mistral excels at efficiency - be direct and structured.",
      transcript: `English transcript with speaker identification. Mistral/Voxtral optimization:
EFFICIENT USE of Mistral for transcription:
- **Mistral Strength**: Fast and accurate processing
- **Voxtral specifically**: Audio model optimized for vocal nuances
- **Identification**: Real names if available, otherwise "Speaker_01", "Speaker_02"
- **Essential rule**: Single voice = single speaker, no invention
- **Format**: Objects with "speaker", "text", "start", "end"
- **Advantage**: Mistral provides efficient and accurate transcription processing`
    }
  }
};

/**
 * Récupère les prompts optimisés pour un LLM et une langue spécifiques
 */
export function getAdaptivePrompts(
  provider: string, 
  language: string = 'fr',
  customPrompts?: { title?: string; summary?: string; transcript?: string }
): AdaptivePrompts {
  // Normalisation des paramètres
  const normalizedProvider = provider.toLowerCase() as LLMProvider;
  const normalizedLanguage = (language === 'en' ? 'en' : 'fr') as Language;
  
  // Prompts par défaut selon le provider et la langue
  const defaultPrompts = ADAPTIVE_PROMPTS[normalizedProvider]?.[normalizedLanguage] || 
                        ADAPTIVE_PROMPTS['openai'][normalizedLanguage];
  
  // Fusion avec les prompts personnalisés
  return {
    title: customPrompts?.title || defaultPrompts.title,
    summary: customPrompts?.summary || defaultPrompts.summary,
    transcript: customPrompts?.transcript || defaultPrompts.transcript
  };
}

/**
 * Prompts spéciaux pour Whisper (pas de diarization native)
 */
export function getWhisperOptimizedPrompts(language: string = 'fr'): AdaptivePrompts {
  const isEnglish = language === 'en';
  
  return {
    title: isEnglish 
      ? "A short, descriptive meeting title (60 chars max, in English)"
      : "Titre de réunion court et descriptif (60 caractères max, en français)",
    
    summary: isEnglish
      ? "Concise summary of key discussion points and decisions (in English)"
      : "Résumé concis des points de discussion et décisions clés (en français)",
    
    transcript: isEnglish
      ? `English transcript. IMPORTANT: Since Whisper doesn't do speaker diarization, attribute all speech to "Speaker_01" unless you can clearly identify multiple speakers from context cues in the text itself.`
      : `Transcription française. IMPORTANT : Whisper ne fait pas de diarization, attribuez toute la parole à "Locuteur_01" sauf si vous pouvez clairement identifier plusieurs locuteurs grâce au contexte dans le texte.`
  };
}

/**
 * Détermine si un modèle nécessite des prompts spéciaux
 */
export function requiresSpecialPrompts(provider: string, model: string): boolean {
  return provider.toLowerCase() === 'openai' && model.includes('whisper');
}

export default { getAdaptivePrompts, getWhisperOptimizedPrompts, requiresSpecialPrompts }; 