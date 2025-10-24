/**
 * 🎭 Speaker Name Detection & Auto-Assignment
 * 
 * Détecte automatiquement les noms des locuteurs dans les transcriptions
 * et les applique rétroactivement à tous leurs segments.
 * 
 * Patterns détectés:
 * - "Je m'appelle X"
 * - "Je suis X"
 * - "C'est X"
 * - "Bonjour, X ici"
 * - "Ici X"
 * - "X à l'appareil"
 * - Interpellations: "Bonjour Marie", "Salut Paul"
 */

export interface SpeakerSegment {
  text: string;
  speaker?: string | null;
  start?: number;
  end?: number;
}

export interface SpeakerMapping {
  [speakerId: string]: string; // SPEAKER_00 -> "Marie"
}

/**
 * Patterns de détection de noms en français
 */
const NAME_PATTERNS = [
  // Auto-présentation directe
  /(?:je m'appelle|je suis|c'est|ici)\s+([A-ZÉÈÊËÀÂÄÔÖ][a-zéèêëàâäôöûùü]+(?:\s+[A-ZÉÈÊËÀÂÄÔÖ][a-zéèêëàâäôöûùü]+)?)/i,
  
  // Présentation formelle
  /(?:mon nom est|je me présente,?\s*(?:je suis)?)\s+([A-ZÉÈÊËÀÂÄÔÖ][a-zéèêëàâäôöûùü]+(?:\s+[A-ZÉÈÊËÀÂÄÔÖ][a-zéèêëàâäôöûùü]+)?)/i,
  
  // Présentation téléphonique
  /([A-ZÉÈÊËÀÂÄÔÖ][a-zéèêëàâäôöûùü]+)\s+(?:à l'appareil|au téléphone)/i,
  
  // Interpellations (détectées au début de phrase)
  /^(?:bonjour|salut|bonsoir|coucou|hey|hé),?\s+([A-ZÉÈÊËÀÂÄÔÖ][a-zéèêëàâäôöûùü]+)/i,
  
  // "C'est [Nom] qui parle"
  /c'est\s+([A-ZÉÈÊËÀÂÄÔÖ][a-zéèêëàâäôöûùü]+)\s+(?:qui parle|ici)/i,
];

/**
 * Détecte un nom dans un segment de texte
 */
export function detectNameInText(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  
  // Nettoyer le texte (enlever ponctuation excessive)
  const cleanText = text.trim();
  
  // Tester chaque pattern
  for (const pattern of NAME_PATTERNS) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      const detectedName = match[1].trim();
      
      // Validation: nom doit faire au moins 2 caractères et pas de mots communs
      const commonWords = ['oui', 'non', 'bien', 'merci', 'voilà', 'donc', 'alors', 'ok', 'très'];
      if (detectedName.length >= 2 && !commonWords.includes(detectedName.toLowerCase())) {
        console.log(`%c[Speaker Detector] ✅ NOM DÉTECTÉ: "${detectedName}"`, 'color: #10b981; font-weight: bold');
        console.log(`[Speaker Detector]    └─ Dans le texte: "${cleanText.substring(0, 80)}..."`);
        return detectedName;
      }
    }
  }
  
  return null;
}

/**
 * Met à jour le mapping speaker_id -> nom humain
 */
export function updateSpeakerMapping(
  speakerId: string | null | undefined,
  detectedName: string,
  currentMapping: SpeakerMapping
): SpeakerMapping {
  if (!speakerId) return currentMapping;
  
  // Si ce speaker a déjà un nom, on garde le premier détecté (plus fiable)
  if (currentMapping[speakerId]) {
    console.log(`[Speaker Detector] ℹ️  ${speakerId} a déjà le nom "${currentMapping[speakerId]}", on garde celui-ci.`);
    return currentMapping;
  }
  
  console.log(`%c[Speaker Detector] 🎉 NOUVEAU MAPPING: ${speakerId} => "${detectedName}"`, 'color: #7c3aed; font-weight: bold');
  
  return {
    ...currentMapping,
    [speakerId]: detectedName
  };
}

/**
 * Applique les noms humains à tous les segments (rétroactif)
 * 
 * @param segments - Liste des segments avec speaker_id technique (SPEAKER_00, etc.)
 * @param speakerMapping - Mapping speaker_id -> nom humain
 * @returns Segments avec noms humains appliqués
 */
export function applySpeakerNames(
  segments: SpeakerSegment[],
  speakerMapping: SpeakerMapping
): SpeakerSegment[] {
  return segments.map(segment => ({
    ...segment,
    speaker: segment.speaker && speakerMapping[segment.speaker]
      ? speakerMapping[segment.speaker]
      : segment.speaker
  }));
}

/**
 * 🚀 Fonction principale: traite un nouveau segment en streaming
 * 
 * Détecte les noms, met à jour le mapping, et retourne les segments mis à jour
 */
export function processStreamingSegment(
  newSegment: SpeakerSegment,
  previousSegments: SpeakerSegment[],
  currentMapping: SpeakerMapping
): {
  updatedSegments: SpeakerSegment[];
  updatedMapping: SpeakerMapping;
  nameDetected: boolean;
  detectedName?: string;
} {
  
  console.log(`[Speaker Detector] 🔍 Analyse nouveau segment: speaker="${newSegment.speaker}", texte="${newSegment.text?.substring(0, 50)}..."`);
  
  // 1. Détection de nom dans le nouveau segment
  const detectedName = detectNameInText(newSegment.text);
  let updatedMapping = currentMapping;
  let nameDetected = false;
  
  if (detectedName && newSegment.speaker) {
    updatedMapping = updateSpeakerMapping(newSegment.speaker, detectedName, currentMapping);
    nameDetected = updatedMapping !== currentMapping;
  }
  
  // 2. Application rétroactive des noms à TOUS les segments (passés + nouveau)
  const allSegments = [...previousSegments, newSegment];
  const updatedSegments = applySpeakerNames(allSegments, updatedMapping);
  
  if (nameDetected) {
    console.log(`%c[Speaker Detector] 🎊 NOM APPLIQUÉ À ${updatedSegments.filter(s => s.speaker === detectedName).length} SEGMENTS!`, 'color: #10b981; font-weight: bold; font-size: 14px');
  }
  
  return {
    updatedSegments,
    updatedMapping,
    nameDetected,
    detectedName: nameDetected ? (detectedName || undefined) : undefined
  };
}

/**
 * Détecte les noms dans une transcription complète (mode batch)
 */
export function detectNamesInTranscript(segments: SpeakerSegment[]): SpeakerMapping {
  console.log(`%c[Speaker Detector] 📊 ANALYSE BATCH: ${segments.length} segments`, 'color: #3b82f6; font-weight: bold');
  
  let mapping: SpeakerMapping = {};
  
  for (const segment of segments) {
    const detectedName = detectNameInText(segment.text);
    if (detectedName && segment.speaker) {
      mapping = updateSpeakerMapping(segment.speaker, detectedName, mapping);
    }
  }
  
  console.log(`[Speaker Detector] ✅ ${Object.keys(mapping).length} locuteurs identifiés:`, mapping);
  
  return mapping;
}

