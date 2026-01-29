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
    
    // 🎭 External speaker source (e.g., Pyannote Live)
    const externalSpeakerRef = useRef<string | null>(null);
    
    // 🎭 Callback for PCM chunks (to send to Pyannote Live for diarization)
    const onPCMChunkCallbackRef = useRef<((pcmData: ArrayBuffer) => void) | null>(null);
    
    // PCM Audio capture refs (AudioWorklet for real-time streaming)
    const audioContextRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const pcmChunkCountRef = useRef<number>(0);

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
    // PHASE 1: LIVE TRANSCRIPTION (during recording)
    // ═══════════════════════════════════════════════════════════════════════════

    const startLiveTranscription = useCallback(async (
        onSegment?: (segment: TranscriptSegment) => void
    ) => {
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:startLive',message:'START_LIVE_CALLED',data:{enableLiveTranscription,liveModel:LIVE_MODEL,enhancementModel:model,language},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,D'})}).catch(()=>{});
        // #endregion

        if (!enableLiveTranscription) {
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:startLive',message:'LIVE_DISABLED_EARLY_RETURN',data:{enableLiveTranscription},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
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
            // Always use gemini-2.0-flash-live-001 for Live WebSocket API
            const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
            
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                // #region agent log
                fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:onopen',message:'WS_CONNECTED',data:{liveModel:LIVE_MODEL},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
                debugLog('useGeminiTranscription:startLive', '✅ WEBSOCKET CONNECTED', {}, 'LIVE');
                // #endregion

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
                                text: `TRANSCRIPTION ONLY. Output ONLY the exact words spoken, nothing else. No comments, no formatting, no asterisks, no explanations. Just the spoken words in ${language}.`
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
                    
                    fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:onmessage',message:'WS_MESSAGE_DETAIL',data:{hasInputTranscription,hasModelTurn,inputTranscriptionText,modelTurnText,serverContentKeys},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,C'})}).catch(()=>{});
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
                        fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:onmessage',message:'SETUP_COMPLETE',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
                        // #endregion
                        debugLog('useGeminiTranscription:onMessage', '✅ SETUP COMPLETE - Ready for audio', {}, 'LIVE');
                    }

                    // Check for errors
                    if (data.error) {
                        // #region agent log
                        fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:onmessage',message:'SERVER_ERROR',data:{errorMsg:data.error?.message||'unknown'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
                        // #endregion
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

                            // ═══════════════════════════════════════════════════════════════
                            // 🎭 SPEAKER IDENTIFICATION (Lightweight)
                            // Priority: 1. Name from text, 2. External (Pyannote), 3. Default
                            // ═══════════════════════════════════════════════════════════════
                            
                            // 🎯 Lightweight name detection from self-introductions
                            // Patterns for self-introduction (detect speaker name)
                            const selfIntroPatterns = [
                                /c'est\s+([A-Z][a-zà-ÿ]{2,})\s+(?:qui\s+parle|ici|à l'appareil)/i,
                                /(?:je\s+suis|je\s+m'appelle|moi\s+c'est)\s+([A-Z][a-zà-ÿ]{2,})/i,
                                /(?:ici|bonjour)\s+([A-Z][a-zà-ÿ]{2,})(?:\s+ici)?/i,
                                /([A-Z][a-zà-ÿ]{2,})\s+(?:à l'appareil|au micro)/i,
                                // Pattern for "[Name] qui parle" without c'est prefix
                                /^([A-Z][a-zà-ÿ]{2,})\s+qui\s+parle/i,
                                /,\s*([A-Z][a-zà-ÿ]{2,})\s+qui\s+parle/i,
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
                                // Common French words starting with capital when at sentence start
                                'quand', 'comme', 'avec', 'pour', 'dans', 'mais', 'cette',
                                'votre', 'notre', 'leur', 'vous', 'nous', 'elles', 'ils'
                            ]);
                            
                            let detectedName: string | null = null;
                            
                            // Try each pattern
                            for (const pattern of selfIntroPatterns) {
                                const match = fullText.match(pattern);
                                if (match && match[1]) {
                                    const candidateName = match[1];
                                    // Validate: not a common word, min 3 chars
                                    if (!EXCLUDED_WORDS.has(candidateName.toLowerCase()) && 
                                        candidateName.length >= 3) {
                                        detectedName = candidateName;
                                        console.log(`%c[GEMINI] 🎭 NAME DETECTED: "${detectedName}"`, 'color: #7c3aed; font-weight: bold');
                                        break;
                                    }
                                }
                            }
                            
                            // Update speaker based on detection
                            if (detectedName) {
                                currentSpeakerRef.current = detectedName;
                                // Store name for future segments
                                speakerNamesRef.current.set('detected', detectedName);
                            } else if (externalSpeakerRef.current) {
                                // Use Pyannote Live if available
                                currentSpeakerRef.current = externalSpeakerRef.current;
                            } else if (speakerNamesRef.current.has('detected')) {
                                // Reuse last detected name
                                currentSpeakerRef.current = speakerNamesRef.current.get('detected')!;
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
                                    return [...prev, {
                                        speaker: newSpeaker,
                                        text: cleanText,
                                        isLive: true,
                                        confidence: isFinal ? 0.9 : 0.75
                                    }];
                                });

                                // Callback with full segment info for UI
                                const segment: TranscriptSegment = {
                                    speaker: newSpeaker,
                                    text: cleanText,
                                    isLive: true,
                                    confidence: isFinal ? 0.9 : 0.75
                                };
                                onSegmentCallbackRef.current?.(segment);
                                onSegment?.(segment);
                            }
                            
                            // Reset for next segment
                            accumulatedTextRef.current = '';
                            setStreamingText('');
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
                        const modelText = data.serverContent.modelTurn.parts[0]?.text || '';
                        // #region agent log
                        if (modelText.length > 0 && modelText.length < 100) {
                            fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:modelTurn',message:'MODEL_TURN_SKIPPED',data:{textPreview:modelText.substring(0,50),reason:'Using inputTranscription as primary source'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
                        }
                        // #endregion
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
                fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:onclose',message:'WS_CLOSED',data:{code:event.code,reason:event.reason||'none',wasClean:event.wasClean},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
                debugLog('useGeminiTranscription:startLive', '🔌 WEBSOCKET CLOSED', {
                    segmentsCount: liveSegments.length,
                    code: event.code,
                    reason: event.reason || 'No reason provided',
                    wasClean: event.wasClean
                }, 'LIVE');
                // #endregion
                setIsLiveActive(false);
                
                // Common close codes:
                // 1000 = Normal closure
                // 1001 = Going away
                // 1006 = Abnormal closure (no close frame)
                // 1011 = Server error
                if (event.code !== 1000) {
                    setError(`WebSocket closed: ${event.reason || `Code ${event.code}`}`);
                }
            };

        } catch (err) {
            setError((err as Error).message);
            setIsLiveActive(false);
        }
    }, [model, language, enableLiveTranscription]);

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
                fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:sendPCM',message:'SENDING_RAW_PCM',data:{chunkIndex,pcmSizeBytes:pcmData.byteLength},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
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

    // Start PCM audio capture using AudioWorklet
    const startPCMCapture = useCallback(async () => {
        try {
            pcmChunkCountRef.current = 0;
            
            // Request microphone access at 16kHz
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            mediaStreamRef.current = stream;

            // Create AudioContext at 16kHz (required by Gemini)
            audioContextRef.current = new AudioContext({ sampleRate: 16000 });
            
            // Load PCM processor worklet
            await audioContextRef.current.audioWorklet.addModule('/pcm-processor.js');
            
            // Create source from microphone
            const source = audioContextRef.current.createMediaStreamSource(stream);
            
            // Create worklet node
            workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');
            
            // Handle PCM data from worklet - send directly to WebSocket
            workletNodeRef.current.port.onmessage = (event) => {
                if (event.data.type === 'pcm') {
                    sendPCMToWebSocket(event.data.data);
                }
            };
            
            // Connect: microphone -> worklet
            source.connect(workletNodeRef.current);
            
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:startPCMCapture',message:'PCM_CAPTURE_STARTED',data:{sampleRate:audioContextRef.current.sampleRate},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
            debugLog('useGeminiTranscription:startPCMCapture', '🎤 PCM CAPTURE STARTED', {
                sampleRate: audioContextRef.current.sampleRate
            }, 'LIVE');
            // #endregion
            
            return true;
        } catch (err) {
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:startPCMCapture',message:'PCM_CAPTURE_ERROR',data:{error:(err as Error).message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
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
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        
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
        if (!enablePostEnhancement) {
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

        // Start live WebSocket connection
        await startLiveTranscription(onLiveSegment);
        
        // Wait for WebSocket to be ready before sending audio
        await new Promise(r => setTimeout(r, 500));
        
        // Start PCM capture via AudioWorklet (sends audio directly to WebSocket)
        const pcmStarted = await startPCMCapture();
        
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:fullWorkflow',message:'PCM_CAPTURE_STATUS',data:{pcmStarted,wsState:wsRef.current?.readyState},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
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
        getBestSegments: () => enhancedSegments.length > 0 ? enhancedSegments : liveSegments
    };
}
