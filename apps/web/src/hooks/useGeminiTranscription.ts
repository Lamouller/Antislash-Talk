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

    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const audioChunksRef = useRef<ArrayBuffer[]>([]);
    const currentSpeakerRef = useRef<string>('Speaker_01');
    const lastTextRef = useRef<string>('');
    
    // Speaker name mapping: Speaker_XX -> Real name (when detected)
    const speakerNamesRef = useRef<Map<string, string>>(new Map());

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
        audioChunksRef.current = [];
        lastTextRef.current = '';

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
                    fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:onmessage',message:'WS_MESSAGE',data:{hasSetupComplete:!!data.setupComplete,hasServerContent:!!data.serverContent,hasError:!!data.error,hasInputTranscription:!!data.serverContent?.inputTranscription,keys:Object.keys(data).slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,C'})}).catch(()=>{});
                    debugLog('useGeminiTranscription:onMessage', '📥 WS MESSAGE RECEIVED', {
                        hasSetupComplete: !!data.setupComplete,
                        hasServerContent: !!data.serverContent,
                        hasError: !!data.error,
                        keys: Object.keys(data).slice(0, 5)
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

                        // Avoid duplicates
                        if (text === lastTextRef.current) return;
                        lastTextRef.current = text;

                        // Detect speaker change
                        if (text.includes('[SPEAKER_CHANGE]') || text.includes('(speaker change)')) {
                            const speakerNum = parseInt(currentSpeakerRef.current.split('_')[1] || '1');
                            currentSpeakerRef.current = `Speaker_${String(speakerNum + 1).padStart(2, '0')}`;
                        }

                        // Detect mentioned names and update speaker mapping
                        const nameMatch = text.match(/\(nom détecté:\s*([^)]+)\)/i) || 
                                         text.match(/(?:je suis|c'est|ici)\s+([A-Z][a-zéèêëàâäùûü]+(?:\s+[A-Z][a-zéèêëàâäùûü]+)?)/i);
                        if (nameMatch) {
                            const detectedName = nameMatch[1].trim();
                            const oldSpeaker = currentSpeakerRef.current;
                            
                            // Store the mapping: Speaker_XX -> Real name
                            speakerNamesRef.current.set(oldSpeaker, detectedName);
                            
                            // Update current speaker to real name
                            currentSpeakerRef.current = detectedName;
                            
                            // Retroactively update ALL previous segments with this speaker
                            setLiveSegments(prev => prev.map(seg => 
                                seg.speaker === oldSpeaker ? { ...seg, speaker: detectedName } : seg
                            ));
                            
                            debugLog('useGeminiTranscription:speakerDetected', '👤 NAME DETECTED - UPDATING ALL', {
                                oldSpeaker,
                                newName: detectedName,
                                mappingSize: speakerNamesRef.current.size
                            }, 'LIVE');
                        }

                        // Clean text - remove metadata and hallucinations
                        const cleanText = text
                            .replace(/\[SPEAKER_CHANGE\]/gi, '')
                            .replace(/\(nom détecté:[^)]+\)/gi, '')
                            .replace(/\(speaker change\)/gi, '')
                            .replace(/\*\*[^*]+\*\*/g, '') // Remove **bold** patterns (hallucinations)
                            .replace(/\([^)]*transcri[^)]*\)/gi, '') // Remove (transcription...) patterns
                            .replace(/\([^)]*clari[^)]*\)/gi, '') // Remove (clarification...) patterns
                            .replace(/I've successfully.*/gi, '') // Remove assistant-like responses
                            .replace(/My focus remains.*/gi, '')
                            .replace(/I'm having trouble.*/gi, '')
                            .trim();

                        if (cleanText && isFinal) {
                            const segment: TranscriptSegment = {
                                speaker: currentSpeakerRef.current,
                                text: cleanText,
                                isLive: true,
                                confidence: 0.85
                            };

                            // #region agent log
                            fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:segment',message:'SEGMENT_CREATED',data:{speaker:segment.speaker,textPreview:cleanText.substring(0,30),hasCallback:!!onSegment},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
                            // #endregion

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

                    // Handle model text output - FILTERED to avoid hallucinations
                    // Only use if it looks like actual transcription (short, no special patterns)
                    if (data.serverContent?.modelTurn?.parts) {
                        for (const part of data.serverContent.modelTurn.parts) {
                            if (part.text) {
                                const rawText = part.text.trim();
                                
                                // Skip if it looks like a hallucination/comment
                                const isHallucination = 
                                    rawText.includes('**') ||
                                    rawText.includes('I\'ve') ||
                                    rawText.includes('I\'m') ||
                                    rawText.includes('My focus') ||
                                    rawText.includes('transcrib') ||
                                    rawText.includes('clari') ||
                                    rawText.includes('audio') ||
                                    rawText.length > 200; // Too long = probably a comment
                                
                                if (!isHallucination && rawText.length > 0) {
                                    const segment: TranscriptSegment = {
                                        speaker: currentSpeakerRef.current,
                                        text: rawText,
                                        isLive: true,
                                        confidence: 0.7
                                    };
                                    setLiveSegments(prev => [...prev, segment]);
                                    onSegment?.(segment);
                                }
                            }
                        }
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
    const sendAudioChunk = useCallback(async (chunk: ArrayBuffer, mimeType?: string) => {
        // Store original for enhancement phase
        audioChunksRef.current.push(chunk);
        const chunkIndex = audioChunksRef.current.length;

        // #region agent log
        if (chunkIndex <= 3) {
            fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:sendChunk',message:'DECODING_CHUNK',data:{chunkIndex,sizeBytes:chunk.byteLength,mimeType:mimeType||'default'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
        }
        // #endregion

        // Send to live transcription WebSocket (convert to PCM first)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            // Try to decode webm to PCM
            const pcmData = await decodeAudioToPCM(chunk);
            
            if (pcmData) {
                const base64 = btoa(
                    new Uint8Array(pcmData).reduce((data, byte) => data + String.fromCharCode(byte), '')
                );

                // #region agent log
                if (chunkIndex <= 3) {
                    fetch('http://127.0.0.1:7245/ingest/046bf818-ee35-424f-9e7e-36ad7fbe78a2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useGeminiTranscription.ts:sendChunk',message:'SENDING_PCM_TO_WS',data:{chunkIndex,pcmSizeBytes:pcmData.byteLength,wsState:wsRef.current?.readyState},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
                    debugLog('useGeminiTranscription:sendChunk', '📤 SENDING PCM TO WS', {
                        chunkIndex,
                        pcmSizeBytes: pcmData.byteLength,
                        wsState: wsRef.current?.readyState
                    }, 'LIVE');
                }
                // #endregion

                // Send as PCM (required by Gemini Live API)
                wsRef.current.send(JSON.stringify({
                    realtimeInput: {
                        mediaChunks: [{
                            mimeType: 'audio/pcm;rate=16000',
                            data: base64
                        }]
                    }
                }));
            } else {
                debugLog('useGeminiTranscription:sendChunk', '⚠️ PCM decode failed - chunk stored only', {
                    chunkIndex
                }, 'LIVE');
            }
        } else {
            debugLog('useGeminiTranscription:sendChunk', '⚠️ WS NOT OPEN - chunk stored only', {
                chunkIndex,
                wsState: wsRef.current?.readyState
            }, 'LIVE');
        }
    }, [decodeAudioToPCM]);

    // Stop live transcription
    const stopLiveTranscription = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.send(JSON.stringify({ clientContent: { turnComplete: true } }));
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

        return {
            sendChunk: sendAudioChunk, // Sends chunks to WebSocket + stores for enhancement
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
        speakerNamesRef.current.clear(); // Reset speaker names mapping
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
