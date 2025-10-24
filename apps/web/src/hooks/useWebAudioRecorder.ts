import { useState, useRef, useEffect } from 'react';

// 🆕 Type pour le callback de chunk live
export type OnChunkReadyCallback = (chunk: Blob, chunkIndex: number) => void;

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
      mediaRecorderRef.current = new MediaRecorder(stream);
      
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
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log(`[useWebAudioRecorder] ⏹️ Recording stopped. Final blob: ${(blob.size / 1024).toFixed(2)} KB`);
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
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };


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