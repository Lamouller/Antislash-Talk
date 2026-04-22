/**
 * 🎙️ useGeminiTranscription - Professional transcription workflow with Gemini
 * 
 * Two-phase workflow:
 * 1. LIVE PHASE: Real-time transcription during recording (fast, basic diarization)
 * 2. ENHANCEMENT PHASE: Post-processing with full diarization (accurate, speaker detection)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { sanitizeSpeakerName, sanitizeSegmentForPrompt } from '../lib/sanitize';
import { normalizeSegment } from '../lib/timestamp';
import { detectName } from '../lib/nameDetectionPatterns';
import { segmentHash } from '../lib/segmentHash';
import { readEnvFlags, resolveFlag } from '../lib/featureFlags';
import { createReconnectStrategy, defaultShouldRetry } from '../lib/wsReconnect';
import type { ReconnectStrategy } from '../lib/wsReconnect';
import { createRmsVad, computeRmsDb } from '../lib/rmsVad';
import { logEvent } from '../lib/telemetry';
import type { RmsVad } from '../lib/rmsVad';

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
    start?: string | number;   // legacy — kept as-is for backward compat
    end?: string | number;     // legacy — kept as-is for backward compat
    startSec?: number;         // phase 5: always numeric seconds (normalised)
    endSec?: number;           // phase 5: always numeric seconds (normalised)
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

// Models configuration
// Gemini Live API - only native-audio models support bidiGenerateContent
// Verified via: curl "https://generativelanguage.googleapis.com/v1beta/models?key=..." | jq
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest'; // Supports bidiGenerateContent + input_audio_transcription
const DEFAULT_ENHANCEMENT_MODEL = 'gemini-2.5-flash'; // For post-recording enhancement

export function useGeminiTranscription(options: UseGeminiTranscriptionOptions = {}) {
    const {
        model = DEFAULT_ENHANCEMENT_MODEL, // Model for enhancement phase (2.5, 3.0, etc.)
        language = 'fr',
        enableLiveTranscription = true,
        enablePostEnhancement = true
    } = options;
    
    // Live phase always uses gemini-2.0-flash-live-001
    // Enhancement phase uses the user-selected model (2.5, 3.0, etc.)

    // State
    const [isLiveActive, setIsLiveActive] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [liveSegments, setLiveSegments] = useState<TranscriptSegment[]>([]);
    const [enhancedSegments, setEnhancedSegments] = useState<TranscriptSegment[]>([]);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [streamingText, setStreamingText] = useState<string>(''); // Real-time streaming text display

    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const audioChunksRef = useRef<ArrayBuffer[]>([]);
    const currentSpeakerRef = useRef<string>('Live'); // Default: no speaker differentiation in live
    const nextSpeakerRef = useRef<string | null>(null);
    const lastSpeakerChangeTimeRef = useRef<number>(0);
    const lastTextRef = useRef<string>('');
    const accumulatedTextRef = useRef<string>('');
    const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const onSegmentCallbackRef = useRef<((segment: TranscriptSegment) => void) | null>(null);
    
    // Speaker name mapping: Speaker_XX -> Real name (when detected)
    const speakerNamesRef = useRef<Map<string, string>>(new Map());

    // ─── Phase 7: speakerLockDedup refs ────────────────────────────────────
    // seenHashesRef: dedup set — hash(speaker, text) → prevents duplicate segments
    const seenHashesRef = useRef<Set<string>>(new Set());
    // speakerMappingRef: pyannoteId → displayName (immutable-style, replaced atomically)
    const speakerMappingRef = useRef<Map<string, string>>(new Map());
    // connectionGenerationRef: incremented on each WS open to invalidate stale callbacks
    const connectionGenerationRef = useRef<number>(0);
    // Phase 14: pending dedup hit counter — batched by 10 before emitting telemetry
    const dedupHitCountRef = useRef<number>(0);
    // ────────────────────────────────────────────────────────────────────────

    // ─── Phase 8: wsReconnect refs ─────────────────────────────────────────
    const reconnectStrategyRef = useRef<ReconnectStrategy>(createReconnectStrategy());
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const sessionStateRef = useRef<{
        startedAt: number;
        lastSegments: TranscriptSegment[]; // rolling last 60s of segments
        isReconnecting: boolean;
    }>({ startedAt: 0, lastSegments: [], isReconnecting: false });
    // Stable ref to the reconnect function — avoids circular useCallback deps.
    const _doReconnectRef = useRef<() => void>(() => { /* assigned below */ });
    // ────────────────────────────────────────────────────────────────────────

    // 🎭 External speaker source (e.g., Pyannote Live)
    const externalSpeakerRef = useRef<string | null>(null);
    
    // 🎭 Callback for PCM chunks (to send to Pyannote Live for diarization)
    const onPCMChunkCallbackRef = useRef<((pcmData: ArrayBuffer) => void) | null>(null);
    
    // PCM Audio capture refs (AudioWorklet for real-time streaming)
    const audioContextRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const pcmChunkCountRef = useRef<number>(0);
    // 🎙️ Phase 10: Track whether we own the PCM stream (i.e. we created it via getUserMedia).
    // If false, the stream was provided externally and we must NOT stop its tracks on cleanup.
    const ownsPCMStreamRef = useRef<boolean>(false);

    // ─── Phase 9: clientVAD refs ───────────────────────────────────────────
    const vadRef = useRef<RmsVad | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const vadDropCountRef = useRef<number>(0);
    // Phase 14: periodic 30s interval to emit vad_drop_batch telemetry without hot-loop logging
    const vadTelemetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // ────────────────────────────────────────────────────────────────────────

    // Get API key
    const getApiKey = async (): Promise<string | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            debugLog('useGeminiTranscription:getApiKey', '❌ NO USER', {}, 'API');
            return null;
        }

        const { data, error } = await supabase
            .from('api_keys')
            .select('encrypted_key')
            .eq('user_id', user.id)
            .eq('provider', 'google')
            .single();

        // #region agent log
        debugLog('useGeminiTranscription:getApiKey', error ? '❌ API KEY ERROR' : '✅ API KEY FOUND', {
            hasKey: !!data?.encrypted_key,
            keyLength: data?.encrypted_key?.length || 0,
            error: error?.message
        }, 'API');
        // #endregion

        return data?.encrypted_key || null;
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 8: Session segment rolling window (60s, for reconnect context)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Push a segment into the rolling 60-second window kept in sessionStateRef.
     * Called from both the legacy (speakerLockDedup OFF) and the new (ON) paths
     * so that session context is always available for reconnection.
     */
    const pushSessionSegment = useCallback((seg: TranscriptSegment) => {
        const nowMs = (seg.endSec ?? seg.startSec ?? 0) * 1000;
        const cutoffMs = nowMs - 60_000;
        sessionStateRef.current.lastSegments = [
            ...sessionStateRef.current.lastSegments.filter(
                s => ((s.endSec ?? 0) * 1000) > cutoffMs
            ),
            seg,
        ];
    }, []);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1: LIVE TRANSCRIPTION (during recording)
    // ═══════════════════════════════════════════════════════════════════════════

    const startLiveTranscription = useCallback(async (
        onSegment?: (segment: TranscriptSegment) => void,
        resumeContext: string = ''
    ) => {
        if (!enableLiveTranscription) {
            return;
        }

        // #region agent log
        debugLog('useGeminiTranscription:startLive', '🎙️ STARTING LIVE PHASE', { 
            liveModel: LIVE_MODEL,
            enhancementModel: model,
            language
        }, 'LIVE');
        // #endregion

        const apiKey = await getApiKey();
        if (!apiKey) {
            setError('Google API Key not found');
            return;
        }

        setIsLiveActive(true);
        setLiveSegments([]);
        setStreamingText('');
        audioChunksRef.current = [];
        lastTextRef.current = '';
        accumulatedTextRef.current = '';
        nextSpeakerRef.current = null;
        lastSpeakerChangeTimeRef.current = Date.now();
        onSegmentCallbackRef.current = onSegment || null; // Store callback for timeout-based creation

        try {
            // Phase 7: increment generation so any pending callbacks from a
            // previous connection are automatically ignored.
            connectionGenerationRef.current++;
            // Capture the current generation in closure so onmessage/createSegment
            // can compare against it and drop callbacks from stale connections.
            const myGeneration = connectionGenerationRef.current;

            // Phase 8: initialise session state for a fresh start (not for reconnects).
            // For reconnects, startedAt is preserved; lastSegments accumulate across reconnects.
            if (!sessionStateRef.current.isReconnecting) {
                sessionStateRef.current.startedAt = Date.now();
                sessionStateRef.current.lastSegments = [];
            }
            sessionStateRef.current.isReconnecting = false;

            // Always use gemini-2.0-flash-live-001 for Live WebSocket API
            const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                // #region agent log
                debugLog('useGeminiTranscription:startLive', '✅ WEBSOCKET CONNECTED', {}, 'LIVE');
                // #endregion

                // Phase 8: successful (re)connect — reset backoff counter.
                const _prevAttempts = reconnectStrategyRef.current.attempts;
                if (_prevAttempts > 0) {
                    // This was a reconnect (not the initial open).
                    logEvent({ type: 'ws_reconnect_success', payload: { attempts: _prevAttempts } });
                }
                reconnectStrategyRef.current.reset();

                // Setup message for live transcription
                // Native-audio models require AUDIO output + speech_config + input_audio_transcription
                const setupMsg = {
                    setup: {
                        model: `models/${LIVE_MODEL}`,
                        generation_config: {
                            response_modalities: ['AUDIO'],  // Required for native-audio models
                            speech_config: {
                                voice_config: {
                                    prebuilt_voice_config: {
                                        voice_name: 'Aoede'  // French-compatible voice
                                    }
                                }
                            }
                        },
                        system_instruction: {
                            parts: [{
                                text: `TRANSCRIPTION ONLY. Output ONLY the exact words spoken, nothing else. No comments, no formatting, no asterisks, no explanations. Just the spoken words in ${language}.${resumeContext}`
                            }]
                        },
                        // Enable input audio transcription - this is the key feature!
                        input_audio_transcription: {}
                    }
                };

                // #region agent log
                debugLog('useGeminiTranscription:startLive', '📤 SENDING SETUP MESSAGE', {
                    liveModel: setupMsg.setup.model,
                    enhancementModel: model,
                    hasSystemInstruction: !!setupMsg.setup.system_instruction
                }, 'LIVE');
                // #endregion

                try {
                    wsRef.current?.send(JSON.stringify(setupMsg));
                    debugLog('useGeminiTranscription:startLive', '✅ SETUP MESSAGE SENT', {}, 'LIVE');
                } catch (sendError) {
                    debugLog('useGeminiTranscription:startLive', '❌ SETUP SEND ERROR', {
                        error: (sendError as Error).message
                    }, 'LIVE');
                }
            };

            wsRef.current.onmessage = async (event) => {
                try {
                    // Handle Blob data (browser sends Blob, not string)
                    let rawData = event.data;
                    if (rawData instanceof Blob) {
                        rawData = await rawData.text();
                    }
                    
                    const data = JSON.parse(rawData);

                    // #region agent log
                    const serverContentKeys = data.serverContent ? Object.keys(data.serverContent) : [];
                    const hasInputTranscription = !!data.serverContent?.inputTranscription;
                    const hasModelTurn = !!data.serverContent?.modelTurn;
                    const modelTurnText = data.serverContent?.modelTurn?.parts?.[0]?.text?.substring(0, 50);
                    const inputTranscriptionText = data.serverContent?.inputTranscription?.text?.substring(0, 50);

                    debugLog('useGeminiTranscription:onMessage', '📥 WS MESSAGE RECEIVED', {
                        hasSetupComplete: !!data.setupComplete,
                        hasServerContent: !!data.serverContent,
                        hasInputTranscription,
                        hasModelTurn,
                        serverContentKeys,
                        inputTranscriptionText,
                        modelTurnText
                    }, 'LIVE');
                    // #endregion

                    // Check for setup completion
                    if (data.setupComplete) {
                        // #region agent log
                        debugLog('useGeminiTranscription:onMessage', '✅ SETUP COMPLETE - Ready for audio', {}, 'LIVE');
                        // #endregion
                    }

                    // Check for errors
                    if (data.error) {
                        // #region agent log
                        debugLog('useGeminiTranscription:onMessage', '❌ SERVER ERROR', {
                            error: data.error
                        }, 'LIVE');
                        setError(data.error.message || 'Server error');
                        return;
                    }

                    // Handle input transcription (from audio)
                    if (data.serverContent?.inputTranscription?.text) {
                        const text = data.serverContent.inputTranscription.text;
                        const isFinal = data.serverContent.inputTranscription.finished;

                        // Clear any pending pause timeout - new text arrived
                        if (pauseTimeoutRef.current) {
                            clearTimeout(pauseTimeoutRef.current);
                            pauseTimeoutRef.current = null;
                        }

                        // ACCUMULATE text
                        accumulatedTextRef.current += text;
                        
                        // 🚀 REAL-TIME: Update streaming text immediately for instant display
                        setStreamingText(accumulatedTextRef.current.trim());

                        // Helper function to create and emit segment
                        const createSegment = (reason: string) => {
                            const fullText = accumulatedTextRef.current;

                            // Avoid duplicates
                            if (fullText === lastTextRef.current || fullText.trim().length === 0) {
                                accumulatedTextRef.current = '';
                                setStreamingText('');
                                return;
                            }
                            lastTextRef.current = fullText;

                            // ─────────────────────────────────────────────────────────────
                            // Phase 7: speakerLockDedup flag branching
                            // Flag OFF (default) → ANCIEN CODE (préservé bit-à-bit)
                            // Flag ON            → NOUVEAU CODE (atomique + dedup)
                            // ─────────────────────────────────────────────────────────────
                            const _envFlags = readEnvFlags();
                            const _useLockDedup = resolveFlag('speakerLockDedup', { envFlags: _envFlags }).value;

                            if (!_useLockDedup) {
                            // ═══════════════════════════════════════════════════════════════
                            // ANCIEN CODE (FLAG OFF) — préservé sans modification
                            // ═══════════════════════════════════════════════════════════════

                            // ═══════════════════════════════════════════════════════════════
                            // 🎭 SPEAKER IDENTIFICATION (Lightweight)
                            // Priority: 1. Name from text, 2. External (Pyannote), 3. Default
                            // ═══════════════════════════════════════════════════════════════

                            // 🎯 Lightweight name detection from self-introductions
                            // Patterns for self-introduction (detect speaker name)
                            const selfIntroPatterns = [
                                // "c'est [toujours/encore/...] Tristan qui parle" - allow optional filler words
                                /c'est\s+(?:toujours\s+|encore\s+|aussi\s+|bien\s+|vraiment\s+)?([A-Z][a-zà-ÿ]{2,})\s+(?:qui\s+parle|ici|à l'appareil)/i,
                                // "là c'est Tristan" / "donc c'est Tristan"
                                /(?:là|donc)\s+c'est\s+(?:toujours\s+)?([A-Z][a-zà-ÿ]{2,})/i,
                                /(?:je\s+suis|je\s+m'appelle|moi\s+c'est)\s+([A-Z][a-zà-ÿ]{2,})/i,
                                /(?:ici|bonjour)\s+([A-Z][a-zà-ÿ]{2,})(?:\s+ici)?/i,
                                /([A-Z][a-zà-ÿ]{2,})\s+(?:à l'appareil|au micro)/i,
                                // Pattern for "[Name] qui parle" without c'est prefix
                                /^([A-Z][a-zà-ÿ]{2,})\s+qui\s+parle/i,
                                /,\s*([A-Z][a-zà-ÿ]{2,})\s+qui\s+parle/i,
                                // NEW: "c'est [Name]," - name followed by comma (simple introduction)
                                /,\s*c'est\s+([A-Z][a-zà-ÿ]{2,}),/i,
                                // NEW: "Bon, c'est [Name]," or "Alors c'est [Name]," - common intro starters
                                /(?:^|[.!?]\s*)(?:bon|alors|ok|bien|oui|donc)\s*,?\s*c'est\s+([A-Z][a-zà-ÿ]{2,})/i,
                                // NEW: "c'est [Name] [SecondName]," - compound names like "Jean Fabien"
                                /c'est\s+([A-Z][a-zà-ÿ]{2,})\s+([A-Z][a-zà-ÿ]{2,})\s*,/i,
                                // NEW: "c'est bien/vraiment [Name]." - with filler word and period/end
                                /c'est\s+(?:bien|vraiment)\s+([A-Z][a-zà-ÿ]{2,})[.,!?]?$/i,
                                // NEW: Simple "c'est [Name]" at end of sentence
                                /c'est\s+([A-Z][a-zà-ÿ]{2,})[.,!?]?\s*$/i,
                            ];

                            // Common words to exclude from name detection (expanded list)
                            const EXCLUDED_WORDS = new Set([
                                // Greetings & common expressions
                                'bonjour', 'bonsoir', 'salut', 'merci', 'donc', 'voilà', 'alors',
                                'oui', 'non', 'bien', 'très', 'super', 'parfait', 'exactement',
                                'effectivement', 'absolument', 'certainement', 'peut', 'être',
                                'live', 'test', 'tester', 'moment', 'instant', 'section',
                                // Negations & common words that could be mistaken for names
                                'pas', 'plus', 'jamais', 'rien', 'personne', 'quelqu', 'tout',
                                'ici', 'parle', 'parler', 'dit', 'dire', 'fait', 'faire',
                                'suis', 'appelle', 'présent', 'présente', 'juste', 'encore',
                                // Pronouns (CRITICAL - "moi", "toi" etc. are NOT names!)
                                'moi', 'toi', 'lui', 'elle', 'eux', 'celui', 'celle', 'ceux',
                                // Common French words starting with capital when at sentence start
                                'quand', 'comme', 'avec', 'pour', 'dans', 'mais', 'cette',
                                'votre', 'notre', 'leur', 'vous', 'nous', 'elles', 'ils',
                                // Adjectives/words that sound like names (transcription errors)
                                'triste', 'content', 'heureux', 'désolé', 'certain', 'vrai'
                            ]);

                            let detectedName: string | null = null;

                            // Try each pattern
                            for (const pattern of selfIntroPatterns) {
                                const match = fullText.match(pattern);
                                if (match && match[1]) {
                                    // Handle compound names (match[1] + match[2])
                                    let candidateName = match[1];
                                    if (match[2] && /^[A-Z]/.test(match[2])) {
                                        candidateName = `${match[1]} ${match[2]}`;
                                    }
                                    // Validate: not a common word, min 3 chars
                                    if (!EXCLUDED_WORDS.has(candidateName.toLowerCase()) &&
                                        candidateName.length >= 3) {
                                        detectedName = candidateName;
                                        console.log(`%c[GEMINI] 🎭 NAME DETECTED: "${detectedName}"`, 'color: #7c3aed; font-weight: bold');
                                        break;
                                    }
                                }
                            }

                            // 🎭 SPEAKER NAME MEMORY SYSTEM (VOICE-FIRST)
                            // Priority: 1. Pyannote voice ID (trust the voice!), 2. Text-based name for NEW speakers only
                            const pyannoteSpeaker = externalSpeakerRef.current; // e.g., "SPEAKER_01"

                            if (detectedName && pyannoteSpeaker) {
                                // Name detected in text - BUT only use it if:
                                // 1. This Pyannote speaker has NO name yet (first introduction)
                                // 2. OR this is a NEW Pyannote speaker (speaker change detected by voice)
                                const existingMapping = speakerNamesRef.current.get(pyannoteSpeaker);

                                if (!existingMapping) {
                                    // ✅ FIRST INTRODUCTION: Accept the name for this voice
                                    speakerNamesRef.current.set(pyannoteSpeaker, detectedName);
                                    currentSpeakerRef.current = detectedName;
                                    console.log(`%c[SPEAKER MEMORY] 🧠 FIRST MAPPING: ${pyannoteSpeaker} → "${detectedName}"`, 'color: #8b5cf6; font-weight: bold');

                                    // 🔄 RETROACTIVE UPDATE: Update past segments with this Pyannote ID
                                    setLiveSegments(prev => {
                                        const updated = prev.map(seg => {
                                            if (seg.speaker === pyannoteSpeaker) {
                                                console.log(`%c[SPEAKER MEMORY] ✏️ RETROACTIVE: "${seg.speaker}" → "${detectedName}"`, 'color: #f59e0b');
                                                return { ...seg, speaker: detectedName };
                                            }
                                            return seg;
                                        });
                                        return updated;
                                    });
                                    speakerNamesRef.current.set('_lastDetected', detectedName);
                                } else {
                                    // ❌ SAME SPEAKER already has a name - IGNORE the new name in text
                                    // (Someone might say another person's name, but voice says it's still the same person)
                                    currentSpeakerRef.current = existingMapping;
                                    console.log(`%c[SPEAKER MEMORY] 🚫 IGNORED "${detectedName}" - voice still ${pyannoteSpeaker} = "${existingMapping}"`, 'color: #ef4444');
                                }
                            } else if (detectedName && !pyannoteSpeaker) {
                                // Name detected but no Pyannote - use text-based detection as fallback
                                currentSpeakerRef.current = detectedName;
                                speakerNamesRef.current.set('_lastDetected', detectedName);
                                console.log(`%c[SPEAKER MEMORY] 📝 TEXT-ONLY: "${detectedName}" (no Pyannote)`, 'color: #f59e0b');
                            } else if (pyannoteSpeaker) {
                                // No name detected, but we have Pyannote speaker
                                // Check if this Pyannote ID has a mapped name
                                const mappedName = speakerNamesRef.current.get(pyannoteSpeaker);
                                if (mappedName) {
                                    // Use the previously mapped name for this voice
                                    currentSpeakerRef.current = mappedName;
                                    console.log(`%c[SPEAKER MEMORY] 🔄 REUSED: ${pyannoteSpeaker} → "${mappedName}"`, 'color: #06b6d4');
                                } else {
                                    // No mapping yet - use raw Pyannote ID
                                    currentSpeakerRef.current = pyannoteSpeaker;
                                }
                            } else if (speakerNamesRef.current.has('_lastDetected')) {
                                // Fallback: reuse last detected name (no Pyannote available)
                                currentSpeakerRef.current = speakerNamesRef.current.get('_lastDetected')!;
                            } else {
                                currentSpeakerRef.current = 'Live';
                            }

                            // Clean text
                            const cleanText = fullText
                                .replace(/\[SPEAKER_CHANGE\]/gi, '')
                                .replace(/\(nom détecté:[^)]+\)/gi, '')
                                .replace(/\(speaker change\)/gi, '')
                                .replace(/\*\*[^*]+\*\*/g, '')
                                .replace(/\([^)]*transcri[^)]*\)/gi, '')
                                .replace(/\([^)]*clari[^)]*\)/gi, '')
                                .replace(/I've successfully.*/gi, '')
                                .replace(/My focus remains.*/gi, '')
                                .replace(/I'm having trouble.*/gi, '')
                                .trim();

                            if (cleanText) {
                                const newSpeaker = currentSpeakerRef.current;

                                debugLog('useGeminiTranscription:onSegment', '📝 SEGMENT CREATED', {
                                    reason,
                                    speaker: newSpeaker,
                                    textPreview: cleanText.substring(0, 40),
                                    length: cleanText.length
                                }, 'LIVE');

                                // 🔄 AGGREGATE: Merge with previous segment if same speaker (with limits)
                                setLiveSegments(prev => {
                                    if (prev.length > 0) {
                                        const lastSegment = prev[prev.length - 1];
                                        // Same speaker? Check if we should merge
                                        if (lastSegment.speaker === newSpeaker) {
                                            const combinedLength = lastSegment.text.length + cleanText.length + 1;
                                            // Count sentences in last segment (by terminal punctuation)
                                            const sentenceCount = (lastSegment.text.match(/[.!?]+/g) || []).length;

                                            // Merge only if: under 400 chars AND under 3 sentences
                                            const shouldMerge = combinedLength < 400 && sentenceCount < 3;

                                            if (shouldMerge) {
                                                const updatedSegments = [...prev];
                                                updatedSegments[prev.length - 1] = {
                                                    ...lastSegment,
                                                    text: lastSegment.text + ' ' + cleanText,
                                                    confidence: isFinal ? 0.9 : 0.75
                                                };
                                                return updatedSegments;
                                            }
                                        }
                                    }
                                    // Different speaker, first segment, or limits exceeded: create new
                                    return [...prev, normalizeSegment({
                                        speaker: newSpeaker,
                                        text: cleanText,
                                        isLive: true,
                                        confidence: isFinal ? 0.9 : 0.75
                                    })];
                                });

                                // Callback with full segment info for UI
                                // NOTE: Only use onSegmentCallbackRef (from startFullWorkflow), NOT onSegment
                                // to avoid duplicate callbacks
                                const segment: TranscriptSegment = normalizeSegment({
                                    speaker: newSpeaker,
                                    text: cleanText,
                                    isLive: true,
                                    confidence: isFinal ? 0.9 : 0.75
                                });
                                onSegmentCallbackRef.current?.(segment);

                                // Phase 8: keep rolling 60s window for reconnect context.
                                pushSessionSegment(segment);
                            }

                            // Reset for next segment
                            accumulatedTextRef.current = '';
                            setStreamingText('');

                            // ═══════════════════════════════════════════════════════════════
                            // END ANCIEN CODE (FLAG OFF)
                            // ═══════════════════════════════════════════════════════════════
                            } else {
                            // ═══════════════════════════════════════════════════════════════
                            // NOUVEAU CODE (FLAG ON) — atomique + dedup
                            // ═══════════════════════════════════════════════════════════════

                            // Guard: stale connection callback check — discard segment
                            // if this onmessage fires after a newer connection was opened.
                            if (myGeneration !== connectionGenerationRef.current) {
                                accumulatedTextRef.current = '';
                                setStreamingText('');
                                return;
                            }

                            const _pyannoteSpeaker = externalSpeakerRef.current; // e.g. "SPEAKER_01"

                            // Pure name detection (no side effects)
                            const _detected = detectName(fullText);

                            // Compute next mapping immutably
                            const _nextMapping = new Map(speakerMappingRef.current);
                            if (_detected && _pyannoteSpeaker && !_nextMapping.has(_pyannoteSpeaker)) {
                                _nextMapping.set(_pyannoteSpeaker, _detected.name);
                                console.log(`%c[SPEAKER LOCK] FIRST MAPPING: ${_pyannoteSpeaker} → "${_detected.name}" (${_detected.patternId})`, 'color: #8b5cf6; font-weight: bold');
                            }

                            // Resolve display name
                            const _resolvedSpeaker = _pyannoteSpeaker
                                ? (_nextMapping.get(_pyannoteSpeaker) ?? _pyannoteSpeaker)
                                : (_detected?.name ?? speakerNamesRef.current.get('_lastDetected') ?? 'Live');

                            // Dedup check
                            const _hash = segmentHash(_resolvedSpeaker, fullText);
                            if (seenHashesRef.current.has(_hash)) {
                                // Already seen — drop silently
                                accumulatedTextRef.current = '';
                                setStreamingText('');
                                // Phase 14: batch dedup hits, emit telemetry every 10
                                dedupHitCountRef.current++;
                                if (dedupHitCountRef.current % 10 === 0) {
                                    logEvent({ type: 'segment_dedup_hit', payload: { count: dedupHitCountRef.current } });
                                }
                                return;
                            }
                            seenHashesRef.current.add(_hash);
                            // FIFO cap: keep at most 1000 hashes (~30-40 min of unique segments).
                            // Prevents unbounded memory growth on long meetings.
                            if (seenHashesRef.current.size > 1000) {
                                const first = seenHashesRef.current.values().next().value;
                                if (first !== undefined) seenHashesRef.current.delete(first);
                            }

                            // Commit mapping ref AFTER dedup check (avoids polluting ref on skip)
                            speakerMappingRef.current = _nextMapping;
                            // Keep legacy speakerNamesRef in sync for getSpeakerNameMap() API
                            if (_detected && _pyannoteSpeaker) {
                                speakerNamesRef.current.set(_pyannoteSpeaker, _detected.name);
                                speakerNamesRef.current.set('_lastDetected', _detected.name);
                            }

                            // Clean text (same rules as legacy path)
                            const _cleanText = fullText
                                .replace(/\[SPEAKER_CHANGE\]/gi, '')
                                .replace(/\(nom détecté:[^)]+\)/gi, '')
                                .replace(/\(speaker change\)/gi, '')
                                .replace(/\*\*[^*]+\*\*/g, '')
                                .replace(/\([^)]*transcri[^)]*\)/gi, '')
                                .replace(/\([^)]*clari[^)]*\)/gi, '')
                                .replace(/I've successfully.*/gi, '')
                                .replace(/My focus remains.*/gi, '')
                                .replace(/I'm having trouble.*/gi, '')
                                .trim();

                            if (_cleanText) {
                                debugLog('useGeminiTranscription:onSegment', '[P7] SEGMENT CREATED (atomique)', {
                                    reason,
                                    speaker: _resolvedSpeaker,
                                    textPreview: _cleanText.substring(0, 40),
                                    patternId: _detected?.patternId ?? null,
                                }, 'LIVE');

                                // Atomic setState: retroactive rename + new segment in ONE call
                                setLiveSegments(prev => {
                                    // Retroactive rename if a new name was detected
                                    const renamed = (_detected && _pyannoteSpeaker)
                                        ? prev.map(seg =>
                                            seg.speaker === _pyannoteSpeaker
                                                ? { ...seg, speaker: _detected.name }
                                                : seg
                                          )
                                        : prev;

                                    // Aggregate: merge if same speaker and within limits
                                    if (renamed.length > 0) {
                                        const _last = renamed[renamed.length - 1];
                                        if (_last.speaker === _resolvedSpeaker) {
                                            const _combined = _last.text.length + _cleanText.length + 1;
                                            const _sentences = (_last.text.match(/[.!?]+/g) || []).length;
                                            if (_combined < 400 && _sentences < 3) {
                                                const _updated = [...renamed];
                                                _updated[renamed.length - 1] = {
                                                    ..._last,
                                                    text: _last.text + ' ' + _cleanText,
                                                    confidence: isFinal ? 0.9 : 0.75,
                                                };
                                                return _updated;
                                            }
                                        }
                                    }

                                    // New segment
                                    return [...renamed, normalizeSegment({
                                        speaker: _resolvedSpeaker,
                                        text: _cleanText,
                                        isLive: true,
                                        confidence: isFinal ? 0.9 : 0.75,
                                    })];
                                });

                                // Callback
                                const _segment: TranscriptSegment = normalizeSegment({
                                    speaker: _resolvedSpeaker,
                                    text: _cleanText,
                                    isLive: true,
                                    confidence: isFinal ? 0.9 : 0.75,
                                });
                                onSegmentCallbackRef.current?.(_segment);

                                // Phase 8: keep rolling 60s window for reconnect context.
                                pushSessionSegment(_segment);
                            }

                            // Reset for next segment
                            accumulatedTextRef.current = '';
                            setStreamingText('');

                            // ═══════════════════════════════════════════════════════════════
                            // END NOUVEAU CODE (FLAG ON)
                            // ═══════════════════════════════════════════════════════════════
                            } // end if (!_useLockDedup) / else
                        };

                        // Decide when to create segment:
                        // 1. If isFinal = true (Gemini says sentence is complete)
                        // 2. If accumulated text > 80 chars (longer phrases)
                        // 3. If text ends with sentence-ending punctuation
                        const hasEnoughText = accumulatedTextRef.current.length > 80;
                        const hasSentenceEnd = /[.!?。]$/.test(accumulatedTextRef.current.trim());
                        
                        if (isFinal || hasEnoughText || hasSentenceEnd) {
                            createSegment(isFinal ? 'final' : hasSentenceEnd ? 'punctuation' : 'length');
                        } else {
                            // Set timeout for pause detection - create segment after 1.5s of silence
                            pauseTimeoutRef.current = setTimeout(() => {
                                if (accumulatedTextRef.current.trim().length > 0) {
                                    createSegment('pause');
                                }
                            }, 1500);
                        }
                    }

                    // Handle model text output - SKIP ENTIRELY for now
                    // The inputTranscription is the authoritative source for transcription
                    // modelTurn often contains hallucinations like "Focusing on Transcription"
                    // We only log for debugging purposes
                    if (data.serverContent?.modelTurn?.parts) {
                        // Don't create segments from modelTurn - inputTranscription is more reliable
                    }

                } catch (e) {
                    // Ignore parse errors
                }
            };

            wsRef.current.onerror = (event) => {
                // #region agent log
                debugLog('useGeminiTranscription:startLive', '❌ WEBSOCKET ERROR', {
                    type: event.type,
                    message: 'WebSocket error occurred'
                }, 'LIVE');
                // #endregion
                setError('WebSocket connection error');
            };

            wsRef.current.onclose = (event) => {
                // #region agent log
                debugLog('useGeminiTranscription:startLive', '🔌 WEBSOCKET CLOSED', {
                    segmentsCount: liveSegments.length,
                    code: event.code,
                    reason: event.reason || 'No reason provided',
                    wasClean: event.wasClean
                }, 'LIVE');
                // #endregion

                const _envFlags = readEnvFlags();
                const _useReconnect = resolveFlag('wsReconnect', { envFlags: _envFlags }).value;

                if (!_useReconnect) {
                    // ═══════════════════════════════════════════════════════════════
                    // ANCIEN CODE (FLAG OFF) — préservé sans modification
                    // Common close codes:
                    // 1000 = Normal closure
                    // 1001 = Going away
                    // 1006 = Abnormal closure (no close frame)
                    // 1011 = Server error
                    // ═══════════════════════════════════════════════════════════════
                    setIsLiveActive(false);
                    if (event.code !== 1000) {
                        setError(`WebSocket closed: ${event.reason || `Code ${event.code}`}`);
                    }
                    return;
                }

                // ═══════════════════════════════════════════════════════════════
                // NOUVEAU CODE (FLAG ON) — exponential backoff reconnect
                // ═══════════════════════════════════════════════════════════════

                // Capture generation at the moment of close — used to detect if
                // the user manually restarted between this close and the timeout.
                const _myGeneration = connectionGenerationRef.current;

                // Normal close or policy violation → no reconnect.
                if (!defaultShouldRetry(event.code, event.reason ?? '')) {
                    setIsLiveActive(false);
                    sessionStateRef.current.isReconnecting = false;
                    reconnectStrategyRef.current.reset();
                    return;
                }

                // Session older than 5 minutes total → give up to avoid infinite loops.
                const _sessionAge = Date.now() - sessionStateRef.current.startedAt;
                if (_sessionAge > 5 * 60_000) {
                    setIsLiveActive(false);
                    sessionStateRef.current.isReconnecting = false;
                    setError('Connection lost — please restart recording');
                    return;
                }

                const _delay = reconnectStrategyRef.current.next();
                if (_delay === null) {
                    // Backoff exhausted.
                    logEvent({ type: 'ws_reconnect_exhausted', payload: { attempts: reconnectStrategyRef.current.attempts } });
                    setIsLiveActive(false);
                    sessionStateRef.current.isReconnecting = false;
                    setError('Connection lost — please restart recording');
                    return;
                }

                sessionStateRef.current.isReconnecting = true;
                logEvent({ type: 'ws_reconnect_attempt', payload: { attempt: reconnectStrategyRef.current.attempts, delayMs: _delay } });
                console.debug(`[WS Reconnect] attempt ${reconnectStrategyRef.current.attempts}/6 in ${_delay}ms (code ${event.code})`);

                reconnectTimeoutRef.current = setTimeout(() => {
                    // If the user manually restarted (connectionGenerationRef incremented),
                    // cancel this scheduled reconnect to avoid opening a duplicate socket.
                    if (connectionGenerationRef.current !== _myGeneration) {
                        console.debug('[WS Reconnect] generation changed — aborting scheduled reconnect');
                        return;
                    }
                    _doReconnectRef.current();
                }, _delay);
            };

        } catch (err) {
            setError((err as Error).message);
            setIsLiveActive(false);
        }
    }, [model, language, enableLiveTranscription, pushSessionSegment]);

    // ─── Phase 8: reconnect function ───────────────────────────────────────

    /**
     * Reopens the WebSocket with the last 60s of segments as context in the
     * systemInstruction, so Gemini can continue seamlessly.
     *
     * Called only when wsReconnect flag is ON and the backoff timer fires.
     */
    const reconnectLiveTranscription = useCallback(async () => {
        if (!sessionStateRef.current.isReconnecting) return;

        const lastSegs = sessionStateRef.current.lastSegments;
        const resumeContext = lastSegs.length > 0
            ? `\n\nSession resumed. Last transcribed segments:\n${lastSegs
                  .map(s => `[${sanitizeSpeakerName(s.speaker)}]: ${sanitizeSegmentForPrompt(s.text)}`)
                  .join('\n')}`
            : '';

        try {
            await startLiveTranscription(onSegmentCallbackRef.current ?? undefined, resumeContext);
            // On success, reset is already handled inside startLiveTranscription's onopen handler.
        } catch (err) {
            // Failure: the new WS attempt will fail and onclose will fire again,
            // which will trigger the next backoff step automatically.
            console.debug('[WS Reconnect] reconnectLiveTranscription failed', err);
        }
    }, [startLiveTranscription]);

    // Keep the ref always pointing at the latest version of the function.
    // This avoids stale-closure issues when the timeout fires after deps change.
    useEffect(() => {
        _doReconnectRef.current = () => {
            reconnectLiveTranscription();
        };
    });

    // ────────────────────────────────────────────────────────────────────────

    // Decode webm/opus to PCM using AudioContext
    const decodeAudioToPCM = useCallback(async (audioData: ArrayBuffer): Promise<ArrayBuffer | null> => {
        try {
            // Create a temporary AudioContext for decoding
            const audioContext = new AudioContext({ sampleRate: 16000 });
            
            // Decode the audio data
            const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0)); // slice to copy
            
            // Get the audio data from the first channel
            const channelData = audioBuffer.getChannelData(0);
            
            // Convert Float32 to Int16 PCM
            const pcmData = new Int16Array(channelData.length);
            for (let i = 0; i < channelData.length; i++) {
                const s = Math.max(-1, Math.min(1, channelData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            await audioContext.close();
            return pcmData.buffer;
        } catch (error) {
            // Decoding might fail for partial chunks - this is expected
            console.debug('[PCM] Decode failed (normal for partial chunks):', error);
            return null;
        }
    }, []);

    // Send audio chunk during live recording
    // NOTE: When AudioWorklet is active (pcmChunkCountRef > 0), don't send to WebSocket
    // because AudioWorklet is already streaming PCM directly
    const sendAudioChunk = useCallback(async (chunk: ArrayBuffer, _mimeType?: string) => {
        // Store original for enhancement phase (always do this)
        audioChunksRef.current.push(chunk);
        const chunkIndex = audioChunksRef.current.length;

        // If AudioWorklet is active, don't try to send - it's already handling WebSocket streaming
        if (pcmChunkCountRef.current > 0) {
            // #region agent log
            if (chunkIndex <= 3) {
                debugLog('useGeminiTranscription:sendChunk', '💾 CHUNK STORED (AudioWorklet active)', {
                    chunkIndex,
                    sizeBytes: chunk.byteLength,
                    pcmChunksActive: pcmChunkCountRef.current
                }, 'LIVE');
            }
            // #endregion
            return; // AudioWorklet is handling the streaming
        }

        // Fallback: If AudioWorklet not active, try to decode and send
        // (This shouldn't happen normally but provides a fallback)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const pcmData = await decodeAudioToPCM(chunk);
            
            if (pcmData) {
                const base64 = btoa(
                    new Uint8Array(pcmData).reduce((data, byte) => data + String.fromCharCode(byte), '')
                );
                wsRef.current.send(JSON.stringify({
                    realtimeInput: {
                        mediaChunks: [{
                            mimeType: 'audio/pcm;rate=16000',
                            data: base64
                        }]
                    }
                }));
            }
        }
    }, [decodeAudioToPCM]);

    // Send raw PCM data directly to WebSocket (used by AudioWorklet)
    // Also forwards to external callback (Pyannote Live) if registered
    const sendPCMToWebSocket = useCallback((pcmData: ArrayBuffer) => {
        pcmChunkCountRef.current++;
        const chunkIndex = pcmChunkCountRef.current;
        
        // 🎭 Forward PCM to Pyannote Live if callback is registered
        if (onPCMChunkCallbackRef.current) {
            try {
                onPCMChunkCallbackRef.current(pcmData);
            } catch (e) {
                console.debug('[PCM] Pyannote callback error:', e);
            }
        }
        
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const base64 = btoa(
                new Uint8Array(pcmData).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );
            
            // #region agent log
            if (chunkIndex <= 5 || chunkIndex % 20 === 0) {
                debugLog('useGeminiTranscription:sendPCM', '📤 SENDING RAW PCM', {
                    chunkIndex,
                    pcmSizeBytes: pcmData.byteLength
                }, 'LIVE');
            }
            // #endregion

            wsRef.current.send(JSON.stringify({
                realtimeInput: {
                    mediaChunks: [{
                        mimeType: 'audio/pcm;rate=16000',
                        data: base64
                    }]
                }
            }));
        }
    }, []);

    // 🎙️ Phase 10: Options accepted by startPCMCapture
    interface StartPCMCaptureOptions {
        /** If provided, this stream is used instead of calling getUserMedia.
         *  The hook will NOT stop the tracks on cleanup (ownsPCMStreamRef = false). */
        externalStream?: MediaStream;
    }

    // Start PCM audio capture using AudioWorklet
    const startPCMCapture = useCallback(async (options: StartPCMCaptureOptions = {}) => {
        try {
            pcmChunkCountRef.current = 0;

            // 🎙️ Phase 10: Decide whether to use an external stream or create our own.
            const _unifiedEnvFlags = readEnvFlags();
            const _useUnified = resolveFlag('unifiedMicStream', { envFlags: _unifiedEnvFlags }).value;

            let stream: MediaStream;
            let ownsStream: boolean;

            if (_useUnified && options.externalStream) {
                stream = options.externalStream;
                ownsStream = false;
                console.debug('[PCM Capture] Using external stream (unifiedMicStream ON)');
            } else {
                // Legacy: create our own stream
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: 16000,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true
                    }
                });
                ownsStream = true;
            }

            mediaStreamRef.current = stream;
            ownsPCMStreamRef.current = ownsStream;

            // Create AudioContext at 16kHz (required by Gemini)
            audioContextRef.current = new AudioContext({ sampleRate: 16000 });
            
            // Load PCM processor worklet
            await audioContextRef.current.audioWorklet.addModule('/pcm-processor.js');
            
            // Create source from microphone
            const source = audioContextRef.current.createMediaStreamSource(stream);

            // ─── Phase 9: clientVAD setup ──────────────────────────────────
            const _envFlags = readEnvFlags();
            const _useVad = resolveFlag('clientVAD', { envFlags: _envFlags }).value;

            if (_useVad) {
                const thresholdDb = parseFloat(
                    (import.meta.env.VITE_VAD_THRESHOLD_DB as string | undefined) ?? '-40'
                );
                const silenceMs = parseInt(
                    (import.meta.env.VITE_VAD_SILENCE_MS as string | undefined) ?? '400',
                    10
                );

                // AnalyserNode is connected IN PARALLEL (not in series) with the workletNode.
                // Both receive audio from the same source node.
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 512;
                analyserRef.current.smoothingTimeConstant = 0.2;
                source.connect(analyserRef.current);

                vadRef.current = createRmsVad({
                    thresholdDb,
                    silenceMs,
                    hangoverMs: 200,
                });

                vadDropCountRef.current = 0;
                // Phase 14: emit vad_drop_batch every 30s (batcher — not in hot loop)
                if (vadTelemetryIntervalRef.current) clearInterval(vadTelemetryIntervalRef.current);
                vadTelemetryIntervalRef.current = setInterval(() => {
                    if (vadDropCountRef.current > 0) {
                        logEvent({ type: 'vad_drop_batch', payload: { dropped: vadDropCountRef.current } });
                        vadDropCountRef.current = 0;
                    }
                }, 30_000);
            }
            // ────────────────────────────────────────────────────────────────

            // Create worklet node
            workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');

            // Handle PCM data from worklet - send directly to WebSocket.
            // When clientVAD is ON, evaluate each frame against the VAD before sending.
            workletNodeRef.current.port.onmessage = (event) => {
                if (event.data?.type !== 'pcm') return;

                if (_useVad && vadRef.current && analyserRef.current) {
                    // Read the current frame from the AnalyserNode (parallel tap into the stream).
                    const buf = new Float32Array(analyserRef.current.fftSize);
                    analyserRef.current.getFloatTimeDomainData(buf);
                    const rmsDb = computeRmsDb(buf);
                    const decision = vadRef.current.process(rmsDb, performance.now());

                    if (!decision.shouldSend) {
                        vadDropCountRef.current++;
                        return; // Drop silent frame — do not send to WebSocket
                    }
                }

                sendPCMToWebSocket(event.data.data);
            };

            // Connect: microphone -> worklet (AnalyserNode already connected above in parallel)
            source.connect(workletNodeRef.current);
            
            // #region agent log
            debugLog('useGeminiTranscription:startPCMCapture', '🎤 PCM CAPTURE STARTED', {
                sampleRate: audioContextRef.current.sampleRate
            }, 'LIVE');
            // #endregion

            return true;
        } catch (err) {
            console.error('Failed to start PCM capture:', err);
            return false;
        }
    }, [sendPCMToWebSocket]);

    // Stop PCM capture
    const stopPCMCapture = useCallback(() => {
        if (workletNodeRef.current) {
            workletNodeRef.current.disconnect();
            workletNodeRef.current = null;
        }
        // ─── Phase 9: disconnect AnalyserNode and clear VAD refs ──────────
        if (analyserRef.current) {
            try { analyserRef.current.disconnect(); } catch { /* ignore */ }
            analyserRef.current = null;
        }
        vadRef.current = null;
        // ─────────────────────────────────────────────────────────────────
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        // 🎙️ Phase 10: Only stop tracks if we created (own) the stream.
        // If the stream was provided externally, the caller (record.tsx) owns it
        // and will stop it when stopRecording() is called.
        if (mediaStreamRef.current) {
            if (ownsPCMStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                console.debug('[PCM Capture] Stopped owned stream tracks');
            } else {
                console.debug('[PCM Capture] External stream — tracks NOT stopped (not owned)');
            }
            mediaStreamRef.current = null;
        }
        ownsPCMStreamRef.current = false;

        debugLog('useGeminiTranscription:stopPCMCapture', '🔇 PCM CAPTURE STOPPED', {
            totalPCMChunks: pcmChunkCountRef.current
        }, 'LIVE');
    }, []);

    // Stop live transcription
    const stopLiveTranscription = useCallback(() => {
        // Clear pause timeout
        if (pauseTimeoutRef.current) {
            clearTimeout(pauseTimeoutRef.current);
            pauseTimeoutRef.current = null;
        }
        
        // Flush any remaining accumulated text as final segment
        if (accumulatedTextRef.current.trim().length > 0) {
            const cleanText = accumulatedTextRef.current
                .replace(/\*\*[^*]+\*\*/g, '')
                .replace(/\([^)]*transcri[^)]*\)/gi, '')
                .trim();
            if (cleanText) {
                const segment: TranscriptSegment = {
                    speaker: currentSpeakerRef.current,
                    text: cleanText,
                    isLive: true,
                    confidence: 0.8
                };
                setLiveSegments(prev => [...prev, segment]);
                onSegmentCallbackRef.current?.(segment);
            }
            accumulatedTextRef.current = '';
            setStreamingText('');
        }
        
        // Stop PCM capture first
        stopPCMCapture();
        if (wsRef.current) {
            wsRef.current.send(JSON.stringify({ clientContent: { turnComplete: true } }));
            setTimeout(() => {
                wsRef.current?.close();
                wsRef.current = null;
            }, 500);
        }
        setIsLiveActive(false);

        debugLog('useGeminiTranscription:stopLive', '🛑 LIVE PHASE STOPPED', {
            totalSegments: liveSegments.length,
            totalChunks: audioChunksRef.current.length,
            totalPCMChunks: pcmChunkCountRef.current
        }, 'LIVE');
    }, [liveSegments.length, stopPCMCapture]);

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2: ENHANCEMENT (after recording - better diarization)
    // ═══════════════════════════════════════════════════════════════════════════

    const enhanceTranscription = useCallback(async (
        audioBlob: Blob,
        existingSegments?: TranscriptSegment[],
        onProgress?: (progress: number) => void
    ): Promise<GeminiTranscriptionResult> => {
        // #region agent log - CONSOLE LOG for browser visibility
        console.log('%c[ENHANCE] 🔄 enhanceTranscription CALLED', 'color: #f97316; font-weight: bold', {
            enablePostEnhancement,
            audioBlobSize: audioBlob?.size,
            existingSegmentsCount: existingSegments?.length,
            liveSegmentsCount: liveSegments.length
        });
        // #endregion
        
        if (!enablePostEnhancement) {
            // #region agent log - CONSOLE LOG
            console.log('%c[ENHANCE] ❌ Enhancement DISABLED - returning early', 'color: #ef4444; font-weight: bold', { enablePostEnhancement });
            // #endregion
            return {
                text: (existingSegments || liveSegments).map(s => s.text).join(' '),
                segments: existingSegments || liveSegments,
                phase: 'live'
            };
        }

        // #region agent log
        debugLog('useGeminiTranscription:enhance', '🔄 STARTING ENHANCEMENT PHASE', {
            enhancementModel: model,
            audioBlobSize: audioBlob.size,
            existingSegmentsCount: (existingSegments || liveSegments).length
        }, 'ENHANCE');
        // #endregion

        setIsEnhancing(true);
        setProgress(0);
        onProgress?.(0);

        // #region agent log - CONSOLE LOG
        console.log('%c[ENHANCE] ✅ Enhancement ENABLED - starting process', 'color: #10b981; font-weight: bold');
        // #endregion

        try {
            console.log('%c[ENHANCE] 🔑 Fetching API key...', 'color: #3b82f6');
            const apiKey = await getApiKey();
            console.log('%c[ENHANCE] 🔑 API Key result:', 'color: #3b82f6', { hasKey: !!apiKey, keyLength: apiKey?.length || 0 });
            if (!apiKey) throw new Error('Google API Key not found');

            // Convert audio to base64
            const arrayBuffer = await audioBlob.arrayBuffer();
            const base64Audio = btoa(
                new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            setProgress(20);
            onProgress?.(20);

            // Determine MIME type - Gemini supports: WAV, MP3, AIFF, AAC, OGG, FLAC
            // Browser typically records in webm/opus - we'll try with the original type
            // as Gemini may still process it, or fall back to audio/ogg
            let mimeType = audioBlob.type || 'audio/webm';
            
            // Map common browser formats to Gemini-compatible types
            if (mimeType.includes('mp4') || mimeType.includes('m4a')) mimeType = 'audio/aac';
            else if (mimeType.includes('wav')) mimeType = 'audio/wav';
            else if (mimeType.includes('webm') || mimeType.includes('opus')) mimeType = 'audio/ogg'; // Try OGG for webm/opus
            else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) mimeType = 'audio/mp3';
            
            // #region agent log
            debugLog('useGeminiTranscription:enhance', '📎 AUDIO FORMAT', {
                originalType: audioBlob.type,
                mappedType: mimeType,
                sizeKB: Math.round(audioBlob.size / 1024)
            }, 'ENHANCE');
            // #endregion

            // Build enhancement prompt with existing transcription context.
            // Sanitize speaker names and segment text to prevent prompt injection
            // (speaker names are user-/model-controlled and injected into the LLM prompt).
            const existingText = (existingSegments || liveSegments).map(s =>
                `[${sanitizeSpeakerName(s.speaker)}]: ${sanitizeSegmentForPrompt(s.text)}`
            ).join('\n');

            const enhancementPrompt = `Tu es un expert en transcription et diarization audio (identification des locuteurs par leur voix).

## AUDIO À ANALYSER
Un enregistrement audio est fourni. Écoute-le INTÉGRALEMENT avant de répondre.

## TRANSCRIPTION LIVE DE RÉFÉRENCE (peut contenir des erreurs)
${existingText || '(aucune transcription préalable - analyse uniquement l\'audio)'}

## INSTRUCTIONS DE DIARIZATION (CRITIQUE)

### Étape 1: Analyse des voix
- Écoute l'audio et identifie le NOMBRE EXACT de voix distinctes
- Chaque voix a un timbre, une tonalité et un rythme uniques
- NE PAS confondre une même personne avec plusieurs speakers

### Étape 2: Attribution des noms
- Si une personne se présente ("je suis X", "c'est X qui parle", "ici X"), utilise ce nom
- Sinon, utilise Speaker_01, Speaker_02, etc.
- COHÉRENCE: Une même voix = UN SEUL nom/identifiant tout au long

### Étape 3: Transcription précise
- Corrige les erreurs de la transcription live
- Garde le sens et les mots exacts prononcés
- Ajoute les timestamps au format "MM:SS"

## FORMAT DE SORTIE (JSON STRICT - AUCUN AUTRE TEXTE)
\`\`\`json
{
  "language": "fr",
  "speakers_detected": <nombre>,
  "speaker_names": ["Nom1", "Speaker_02"],
  "segments": [
    {"speaker": "Nom1", "text": "texte exact", "start": "00:00", "end": "00:15", "confidence": 0.95},
    {"speaker": "Speaker_02", "text": "réponse", "start": "00:16", "end": "00:28", "confidence": 0.92}
  ]
}
\`\`\`

## RÈGLES CRITIQUES
- Retourne UNIQUEMENT le JSON, pas de texte avant ou après
- Si 1 seul locuteur, speakers_detected=1 et utilise UN SEUL nom
- Les segments doivent être dans l'ordre chronologique
- Confidence entre 0.0 et 1.0`;

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
            console.log('%c[ENHANCE] 📤 CALLING GEMINI API', 'color: #8b5cf6; font-weight: bold', {
                model: cleanModel,
                apiVersion,
                audioSizeKB: Math.round(base64Audio.length / 1024),
                mimeType
            });
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

            // #region agent log - CONSOLE LOG
            console.log('%c[ENHANCE] 📥 GEMINI API RESPONSE', 'color: #8b5cf6', { status: response.status, ok: response.ok });
            // #endregion

            if (!response.ok) {
                const err = await response.json();
                // #region agent log - CONSOLE LOG
                console.log('%c[ENHANCE] ❌ GEMINI API ERROR', 'color: #ef4444; font-weight: bold', { error: err.error?.message || 'unknown', fullError: err });
                // #endregion
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

                const enhancedSegs: TranscriptSegment[] = (parsed.segments || []).map((s: any) =>
                    normalizeSegment({
                        speaker: s.speaker || 'Speaker_01',
                        text: s.text,
                        start: s.start,
                        end: s.end,
                        confidence: s.confidence || 0.9,
                        isLive: false
                    })
                );

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

    // 🎙️ Phase 10: Options for startFullWorkflow
    interface StartFullWorkflowOptions {
        onLiveSegment?: (segment: TranscriptSegment) => void;
        onEnhancedResult?: (result: GeminiTranscriptionResult) => void;
        /** If provided (and unifiedMicStream flag is ON), passed to startPCMCapture
         *  to skip a second getUserMedia call. */
        externalStream?: MediaStream;
    }

    const startFullWorkflow = useCallback(async (
        onLiveSegmentOrOptions?: ((segment: TranscriptSegment) => void) | StartFullWorkflowOptions,
        onEnhancedResult?: (result: GeminiTranscriptionResult) => void
    ) => {
        // Support both legacy positional call and new options object
        let onLiveSegment: ((segment: TranscriptSegment) => void) | undefined;
        let externalStream: MediaStream | undefined;

        if (typeof onLiveSegmentOrOptions === 'function') {
            onLiveSegment = onLiveSegmentOrOptions;
        } else if (onLiveSegmentOrOptions && typeof onLiveSegmentOrOptions === 'object') {
            onLiveSegment = onLiveSegmentOrOptions.onLiveSegment;
            onEnhancedResult = onLiveSegmentOrOptions.onEnhancedResult;
            externalStream = onLiveSegmentOrOptions.externalStream;
        }

        // #region agent log
        debugLog('useGeminiTranscription:fullWorkflow', '🚀 STARTING FULL WORKFLOW', {
            enableLive: enableLiveTranscription,
            enableEnhance: enablePostEnhancement,
            hasExternalStream: !!externalStream
        }, 'WORKFLOW');
        // #endregion

        // Start live WebSocket connection
        await startLiveTranscription(onLiveSegment);

        // Wait for WebSocket to be ready before sending audio
        await new Promise(r => setTimeout(r, 500));

        // Start PCM capture via AudioWorklet (sends audio directly to WebSocket)
        // 🎙️ Phase 10: pass externalStream so startPCMCapture can skip getUserMedia when flag is ON
        const pcmStarted = await startPCMCapture({ externalStream });
        
        // #region agent log
        debugLog('useGeminiTranscription:fullWorkflow', '🎤 PCM CAPTURE STATUS', {
            pcmStarted,
            wsState: wsRef.current?.readyState
        }, 'WORKFLOW');
        // #endregion

        return {
            sendChunk: sendAudioChunk, // Also stores chunks for enhancement phase
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
    }, [startLiveTranscription, sendAudioChunk, stopLiveTranscription, enhanceTranscription, liveSegments, enableLiveTranscription, enablePostEnhancement, startPCMCapture]);

    // Reset state
    const reset = useCallback(() => {
        if (pauseTimeoutRef.current) {
            clearTimeout(pauseTimeoutRef.current);
            pauseTimeoutRef.current = null;
        }
        // Phase 8: cancel any pending reconnect timer
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        reconnectStrategyRef.current.reset();
        sessionStateRef.current = { startedAt: 0, lastSegments: [], isReconnecting: false };

        setLiveSegments([]);
        setEnhancedSegments([]);
        setStreamingText('');
        setProgress(0);
        setError(null);
        audioChunksRef.current = [];
        currentSpeakerRef.current = 'Speaker_01';
        nextSpeakerRef.current = null;
        lastSpeakerChangeTimeRef.current = 0;
        lastTextRef.current = '';
        accumulatedTextRef.current = '';
        onSegmentCallbackRef.current = null;
        speakerNamesRef.current.clear();
        // Phase 7: clear dedup/mapping refs on reset
        seenHashesRef.current.clear();
        speakerMappingRef.current.clear();
        dedupHitCountRef.current = 0;
        // Phase 14: clear VAD telemetry interval on reset
        if (vadTelemetryIntervalRef.current) {
            clearInterval(vadTelemetryIntervalRef.current);
            vadTelemetryIntervalRef.current = null;
        }
    }, []);

    // 🎭 Set external speaker (from Pyannote Live or other source)
    const setExternalSpeaker = useCallback((speaker: string | null) => {
        externalSpeakerRef.current = speaker;
        if (speaker) {
            debugLog('useGeminiTranscription:setExternalSpeaker', '🎭 EXTERNAL SPEAKER SET', {
                speaker
            }, 'LIVE');
        }
    }, []);

    // 🎭 Set callback for PCM chunks (to forward to Pyannote Live)
    const setOnPCMChunk = useCallback((callback: ((pcmData: ArrayBuffer) => void) | null) => {
        onPCMChunkCallbackRef.current = callback;
        debugLog('useGeminiTranscription:setOnPCMChunk', '🎭 PCM CALLBACK SET', {
            hasCallback: !!callback
        }, 'LIVE');
    }, []);

    // ─── Phase 9: VAD metrics (for telemetry / debug — phase 14) ──────────
    const getVadMetrics = useCallback(() => ({
        enabled: !!vadRef.current,
        state: vadRef.current?.state ?? ('silence' as const),
        droppedChunks: vadDropCountRef.current,
    }), []);
    // ────────────────────────────────────────────────────────────────────────

    // Cleanup on unmount: release refs that would otherwise stay in closure.
    // reset() also clears these, but navigation-back can unmount without reset().
    useEffect(() => {
        return () => {
            speakerNamesRef.current.clear();
            // Phase 7: clear dedup/mapping refs on unmount
            seenHashesRef.current.clear();
            speakerMappingRef.current.clear();
            audioChunksRef.current = [];
            // Phase 8: cancel reconnect timer and clear session state on unmount
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            reconnectStrategyRef.current.reset();
            sessionStateRef.current = { startedAt: 0, lastSegments: [], isReconnecting: false };
            if (wsRef.current) {
                try {
                    wsRef.current.close(1000, 'unmount');
                } catch {
                    // ignore — socket may already be closing
                }
                wsRef.current = null;
            }
            // Phase 9: disconnect AnalyserNode and clear VAD refs on unmount
            if (analyserRef.current) {
                try { analyserRef.current.disconnect(); } catch { /* ignore */ }
                analyserRef.current = null;
            }
            vadRef.current = null;
            // Phase 14: clear VAD telemetry interval on unmount
            if (vadTelemetryIntervalRef.current) {
                clearInterval(vadTelemetryIntervalRef.current);
                vadTelemetryIntervalRef.current = null;
            }
            if (audioContextRef.current) {
                try {
                    audioContextRef.current.close();
                } catch {
                    // ignore
                }
                audioContextRef.current = null;
            }
            if (mediaStreamRef.current) {
                // 🎙️ Phase 10: Only stop tracks if we own the stream
                if (ownsPCMStreamRef.current) {
                    mediaStreamRef.current.getTracks().forEach(t => t.stop());
                }
                mediaStreamRef.current = null;
            }
            ownsPCMStreamRef.current = false;
        };
    }, []);

    return {
        // State
        isLiveActive,
        isEnhancing,
        liveSegments,
        enhancedSegments,
        progress,
        error,
        streamingText, // 🚀 Real-time text being transcribed (before segment is finalized)

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
        
        // 🎭 External speaker source (Pyannote Live)
        setExternalSpeaker,
        
        // 🎭 PCM chunk callback (for Pyannote Live diarization)
        setOnPCMChunk,
        
        // Get best available segments
        getBestSegments: () => enhancedSegments.length > 0 ? enhancedSegments : liveSegments,
        
        // 🧠 Speaker name memory - get current mappings
        getSpeakerNameMap: () => Object.fromEntries(speakerNamesRef.current),
        
        // 🧠 Manually set a speaker name (for UI-based assignment)
        setSpeakerName: (speakerId: string, name: string) => {
            speakerNamesRef.current.set(speakerId, name);
            console.log(`%c[SPEAKER MEMORY] ✏️ MANUAL SET: ${speakerId} → "${name}"`, 'color: #f59e0b; font-weight: bold');
        },

        // 🎙️ Phase 9: VAD metrics (enabled, state, droppedChunks)
        getVadMetrics,
    };
}
