/**
 * Hook pour interagir avec Ollama (LLM local)
 * Permet de générer des titres et résumés avec les prompts personnalisés
 */

import { useState, useCallback } from 'react';

const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

interface OllamaStatus {
  available: boolean;
  models: OllamaModel[];
  error?: string;
}

export function useOllama() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Vérifie si Ollama est disponible et liste les modèles installés
   */
  const checkStatus = useCallback(async (): Promise<OllamaStatus> => {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return {
          available: false,
          models: [],
          error: `Ollama not available (HTTP ${response.status})`,
        };
      }

      const data = await response.json();
      return {
        available: true,
        models: data.models || [],
      };
    } catch (error) {
      return {
        available: false,
        models: [],
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }, []);

  /**
   * Génère du texte avec Ollama
   */
  const generate = useCallback(async (
    model: string,
    prompt: string,
    options?: { temperature?: number; top_p?: number; top_k?: number }
  ): Promise<string> => {
    setIsGenerating(true);
    setError(null);

    try {
      const requestBody: OllamaGenerateRequest = {
        model,
        prompt,
        stream: false,
        options: {
          temperature: options?.temperature || 0.3, // Lower for more focused responses
          top_p: options?.top_p || 0.9,
          top_k: options?.top_k || 40,
        },
      };

      console.log(`🤖 Calling Ollama with model: ${model}`);
      console.log(`📝 Prompt length: ${prompt.length} chars`);

      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(600000), // 10 minutes timeout (for very slow CPUs like M1/M2 Macs)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const data: OllamaGenerateResponse = await response.json();
      
      console.log(`✅ Ollama generation completed with ${model}`);
      
      return data.response.trim();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Ollama generation error:', errorMsg);
      setError(errorMsg);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  /**
   * Génère un titre et résumé avec Ollama selon les prompts personnalisés
   */
  const generateTitleAndSummary = useCallback(async (
    model: string,
    transcript: string,
    prompts: { title?: string; summary?: string }
  ): Promise<{ title: string; summary: string }> => {
    console.log(`🧠 Generating title and summary with Ollama (${model})...`);

    const titlePrompt = prompts.title || 'Generate a short, descriptive title for the meeting in French (max 60 characters).';
    const summaryPrompt = prompts.summary || 'Provide a concise one-paragraph summary of the key discussion points and decisions, in French.';

    // Limiter la taille de la transcription pour éviter les timeouts (1000 chars = ~30s de génération sur CPU lent)
    const truncatedTranscript = transcript.length > 1000 
      ? transcript.substring(0, 1000) + '...'
      : transcript;
    
    console.log(`📊 Transcription truncated to ${truncatedTranscript.length} chars (from ${transcript.length})`);
    console.log(`⏱️ Estimated generation time: ~3-5 minutes on slow CPU`);

    // Générer le titre
    const titleFullPrompt = `${titlePrompt}

Transcription de la réunion:
${truncatedTranscript}

Titre (max 60 caractères):`;

    const title = await generate(model, titleFullPrompt, { temperature: 0.2 });

    // Générer le résumé
    const summaryFullPrompt = `${summaryPrompt}

Transcription de la réunion:
${truncatedTranscript}

Résumé:`;

    const summary = await generate(model, summaryFullPrompt, { temperature: 0.3 });

    return {
      title: title.substring(0, 60).replace(/\n/g, ' ').trim(),
      summary: summary.trim(),
    };
  }, [generate]);

  /**
   * Télécharge un modèle Ollama
   */
  const pullModel = useCallback(async (modelName: string): Promise<void> => {
    console.log(`📥 Pulling Ollama model: ${modelName}`);
    
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      // Stream the response to show progress
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.status) {
              console.log(`📦 ${data.status}`);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      console.log(`✅ Model ${modelName} pulled successfully`);
    } catch (error) {
      console.error('❌ Failed to pull model:', error);
      throw error;
    }
  }, []);

  /**
   * Génère uniquement un titre à partir d'un transcript
   */
  const generateTitle = async (transcript: string, customPrompt?: string): Promise<string> => {
    console.log(`🧠 Generating title with Ollama...`);
    
    const basePrompt = customPrompt || 'Generate a concise, descriptive title (maximum 60 characters) for the following meeting transcript. Return ONLY the title, nothing else.';
    const fullPrompt = `${basePrompt}\n\nTranscript:\n${transcript.substring(0, 1000)}`;
    
    console.log(`📝 Using ${customPrompt ? 'CUSTOM' : 'DEFAULT'} title prompt`);
    
    const title = await generate('llama3.2:latest', fullPrompt, { temperature: 0.3 });
    return title.substring(0, 60).replace(/\n/g, ' ').trim();
  };

  /**
   * Génère uniquement un résumé à partir d'un transcript
   */
  const generateSummary = async (transcript: string, customPrompt?: string): Promise<string> => {
    console.log(`🧠 Generating summary with Ollama...`);
    
    const basePrompt = customPrompt || 'Summarize the following meeting transcript in a concise and structured way. Include key points, decisions, and action items.';
    const fullPrompt = `${basePrompt}\n\nTranscript:\n${transcript}`;
    
    console.log(`📝 Using ${customPrompt ? 'CUSTOM' : 'DEFAULT'} summary prompt`);
    
    const summary = await generate('llama3.2:latest', fullPrompt, { temperature: 0.3 });
    return summary.trim();
  };

  return {
    isGenerating,
    error,
    checkStatus,
    generate,
    generateTitleAndSummary,
    generateTitle,
    generateSummary,
    pullModel,
  };
}

