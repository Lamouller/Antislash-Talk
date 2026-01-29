/**
 * 🎭 useLiveDiarization - Real-time speaker identification with Pyannote
 * 
 * Works in parallel with Gemini Live:
 * - Gemini Live → Text transcription
 * - Pyannote Live → Speaker identification
 * 
 * Usage:
 * 1. Start Gemini Live for text
 * 2. Start this for speaker IDs
 * 3. Combine: text segments get speaker labels
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface SpeakerEvent {
    type: 'speaker' | 'speaker_change' | 'ready' | 'error' | 'summary';
    speaker?: string;
    from?: string;
    to?: string;
    confidence?: number;
    is_new?: boolean;
    message?: string;
    total_speakers?: number;
    speakers?: string[];
}

interface UseLiveDiarizationOptions {
    serverUrl?: string;
    onSpeakerChange?: (speaker: string, confidence: number) => void;
    onError?: (error: string) => void;
}

// Derive WebSocket URL from VITE_WHISPERX_URL (HTTP -> WS)
const getWebSocketUrl = (): string => {
    const httpUrl = import.meta.env.VITE_WHISPERX_URL || 'http://localhost:8082';
    // Convert http(s):// to ws(s)://
    return httpUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
};

const WHISPERX_WS_URL = getWebSocketUrl();

export function useLiveDiarization(options: UseLiveDiarizationOptions = {}) {
    const {
        serverUrl = WHISPERX_WS_URL,
        onSpeakerChange,
        onError
    } = options;

    // State
    const [isConnected, setIsConnected] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
    const [speakers, setSpeakers] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Refs
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Check availability
    const checkAvailability = useCallback(async () => {
        try {
            const httpUrl = serverUrl.replace('ws://', 'http://').replace('wss://', 'https://');
            const response = await fetch(`${httpUrl}/live-diarization/status`, {
                signal: AbortSignal.timeout(3000)
            });
            
            if (response.ok) {
                const data = await response.json();
                setIsAvailable(data.available);
                return data.available;
            }
            setIsAvailable(false);
            return false;
        } catch {
            setIsAvailable(false);
            return false;
        }
    }, [serverUrl]);

    // Connect to WebSocket
    const connect = useCallback(async (): Promise<boolean> => {
        console.log('%c[LiveDiarization] 🔌 Connecting...', 'color: #7c3aed; font-weight: bold');
        
        // Check availability first
        const available = await checkAvailability();
        if (!available) {
            console.warn('[LiveDiarization] ❌ Service not available');
            setError('Live diarization service not available');
            return false;
        }

        return new Promise((resolve) => {
            try {
                const ws = new WebSocket(`${serverUrl}/ws/live-diarization`);
                
                ws.onopen = () => {
                    console.log('%c[LiveDiarization] ✅ Connected!', 'color: #16a34a; font-weight: bold');
                    setIsConnected(true);
                    setError(null);
                };

                ws.onmessage = (event) => {
                    try {
                        const data: SpeakerEvent = JSON.parse(event.data);
                        
                        switch (data.type) {
                            case 'ready':
                                console.log('[LiveDiarization] 🎭 Ready:', data.message);
                                resolve(true);
                                break;
                                
                            case 'speaker':
                                console.log(`%c[LiveDiarization] 🎤 Speaker: ${data.speaker}`, 
                                    'color: #16a34a; font-weight: bold', 
                                    `(confidence: ${data.confidence}, new: ${data.is_new})`
                                );
                                setCurrentSpeaker(data.speaker || null);
                                if (data.is_new && data.speaker) {
                                    setSpeakers(prev => [...prev, data.speaker!]);
                                }
                                onSpeakerChange?.(data.speaker || '', data.confidence || 0);
                                break;
                                
                            case 'speaker_change':
                                console.log(`%c[LiveDiarization] 🔄 Speaker change: ${data.from} → ${data.to}`, 
                                    'color: #f59e0b; font-weight: bold'
                                );
                                setCurrentSpeaker(data.to || null);
                                if (data.is_new && data.to) {
                                    setSpeakers(prev => [...prev, data.to!]);
                                }
                                onSpeakerChange?.(data.to || '', data.confidence || 0);
                                break;
                                
                            case 'summary':
                                console.log(`%c[LiveDiarization] 📊 Summary: ${data.total_speakers} speakers`, 
                                    'color: #7c3aed; font-weight: bold'
                                );
                                break;
                                
                            case 'error':
                                console.error('[LiveDiarization] ❌ Error:', data.message);
                                setError(data.message || 'Unknown error');
                                onError?.(data.message || 'Unknown error');
                                break;
                        }
                    } catch (e) {
                        console.error('[LiveDiarization] Parse error:', e);
                    }
                };

                ws.onerror = (event) => {
                    console.error('[LiveDiarization] ❌ WebSocket error:', event);
                    setError('WebSocket connection error');
                    resolve(false);
                };

                ws.onclose = (event) => {
                    console.log(`[LiveDiarization] 🔌 Disconnected (code: ${event.code})`);
                    setIsConnected(false);
                    wsRef.current = null;
                };

                wsRef.current = ws;
                
                // Timeout if no ready message
                setTimeout(() => resolve(false), 5000);
                
            } catch (e) {
                console.error('[LiveDiarization] Connection error:', e);
                setError('Failed to connect');
                resolve(false);
            }
        });
    }, [serverUrl, checkAvailability, onSpeakerChange, onError]);

    // Disconnect
    const disconnect = useCallback(() => {
        if (wsRef.current) {
            // Send stop signal
            try {
                wsRef.current.send(JSON.stringify({ type: 'stop' }));
            } catch {}
            
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
        setCurrentSpeaker(null);
    }, []);

    // Send audio chunk (PCM 16kHz, 16-bit, mono)
    const sendAudioChunk = useCallback((pcmData: ArrayBuffer) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(pcmData);
        }
    }, []);

    // Reset session (keeps connection)
    const resetSession = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'reset' }));
            setCurrentSpeaker(null);
            setSpeakers([]);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            disconnect();
        };
    }, [disconnect]);

    return {
        // State
        isConnected,
        isAvailable,
        currentSpeaker,
        speakers,
        error,

        // Actions
        checkAvailability,
        connect,
        disconnect,
        sendAudioChunk,
        resetSession,
    };
}

export default useLiveDiarization;
