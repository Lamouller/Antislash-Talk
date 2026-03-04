import { useState, useRef, useCallback } from 'react';
import { useOllama } from './useOllama';
import { useAI } from './useAI';
import {
  checkWhisperXAvailability,
  transcribeWithWhisperX as transcribeWithWhisperXClient,
  transcribeWithWhisperXStreaming as transcribeWithWhisperXStreamingClient,
  type WhisperXSegment
} from '../lib/whisperx-client';

// WebGPU type declarations for TypeScript
declare global {
  interface Navigator {
    gpu?: GPU;
    deviceMemory?: number; // GB
    hardwareConcurrency?: number; // CPU cores
  }

  interface GPU {
    requestAdapter(): Promise<GPUAdapter | null>;
  }

  interface GPUAdapter {
    requestDevice(): Promise<GPUDevice | null>;
    limits?: {
      maxBufferSize?: number;
      maxStorageBufferBindingSize?: number;
    };
  }

  interface GPUDevice {
    limits: {
      maxBufferSize: number;
      maxStorageBufferBindingSize: number;
    };
    destroy(): void;
  }
}

// Known Whisper hallucination phrases (lowercased for comparison)
const HALLUCINATION_PHRASES = [
  'merci d\'avoir regardé',
  'merci de votre attention',
  'sous-titres réalisés',
  'sous-titrage',
  'thanks for watching',
  'thank you for watching',
  'please subscribe',
  'like and subscribe',
  'don\'t forget to subscribe',
  'n\'oubliez pas de vous abonner',
  'abonnez-vous',
  'see you next time',
  'à la prochaine',
  'rendez-vous au prochain épisode',
  'sous-titres par',
  'subtitles by',
  'copyright',
  'all rights reserved',
];

// Post-process to remove repetitive patterns (hallucinations)
const cleanHallucinations = (text: string): string => {
  if (!text) return '';

  // Split by sentence-ending punctuation and filter out empty strings
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const cleanSentences: string[] = [];
  let lastSentence = '';

  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const lastNormalized = lastSentence.toLowerCase().replace(/[^\w\s]/g, '').trim();

    // Skip repeated sentences
    if (normalized === lastNormalized) {
      continue;
    }

    // Skip known hallucination phrases
    if (HALLUCINATION_PHRASES.some(phrase => normalized.includes(phrase))) {
      console.warn(`🚨 Hallucination phrase filtered: "${sentence}"`);
      continue;
    }

    // Skip segments containing music symbols
    if (/[♪♫🎵🎶🎤🎧]/.test(sentence)) {
      console.warn(`🚨 Music symbol segment filtered: "${sentence}"`);
      continue;
    }

    // Skip segments that are just punctuation, ellipsis, or single characters
    const strippedText = sentence.replace(/[.\s,;:!?\-…]/g, '').trim();
    if (strippedText.length < 2) {
      continue;
    }

    cleanSentences.push(sentence);
    lastSentence = sentence;
  }

  // If we removed too much (>90% repetition), it's likely a hallucination
  if (cleanSentences.length < sentences.length * 0.1 && sentences.length > 5) {
    console.warn('🚨 High repetition detected - likely hallucination. Consider using a larger model or cloud transcription.');
    return `[Erreur: transcription répétitive détectée. Essayez un modèle plus gros ou la transcription cloud.]`;
  }

  return cleanSentences.join('. ') + (cleanSentences.length > 0 ? '.' : '');
};

// Check if a model is a Voxtral model (now exclusively in mistral provider)
const isVoxtralModel = (modelId: string): boolean => {
  return modelId.includes('voxtral') || modelId === 'voxtral-small' || modelId === 'voxtral-mini';
};

// Manage Mistral API key securely
const getMistralApiKey = (): string | null => {
  // Priority 1: Environment variable (for production)
  const envKey = import.meta.env.VITE_MISTRAL_API_KEY;
  if (envKey) return envKey;

  // Priority 2: Local storage (for development/user convenience)
  const localKey = localStorage.getItem('mistral_api_key');
  if (localKey) return localKey;

  return null;
};

const storeMistralApiKey = (apiKey: string): void => {
  // Store in local storage for convenience
  // Note: In production, this should ideally be stored server-side securely
  localStorage.setItem('mistral_api_key', apiKey);
  console.log('🔐 Mistral API key stored locally for Voxtral access');
};

const clearMistralApiKey = (): void => {
  localStorage.removeItem('mistral_api_key');
  console.log('🗑️ Mistral API key cleared from local storage');
};

// Transcribe using Mistral API for Voxtral models
const transcribeWithVoxtral = async (
  audioBlob: Blob,
  modelId: string,
  onProgress?: (progress: number) => void
): Promise<LocalTranscriptionResult> => {
  console.log('🎯 Using Voxtral via Mistral API...');

  if (onProgress) onProgress(20);

  // Get API key from environment or user settings
  const apiKey = getMistralApiKey();
  if (!apiKey) {
    throw new Error(`🔑 Mistral API key required for Voxtral models!

🎯 VOXTRAL offers advanced cloud-powered features:
• Superior transcription quality (beats Whisper)
• Built-in Q&A and semantic understanding  
• Function calling from voice
• Native multilingual support

📋 TO USE VOXTRAL:
1. Get API key from: https://console.mistral.ai
2. Go to Settings → API Keys → Add Mistral key
3. Select "Mistral" provider in Transcription Settings
4. Choose Voxtral Small or Mini model

🔒 PREFER 100% LOCAL PRIVACY? 
Switch to "Local" provider and choose Whisper or Moonshine models!`);
  }

  if (onProgress) onProgress(40);

  // Convert audio blob to base64 for API
  const arrayBuffer = await audioBlob.arrayBuffer();
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  if (onProgress) onProgress(60);

  try {
    const response = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId.includes('Mini') ? 'voxtral-mini' : 'voxtral-small',
        audio: base64Audio,
        language: 'fr', // French by default
        response_format: 'verbose_json',
        temperature: 0.0, // Deterministic output
      }),
    });

    if (onProgress) onProgress(80);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Mistral API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }

    const result = await response.json();

    if (onProgress) onProgress(100);

    console.log('✅ Voxtral transcription completed via Mistral API');

    // Convert Mistral API response to our format
    const transcriptionResult: LocalTranscriptionResult = {
      text: cleanHallucinations(result.text || ''),
      chunks: result.segments?.map((segment: any, index: number) => ({
        start: segment.start || 0,
        end: segment.end || 0,
        speaker: `Speaker_${index + 1}`,
        text: cleanHallucinations(segment.text || ''),
      })) || []
    };

    return transcriptionResult;

  } catch (error: any) {
    console.error('❌ Voxtral API transcription failed:', error);
    if (error.message.includes('401') || error.message.includes('API key')) {
      throw new Error('Invalid Mistral API key. Please check your API key in settings.');
    } else if (error.message.includes('429')) {
      throw new Error('Mistral API rate limit exceeded. Please try again later.');
    } else if (error.message.includes('413')) {
      throw new Error('Audio file too large for Voxtral API. Try a shorter audio file.');
    } else {
      throw new Error(`Voxtral transcription failed: ${error.message}. Try cloud transcription as fallback.`);
    }
  }
};

export interface DeviceBenchmark {
  webGPUSupported: boolean;
  estimatedMemoryGB: number;
  cpuCores: number;
  maxBufferSizeMB: number;
  recommendedModel: string;
  deviceClass: 'high-end' | 'mid-range' | 'low-end';
  canRunLargeModels: boolean;
}

export interface LocalTranscriptionResult {
  text: string;
  chunks?: Array<{
    start: number;
    end: number;
    speaker: string;
    text: string;
  }>;
}

export interface UseLocalTranscriptionReturn {
  isTranscribing: boolean;
  progress: number;
  error: string | null;
  benchmark: DeviceBenchmark | null;
  transcribe: (audioBlob: Blob, modelId: string) => Promise<LocalTranscriptionResult>;
  transcribeStreaming: (audioBlob: Blob, modelId: string, onSegmentReceived?: (segment: { text: string; start: number; end: number; speaker?: string | null }) => void) => Promise<LocalTranscriptionResult>; // 🆕 STREAMING
  transcribeChunkLive: (chunk: Blob, chunkIndex: number, onSegmentReceived: (segment: { text: string; start: number; end: number; speaker?: string | null }) => void) => Promise<void>; // 🚀 LIVE CHUNK STREAMING
  cancelTranscription: () => void;
  runBenchmark: () => Promise<DeviceBenchmark>;
  enhanceWithLocalLLM: (transcript: string, prompts: { title?: string, summary?: string, transcript?: string }, ollamaModel?: string) => Promise<{ title: string, summary: string, enhancedTranscript?: any }>;
  // AI generation (Ollama, OpenAI, Gemini)
  generateTitle: (text: string, customPrompt?: string) => Promise<string>;
  generateSummary: (text: string, customPrompt?: string) => Promise<string>;
  generateSummaryStream: (text: string, customPrompt?: string, onChunk?: (chunk: string) => void) => Promise<string>; // 🚀 Streaming
  generateTitleAndSummaryParallel: (transcript: string, titlePrompt?: string, summaryPrompt?: string, onSummaryChunk?: (chunk: string) => void) => Promise<{ title: string; summary: string }>; // ⚡ Parallel
  // Voxtral API key management
  getMistralApiKey: () => string | null;
  storeMistralApiKey: (apiKey: string) => void;
  clearMistralApiKey: () => void;
  hasVoxtralAccess: boolean;
  // Backend availability checks
  checkWhisperXAvailability: () => Promise<boolean>;
}

export function useLocalTranscription(): UseLocalTranscriptionReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [benchmark, setBenchmark] = useState<DeviceBenchmark | null>(null);
  const transcriptionRef = useRef<any>(null);

  // Hook Ollama pour génération locale de titre/résumé
  const ollama = useOllama();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Comprehensive device benchmark
  const runBenchmark = useCallback(async (): Promise<DeviceBenchmark> => {
    console.log('🔬 Running device performance benchmark...');

    const benchmark: DeviceBenchmark = {
      webGPUSupported: false,
      estimatedMemoryGB: 4, // Default fallback
      cpuCores: navigator.hardwareConcurrency || 4,
      maxBufferSizeMB: 0,
      recommendedModel: 'Xenova/whisper-tiny',
      deviceClass: 'low-end',
      canRunLargeModels: false
    };

    // Check WebGPU support and capabilities
    if (navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          benchmark.webGPUSupported = true;

          try {
            const device = await adapter.requestDevice();
            if (device) {
              // Get actual GPU limits
              benchmark.maxBufferSizeMB = Math.floor(device.limits.maxBufferSize / (1024 * 1024));
              device.destroy();
              console.log(`🍎 WebGPU max buffer: ${benchmark.maxBufferSizeMB}MB`);
            }
          } catch (deviceError) {
            console.warn('Could not get GPU device details:', deviceError);
          }
        }
      } catch (error) {
        console.warn('WebGPU adapter request failed:', error);
      }
    }

    // Estimate memory from various sources
    if (navigator.deviceMemory) {
      benchmark.estimatedMemoryGB = navigator.deviceMemory;
    } else {
      // Estimate based on other indicators
      const userAgent = navigator.userAgent;
      if (userAgent.includes('M1') || userAgent.includes('M2') || userAgent.includes('M3') || userAgent.includes('M4')) {
        benchmark.estimatedMemoryGB = 16; // Most M-series Macs have 16GB+
      } else if (userAgent.includes('Mac')) {
        benchmark.estimatedMemoryGB = 8; // Older Macs
      } else if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
        benchmark.estimatedMemoryGB = 6; // Mobile devices
      }
    }

    // Device classification and model recommendation
    const isAppleSilicon = navigator.userAgent.includes('Mac') && (
      navigator.userAgent.includes('M1') || navigator.userAgent.includes('M2') ||
      navigator.userAgent.includes('M3') || navigator.userAgent.includes('M4')
    );

    if (benchmark.webGPUSupported && benchmark.estimatedMemoryGB >= 16 && benchmark.cpuCores >= 8) {
      benchmark.deviceClass = 'high-end';
      benchmark.canRunLargeModels = false; // Conservative: even high-end has issues with large models in browser
      if (isAppleSilicon) {
        benchmark.recommendedModel = 'distil-whisper/distil-large-v3.5'; // Best local model for Apple Silicon
      } else {
        benchmark.recommendedModel = 'Xenova/whisper-base'; // Conservative for non-Apple
      }
    } else if (benchmark.webGPUSupported && benchmark.estimatedMemoryGB >= 8 && benchmark.cpuCores >= 4) {
      benchmark.deviceClass = 'mid-range';
      benchmark.canRunLargeModels = false;
      if (isAppleSilicon) {
        benchmark.recommendedModel = 'Xenova/whisper-base'; // Good balance for mid-range Apple Silicon
      } else {
        benchmark.recommendedModel = 'Xenova/whisper-tiny'; // Conservative for other devices
      }
    } else {
      benchmark.deviceClass = 'low-end';
      benchmark.canRunLargeModels = false;
      benchmark.recommendedModel = 'onnx-community/moonshine-tiny-ONNX'; // Most compatible
    }

    console.log('📊 Device benchmark results:', {
      class: benchmark.deviceClass,
      memory: `${benchmark.estimatedMemoryGB}GB`,
      cores: benchmark.cpuCores,
      webGPU: benchmark.webGPUSupported,
      maxBuffer: `${benchmark.maxBufferSizeMB}MB`,
      recommended: benchmark.recommendedModel
    });

    setBenchmark(benchmark);
    return benchmark;
  }, []);

  // Check WebGPU support (simplified version for compatibility)
  const checkWebGPUSupport = useCallback(async () => {
    if (!navigator.gpu) {
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }, []);

  const transcribe = useCallback(async (audioBlob: Blob, modelId: string): Promise<LocalTranscriptionResult> => {
    return new Promise(async (resolve, reject) => {
      try {
        setIsTranscribing(true);
        setProgress(5);
        setError(null);

        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        console.log('🚀 Starting local transcription with model:', modelId);

        // Check if this is a Voxtral model - if so, use Mistral API
        if (isVoxtralModel(modelId)) {
          console.log('🎯 Detected Voxtral model, using Mistral API...');
          const result = await transcribeWithVoxtral(audioBlob, modelId, setProgress);
          resolve(result);
          return;
        }

        // ============================================
        // INTELLIGENT ROUTING - Priorité optimale
        // ============================================
        console.log(`[transcription] 📋 Model selected: ${modelId}`);

        // Modèles compatibles avec WhisperX
        const whisperXCompatibleModels = [
          'Xenova/whisper-tiny',
          'Xenova/whisper-tiny+diarization',
          'Xenova/whisper-base',
          'Xenova/whisper-base+diarization',
          'Xenova/whisper-small',
          'Xenova/whisper-small.fr',
          'Xenova/whisper-medium',
          'Xenova/whisper-medium+diarization',
          'distil-whisper/distil-large-v3',
          'openai/whisper-large-v3',
          'Xenova/whisper-large-v2',
          'bofenghuang/whisper-large-v2-french'
        ];

        const isWhisperXCompatible = whisperXCompatibleModels.some(model =>
          modelId.includes(model) || modelId === model
        );

        // Détection de la demande de diarization
        const needsDiarization = modelId.includes('diarization') || modelId.includes('+diarization');

        console.log(`[transcription] 🔍 Routing check:`, {
          whisperX: isWhisperXCompatible,
          needsDiarization,
          willUseWhisperX: needsDiarization && isWhisperXCompatible
        });

        // 🏆 PRIORITÉ 1: WhisperX (si diarization demandée ET compatible)
        if (needsDiarization && isWhisperXCompatible) {
          console.log('[transcription] 🏆 Diarization needed, checking WhisperX...');
          try {
            const isWhisperXAvailable = await checkWhisperXAvailability();

            console.log(`[transcription] 🔍 WhisperX available? ${isWhisperXAvailable}`);

            if (isWhisperXAvailable) {
              console.log(`%c[transcription] 🏆 USING WHISPERX - DIARIZATION MODE!`, 'color: #7c3aed; font-weight: bold; font-size: 14px; background: #ede9fe; padding: 4px 8px; border-radius: 4px');
              setProgress(10);

              const startTime = Date.now();
              const result = await transcribeWithWhisperXClient(
                audioBlob,
                {
                  language: 'fr',
                  model: 'base', // Peut être ajusté selon le modèle
                  diarization: true,
                },
                (progressUpdate) => {
                  setProgress(progressUpdate.progress || 0);
                }
              );

              const totalTime = Date.now() - startTime;
              console.log(`%c[transcription] ⚡ COMPLETED IN ${(totalTime / 1000).toFixed(2)}s`, 'color: #16a34a; font-weight: bold');

              // Convert to our format
              const transcriptionResult: LocalTranscriptionResult = {
                text: cleanHallucinations(result.text || ''),
                chunks: result.segments?.map((seg) => ({
                  start: seg.start || 0,
                  end: seg.end || 0,
                  speaker: seg.speaker || `Locuteur_01`,
                  text: cleanHallucinations(seg.text || ''),
                })) || []
              };

              setProgress(100);
              setIsTranscribing(false);
              console.log(`%c[transcription] 🎉 SUCCESS! Text: ${transcriptionResult.text.length} chars`, 'color: #16a34a; font-weight: bold');
              resolve(transcriptionResult);
              return;
            } else {
              console.log('⚠️ WhisperX not available, falling back to PyTorch...');
            }
          } catch (whisperXError) {
            console.warn(`%c[transcription] ⚠️ WhisperX FAILED, falling back...`, 'color: #f59e0b; font-weight: bold');
            console.error('[transcription] WhisperX error:', whisperXError);
            // Continue to PyTorch fallback
          }
        }

        // Check if this model requires PyTorch server (Medium, Large, Large v2, Large v3, Large FR)
        const requiresServer =
          modelId === 'Xenova/whisper-medium' ||
          modelId === 'Xenova/whisper-medium+diarization' ||
          modelId === 'Xenova/whisper-large-v2' ||
          modelId === 'openai/whisper-large-v3' ||
          modelId === 'bofenghuang/whisper-large-v2-french';

        if (requiresServer) {
          console.log('🖥️ Detected SERVER model, using PyTorch service...');
          setProgress(20);

          try {
            // Call PyTorch service
            // Le code JS s'exécute dans le NAVIGATEUR, pas dans Docker !
            const PYTORCH_SERVICE_URL = import.meta.env.VITE_PYTORCH_SERVICE_URL || 'http://localhost:8000';

            // Check if PyTorch service is available
            const healthCheck = await fetch(`${PYTORCH_SERVICE_URL}/health`, {
              method: 'GET',
              signal: AbortSignal.timeout(5000),
            });

            if (!healthCheck.ok) {
              throw new Error('PyTorch service not available');
            }

            console.log('✅ PyTorch service is available');
            setProgress(40);

            // Prepare FormData for upload
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.webm');
            formData.append('language', 'fr');

            // Map model ID to PyTorch model name
            let pytorchModelName = 'medium';
            if (modelId.includes('large-v3')) {
              pytorchModelName = 'large-v3';
            } else if (modelId.includes('large-v2') || modelId.includes('french')) {
              pytorchModelName = 'large-v2';
            } else if (modelId.includes('medium')) {
              pytorchModelName = 'medium';
            }

            // Enable diarization for models that support it
            const enableDiarization = modelId.includes('diarization') || modelId.includes('large-v3');

            formData.append('model', pytorchModelName);
            formData.append('enable_diarization', enableDiarization ? 'true' : 'false');

            console.log(`🎯 Transcribing with PyTorch model: ${pytorchModelName}${enableDiarization ? ' + DIARIZATION 🎭' : ''}`);
            setProgress(60);

            const response = await fetch(`${PYTORCH_SERVICE_URL}/transcribe`, {
              method: 'POST',
              body: formData,
              signal: AbortSignal.timeout(600000), // 10 minutes timeout (modèle large-v3 + diarization)
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`PyTorch transcription failed: ${errorText}`);
            }

            const result = await response.json();
            setProgress(90);

            console.log(`✅ PyTorch transcription completed in ${result.processing_time}s`);

            // Convert PyTorch response to our format
            const transcriptionResult: LocalTranscriptionResult = {
              text: cleanHallucinations(result.transcript || ''),
              chunks: result.segments?.map((seg: any, idx: number) => ({
                start: seg.start || 0,
                end: seg.end || 0,
                speaker: result.speakers?.find((s: any) =>
                  s.start <= seg.start && s.end >= seg.end
                )?.speaker || `Locuteur_${String((idx % 3) + 1).padStart(2, '0')}`,
                text: cleanHallucinations(seg.text || ''),
              })) || []
            };

            setProgress(100);
            setIsTranscribing(false);
            console.log('🎉 Server-side transcription completed successfully!');
            resolve(transcriptionResult);
            return;

          } catch (serverError: any) {
            console.error('❌ PyTorch service error:', serverError);

            // Check if it's a connection error
            if (serverError.message.includes('Failed to fetch') || serverError.message.includes('not available')) {
              const errorMsg = `⚠️ Le service PyTorch n'est pas démarré.

🚀 Pour utiliser les modèles lourds (Medium, Large), démarrez le service:
   docker-compose -f docker-compose.monorepo.yml --profile pytorch up -d

💡 Alternatives:
   • Utilisez un modèle léger (Whisper Tiny/Base, Moonshine)
   • Utilisez la transcription cloud (OpenAI/Google)`;

              setError(errorMsg);
              setIsTranscribing(false);
              reject(new Error(errorMsg));
              return;
            } else {
              throw serverError;
            }
          }
        }

        // Check WebGPU support first
        const webGPUSupported = await checkWebGPUSupport();
        const device = webGPUSupported ? 'webgpu' : 'wasm';

        console.log(`🔧 Hardware acceleration: ${webGPUSupported ? '✅ WebGPU (Apple Silicon GPU)' : '⚠️ WASM (CPU only)'}`);

        if (webGPUSupported) {
          console.log('🍎 Utilizing Apple Silicon GPU through WebGPU for maximum performance!');
        } else {
          console.log('💻 Falling back to CPU processing (slower but still works)');
        }

        // Check model size and warn user about heavy models
        const modelSizeWarning = {
          'Xenova/whisper-medium': '769MB - May be slower on WebGPU',
          'Xenova/whisper-large-v2': '1.5GB - Very likely to fail',
          'distil-whisper/distil-large-v3.5': '756MB - Optimized for WebGPU'
        };

        if (modelSizeWarning[modelId as keyof typeof modelSizeWarning]) {
          console.warn(`⚠️ Large model notice: ${modelId} (${modelSizeWarning[modelId as keyof typeof modelSizeWarning]})`);
        }

        // If no benchmark run yet, run it now
        let currentBenchmark = benchmark;
        if (!currentBenchmark) {
          console.log('🔬 Running performance benchmark...');
          currentBenchmark = await runBenchmark();
        }

        // Check if model is appropriate for device
        const isLargeModel = modelId.includes('medium') || modelId.includes('large') || modelId.includes('distil-large');
        if (isLargeModel && !currentBenchmark.canRunLargeModels) {
          console.warn(`⚠️ Model ${modelId} may be too large for your device (${currentBenchmark.deviceClass})`);
          console.warn(`💡 Recommended model: ${currentBenchmark.recommendedModel}`);
        }

        // Load Transformers.js library
        console.log('📦 Loading Transformers.js library...');
        const transformers = await import('@huggingface/transformers');
        console.log('✅ Transformers.js loaded successfully');

        setProgress(15);

        console.log('🤖 Initializing speech recognition pipeline...');

        // Use cached model or create new one with WebGPU support
        if (!transcriptionRef.current || transcriptionRef.current.modelId !== modelId || transcriptionRef.current.device !== device) {
          console.log(`⬇️ Loading model: ${modelId} with ${device.toUpperCase()}`);
          setProgress(20);

          try {
            // Create pipeline with WebGPU support
            // Use more conservative settings for better compatibility
            const isLargeModel = modelId.includes('medium') || modelId.includes('large') || modelId.includes('distil-large');

            // For WebGPU, use more conservative dtype settings to avoid execution errors
            let dtype;
            if (webGPUSupported) {
              if (isLargeModel) {
                // Large models: use quantized to reduce memory pressure
                dtype = { encoder_model: 'fp32' as const, decoder_model_merged: 'q4' as const };
              } else {
                // Small models: use fp32 for both to avoid WebGPU precision issues
                dtype = { encoder_model: 'fp32' as const, decoder_model_merged: 'fp32' as const };
              }
            } else {
              // WASM: always use quantized to save memory
              dtype = { encoder_model: 'fp32' as const, decoder_model_merged: 'q4' as const };
            }

            console.log(`🔧 Using dtype configuration:`, dtype, `for model size: ${isLargeModel ? 'LARGE' : 'SMALL'}, device: ${device.toUpperCase()}`);

            const transcriber = await transformers.pipeline('automatic-speech-recognition', modelId, {
              dtype: dtype,
              device: device, // This will use WebGPU if supported, fallback to WASM
            });

            transcriptionRef.current = {
              modelId,
              device,
              transcriber
            };
            console.log(`✅ Model loaded successfully with ${device.toUpperCase()}!`);
          } catch (modelError: any) {
            console.error('❌ Model loading failed:', modelError);

            // Provide specific error messages
            if (modelError.message.includes('404') || modelError.message.includes('Not Found')) {
              throw new Error('Model not found on Hugging Face. Please try a different model or use cloud transcription.');
            } else if (modelError.message.includes('out of memory') || modelError.message.includes('failed to allocate') || modelError.message.includes('buffer')) {
              const recommendedMsg = currentBenchmark ? ` Try ${currentBenchmark.recommendedModel} instead.` : ' Try a smaller model.';
              throw new Error(`Model too large for your device (${modelId}).${recommendedMsg} Or use cloud transcription for guaranteed results.`);
            } else if (modelError.message.includes('WebGPU') || device === 'webgpu') {
              console.log('🔄 WebGPU failed, falling back to WASM...');
              // Retry with WASM
              try {
                const transcriber = await transformers.pipeline('automatic-speech-recognition', modelId, {
                  dtype: {
                    encoder_model: 'fp32' as const,
                    decoder_model_merged: 'q4' as const,
                  },
                  device: 'wasm',
                });

                transcriptionRef.current = {
                  modelId,
                  device: 'wasm',
                  transcriber
                };
                console.log('✅ Model loaded successfully with WASM fallback!');
              } catch (fallbackError: any) {
                throw new Error(`Model loading failed: ${fallbackError.message}. Try cloud transcription for more reliability.`);
              }
            } else {
              throw new Error(`Model loading failed: ${modelError.message}. Try cloud transcription for more reliability.`);
            }
          }
        } else {
          console.log(`♻️ Using cached model with ${device.toUpperCase()}`);
        }

        setProgress(60);

        console.log('🎵 Processing audio file...');

        // Convert Blob to URL for read_audio
        const audioUrl = URL.createObjectURL(audioBlob);

        try {
          // Check if we were cancelled
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Transcription cancelled');
          }

          // Use read_audio to properly process the audio data
          console.log('🔊 Reading and resampling audio...');
          const audioData = await transformers.read_audio(audioUrl, 16000);

          setProgress(70);

          // Check if we were cancelled
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Transcription cancelled');
          }

          const currentDevice = transcriptionRef.current.device;
          console.log(`🎙️ Starting transcription process with ${currentDevice.toUpperCase()}...`);

          try {
            const result = await transcriptionRef.current.transcriber(audioData, {
              return_timestamps: true,
              language: 'french',
              task: 'transcribe',
              chunk_length_s: 30, // Process in 30-second chunks
              stride_length_s: 5,  // 5-second overlap
              // Anti-hallucination parameters
              temperature: 0.0,    // Disable randomness
              no_repeat_ngram_size: 3, // Prevent repetitive phrases
              repetition_penalty: 1.2, // Penalize repetitions
              length_penalty: 1.0,     // Neutral length preference
              num_beams: 1,           // Greedy decoding for consistency
              no_speech_threshold: 0.6, // Output nothing if speech probability < 60%
              condition_on_previous_text: false, // Prevent hallucination propagation between chunks
            });

            setProgress(90);

            console.log('📝 Transcription completed:', result);
            console.log(`⚡ Processing completed using ${currentDevice.toUpperCase()}${webGPUSupported ? ' (Apple Silicon GPU)' : ' (CPU)'}!`);

            // Clean up the blob URL
            URL.revokeObjectURL(audioUrl);

            // Format result to match our expected structure
            const formattedResult: LocalTranscriptionResult = {
              text: cleanHallucinations(result.text || ''),
              chunks: result.chunks ? result.chunks.map((chunk: any, index: number) => ({
                start: chunk.timestamp?.[0] || 0,
                end: chunk.timestamp?.[1] || 0,
                speaker: `Locuteur_${String((index % 3) + 1).padStart(2, '0')}`,
                text: cleanHallucinations(chunk.text || '')
              })) : [{
                start: 0,
                end: 0,
                speaker: 'Locuteur_01',
                text: cleanHallucinations(result.text || '')
              }]
            };

            setProgress(100);
            setIsTranscribing(false);

            console.log(`🎉 Local transcription completed successfully using ${currentDevice.toUpperCase()}!`);
            resolve(formattedResult);

          } catch (transcriptionError: any) {
            console.error('🚫 Transcription execution error:', transcriptionError);

            // Handle WebGPU execution errors by falling back to WASM
            if (currentDevice === 'webgpu' && (
              typeof transcriptionError === 'number' ||
              transcriptionError.message?.includes('execution failed') ||
              transcriptionError.message?.includes('WebGPU') ||
              /^\d+$/.test(String(transcriptionError)) ||
              String(transcriptionError).match(/^\d{8,}$/) // Large error codes
            )) {
              console.log('🔄 WebGPU execution failed, retrying with WASM...');

              try {
                // Force reload with WASM
                console.log('🤖 Reloading model with WASM...');
                const transformers = await import('@huggingface/transformers');

                const transcriber = await transformers.pipeline('automatic-speech-recognition', modelId, {
                  dtype: {
                    encoder_model: 'fp32' as const,
                    decoder_model_merged: 'q4' as const,
                  },
                  device: 'wasm',
                });

                transcriptionRef.current = {
                  modelId,
                  device: 'wasm',
                  transcriber
                };

                console.log('✅ Model reloaded with WASM, retrying transcription...');

                // Retry transcription with WASM
                // Note: Cast to any because @huggingface/transformers types don't include all valid Whisper params
                const result = await (transcriber as any)(audioData, {
                  return_timestamps: true,
                  language: 'french',
                  task: 'transcribe',
                  chunk_length_s: 30,
                  stride_length_s: 5,
                  // Anti-hallucination parameters
                  temperature: 0.0,
                  no_repeat_ngram_size: 3,
                  repetition_penalty: 1.2,
                  length_penalty: 1.0,
                  num_beams: 1,
                  no_speech_threshold: 0.6, // Output nothing if speech probability < 60%
                  condition_on_previous_text: false, // Prevent hallucination propagation between chunks
                });

                setProgress(90);

                console.log('📝 Transcription completed with WASM fallback:', result);
                console.log('⚡ Processing completed using WASM (CPU)!');

                // Clean up the blob URL
                URL.revokeObjectURL(audioUrl);

                // Format result
                const formattedResult: LocalTranscriptionResult = {
                  text: cleanHallucinations((result as any).text || ''),
                  chunks: (result as any).chunks ? (result as any).chunks.map((chunk: any, index: number) => ({
                    start: chunk.timestamp?.[0] || 0,
                    end: chunk.timestamp?.[1] || 0,
                    speaker: `Locuteur_${String((index % 3) + 1).padStart(2, '0')}`,
                    text: cleanHallucinations(chunk.text || '')
                  })) : [{
                    start: 0,
                    end: 0,
                    speaker: 'Locuteur_01',
                    text: cleanHallucinations((result as any).text || '')
                  }]
                };

                setProgress(100);
                setIsTranscribing(false);

                console.log('🎉 Local transcription completed successfully using WASM fallback!');
                resolve(formattedResult);
                return; // Exit successfully

              } catch (wasmFallbackError: any) {
                console.error('❌ WASM fallback also failed:', wasmFallbackError);
                throw new Error(`Both WebGPU and WASM failed. ${wasmFallbackError.message}. Please try cloud transcription for guaranteed results.`);
              }
            } else {
              // Other transcription errors
              throw transcriptionError;
            }
          }

        } catch (audioError: any) {
          // Clean up the blob URL in case of error
          URL.revokeObjectURL(audioUrl);
          throw audioError;
        }

      } catch (error: any) {
        console.error('💥 Local transcription error:', error);

        // Check if it was cancelled
        if (error.message === 'Transcription cancelled') {
          setError('Transcription cancelled by user');
          setIsTranscribing(false);
          reject(new Error('Transcription cancelled'));
          return;
        }

        // Provide user-friendly error messages
        let userMessage: string;

        // Handle numeric error codes (WebGPU/ONNX errors)
        if (typeof error === 'number' || (error.message && /^\d+$/.test(error.message))) {
          userMessage = `WebGPU execution failed (code: ${error.message || error}). Your GPU may not support this model size. Try a smaller model or use cloud transcription.`;
        } else if (!error.message) {
          userMessage = 'Unknown transcription error. Please try a smaller model or use cloud transcription.';
        } else if (error.message.includes('404') || error.message.includes('Not Found')) {
          userMessage = 'Model not found. Please select a different model or use cloud transcription.';
        } else if (error.message.includes('Unsupported model type')) {
          userMessage = 'This model is not compatible. Please use cloud transcription instead.';
        } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          userMessage = 'Network error. Please check your internet connection or use cloud transcription.';
        } else if (error.message.includes('Aborted') || error.message.includes('RuntimeError') || error.message.includes('out of memory')) {
          userMessage = `Processing failed (insufficient memory or GPU error).
            Current model: ${modelId}
            🚀 Try a smaller model (Moonshine Tiny/Whisper Tiny) or use cloud transcription (OpenAI/Google) for guaranteed results.`;
        } else if (error.message.includes('Float32Array') || error.message.includes('ArrayBuffer')) {
          userMessage = 'Audio format error. Please try recording again or use cloud transcription.';
        } else if (error.message.includes('Failed to load')) {
          userMessage = 'Failed to load the AI library. Please refresh the page or use cloud transcription.';
        } else {
          userMessage = error.message;
        }

        setError(userMessage);
        setIsTranscribing(false);
        reject(new Error(userMessage));
      }
    });
  }, [checkWebGPUSupport, benchmark, runBenchmark]);

  const cancelTranscription = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsTranscribing(false);
    setProgress(0);
    setError(null);
    transcriptionRef.current = null;
  }, []);

  // ✅ Enhanced LLM function with Voxtral capabilities (100% private when possible)
  const enhanceWithLocalLLM = useCallback(async (
    transcript: string,
    prompts: { title?: string, summary?: string, transcript?: string },
    ollamaModel?: string // Nouveau paramètre optionnel
  ): Promise<{ title: string, summary: string, enhancedTranscript?: any }> => {
    try {
      console.log('🧠 Starting intelligent transcript enhancement...');

      // Priority 1: Try Ollama if model is specified
      if (ollamaModel && ollamaModel !== 'none') {
        console.log(`🦙 Trying Ollama with model: ${ollamaModel}`);

        try {
          console.log(`⏱️ Generating with Ollama (${ollamaModel})... This may take up to 3 minutes on slower systems.`);
          const result = await ollama.generateTitleAndSummary(ollamaModel, transcript, prompts);
          console.log('✅ Ollama enhancement completed successfully');

          return {
            title: result.title,
            summary: result.summary,
            enhancedTranscript: null
          };
        } catch (ollamaError) {
          console.warn('⚠️ Ollama enhancement failed, falling back to rule-based generation:', ollamaError);

          // Show user-friendly message if timeout
          if (ollamaError instanceof Error && (ollamaError.message.includes('timeout') || ollamaError.message.includes('timed out'))) {
            console.error('💡 Ollama took more than 10 minutes (CPU is too slow). Solutions:');
            console.error('   1. ✅ RECOMMENDED: Set Ollama model to "None" in settings (fast rule-based generation)');
            console.error('   2. Wait for transcription to complete, then click "Generate Transcript & Summary" manually');
            console.error('   3. Consider upgrading to a faster CPU or using cloud APIs (Google Gemini, OpenAI)');
            console.error('');
            console.error('ℹ️ The transcription has been saved. Only title/summary generation failed.');
          }
        }
      }

      // Priority 2: Check if we have access to Voxtral for advanced semantic understanding
      const mistralApiKey = getMistralApiKey();

      if (mistralApiKey) {
        console.log('🎯 Using Voxtral for advanced semantic analysis...');

        try {
          // Use Voxtral's native understanding capabilities for better enhancement
          const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${mistralApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'voxtral-small',
              messages: [
                {
                  role: 'system',
                  content: `Tu es un assistant expert en analyse de réunions et transcriptions. 
Tu dois générer un titre percutant et un résumé structuré en français.
Utilise les prompts personnalisés si fournis: ${JSON.stringify(prompts)}`
                },
                {
                  role: 'user',
                  content: `Analyse cette transcription de réunion et génère:

1. Un titre accrocheur et descriptif (max 60 caractères)
2. Un résumé des points clés et décisions (max 200 caractères)

Transcription:
${transcript}

Format de réponse stricte:
TITRE: [titre descriptif]
RÉSUMÉ: [résumé des points clés et actions]`
                }
              ],
              temperature: 0.2,
              max_tokens: 400
            }),
          });

          if (response.ok) {
            const result = await response.json();
            const content = result.choices[0]?.message?.content || '';

            // Parse Voxtral's structured response
            const titleMatch = content.match(/TITRE:\s*(.+)/);
            const summaryMatch = content.match(/RÉSUMÉ:\s*(.+)/);

            const title = titleMatch?.[1]?.trim() || transcript.split(/[.!?]+/)[0]?.trim() || 'Réunion enregistrée';
            const summary = summaryMatch?.[1]?.trim() || `Analyse Voxtral terminée. ${transcript.split(/[.!?]+/).length} phrases analysées.`;

            console.log('✅ Voxtral semantic enhancement completed with advanced understanding');

            return {
              title: title.length > 60 ? title.substring(0, 60) + '...' : title,
              summary: summary.length > 200 ? summary.substring(0, 200) + '...' : summary,
              enhancedTranscript: transcript
            };
          }
        } catch (voxtralError) {
          console.warn('⚠️ Voxtral enhancement failed, falling back to local processing:', voxtralError);
        }
      }

      console.log('📝 Using local rule-based enhancement (100% private)...');
      console.log('📝 Applying custom prompts:', prompts); // Use the prompts parameter

      // Enhanced rule-based approach with better keyword detection
      const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);

      // Smart title generation (look for meeting purpose or main topic)
      let title = '';
      const titleKeywords = ['réunion', 'point', 'sujet', 'ordre du jour', 'meeting', 'discussion', 'projet'];
      const titleSentence = sentences.find(s =>
        titleKeywords.some(kw => s.toLowerCase().includes(kw))
      ) || sentences[0];

      // Clean up the title (remove common prefixes)
      let cleanTitle = titleSentence?.trim() || '';
      cleanTitle = cleanTitle
        .replace(/^(bonjour|salut|hello|bienvenue|merci|alors|donc|voilà|ok|d'accord)[,\s]*/gi, '')
        .replace(/^(aujourd'hui|ce matin|cet après-midi|ce soir)[,\s]*/gi, '')
        .trim();

      title = cleanTitle.substring(0, 60) + (cleanTitle.length > 60 ? '...' : '') || 'Réunion';

      // Enhanced summary with intelligent extraction
      const keyPhrases = [
        'nous devons', 'il faut', 'important', 'décision', 'action', 'problème',
        'solution', 'objectif', 'résultat', 'conclusion', 'prochaine étape',
        'à faire', 'urgent', 'priorité', 'deadline', 'échéance', 'prévu', 'planifié'
      ];

      const importantSentences = sentences.filter(sentence =>
        keyPhrases.some(phrase => sentence.toLowerCase().includes(phrase))
      ).slice(0, 3);

      // Build a structured summary
      let summary = '';

      if (importantSentences.length > 0) {
        summary = '**Points clés discutés:**\n\n' + importantSentences
          .map((s, i) => `${i + 1}. ${s.trim()}`)
          .join('\n');
      } else {
        // Fallback: extract first meaningful sentences
        const meaningfulSentences = sentences
          .filter(s => s.split(' ').length > 5) // At least 5 words
          .slice(0, 3);

        summary = '**Résumé de la conversation:**\n\n' + meaningfulSentences
          .map(s => s.trim())
          .join('. ') + '.';
      }

      // Add context about participants if available
      const participantMentions = transcript.match(/\b(je|tu|il|elle|nous|vous|ils|elles)\b/gi) || [];
      const uniquePronouns = new Set(participantMentions.map(p => p.toLowerCase()));

      if (uniquePronouns.size > 2) {
        summary += '\n\n_Discussion impliquant plusieurs participants._';
      }

      console.log('✅ Local enhancement completed with smart analysis');

      return {
        title: title,
        summary: summary,
        enhancedTranscript: null // Will implement later with local LLM
      };

    } catch (error) {
      console.error('❌ Local LLM enhancement failed:', error);

      // Fallback to basic extraction
      const title = transcript.split('.')[0]?.trim().substring(0, 60) + '...' || 'Réunion';
      const summary = transcript.substring(0, 200) + '...';

      return { title, summary, enhancedTranscript: null };
    }
  }, [ollama]);

  /**
   * 🚀 STREAMING TRANSCRIPTION
   * 
   * Transcription en temps réel avec Server-Sent Events (SSE)
   * Compatible avec WhisperX et whisper.cpp (si streaming disponible)
   * 
   * @param audioBlob - Audio à transcrire
   * @param modelId - ID du modèle (ex: 'Xenova/whisper-small+diarization')
   * @param onSegmentReceived - Callback appelé pour chaque segment reçu en temps réel
   * @returns Transcription complète une fois terminée
   */
  const transcribeStreaming = useCallback(async (
    audioBlob: Blob,
    modelId: string,
    onSegmentReceived?: (segment: { text: string; start: number; end: number; speaker?: string | null }) => void
  ): Promise<LocalTranscriptionResult> => {

    console.log(`%c[streaming] 🚀 STARTING STREAMING TRANSCRIPTION`, 'color: #7c3aed; font-weight: bold; font-size: 16px');
    console.log(`[streaming] 📋 Model: ${modelId}`);
    console.log(`[streaming] 📊 Audio size: ${(audioBlob.size / 1024).toFixed(2)} KB`);

    setIsTranscribing(true);
    setProgress(5);
    setError(null);

    try {
      // Détection du modèle
      const needsDiarization = modelId.includes('diarization') || modelId.includes('+diarization');

      // 🏆 PRIORITÉ 1: WhisperX si diarization demandée
      if (needsDiarization) {
        console.log('[streaming] 🏆 Diarization needed, checking WhisperX...');
        const isWhisperXAvailable = await checkWhisperXAvailability();

        if (isWhisperXAvailable) {
          console.log(`%c[streaming] 🏆 USING WHISPERX STREAMING!`, 'color: #7c3aed; font-weight: bold');
          setProgress(10);

          const result = await transcribeWithWhisperXStreamingClient(
            audioBlob,
            {
              language: 'fr',
              model: 'base', // Peut être ajusté
              diarization: true,
            },
            // Callback pour chaque segment reçu
            (segment: WhisperXSegment) => {
              console.log(`%c[streaming] 🎤 NEW SEGMENT`, 'color: #16a34a; font-weight: bold', segment);
              if (onSegmentReceived) {
                onSegmentReceived({
                  text: segment.text,
                  start: segment.start,
                  end: segment.end,
                  speaker: segment.speaker
                });
              }
            },
            // Callback de progression
            (progressUpdate) => {
              setProgress(progressUpdate.progress || 0);
            }
          );

          // Formater le résultat
          const transcriptionResult: LocalTranscriptionResult = {
            text: cleanHallucinations(result.text || ''),
            chunks: result.segments?.map((seg) => ({
              start: seg.start || 0,
              end: seg.end || 0,
              speaker: seg.speaker || `Locuteur_01`,
              text: cleanHallucinations(seg.text || ''),
            })) || []
          };

          setProgress(100);
          setIsTranscribing(false);
          console.log(`%c[streaming] 🎉 STREAMING SUCCESS!`, 'color: #16a34a; font-weight: bold; font-size: 16px');

          return transcriptionResult;
        } else {
          console.warn('⚠️ WhisperX not available for streaming, falling back to batch...');
        }
      }

      // 🚀 PRIORITÉ 2: whisper.cpp streaming (si disponible dans le futur)
      // TODO: Implémenter whisper.cpp streaming si leur API le supporte

      // 📦 FALLBACK: Mode batch classique (pas de streaming)
      console.log(`%c[streaming] ⚠️ Streaming not available, falling back to BATCH mode`, 'color: #f59e0b; font-weight: bold');
      const result = await transcribe(audioBlob, modelId);

      setProgress(100);
      setIsTranscribing(false);

      return result;

    } catch (error: any) {
      console.error(`%c[streaming] ❌ STREAMING FAILED`, 'color: #dc2626; font-weight: bold');
      console.error('[streaming] Error:', error);

      setError(error.message || 'Streaming transcription failed');
      setIsTranscribing(false);
      setProgress(0);

      throw new Error(`Streaming transcription failed: ${error.message || 'Unknown error'}`);
    }
  }, [transcribe, checkWhisperXAvailability]);

  /**
   * 🚀 TRANSCRIPTION LIVE PAR CHUNK
   * Transcrit un chunk audio individuel en temps réel pendant l'enregistrement
   * Ne bloque pas les états globaux (plusieurs chunks peuvent être en cours)
   */
  const transcribeChunkLive = useCallback(async (
    chunk: Blob,
    chunkIndex: number,
    onSegmentReceived: (segment: { text: string; start: number; end: number; speaker?: string | null }) => void
  ): Promise<void> => {

    const chunkStartTime = Date.now();
    console.log(`%c[chunkLive] 🚀 TRANSCRIBING CHUNK #${chunkIndex} - STARTED AT ${new Date().toLocaleTimeString()}`, 'color: #7c3aed; font-weight: bold; font-size: 14px; background: #ede9fe; padding: 4px 8px');
    console.log(`[chunkLive] 📊 Chunk size: ${(chunk.size / 1024).toFixed(2)} KB`);

    try {
      // Vérifier que WhisperX est disponible
      console.log(`[chunkLive] 🔍 Checking WhisperX availability for chunk #${chunkIndex}...`);
      const availabilityCheckStart = Date.now();
      const isWhisperXAvailable = await checkWhisperXAvailability();
      const availabilityCheckTime = Date.now() - availabilityCheckStart;

      console.log(`[chunkLive] WhisperX availability check took ${availabilityCheckTime}ms`);

      if (!isWhisperXAvailable) {
        console.warn(`%c[chunkLive] ❌ WhisperX NOT AVAILABLE for chunk #${chunkIndex}!`, 'color: #dc2626; font-weight: bold; background: #fee; padding: 4px 8px');
        console.warn(`[chunkLive] 💡 Make sure WhisperX is running: docker ps | grep whisperx`);
        console.warn(`[chunkLive] 💡 Test manually: curl http://localhost:8082/health`);
        return;
      }

      console.log(`%c[chunkLive] ✅ WhisperX AVAILABLE! Starting transcription...`, 'color: #16a34a; font-weight: bold');

      // Calculer l'offset de temps pour ce chunk (20s par chunk)
      const CHUNK_DURATION_SECONDS = 20;
      const timeOffset = chunkIndex * CHUNK_DURATION_SECONDS;

      // Transcrire le chunk avec WhisperX en streaming
      console.log(`[chunkLive] 📡 Calling WhisperX streaming API for chunk #${chunkIndex}...`);
      const transcriptionStart = Date.now();

      let segmentCount = 0;
      await transcribeWithWhisperXStreamingClient(
        chunk,
        {
          language: 'fr',
          model: 'tiny', // 🚀 Modèle ULTRA-rapide pour du live (5x plus rapide que base)
          diarization: true, // Toujours activer la diarization pour du live
        },
        // Callback pour chaque segment reçu
        (segment: WhisperXSegment) => {
          segmentCount++;
          // Ajuster les timestamps avec l'offset du chunk
          const adjustedSegment = {
            text: segment.text,
            start: segment.start + timeOffset,
            end: segment.end + timeOffset,
            speaker: segment.speaker
          };

          const segmentReceivedTime = Date.now();
          const elapsedSinceChunkStart = segmentReceivedTime - chunkStartTime;

          console.log(`%c[chunkLive] 🎤 SEGMENT #${segmentCount} from chunk #${chunkIndex} (${elapsedSinceChunkStart}ms since chunk start)`, 'color: #16a34a; font-weight: bold; background: #f0fdf4; padding: 4px 8px');
          console.log(`[chunkLive]   └─ Text: "${adjustedSegment.text}"`);
          console.log(`[chunkLive]   └─ Speaker: ${adjustedSegment.speaker || 'Unknown'}`);
          console.log(`[chunkLive]   └─ Time: ${adjustedSegment.start.toFixed(2)}s - ${adjustedSegment.end.toFixed(2)}s`);

          console.log(`%c[chunkLive] 🔄 CALLING onSegmentReceived callback...`, 'color: #3b82f6; font-weight: bold');
          onSegmentReceived(adjustedSegment);
          console.log(`%c[chunkLive] ✅ Callback executed successfully`, 'color: #16a34a');
        },
        // Callback de progression (ignoré pour les chunks live)
        () => { }
      );

      const transcriptionTime = Date.now() - transcriptionStart;
      const totalTime = Date.now() - chunkStartTime;

      console.log(`%c[chunkLive] ✅ Chunk #${chunkIndex} transcribed successfully!`, 'color: #16a34a; font-weight: bold; font-size: 14px; background: #f0fdf4; padding: 4px 8px');
      console.log(`[chunkLive]   └─ Segments received: ${segmentCount}`);
      console.log(`[chunkLive]   └─ Transcription time: ${transcriptionTime}ms`);
      console.log(`[chunkLive]   └─ Total time: ${totalTime}ms`);

    } catch (error: any) {
      // Ne pas faire échouer toute la transcription si un chunk échoue
      console.error(`%c[chunkLive] ❌ Chunk #${chunkIndex} transcription failed`, 'color: #dc2626; font-weight: bold');
      console.error(`[chunkLive] Error:`, error);
      console.warn(`[chunkLive] ⚠️ Continuing with other chunks...`);
    }
  }, [checkWhisperXAvailability]);

  // Use the unified AI hook for generation (with streaming support)
  const { generate: generateAI, generateStream, generateParallel: generateParallelAI } = useAI();

  // Wrapper functions pour AI generation avec custom prompts via le provider global
  const generateTitle = async (transcript: string, customPrompt?: string): Promise<string> => {
    console.log('🧠 Generating title using refined AI provider...');

    // Default prompts if none provided
    const defaultTitlePrompt = 'Generate a concise, descriptive title (maximum 60 characters) for the following meeting transcript. Return ONLY the title, nothing else.';

    const sysPrompt = "You are an expert meeting assistant. Your task is to generate a concise title for the provided transcript.";
    const userPrompt = `${customPrompt || defaultTitlePrompt}\n\nTranscript:\n${transcript.substring(0, 4000)}`;

    try {
      const result = await generateAI({
        systemPrompt: sysPrompt,
        userPrompt: userPrompt
      });
      // Clean result
      return result.replace(/["']/g, '').substring(0, 60).replace(/\n/g, ' ').trim();
    } catch (error) {
      console.error('AI Title Gen Error:', error);
      throw error;
    }
  };

  const generateSummary = async (transcript: string, customPrompt?: string): Promise<string> => {
    console.log('🧠 Generating summary using refined AI provider...');

    const defaultSummaryPrompt = 'Summarize the following meeting transcript in a concise and structured way. Include key points, decisions, and action items.';

    const sysPrompt = "You are an expert meeting assistant. Your task is to summarize the provided transcript.";
    const userPrompt = `${customPrompt || defaultSummaryPrompt}\n\nTranscript:\n${transcript.substring(0, 15000)}`;

    try {
      const result = await generateAI({
        systemPrompt: sysPrompt,
        userPrompt: userPrompt
      });
      return result.trim();
    } catch (error) {
      console.error('AI Summary Gen Error:', error);
      throw error;
    }
  };

  // 🚀 STREAMING: Generate summary with real-time updates
  const generateSummaryStream = async (
    transcript: string, 
    customPrompt?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> => {
    console.log('🚀 Generating summary with STREAMING...');

    const defaultSummaryPrompt = 'Summarize the following meeting transcript in a concise and structured way. Include key points, decisions, and action items.';

    const sysPrompt = "You are an expert meeting assistant. Your task is to summarize the provided transcript.";
    const userPrompt = `${customPrompt || defaultSummaryPrompt}\n\nTranscript:\n${transcript.substring(0, 15000)}`;

    try {
      const result = await generateStream({
        systemPrompt: sysPrompt,
        userPrompt: userPrompt,
        callbacks: {
          onChunk: onChunk,
          onComplete: (text) => console.log(`✅ Streaming summary complete: ${text.length} chars`)
        }
      });
      return result.trim();
    } catch (error) {
      console.error('AI Streaming Summary Error:', error);
      throw error;
    }
  };

  // ⚡ PARALLEL: Generate title AND summary at the same time (2x faster!)
  const generateTitleAndSummaryParallel = async (
    transcript: string,
    titlePrompt?: string,
    summaryPrompt?: string,
    onSummaryChunk?: (chunk: string) => void
  ): Promise<{ title: string; summary: string }> => {
    console.log('⚡ Starting PARALLEL title + summary generation...');
    const startTime = Date.now();

    const defaultTitlePrompt = 'Generate a concise, descriptive title (maximum 60 characters) for this meeting. Return ONLY the title.';
    const defaultSummaryPrompt = 'Summarize this meeting transcript. Include key points, decisions, and action items.';

    const titleSysPrompt = "You are an expert meeting assistant. Generate a concise title.";
    const summarySysPrompt = "You are an expert meeting assistant. Summarize the transcript.";

    try {
      const result = await generateParallelAI(
        transcript,
        `${titleSysPrompt}\n\n${titlePrompt || defaultTitlePrompt}`,
        `${summarySysPrompt}\n\n${summaryPrompt || defaultSummaryPrompt}`,
        onSummaryChunk
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⚡ Parallel generation complete in ${duration}s`);

      return {
        title: result.title.replace(/["']/g, '').substring(0, 60).replace(/\n/g, ' ').trim(),
        summary: result.summary.trim()
      };
    } catch (error) {
      console.error('⚡ Parallel generation error:', error);
      throw error;
    }
  };

  return {
    isTranscribing,
    progress,
    error,
    benchmark,
    transcribe,
    transcribeStreaming, // 🆕 NOUVELLE FONCTION STREAMING
    transcribeChunkLive, // 🚀 LIVE CHUNK TRANSCRIPTION
    cancelTranscription,
    runBenchmark,
    enhanceWithLocalLLM,
    // AI generation (Ollama, OpenAI, Gemini) - use configured provider
    generateTitle,
    generateSummary,
    generateSummaryStream, // 🚀 NEW: Streaming summary generation
    generateTitleAndSummaryParallel, // ⚡ NEW: Parallel title + summary (2x faster!)
    // Voxtral API key management
    getMistralApiKey,
    storeMistralApiKey,
    clearMistralApiKey,
    hasVoxtralAccess: !!getMistralApiKey(),
    // Backend availability checks
    checkWhisperXAvailability,
  };
} 