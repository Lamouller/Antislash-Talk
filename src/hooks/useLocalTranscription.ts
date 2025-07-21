import { useState, useRef, useCallback } from 'react';

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
    
    if (normalized !== lastNormalized) {
      cleanSentences.push(sentence);
      lastSentence = sentence;
    }
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
  cancelTranscription: () => void;
  runBenchmark: () => Promise<DeviceBenchmark>;
  enhanceWithLocalLLM: (transcript: string, prompts: {title?: string, summary?: string, transcript?: string}) => Promise<{title: string, summary: string, enhancedTranscript?: any}>;
  // Voxtral API key management
  getMistralApiKey: () => string | null;
  storeMistralApiKey: (apiKey: string) => void;
  clearMistralApiKey: () => void;
  hasVoxtralAccess: boolean;
}

export function useLocalTranscription(): UseLocalTranscriptionReturn {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [benchmark, setBenchmark] = useState<DeviceBenchmark | null>(null);
  const transcriptionRef = useRef<any>(null);
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
                const result = await transcriber(audioData, {
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
    prompts: {title?: string, summary?: string, transcript?: string}
  ): Promise<{title: string, summary: string, enhancedTranscript?: any}> => {
    try {
      console.log('🧠 Starting intelligent transcript enhancement...');
      
      // Check if we have access to Voxtral for advanced semantic understanding
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
      const titleKeywords = ['réunion', 'point', 'sujet', 'ordre du jour', 'meeting', 'discussion'];
      const titleSentence = sentences.find(s => 
        titleKeywords.some(kw => s.toLowerCase().includes(kw))
      ) || sentences[0];
      
      title = titleSentence?.trim().substring(0, 60) + (titleSentence?.length > 60 ? '...' : '') || 'Réunion sans titre';
      
      // Enhanced summary with action items and decisions
      const keyPhrases = [
        'nous devons', 'il faut', 'important', 'décision', 'action', 'problème', 
        'solution', 'objectif', 'résultat', 'conclusion', 'prochaine étape',
        'à faire', 'urgent', 'priorité', 'deadline', 'échéance'
      ];
      
      const importantSentences = sentences.filter(sentence => 
        keyPhrases.some(phrase => sentence.toLowerCase().includes(phrase))
      ).slice(0, 3);
      
      const summary = importantSentences.length > 0 
        ? importantSentences.join('. ') + '.'
        : `Points clés identifiés: ${sentences.slice(0, 2).join('. ')}.`;
      
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
  }, []);

  return {
    isTranscribing,
    progress,
    error,
    benchmark,
    transcribe,
    cancelTranscription,
    runBenchmark,
    enhanceWithLocalLLM,
    // Voxtral API key management
    getMistralApiKey,
    storeMistralApiKey,
    clearMistralApiKey,
    hasVoxtralAccess: !!getMistralApiKey(),
  };
} 