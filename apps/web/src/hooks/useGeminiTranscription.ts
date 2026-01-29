/**
 * 🎙️ useGeminiTranscription - Professional transcription workflow with Gemini
 * 
 * Two-phase workflow:
 * 1. LIVE PHASE: Real-time transcription during recording (fast, basic diarization)
 * 2. ENHANCEMENT PHASE: Post-processing with full diarization (accurate, speaker detection)
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// #region agent log
const debugLog = (loc: string, msg: string, data: any, hyp: string) => {
    try {
        const logs = JSON.parse(localStorage.getItem('__debug_logs__') || '[]');
        logs.push({ location: loc, message: msg, data, timestamp: Date.now(), hypothesisId: hyp });
        if (logs.length > 200) logs.shift();
        localStorage.setItem('__debug_logs__', JSON.stringify(logs));
        console.log(`%c[GEMINI:${hyp}] ${loc}: ${msg}`, 'color: #10b981; font-weight: bold', data);
    } catch (e) { }
};
// #endregion

export interface TranscriptSegment {
    speaker: string;
    text: string;
    start?: string;
    end?: string;
    confidence?: number;
    isLive?: boolean; // true = from live phase, false = from enhancement
}

export interface GeminiTranscriptionResult {
    text: string;
    segments: TranscriptSegment[];
    language?: string;
    phase: 'live' | 'enhanced';
}

interface UseGeminiTranscriptionOptions {
    model?: string;
    language?: string;
    enableLiveTranscription?: boolean;
    enablePostEnhancement?: boolean;
}

export function useGeminiTranscription(options: UseGeminiTranscriptionOptions = {}) {
    const {
        model = 'gemini-2.5-flash',
        language = 'fr',
        enableLiveTranscription = true,
        enablePostEnhancement = true
    } = options;

    // State
    const [isLiveActive, setIsLiveActive] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>([]);
    const [enhancedSegments, setEnhancedSegments] = useState<TranscriptSegment[]>([]);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const audioChunksRef = useRef<ArrayBuffer[]>([]);
    const currentSpeakerRef = useRef<string>('Speaker_01');
    const lastTextRef = useRef<string>('');

    // Get API key
    const getApiKey = async (): Promise<string | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data } = await supabase
            .from('api_keys')
            .select('encrypted_key')
            .eq('user_id', user.id)
            .eq('provider', 'google')
            .single();

        return data?.encrypted_key || null;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1: LIVE TRANSCRIPTION (during recording)
    // ═══════════════════════════════════════════════════════════════════════════

    const startLiveTranscription = useCallback(async (
        onSegment?: (segment: TranscriptSegment) => void
    ) => {
        if (!enableLiveTranscription) return;

        // #region agent log
        debugLog('useGeminiTranscription:startLive', '🎙️ STARTING LIVE PHASE', { model, language }, 'LIVE');
        // #endregion

        const apiKey = await getApiKey();
        if (!apiKey) {
            setError('Google API Key not found');
            return;
        }

        setIsLiveActive(true);
        setLiveSegments([]);
        audioChunksRef.current = [];
        lastTextRef.current = '';

        try {
            // Use Gemini Live API via WebSocket
            const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
            
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                // #region agent log
                debugLog('useGeminiTranscription:startLive', '✅ WEBSOCKET CONNECTED', {}, 'LIVE');
                // #endregion

                // Setup message for live transcription
                const setupMsg = {
                    setup: {
                        model: `models/gemini-2.0-flash-live-001`,
                        generation_config: {
                            response_modalities: ['TEXT']
                        },
                        system_instruction: {
                            parts: [{
                                text: `Tu es un assistant de transcription temps réel professionnel.
RÈGLES STRICTES:
1. Transcris l'audio en ${language} avec précision
2. Détecte les changements de voix et indique [SPEAKER_CHANGE] quand tu entends une nouvelle voix
3. Si tu entends un nom propre mentionné, note-le entre parenthèses: (nom détecté: Jean)
4. Retourne UNIQUEMENT le texte transcrit, rien d'autre
5. Ne répète JAMAIS le même texte deux fois`
                            }]
                        },
                        input_audio_transcription: {}
                    }
                };

                wsRef.current?.send(JSON.stringify(setupMsg));
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Handle input transcription (from audio)
                    if (data.serverContent?.inputTranscription?.text) {
                        const text = data.serverContent.inputTranscription.text;
                        const isFinal = data.serverContent.inputTranscription.finished;

                        // Avoid duplicates
                        if (text === lastTextRef.current) return;
                        lastTextRef.current = text;

                        // Detect speaker change
                        if (text.includes('[SPEAKER_CHANGE]') || text.includes('(speaker change)')) {
                            const speakerNum = parseInt(currentSpeakerRef.current.split('_')[1] || '1');
                            currentSpeakerRef.current = `Speaker_${String(speakerNum + 1).padStart(2, '0')}`;
                        }

                        // Detect mentioned names
                        const nameMatch = text.match(/\(nom détecté:\s*([^)]+)\)/i);
                        if (nameMatch) {
                            currentSpeakerRef.current = nameMatch[1].trim();
                        }

                        // Clean text
                        const cleanText = text
                            .replace(/\[SPEAKER_CHANGE\]/gi, '')
                            .replace(/\(nom détecté:[^)]+\)/gi, '')
                            .replace(/\(speaker change\)/gi, '')
                            .trim();

                        if (cleanText && isFinal) {
                            const segment: TranscriptSegment = {
                                speaker: currentSpeakerRef.current,
                                text: cleanText,
                                isLive: true,
                                confidence: 0.85
                            };

                            setLiveSegments(prev => [...prev, segment]);
                            onSegment?.(segment);

                            // #region agent log
                            debugLog('useGeminiTranscription:onSegment', '📝 LIVE SEGMENT', {
                                speaker: segment.speaker,
                                textPreview: cleanText.substring(0, 50)
                            }, 'LIVE');
                            // #endregion
                        }
                    }

                    // Handle model text output
                    if (data.serverContent?.modelTurn?.parts) {
                        for (const part of data.serverContent.modelTurn.parts) {
                            if (part.text) {
                                const segment: TranscriptSegment = {
                                    speaker: currentSpeakerRef.current,
                                    text: part.text.trim(),
                                    isLive: true,
                                    confidence: 0.8
                                };
                                setLiveSegments(prev => [...prev, segment]);
                                onSegment?.(segment);
                            }
                        }
                    }

                } catch (e) {
                    // Ignore parse errors
                }
            };

            wsRef.current.onerror = () => {
                // #region agent log
                debugLog('useGeminiTranscription:startLive', '❌ WEBSOCKET ERROR', {}, 'LIVE');
                // #endregion
                setError('WebSocket connection error');
            };

            wsRef.current.onclose = () => {
                // #region agent log
                debugLog('useGeminiTranscription:startLive', '🔌 WEBSOCKET CLOSED', {
                    segmentsCount: liveSegments.length
                }, 'LIVE');
                // #endregion
                setIsLiveActive(false);
            };

        } catch (err) {
            setError((err as Error).message);
            setIsLiveActive(false);
        }
    }, [model, language, enableLiveTranscription]);

    // Send audio chunk during live recording
    const sendAudioChunk = useCallback((chunk: ArrayBuffer) => {
        // Store for enhancement phase
        audioChunksRef.current.push(chunk);

        // Send to live transcription
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const base64 = btoa(
                new Uint8Array(chunk).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            wsRef.current.send(JSON.stringify({
                realtime_input: {
                    media_chunks: [{
                        mime_type: 'audio/pcm',
                        data: base64
                    }]
                }
            }));
        }
    }, []);

    // Stop live transcription
    const stopLiveTranscription = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.send(JSON.stringify({ client_content: { turn_complete: true } }));
            setTimeout(() => {
                wsRef.current?.close();
                wsRef.current = null;
            }, 500);
        }
        setIsLiveActive(false);

        // #region agent log
        debugLog('useGeminiTranscription:stopLive', '🛑 LIVE PHASE STOPPED', {
            totalSegments: liveSegments.length,
            totalChunks: audioChunksRef.current.length
        }, 'LIVE');
        // #endregion
    }, [liveSegments.length]);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2: ENHANCEMENT (after recording - better diarization)
    // ═══════════════════════════════════════════════════════════════════════════

    const enhanceTranscription = useCallback(async (
        audioBlob: Blob,
        existingSegments?: TranscriptSegment[],
        onProgress?: (progress: number) => void
    ): Promise<GeminiTranscriptionResult> => {
        if (!enablePostEnhancement) {
            return {
                text: (existingSegments || liveSegments).map(s => s.text).join(' '),
                segments: existingSegments || liveSegments,
                phase: 'live'
            };
        }

        // #region agent log
        debugLog('useGeminiTranscription:enhance', '🔄 STARTING ENHANCEMENT PHASE', {
            audioBlobSize: audioBlob.size,
            existingSegmentsCount: (existingSegments || liveSegments).length
        }, 'ENHANCE');
        // #endregion

        setIsEnhancing(true);
        setProgress(0);
        onProgress?.(0);

        try {
            const apiKey = await getApiKey();
            if (!apiKey) throw new Error('Google API Key not found');

            // Convert audio to base64
            const arrayBuffer = await audioBlob.arrayBuffer();
            const base64Audio = btoa(
                new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            setProgress(20);
            onProgress?.(20);

            // Determine MIME type
            let mimeType = audioBlob.type || 'audio/webm';
            if (mimeType.includes('mp4')) mimeType = 'audio/mp4';
            else if (mimeType.includes('wav')) mimeType = 'audio/wav';
            else if (mimeType.includes('webm')) mimeType = 'audio/webm';

            // Build enhancement prompt with existing transcription context
            const existingText = (existingSegments || liveSegments).map(s => 
                `[${s.speaker}]: ${s.text}`
            ).join('\n');

            const enhancementPrompt = `Tu es un expert en transcription audio professionnelle avec identification des locuteurs.

CONTEXTE - Transcription live existante (peut contenir des erreurs):
${existingText || '(aucune transcription préalable)'}

TÂCHE:
1. Réécoute l'audio complet et corrige les erreurs de transcription
2. Identifie PRÉCISÉMENT chaque locuteur distinct par sa voix
3. Utilise les noms propres si mentionnés, sinon Speaker_01, Speaker_02, etc.
4. Ajoute les timestamps au format MM:SS
5. IMPORTANT: Si un seul locuteur est présent, utilise UNIQUEMENT Speaker_01

FORMAT DE SORTIE (JSON strict):
{
  "language": "code langue détectée",
  "speakers_detected": 2,
  "segments": [
    {"speaker": "Speaker_01", "text": "texte exact", "start": "00:00", "end": "00:15", "confidence": 0.95},
    {"speaker": "Speaker_02", "text": "réponse", "start": "00:16", "end": "00:28", "confidence": 0.92}
  ]
}

RETOURNE UNIQUEMENT LE JSON, AUCUN AUTRE TEXTE.`;

            setProgress(30);
            onProgress?.(30);

            // Call Gemini API
            const cleanModel = model.replace(/^models\//, '');
            const needsBeta = cleanModel.includes('exp') || cleanModel.includes('preview') || 
                              cleanModel.startsWith('gemini-3') || cleanModel.startsWith('gemini-2.5') ||
                              cleanModel.startsWith('gemini-2.0');
            const apiVersion = needsBeta ? 'v1beta' : 'v1';

            const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${cleanModel}:generateContent?key=${apiKey}`;

            // #region agent log
            debugLog('useGeminiTranscription:enhance', '📤 CALLING GEMINI API', {
                model: cleanModel,
                audioSizeKB: Math.round(base64Audio.length / 1024)
            }, 'ENHANCE');
            // #endregion

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType, data: base64Audio } },
                            { text: enhancementPrompt }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        topP: 0.95,
                        maxOutputTokens: 16384
                    }
                })
            });

            setProgress(70);
            onProgress?.(70);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Gemini API error');
            }

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // #region agent log
            debugLog('useGeminiTranscription:enhance', '📥 GEMINI RESPONSE', {
                rawTextLength: rawText.length,
                preview: rawText.substring(0, 200)
            }, 'ENHANCE');
            // #endregion

            setProgress(85);
            onProgress?.(85);

            // Parse JSON response
            let result: GeminiTranscriptionResult;
            try {
                let cleanedText = rawText.trim();
                if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
                else if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
                if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);
                cleanedText = cleanedText.trim();

                const parsed = JSON.parse(cleanedText);

                const enhancedSegs: TranscriptSegment[] = (parsed.segments || []).map((s: any) => ({
                    speaker: s.speaker || 'Speaker_01',
                    text: s.text,
                    start: s.start,
                    end: s.end,
                    confidence: s.confidence || 0.9,
                    isLive: false
                }));

                setEnhancedSegments(enhancedSegs);

                result = {
                    text: enhancedSegs.map(s => s.text).join(' '),
                    segments: enhancedSegs,
                    language: parsed.language,
                    phase: 'enhanced'
                };

            } catch (parseError) {
                // Fallback to live segments if parsing fails
                // #region agent log
                debugLog('useGeminiTranscription:enhance', '⚠️ JSON PARSE FAILED', {
                    error: (parseError as Error).message
                }, 'ENHANCE');
                // #endregion

                result = {
                    text: rawText,
                    segments: existingSegments || liveSegments,
                    phase: 'live'
                };
            }

            setProgress(100);
            onProgress?.(100);

            // #region agent log
            debugLog('useGeminiTranscription:enhance', '✅ ENHANCEMENT COMPLETE', {
                segmentsCount: result.segments.length,
                speakers: [...new Set(result.segments.map(s => s.speaker))],
                language: result.language
            }, 'ENHANCE');
            // #endregion

            return result;

        } catch (err) {
            setError((err as Error).message);
            // #region agent log
            debugLog('useGeminiTranscription:enhance', '❌ ENHANCEMENT ERROR', {
                error: (err as Error).message
            }, 'ENHANCE');
            // #endregion
            
            // Return live segments as fallback
            return {
                text: (existingSegments || liveSegments).map(s => s.text).join(' '),
                segments: existingSegments || liveSegments,
                phase: 'live'
            };
        } finally {
            setIsEnhancing(false);
        }
    }, [model, language, enablePostEnhancement, liveSegments]);

    // ═══════════════════════════════════════════════════════════════════════════
    // FULL WORKFLOW: Start live → Stop → Enhance automatically
    // ═══════════════════════════════════════════════════════════════════════════

    const startFullWorkflow = useCallback(async (
        onLiveSegment?: (segment: TranscriptSegment) => void,
        onEnhancedResult?: (result: GeminiTranscriptionResult) => void
    ) => {
        // #region agent log
        debugLog('useGeminiTranscription:fullWorkflow', '🚀 STARTING FULL WORKFLOW', {
            enableLive: enableLiveTranscription,
            enableEnhance: enablePostEnhancement
        }, 'WORKFLOW');
        // #endregion

        // Start live phase
        await startLiveTranscription(onLiveSegment);

        return {
            sendChunk: sendAudioChunk,
            stop: stopLiveTranscription,
            finalize: async (audioBlob: Blob) => {
                stopLiveTranscription();
                
                // Wait a bit for WebSocket to close
                await new Promise(r => setTimeout(r, 600));
                
                // Start enhancement phase
                const result = await enhanceTranscription(audioBlob, liveSegments);
                onEnhancedResult?.(result);
                return result;
            }
        };
    }, [startLiveTranscription, sendAudioChunk, stopLiveTranscription, enhanceTranscription, liveSegments, enableLiveTranscription, enablePostEnhancement]);

    // Reset state
    const reset = useCallback(() => {
        setLiveSegments([]);
        setEnhancedSegments([]);
        setProgress(0);
        setError(null);
        audioChunksRef.current = [];
        currentSpeakerRef.current = 'Speaker_01';
        lastTextRef.current = '';
    }, []);

    return {
        // State
        isLiveActive,
        isEnhancing,
        liveSegments,
        enhancedSegments,
        progress,
        error,

        // Phase 1: Live
        startLiveTranscription,
        sendAudioChunk,
        stopLiveTranscription,

        // Phase 2: Enhancement
        enhanceTranscription,

        // Full workflow
        startFullWorkflow,

        // Utilities
        reset,
        
        // Get best available segments
        getBestSegments: () => enhancedSegments.length > 0 ? enhancedSegments : liveSegments
    };
}
