import { useState, useRef, useEffect } from 'react';

// 🆕 Type pour le callback de chunk live
export type OnChunkReadyCallback = (chunk: Blob, chunkIndex: number) => void;

// #region agent log - localStorage based for mobile debugging
const debugLog = (loc: string, msg: string, data: any, hyp: string) => { try { const logs = JSON.parse(localStorage.getItem('__debug_logs__') || '[]'); logs.push({location:loc,message:msg,data,timestamp:Date.now(),hypothesisId:hyp}); if(logs.length > 100) logs.shift(); localStorage.setItem('__debug_logs__', JSON.stringify(logs)); console.log(`[DEBUG:${hyp}] ${loc}: ${msg}`, data); } catch(e){} };
// #endregion

export function useWebAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 🆕 Callback pour le streaming live
  const onChunkReadyCallbackRef = useRef<OnChunkReadyCallback | null>(null);
  const chunkIndexRef = useRef<number>(0);
  // 🔧 Store the actual mimeType used for recording
  const mimeTypeRef = useRef<string>('audio/webm');
  // 📞 Track if pause was caused by system interruption (like phone call)
  const wasInterruptedRef = useRef<boolean>(false);

  useEffect(() => {
    // Clean up audio blob URL
    return () => {
      if (audioBlob) {
        URL.revokeObjectURL(URL.createObjectURL(audioBlob));
      }
    };
  }, [audioBlob]);

  const startRecording = async (onChunkReady?: OnChunkReadyCallback) => {
    try {
      console.log(`%c[useWebAudioRecorder] 🎙️ STARTING RECORDING`, 'color: #10b981; font-weight: bold');
      console.log(`[useWebAudioRecorder] Live streaming: ${onChunkReady ? '✅ ENABLED (chunks every 10s)' : '❌ DISABLED (single blob)'}`);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 🔧 Detect best audio format for current browser
      // iOS Safari: audio/mp4, Chrome/Android: audio/webm
      let mimeType = 'audio/webm';
      const options: MediaRecorderOptions = {};
      
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
        options.mimeType = mimeType;
        console.log('[useWebAudioRecorder] 🎵 Using WebM with Opus codec');
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
        options.mimeType = mimeType;
        console.log('[useWebAudioRecorder] 🍎 Using MP4 for iOS compatibility');
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
        options.mimeType = mimeType;
        console.log('[useWebAudioRecorder] 🎵 Using WebM (basic)');
      } else {
        console.warn('[useWebAudioRecorder] ⚠️ No preferred format supported, using browser default');
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      mimeTypeRef.current = mimeType; // Store for later use
      
      // #region agent log - Hypothesis A,B,E: Monitor MediaRecorder state changes and track status
      mediaRecorderRef.current.onpause = () => {
        debugLog('useWebAudioRecorder.ts:onpause', 'MediaRecorder PAUSED by system', { state: mediaRecorderRef.current?.state, tracksState: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState, muted: t.muted })) }, 'A');
        // 📞 Mark as interrupted for auto-resume
        wasInterruptedRef.current = true;
        setIsPaused(true);
        if (timerRef.current) clearInterval(timerRef.current);
        console.log('[useWebAudioRecorder] 📞 Recording interrupted (likely phone call) - will auto-resume');
      };
      mediaRecorderRef.current.onresume = () => {
        debugLog('useWebAudioRecorder.ts:onresume', 'MediaRecorder RESUMED', { state: mediaRecorderRef.current?.state }, 'A');
        // 📞 Clear interruption flag
        wasInterruptedRef.current = false;
        setIsPaused(false);
        // Restart timer
        if (!timerRef.current) {
          timerRef.current = setInterval(() => {
            setDuration(prev => prev + 1);
          }, 1000);
        }
        console.log('[useWebAudioRecorder] ▶️ Recording resumed after interruption');
      };
      mediaRecorderRef.current.onerror = (e: any) => {
        debugLog('useWebAudioRecorder.ts:onerror', 'MediaRecorder ERROR', { error: e?.error?.name || e?.message || 'unknown', state: mediaRecorderRef.current?.state }, 'E');
      };
      // Monitor track ended events (Hypothesis B)
      stream.getTracks().forEach((track, idx) => {
        track.onended = () => {
          debugLog('useWebAudioRecorder.ts:track.onended', `Track ${idx} ENDED`, { kind: track.kind, readyState: track.readyState }, 'B');
        };
        track.onmute = () => {
          debugLog('useWebAudioRecorder.ts:track.onmute', `Track ${idx} MUTED`, { kind: track.kind, enabled: track.enabled, muted: track.muted }, 'B');
        };
        track.onunmute = () => {
          debugLog('useWebAudioRecorder.ts:track.onunmute', `Track ${idx} UNMUTED`, { kind: track.kind, enabled: track.enabled, muted: track.muted }, 'B');
        };
      });
      // #endregion
      
      // 🆕 Stocker le callback pour le streaming live
      onChunkReadyCallbackRef.current = onChunkReady || null;
      chunkIndexRef.current = 0;
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log(`[useWebAudioRecorder] 📦 Chunk #${chunkIndexRef.current} ready (${(event.data.size / 1024).toFixed(2)} KB)`);
          
          // Stocker le chunk pour le blob final
          chunksRef.current.push(event.data);
          
          // 🚀 Si callback existe, envoyer le chunk immédiatement pour transcription live
          if (onChunkReadyCallbackRef.current) {
            console.log(`%c[useWebAudioRecorder] 🚀 SENDING CHUNK #${chunkIndexRef.current} TO LIVE TRANSCRIPTION`, 'color: #7c3aed; font-weight: bold');
            onChunkReadyCallbackRef.current(event.data, chunkIndexRef.current);
          }
          
          chunkIndexRef.current++;
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        // 🔧 Use the actual mimeType that was used for recording
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        console.log(`[useWebAudioRecorder] ⏹️ Recording stopped. Final blob: ${(blob.size / 1024).toFixed(2)} KB (${mimeTypeRef.current})`);
        setAudioBlob(blob);
        chunksRef.current = [];
        chunkIndexRef.current = 0;
        onChunkReadyCallbackRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
      };
      
            // 🔥 CLÉ DU STREAMING LIVE: Chunks toutes les 20 secondes !
            const CHUNK_INTERVAL_MS = 20000; // 20 secondes (balance entre latence et charge serveur)
      if (onChunkReady) {
        console.log(`%c[useWebAudioRecorder] ⚡ LIVE MODE: Generating chunks every ${CHUNK_INTERVAL_MS / 1000}s`, 'color: #f59e0b; font-weight: bold');
        mediaRecorderRef.current.start(CHUNK_INTERVAL_MS);
      } else {
        console.log(`[useWebAudioRecorder] 📦 BATCH MODE: Single blob at the end`);
        mediaRecorderRef.current.start();
      }
      
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error("❌ Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      wasInterruptedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const pauseRecording = () => {
    // #region agent log - Hypothesis A,B,E: Track pause call details
    debugLog('useWebAudioRecorder.ts:pauseRecording', 'PAUSE called', { isRecording, isPaused, wasInterrupted: wasInterruptedRef.current, mediaRecorderState: mediaRecorderRef.current?.state, timestamp: Date.now() }, 'A');
    // #endregion
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
      // Manual pause, not interruption
      wasInterruptedRef.current = false;
      // #region agent log - Hypothesis A,B,E: Confirm pause executed
      debugLog('useWebAudioRecorder.ts:pauseRecording:done', 'PAUSE executed', { newIsPaused: true, wasInterruptedNow: false, mediaRecorderState: mediaRecorderRef.current?.state }, 'A');
      // #endregion
    } else {
      // #region agent log - Hypothesis A,B,E: Pause was blocked
      debugLog('useWebAudioRecorder.ts:pauseRecording:blocked', 'PAUSE blocked - conditions not met', { isRecording, isPaused, hasMediaRecorder: !!mediaRecorderRef.current }, 'A');
      // #endregion
    }
  };

  const resumeRecording = () => {
    // #region agent log - Hypothesis A,B,E: Track resume call details
    debugLog('useWebAudioRecorder.ts:resumeRecording', 'RESUME called', { isPaused, wasInterrupted: wasInterruptedRef.current, mediaRecorderState: mediaRecorderRef.current?.state, timestamp: Date.now() }, 'A');
    // #endregion
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      // Manual resume, clear interruption flag
      wasInterruptedRef.current = false;
      // #region agent log - Hypothesis A,B,E: Confirm resume executed
      debugLog('useWebAudioRecorder.ts:resumeRecording:done', 'RESUME executed', { newIsPaused: false, wasInterruptedNow: false, mediaRecorderState: mediaRecorderRef.current?.state }, 'A');
      // #endregion
    } else {
      // #region agent log - Hypothesis A,B,E: Resume was blocked
      debugLog('useWebAudioRecorder.ts:resumeRecording:blocked', 'RESUME blocked - conditions not met', { isPaused, hasMediaRecorder: !!mediaRecorderRef.current }, 'A');
      // #endregion
    }
  };

  const resetRecorder = () => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current.stop();
      }
    }
    chunksRef.current = [];
    setAudioBlob(null);
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    wasInterruptedRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };


  // 📞 Auto-resume after interruptions (phone calls, WhatsApp, etc.)
  useEffect(() => {
    const attemptAutoResume = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused' && wasInterruptedRef.current) {
        console.log('[useWebAudioRecorder] ▶️ Auto-resuming recording after interruption');
        try {
          mediaRecorderRef.current.resume();
        } catch (error) {
          console.error('[useWebAudioRecorder] ❌ Failed to auto-resume:', error);
        }
      }
    };

    const handleVisibilityChange = () => {
      console.log('[useWebAudioRecorder] 👁️ Visibility changed:', document.visibilityState);
      if (document.visibilityState === 'visible') {
        console.log('[useWebAudioRecorder] Was interrupted?', wasInterruptedRef.current);
        console.log('[useWebAudioRecorder] MediaRecorder state:', mediaRecorderRef.current?.state);
        
        if (wasInterruptedRef.current) {
          console.log('[useWebAudioRecorder] 👁️ Page visible again after interruption - attempting auto-resume');
          // Small delay to ensure system has released audio
          setTimeout(attemptAutoResume, 500);
        }
      }
    };

    const handleFocus = () => {
      console.log('[useWebAudioRecorder] 🔍 Window focused');
      if (wasInterruptedRef.current) {
        console.log('[useWebAudioRecorder] 🔍 Focus detected after interruption - attempting auto-resume');
        setTimeout(attemptAutoResume, 500);
      }
    };

    // 🔄 Polling fallback: check every 2 seconds if we should auto-resume
    const pollingInterval = setInterval(() => {
      // #region agent log - Hypothesis B: Track polling state
      debugLog('useWebAudioRecorder.ts:polling', 'Polling check', { isRecording, wasInterrupted: wasInterruptedRef.current, mediaRecorderState: mediaRecorderRef.current?.state }, 'B');
      // #endregion
      if (isRecording && wasInterruptedRef.current && mediaRecorderRef.current?.state === 'paused') {
        // #region agent log - Hypothesis B: Auto-resume triggered!
        debugLog('useWebAudioRecorder.ts:polling:autoResume', 'AUTO-RESUME TRIGGERED BY POLLING!', { isRecording, wasInterrupted: wasInterruptedRef.current }, 'B');
        // #endregion
        console.log('[useWebAudioRecorder] 🔄 Polling detected paused state after interruption - auto-resuming');
        attemptAutoResume();
      }
    }, 2000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(pollingInterval);
    };
  }, [isRecording]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return { isRecording, isPaused, duration, audioBlob, startRecording, stopRecording, pauseRecording, resumeRecording, resetRecorder };
}; 