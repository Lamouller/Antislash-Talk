/**
 * 🏆 WhisperX Client
 * 
 * Client pour communiquer avec le service WhisperX
 * Solution ultra-performante : faster-whisper + alignement + diarization
 * 
 * Performance : 6x plus rapide que PyTorch + Pyannote
 * 
 * Utilisation :
 * - Si WhisperX est disponible (port 8082) + diarization demandée → utilise WhisperX
 * - Sinon → fallback automatique sur whisper.cpp, PyTorch ou navigateur
 */

// Type pour un segment individuel (utilisé dans les résultats et le streaming)
export interface WhisperXSegment {
  id?: number;
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
}

export interface WhisperXTranscriptionResult {
  text: string;
  segments?: Array<WhisperXSegment>;
  language?: string;
  processing_time?: {
    transcription: number;
    alignment: number;
    diarization: number;
    total: number;
  };
  backend?: string;
  model?: string;
  diarization_enabled?: boolean;
}

export interface WhisperXHealthStatus {
  status: 'ok' | 'error';
  available: boolean;
  backend: 'whisperx';
  device?: string;
  gpu_available?: boolean;
  diarization_available?: boolean;
  version?: string;
}

/**
 * URL du service WhisperX
 * Le code JS s'exécute dans le NAVIGATEUR, pas dans Docker !
 * Donc on doit utiliser localhost:8082 (port externe exposé)
 */
const WHISPERX_URL = import.meta.env.VITE_WHISPERX_URL || 'http://localhost:8082';

/**
 * Vérifie si le service WhisperX est disponible
 */
export async function checkWhisperXAvailability(): Promise<boolean> {
  console.log(`%c[WhisperX] 🔍 Checking availability at ${WHISPERX_URL}/health...`, 'color: #7c3aed; font-weight: bold');
  
  try {
    const response = await fetch(`${WHISPERX_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 secondes max
    });
    
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      console.log(`%c[WhisperX] ✅ Service AVAILABLE!`, 'color: #16a34a; font-weight: bold', data);
      return true;
    }
    
    console.warn(`%c[WhisperX] ⚠️ Service responded but NOT OK (status: ${response.status})`, 'color: #f59e0b; font-weight: bold');
    return false;
  } catch (error: any) {
    console.warn(`%c[WhisperX] ❌ Service NOT AVAILABLE`, 'color: #dc2626; font-weight: bold');
    console.info(`%c[WhisperX] 💡 To enable: docker-compose --profile whisperx up -d`, 'color: #3b82f6');
    console.debug('[WhisperX] Error details:', error);
    return false;
  }
}

/**
 * Récupère le status détaillé du service
 */
export async function getWhisperXHealth(): Promise<WhisperXHealthStatus | null> {
  try {
    const response = await fetch(`${WHISPERX_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return {
      status: 'ok',
      available: true,
      backend: 'whisperx',
      device: data.device,
      gpu_available: data.gpu_available,
      diarization_available: data.diarization_available,
      version: data.version,
    };
  } catch {
    return null;
  }
}

/**
 * Transcription avec WhisperX (ultra-rapide + diarization)
 * 
 * @param audioBlob - Audio à transcrire
 * @param options - Options de transcription
 * @param onProgress - Callback de progression (optionnel)
 * @returns Transcription complète avec diarization
 */
export async function transcribeWithWhisperX(
  audioBlob: Blob,
  options?: {
    language?: string;
    model?: string; // tiny, base, small, medium, large-v2, large-v3
    diarization?: boolean;
    min_speakers?: number;
    max_speakers?: number;
  },
  onProgress?: (progress: { status: string; progress?: number }) => void
): Promise<WhisperXTranscriptionResult> {
  
  console.log(`%c[WhisperX] 🏆 STARTING TRANSCRIPTION WITH DIARIZATION`, 'color: #7c3aed; font-weight: bold; font-size: 14px');
  console.log(`[WhisperX] 📊 Audio size: ${(audioBlob.size / 1024).toFixed(2)} KB`);
  console.log(`[WhisperX] 🌍 Language: ${options?.language || 'auto'}`);
  console.log(`[WhisperX] 🎭 Diarization: ${options?.diarization !== false}`);
  console.log(`[WhisperX] 📦 Model: ${options?.model || 'base'}`);
  
  onProgress?.({ status: 'Checking WhisperX availability...', progress: 5 });
  
  // 1. Vérifier que le service est disponible
  const startCheck = Date.now();
  const isAvailable = await checkWhisperXAvailability();
  console.log(`[WhisperX] ⏱️ Health check took ${Date.now() - startCheck}ms`);
  
  if (!isAvailable) {
    throw new Error('WhisperX service is not available. Start it with: docker-compose --profile whisperx up -d');
  }
  
  onProgress?.({ status: 'Uploading audio to WhisperX...', progress: 15 });
  console.log(`[WhisperX] 📤 Uploading to ${WHISPERX_URL}/transcribe...`);
  
  // 2. Préparer le FormData
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  
  // Options de transcription
  if (options?.language) {
    formData.append('language', options.language);
  }
  
  if (options?.model) {
    formData.append('model', options.model);
  }
  
  // Diarization activée par défaut
  formData.append('diarization', String(options?.diarization !== false));
  
  if (options?.min_speakers !== undefined) {
    formData.append('min_speakers', String(options.min_speakers));
  }
  
  if (options?.max_speakers !== undefined) {
    formData.append('max_speakers', String(options.max_speakers));
  }
  
  onProgress?.({ status: 'Transcribing with WhisperX (faster-whisper)...', progress: 30 });
  
  // 3. Envoyer la requête de transcription
  const startTranscription = Date.now();
  console.log('[WhisperX] 🎙️ Sending transcription request...');
  
  const response = await fetch(`${WHISPERX_URL}/transcribe`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(300000), // 5 minutes timeout
  });
  
  const transcriptionTime = Date.now() - startTranscription;
  console.log(`[WhisperX] ⏱️ Total processing took ${(transcriptionTime / 1000).toFixed(2)}s`);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`%c[WhisperX] ❌ TRANSCRIPTION FAILED`, 'color: #dc2626; font-weight: bold');
    console.error('[WhisperX] Error:', errorText);
    throw new Error(`WhisperX transcription failed: ${errorText}`);
  }
  
  onProgress?.({ status: 'Processing results...', progress: 90 });
  
  const result: WhisperXTranscriptionResult = await response.json();
  
  onProgress?.({ status: 'Transcription complete!', progress: 100 });
  
  console.log(`%c[WhisperX] ✅ TRANSCRIPTION COMPLETED!`, 'color: #16a34a; font-weight: bold; font-size: 14px');
  console.log(`[WhisperX] 📝 Text length: ${result.text?.length || 0} characters`);
  console.log(`[WhisperX] 🎯 Segments: ${result.segments?.length || 0}`);
  console.log(`[WhisperX] 🎭 Diarization: ${result.diarization_enabled ? '✅' : '❌'}`);
  
  if (result.processing_time) {
    console.log(`[WhisperX] ⏱️ Breakdown:`, result.processing_time);
    console.log(`[WhisperX] ⚡ Performance: ${((audioBlob.size / 1024) / result.processing_time.total).toFixed(2)} KB/s`);
  }
  
  // Compter les locuteurs uniques
  if (result.segments && result.diarization_enabled) {
    const speakers = new Set(result.segments.map(s => s.speaker).filter(s => s));
    console.log(`[WhisperX] 👥 Speakers detected: ${speakers.size}`);
  }
  
  return result;
}

/**
 * Détection automatique du meilleur backend disponible pour diarization
 */
export async function detectOptimalDiarizationBackend(): Promise<{
  backend: 'whisperx' | 'pytorch' | 'none';
  available: boolean;
  url?: string;
  estimatedSpeed?: string;
  supportsRealtime?: boolean;
}> {
  
  // 1️⃣ Essayer WhisperX (le plus rapide pour diarization)
  const whisperXHealth = await getWhisperXHealth();
  if (whisperXHealth?.status === 'ok' && whisperXHealth.diarization_available) {
    return {
      backend: 'whisperx',
      available: true,
      url: WHISPERX_URL,
      estimatedSpeed: whisperXHealth.gpu_available ? '30-40s per minute' : '45-60s per minute',
      supportsRealtime: false,
    };
  }
  
  // 2️⃣ Fallback sur PyTorch (plus lent mais fonctionne)
  try {
    const PYTORCH_URL = import.meta.env.VITE_PYTORCH_SERVICE_URL || 'http://localhost:8000';
    const response = await fetch(`${PYTORCH_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.diarization) {
        return {
          backend: 'pytorch',
          available: true,
          url: PYTORCH_URL,
          estimatedSpeed: '180-240s per minute',
          supportsRealtime: false,
        };
      }
    }
  } catch {
    console.log('⚠️ PyTorch service not available or diarization disabled');
  }
  
  // 3️⃣ Aucune solution de diarization disponible
  return {
    backend: 'none',
    available: false,
    estimatedSpeed: 'N/A',
    supportsRealtime: false,
  };
}

/**
 * 🚀 STREAMING: Transcription en temps réel avec Server-Sent Events (SSE)
 * 
 * Cette fonction envoie l'audio et reçoit les segments au fur et à mesure
 * qu'ils sont transcrits, permettant une UX "wahoo" en direct !
 * 
 * @param audioBlob - Audio à transcrire
 * @param options - Options de transcription
 * @param onSegment - Callback appelé pour chaque segment reçu en temps réel
 * @param onProgress - Callback de progression (optionnel)
 * @returns Transcription complète une fois terminée
 */
export async function transcribeWithWhisperXStreaming(
  audioBlob: Blob,
  options?: {
    language?: string;
    model?: string;
    diarization?: boolean;
  },
  onSegment?: (segment: WhisperXSegment) => void,
  onProgress?: (progress: { status: string; progress?: number }) => void
): Promise<WhisperXTranscriptionResult> {
  
  console.log(`%c[WhisperX] 🚀 STARTING STREAMING TRANSCRIPTION`, 'color: #7c3aed; font-weight: bold; font-size: 16px');
  console.log(`[WhisperX] 📊 Audio size: ${(audioBlob.size / 1024).toFixed(2)} KB`);
  console.log(`[WhisperX] 🎭 Diarization: ${options?.diarization !== false}`);
  
  onProgress?.({ status: 'Uploading audio for streaming...', progress: 5 });
  
  // 1. Préparer le FormData
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('language', options?.language || 'fr');
  formData.append('model', options?.model || 'base');
  formData.append('diarization', String(options?.diarization !== false));
  
  console.log('[WhisperX] 📤 Uploading to streaming endpoint...');
  onProgress?.({ status: 'Starting real-time transcription...', progress: 10 });
  
  // 2. Envoyer la requête de transcription en streaming
  const response = await fetch(`${WHISPERX_URL}/transcribe-stream`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`%c[WhisperX] ❌ STREAMING FAILED`, 'color: #dc2626; font-weight: bold');
    throw new Error(`WhisperX streaming failed: ${errorText}`);
  }
  
  console.log(`%c[WhisperX] 🎬 STREAMING STARTED - listening for events...`, 'color: #7c3aed; font-weight: bold');
  
  // 3. Parser les événements Server-Sent Events (SSE)
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  const segments: WhisperXSegment[] = [];
  let fullText = '';
  let buffer = '';
  
  if (!reader) {
    throw new Error('Response body reader not available');
  }
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log(`%c[WhisperX] 🏁 STREAMING COMPLETE`, 'color: #16a34a; font-weight: bold');
        break;
      }
      
      // Décoder les données reçues
      buffer += decoder.decode(value, { stream: true });
      
      // Parser les événements SSE (format: event: type\ndata: json\n\n)
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Garder la dernière ligne incomplète
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const eventMatch = line.match(/^event:\s*(.+)/m);
        const dataMatch = line.match(/^data:\s*(.+)/m);
        
        if (eventMatch && dataMatch) {
          const eventType = eventMatch[1].trim();
          const eventData = JSON.parse(dataMatch[1].trim());
          
          // Gérer les différents types d'événements
          switch (eventType) {
            case 'progress':
              console.log(`[WhisperX] 📊 Progress: ${eventData.status} (${eventData.progress || 0}%)`);
              onProgress?.({ 
                status: eventData.status, 
                progress: eventData.progress || 0 
              });
              break;
              
            case 'segment':
              console.log(`%c[WhisperX] 🎤 NEW SEGMENT:`, 'color: #16a34a; font-weight: bold', eventData);
              
              const segment: WhisperXSegment = {
                text: eventData.text || '',
                start: eventData.start || 0,
                end: eventData.end || 0,
                speaker: eventData.speaker || null,
              };
              
              segments.push(segment);
              fullText += (fullText ? ' ' : '') + segment.text;
              
              // Appeler le callback en temps réel ! 🔥
              if (onSegment) {
                onSegment(segment);
              }
              break;
              
            case 'complete':
              console.log(`%c[WhisperX] ✅ TRANSCRIPTION COMPLETE!`, 'color: #16a34a; font-weight: bold; font-size: 14px');
              console.log(`[WhisperX] 📝 Total segments: ${eventData.total_segments || segments.length}`);
              onProgress?.({ status: 'Transcription complete!', progress: 100 });
              break;
              
            case 'error':
              console.error(`%c[WhisperX] ❌ STREAMING ERROR`, 'color: #dc2626; font-weight: bold');
              throw new Error(eventData.detail || 'Unknown streaming error');
              
            default:
              console.warn('[WhisperX] ⚠️ Unknown event type:', eventType);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  // 4. Retourner le résultat complet
  const result: WhisperXTranscriptionResult = {
    text: fullText,
    segments: segments.map((s, id) => ({ ...s, id })),
    language: options?.language || 'fr',
    diarization_enabled: options?.diarization !== false,
  };
  
  console.log(`%c[WhisperX] 🎉 STREAMING COMPLETE!`, 'color: #16a34a; font-weight: bold; font-size: 16px');
  console.log(`[WhisperX] 📝 Final text length: ${result.text.length} chars`);
  console.log(`[WhisperX] 🎯 Final segments: ${result.segments?.length || 0}`);
  
  return result;
}

/**
 * Export de l'URL pour utilisation externe
 */
export { WHISPERX_URL };
