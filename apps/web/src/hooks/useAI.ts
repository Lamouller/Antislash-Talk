import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOllama } from './useOllama';

// #region agent log - Debug logging for AI streaming
const debugLog = (loc: string, msg: string, data: any, hyp: string) => {
    try {
        const logs = JSON.parse(localStorage.getItem('__debug_logs__') || '[]');
        logs.push({ location: loc, message: msg, data, timestamp: Date.now(), hypothesisId: hyp });
        if (logs.length > 200) logs.shift();
        localStorage.setItem('__debug_logs__', JSON.stringify(logs));
        console.log(`%c[AI:${hyp}] ${loc}: ${msg}`, 'color: #7c3aed; font-weight: bold', data);
    } catch (e) { }
};
// #endregion

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'local';

interface GenerateOptions {
    systemPrompt: string;
    userPrompt: string;
    model?: string;
    provider?: AIProvider;
}

interface StreamCallbacks {
    onChunk?: (chunk: string) => void;
    onComplete?: (fullText: string) => void;
    onError?: (error: Error) => void;
}

export function useAI() {
    const [isGenerating, setIsGenerating] = useState(false);
    const { generate: generateOllama } = useOllama();

    const getProfileSettings = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not logged in');

        const { data: profile } = await supabase
            .from('profiles')
            .select('preferred_llm, preferred_llm_model, preferred_transcription_provider, preferred_transcription_model')
            .eq('id', user.id)
            .single();

        return profile;
    };

    const getApiKey = async (provider: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data } = await supabase
            .from('api_keys')
            .select('encrypted_key')
            .eq('user_id', user.id)
            .eq('provider', provider)
            .single();

        return data?.encrypted_key; // Note: In a real app, you'd decrypt this if it was actually encrypted
    };

    const generateOpenAI = async (apiKey: string, model: string, system: string, user: string) => {
        const modelId = model || 'gpt-5';
        const isReasoningModel = modelId.startsWith('o1') || modelId.startsWith('o3');
        
        // Reasoning models (o1, o3) don't support system messages or temperature
        const messages = isReasoningModel 
            ? [{ role: 'user', content: `${system}\n\n${user}` }]
            : [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ];
        
        const body: Record<string, unknown> = {
            model: modelId,
            messages
        };
        
        // Only add temperature for non-reasoning models
        if (!isReasoningModel) {
            body.temperature = 0.7;
        }
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API error');
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    };

    // 🚀 STREAMING: OpenAI with SSE
    const generateOpenAIStream = async (
        apiKey: string, 
        model: string, 
        system: string, 
        user: string,
        callbacks: StreamCallbacks
    ): Promise<string> => {
        const modelId = model || 'gpt-4o-mini';
        const isReasoningModel = modelId.startsWith('o1') || modelId.startsWith('o3');
        
        // #region agent log
        debugLog('useAI:generateOpenAIStream', 'STARTING OpenAI STREAM', {
            model: modelId,
            isReasoningModel,
            systemPromptLength: system.length,
            userPromptLength: user.length,
            userPromptPreview: user.substring(0, 200)
        }, 'STREAM');
        // #endregion
        
        const messages = isReasoningModel 
            ? [{ role: 'user', content: `${system}\n\n${user}` }]
            : [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ];
        
        const body: Record<string, unknown> = {
            model: modelId,
            messages,
            stream: true // Enable streaming
        };
        
        if (!isReasoningModel) {
            body.temperature = 0.7;
        }
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            // #region agent log
            debugLog('useAI:generateOpenAIStream', 'OpenAI ERROR', { error, status: response.status }, 'STREAM');
            // #endregion
            throw new Error(error.error?.message || 'OpenAI API error');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let chunkCount = 0;

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            if (content) {
                                fullText += content;
                                chunkCount++;
                                callbacks.onChunk?.(content);
                                
                                // Log every 10 chunks
                                if (chunkCount % 10 === 0) {
                                    // #region agent log
                                    debugLog('useAI:generateOpenAIStream', `CHUNK #${chunkCount}`, {
                                        totalLength: fullText.length,
                                        latestContent: content.substring(0, 50)
                                    }, 'STREAM');
                                    // #endregion
                                }
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        }

        // #region agent log
        debugLog('useAI:generateOpenAIStream', 'STREAM COMPLETE', {
            totalChunks: chunkCount,
            totalLength: fullText.length,
            preview: fullText.substring(0, 200)
        }, 'STREAM');
        // #endregion

        callbacks.onComplete?.(fullText);
        return fullText;
    };

    const generateMistral = async (apiKey: string, model: string, system: string, user: string) => {
        const modelId = model || 'mistral-large-2512';
        
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: modelId,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Mistral API error');
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    };

    const generateGoogle = async (apiKey: string, model: string, system: string, user: string) => {
        // Simple implementation for Google Gemini via REST API
        // Always strip 'models/' prefix just in case it crept in
        // Default to the latest stable model
        const cleanModel = (model || 'gemini-2.5-flash').replace(/^models\//, '');

        // Use v1beta for experimental/preview models (exp, preview, 3.x, 2.5.x with native-audio)
        // Use v1 for stable models (1.5.x, 2.0.x non-exp)
        const needsBeta = cleanModel.includes('exp') || 
                          cleanModel.includes('preview') || 
                          cleanModel.includes('native-audio') ||
                          cleanModel.startsWith('gemini-3') ||
                          cleanModel.startsWith('gemini-2.5');
        const apiVersion = needsBeta ? 'v1beta' : 'v1';

        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${cleanModel}:generateContent?key=${apiKey}`;

        console.log(`🤖 Call Google API: ${cleanModel} (${apiVersion})`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: `${system}\n\n${user}` }]
                    }
                ],
                // Add generation config for safety/consistency
                generationConfig: {
                    temperature: 0.7,
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `Google API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    };

    // 🚀 STREAMING: Google Gemini with SSE
    const generateGoogleStream = async (
        apiKey: string, 
        model: string, 
        system: string, 
        user: string,
        callbacks: StreamCallbacks
    ): Promise<string> => {
        const cleanModel = (model || 'gemini-2.5-flash').replace(/^models\//, '');
        
        const needsBeta = cleanModel.includes('exp') || 
                          cleanModel.includes('preview') || 
                          cleanModel.includes('native-audio') ||
                          cleanModel.startsWith('gemini-3') ||
                          cleanModel.startsWith('gemini-2.5');
        const apiVersion = needsBeta ? 'v1beta' : 'v1';

        // Use streamGenerateContent for streaming
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${cleanModel}:streamGenerateContent?key=${apiKey}&alt=sse`;

        // #region agent log
        debugLog('useAI:generateGoogleStream', 'STARTING Gemini STREAM', {
            model: cleanModel,
            apiVersion,
            systemPromptLength: system.length,
            userPromptLength: user.length,
            userPromptPreview: user.substring(0, 200)
        }, 'STREAM');
        // #endregion

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: `${system}\n\n${user}` }]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            // #region agent log
            debugLog('useAI:generateGoogleStream', 'Gemini ERROR', { error, status: response.status }, 'STREAM');
            // #endregion
            throw new Error(error.error?.message || `Google API error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let chunkCount = 0;

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            if (content) {
                                fullText += content;
                                chunkCount++;
                                callbacks.onChunk?.(content);
                                
                                // Log every 10 chunks
                                if (chunkCount % 10 === 0) {
                                    // #region agent log
                                    debugLog('useAI:generateGoogleStream', `CHUNK #${chunkCount}`, {
                                        totalLength: fullText.length,
                                        latestContent: content.substring(0, 50)
                                    }, 'STREAM');
                                    // #endregion
                                }
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        }

        // #region agent log
        debugLog('useAI:generateGoogleStream', 'STREAM COMPLETE', {
            totalChunks: chunkCount,
            totalLength: fullText.length,
            preview: fullText.substring(0, 200)
        }, 'STREAM');
        // #endregion

        callbacks.onComplete?.(fullText);
        return fullText;
    };

    const generate = useCallback(async ({ systemPrompt, userPrompt, model: overrideModel, provider: overrideProvider }: GenerateOptions) => {
        setIsGenerating(true);
        try {
            // 1. Get configurations
            let profile;
            try {
                profile = await getProfileSettings();
                console.log('👤 useAI: Fetched profile:', profile);
            } catch (err) {
                console.warn('⚠️ Failed to fetch user profile, using defaults:', err);
            }

            // 2. Determine provider and model
            let provider = overrideProvider || profile?.preferred_llm || 'openai';
            let model = overrideModel || (provider === 'local' ? profile?.preferred_llm_model : profile?.preferred_llm_model);

            console.log(`🤖 AI Generation: Initial Provider=${provider.toUpperCase()}`);

            // 3. Smart Fallback: Check if we have the key for the selected provider
            if (provider !== 'local') {
                const apiKey = await getApiKey(provider);

                if (!apiKey) {
                    // Key missing for selected provider! Check others...
                    console.warn(`⚠️ Key missing for ${provider}. Checking alternatives...`);

                    const providers = ['google', 'mistral', 'openai'];
                    for (const p of providers) {
                        const key = await getApiKey(p);
                        if (key) {
                            console.log(`✅ Found valid key for ${p}. Switching provider.`);
                            provider = p as any;

                            // Smart Model Selection:
                            // If we fallback to the provider that is ALSO the transcription provider,
                            // try to use that model instead of the default.
                            if (profile?.preferred_transcription_provider === p && profile?.preferred_transcription_model) {
                                console.log(`🧠 Smart Fallback: Using transcription model ${profile.preferred_transcription_model}`);
                                model = profile.preferred_transcription_model;
                            } else {
                                // Otherwise reset to default
                                model = undefined;
                            }
                            break;
                        }
                    }
                }
            }

            console.log(`🤖 AI Generation: Final Provider=${provider.toUpperCase()} (${model || 'default'})`);

            let result = '';

            if (provider === 'local') {
                // Use Ollama
                if (!model || model === 'none') {
                    throw new Error('No local model selected in settings');
                }
                result = await generateOllama(model, `${systemPrompt}\n\n${userPrompt}`);

            } else {
                // Cloud Providers
                const apiKey = await getApiKey(provider);

                if (!apiKey) {
                    throw new Error(`API Key for ${provider.toUpperCase()} not found. Please add it in Settings > AI Model.`);
                }

                switch (provider) {
                    case 'openai':
                        result = await generateOpenAI(apiKey, model, systemPrompt, userPrompt);
                        break;
                    case 'mistral':
                        result = await generateMistral(apiKey, model, systemPrompt, userPrompt);
                        break;
                    case 'google':
                        result = await generateGoogle(apiKey, model, systemPrompt, userPrompt);
                        break;
                    case 'anthropic':
                        throw new Error('Anthropic implementation pending');
                    default:
                        throw new Error(`Provider ${provider} not supported`);
                }
            }

            return result;

        } catch (error: any) {
            console.error('AI Generation Error:', error);
            throw error; // Let caller handle UI feedback
        } finally {
            setIsGenerating(false);
        }
    }, [generateOllama]);

    // 🚀 STREAMING GENERATION - Shows progress in real-time
    const generateStream = useCallback(async (
        options: GenerateOptions & { callbacks: StreamCallbacks }
    ) => {
        const { systemPrompt, userPrompt, model: overrideModel, provider: overrideProvider, callbacks } = options;
        setIsGenerating(true);
        
        // #region agent log
        debugLog('useAI:generateStream', '🚀 STARTING STREAM GENERATION', {
            overrideProvider,
            overrideModel,
            systemPromptLength: systemPrompt.length,
            userPromptLength: userPrompt.length
        }, 'STREAM');
        // #endregion
        
        try {
            let profile;
            try {
                profile = await getProfileSettings();
                // #region agent log
                debugLog('useAI:generateStream', 'PROFILE FETCHED', {
                    preferredLlm: profile?.preferred_llm,
                    preferredLlmModel: profile?.preferred_llm_model
                }, 'STREAM');
                // #endregion
            } catch (err) {
                console.warn('⚠️ Failed to fetch user profile:', err);
            }

            let provider = overrideProvider || profile?.preferred_llm || 'openai';
            let model = overrideModel || profile?.preferred_llm_model;

            if (provider !== 'local') {
                const apiKey = await getApiKey(provider);

                if (!apiKey) {
                    // #region agent log
                    debugLog('useAI:generateStream', 'NO API KEY - SEARCHING FALLBACK', { originalProvider: provider }, 'STREAM');
                    // #endregion
                    const providers = ['google', 'openai', 'mistral'];
                    for (const p of providers) {
                        const key = await getApiKey(p);
                        if (key) {
                            provider = p as AIProvider;
                            model = undefined;
                            // #region agent log
                            debugLog('useAI:generateStream', 'FALLBACK PROVIDER FOUND', { newProvider: provider }, 'STREAM');
                            // #endregion
                            break;
                        }
                    }
                }
            }

            const apiKey = await getApiKey(provider);
            if (!apiKey && provider !== 'local') {
                // #region agent log
                debugLog('useAI:generateStream', 'ERROR: NO API KEY', { provider }, 'STREAM');
                // #endregion
                throw new Error(`API Key for ${provider.toUpperCase()} not found.`);
            }

            // #region agent log
            debugLog('useAI:generateStream', '🎯 PROVIDER SELECTED', {
                provider,
                model: model || 'default',
                hasApiKey: !!apiKey
            }, 'STREAM');
            // #endregion

            let result = '';
            switch (provider) {
                case 'openai':
                    result = await generateOpenAIStream(apiKey!, model || 'gpt-4o-mini', systemPrompt, userPrompt, callbacks);
                    break;
                case 'google':
                    result = await generateGoogleStream(apiKey!, model || 'gemini-2.5-flash', systemPrompt, userPrompt, callbacks);
                    break;
                default:
                    // #region agent log
                    debugLog('useAI:generateStream', 'FALLBACK TO NON-STREAMING', { provider }, 'STREAM');
                    // #endregion
                    // Fallback to non-streaming for other providers
                    result = await generate({ systemPrompt, userPrompt, model, provider });
                    callbacks.onComplete?.(result);
            }

            return result;
        } catch (error: any) {
            // #region agent log
            debugLog('useAI:generateStream', 'ERROR', { error: error.message }, 'STREAM');
            // #endregion
            callbacks.onError?.(error);
            throw error;
        } finally {
            setIsGenerating(false);
        }
    }, [generate]);

    // ⚡ PARALLEL GENERATION - Generate title and summary at the same time
    const generateParallel = useCallback(async (
        transcript: string,
        titlePrompt?: string,
        summaryPrompt?: string,
        onSummaryChunk?: (chunk: string) => void
    ): Promise<{ title: string; summary: string }> => {
        const startTime = Date.now();

        // Default prompts if none provided
        const defaultTitlePrompt = 'Generate a concise, descriptive title (maximum 60 characters) for this meeting. Return ONLY the title, nothing else.';
        const defaultSummaryPrompt = 'Summarize this meeting transcript in a structured way. Include key points, decisions made, and action items.';

        const finalTitlePrompt = titlePrompt || defaultTitlePrompt;
        const finalSummaryPrompt = summaryPrompt || defaultSummaryPrompt;

        // #region agent log
        debugLog('useAI:generateParallel', '⚡ STARTING PARALLEL GENERATION', {
            transcriptLength: transcript.length,
            transcriptPreview: transcript.substring(0, 200),
            hasTitlePrompt: !!titlePrompt,
            titlePromptLength: titlePrompt?.length || 0,
            titlePromptPreview: (titlePrompt || defaultTitlePrompt).substring(0, 100),
            hasSummaryPrompt: !!summaryPrompt,
            summaryPromptLength: summaryPrompt?.length || 0,
            summaryPromptPreview: (summaryPrompt || defaultSummaryPrompt).substring(0, 100),
            hasStreamingCallback: !!onSummaryChunk
        }, 'PARALLEL');
        // #endregion

        // Generate title and summary in parallel
        const [titleResult, summaryResult] = await Promise.all([
            // Title generation (non-streaming, usually fast)
            generate({
                systemPrompt: 'You are an expert meeting assistant. Generate a concise title.',
                userPrompt: `${finalTitlePrompt}\n\nTranscript:\n${transcript.substring(0, 3000)}`
            }),
            // Summary generation (streaming if callback provided)
            onSummaryChunk 
                ? generateStream({
                    systemPrompt: 'You are an expert meeting assistant. Summarize the transcript.',
                    userPrompt: `${finalSummaryPrompt}\n\nTranscript:\n${transcript}`,
                    callbacks: {
                        onChunk: (chunk) => {
                            onSummaryChunk(chunk);
                        },
                        onComplete: (text) => {
                            // #region agent log
                            debugLog('useAI:generateParallel', '✅ SUMMARY STREAM COMPLETE', {
                                summaryLength: text.length,
                                summaryPreview: text.substring(0, 200)
                            }, 'PARALLEL');
                            // #endregion
                        }
                    }
                })
                : generate({
                    systemPrompt: 'You are an expert meeting assistant. Summarize the transcript.',
                    userPrompt: `${finalSummaryPrompt}\n\nTranscript:\n${transcript}`
                })
        ]);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        // #region agent log
        debugLog('useAI:generateParallel', '⚡ PARALLEL GENERATION COMPLETE', {
            durationSeconds: duration,
            titleLength: titleResult.length,
            titleResult: titleResult.substring(0, 60),
            summaryLength: summaryResult.length,
            summaryPreview: summaryResult.substring(0, 200)
        }, 'PARALLEL');
        // #endregion

        // Clean title: remove markdown formatting (**bold**, *italic*), quotes, newlines
        const cleanTitle = titleResult
            .replace(/\*\*/g, '')  // Remove **bold**
            .replace(/\*/g, '')   // Remove *italic*
            .replace(/["']/g, '') // Remove quotes
            .replace(/\n/g, ' ')  // Replace newlines with spaces
            .replace(/^(Titre|Title)\s*:\s*/i, '') // Remove "Titre:" or "Title:" prefix
            .trim()
            .substring(0, 80);    // Limit length
        
        return {
            title: cleanTitle,
            summary: summaryResult.trim()
        };
    }, [generate, generateStream]);

    // 🎙️ GEMINI AUDIO TRANSCRIPTION WITH DIARIZATION
    const transcribeWithGemini = useCallback(async (
        audioBlob: Blob,
        options?: {
            model?: string;
            language?: string;
            enableDiarization?: boolean;
            onProgress?: (progress: number) => void;
        }
    ): Promise<{
        text: string;
        segments: Array<{
            speaker: string;
            text: string;
            start?: number;
            end?: number;
        }>;
        language?: string;
    }> => {
        const model = options?.model || 'gemini-2.5-flash';
        const language = options?.language || 'auto';
        const enableDiarization = options?.enableDiarization ?? true;

        // #region agent log
        debugLog('useAI:transcribeWithGemini', '🎙️ STARTING GEMINI TRANSCRIPTION', {
            audioBlobSize: audioBlob.size,
            audioBlobType: audioBlob.type,
            model,
            language,
            enableDiarization
        }, 'TRANSCRIBE');
        // #endregion

        const apiKey = await getApiKey('google');
        if (!apiKey) {
            throw new Error('Google API Key not found. Please add it in Settings.');
        }

        // Convert audio blob to base64
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64Audio = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        // Determine MIME type
        let mimeType = audioBlob.type || 'audio/webm';
        if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
            mimeType = 'audio/mp4';
        } else if (mimeType.includes('webm')) {
            mimeType = 'audio/webm';
        } else if (mimeType.includes('wav')) {
            mimeType = 'audio/wav';
        }

        options?.onProgress?.(10);

        // Build the transcription prompt with diarization instructions
        const transcriptionPrompt = enableDiarization
            ? `Transcribe this audio with speaker diarization. 
               
Instructions:
- Identify each speaker (Speaker_01, Speaker_02, etc.) or use their names if mentioned
- Provide timestamps if possible (in MM:SS format)
- Language: ${language === 'auto' ? 'Detect automatically' : language}
- If only ONE speaker is present, label them as "Speaker_01" only

Output format (JSON):
{
  "language": "detected language code",
  "segments": [
    {"speaker": "Speaker_01", "text": "What they said", "start": "00:00", "end": "00:05"},
    {"speaker": "Speaker_02", "text": "Their response", "start": "00:06", "end": "00:12"}
  ]
}

Return ONLY valid JSON, no markdown or explanation.`
            : `Transcribe this audio accurately.
Language: ${language === 'auto' ? 'Detect automatically' : language}

Output format (JSON):
{
  "language": "detected language code",
  "text": "Full transcription text"
}

Return ONLY valid JSON, no markdown or explanation.`;

        // Determine API version
        const cleanModel = model.replace(/^models\//, '');
        const needsBeta = cleanModel.includes('exp') || 
                          cleanModel.includes('preview') || 
                          cleanModel.startsWith('gemini-3') ||
                          cleanModel.startsWith('gemini-2.5') ||
                          cleanModel.startsWith('gemini-2.0');
        const apiVersion = needsBeta ? 'v1beta' : 'v1';

        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${cleanModel}:generateContent?key=${apiKey}`;

        // #region agent log
        debugLog('useAI:transcribeWithGemini', '📡 SENDING TO GEMINI', {
            url: url.replace(apiKey, '***'),
            mimeType,
            audioSizeKB: Math.round(base64Audio.length / 1024),
            promptLength: transcriptionPrompt.length
        }, 'TRANSCRIBE');
        // #endregion

        options?.onProgress?.(30);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Audio
                                }
                            },
                            {
                                text: transcriptionPrompt
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.1, // Low temperature for accuracy
                    topP: 0.95,
                    maxOutputTokens: 8192
                }
            })
        });

        options?.onProgress?.(70);

        if (!response.ok) {
            const error = await response.json();
            // #region agent log
            debugLog('useAI:transcribeWithGemini', '❌ GEMINI ERROR', { error, status: response.status }, 'TRANSCRIBE');
            // #endregion
            throw new Error(error.error?.message || `Gemini API error: ${response.statusText}`);
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // #region agent log
        debugLog('useAI:transcribeWithGemini', '📥 RAW RESPONSE', {
            rawTextLength: rawText.length,
            rawTextPreview: rawText.substring(0, 500)
        }, 'TRANSCRIBE');
        // #endregion

        options?.onProgress?.(90);

        // Parse the JSON response
        let result: { text: string; segments: any[]; language?: string };

        try {
            // Clean the response (remove markdown code blocks if present)
            let cleanedText = rawText.trim();
            if (cleanedText.startsWith('```json')) {
                cleanedText = cleanedText.slice(7);
            } else if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.slice(3);
            }
            if (cleanedText.endsWith('```')) {
                cleanedText = cleanedText.slice(0, -3);
            }
            cleanedText = cleanedText.trim();

            const parsed = JSON.parse(cleanedText);

            if (enableDiarization && parsed.segments) {
                result = {
                    text: parsed.segments.map((s: any) => s.text).join(' '),
                    segments: parsed.segments.map((s: any) => ({
                        speaker: s.speaker || 'Speaker_01',
                        text: s.text,
                        start: s.start,
                        end: s.end
                    })),
                    language: parsed.language
                };
            } else {
                result = {
                    text: parsed.text || rawText,
                    segments: [{
                        speaker: 'Speaker_01',
                        text: parsed.text || rawText
                    }],
                    language: parsed.language
                };
            }
        } catch (parseError) {
            // If JSON parsing fails, use raw text
            // #region agent log
            debugLog('useAI:transcribeWithGemini', '⚠️ JSON PARSE FAILED, USING RAW', { error: (parseError as Error).message }, 'TRANSCRIBE');
            // #endregion
            result = {
                text: rawText,
                segments: [{
                    speaker: 'Speaker_01',
                    text: rawText
                }]
            };
        }

        options?.onProgress?.(100);

        // #region agent log
        debugLog('useAI:transcribeWithGemini', '✅ TRANSCRIPTION COMPLETE', {
            textLength: result.text.length,
            segmentsCount: result.segments.length,
            speakers: [...new Set(result.segments.map(s => s.speaker))],
            language: result.language
        }, 'TRANSCRIBE');
        // #endregion

        return result;
    }, []);

    // 🎙️ GEMINI LIVE API - Real-time streaming transcription via WebSocket
    const startGeminiLiveTranscription = useCallback(async (
        options: {
            model?: string;
            language?: string;
            onTranscript?: (text: string, isFinal: boolean) => void;
            onSpeakerChange?: (speaker: string) => void;
            onError?: (error: Error) => void;
        }
    ): Promise<{
        sendAudioChunk: (chunk: ArrayBuffer) => void;
        stop: () => void;
        isConnected: () => boolean;
    }> => {
        const model = options?.model || 'gemini-2.0-flash-live-001';
        const language = options?.language || 'fr';

        // #region agent log
        debugLog('useAI:startGeminiLive', '🎙️ STARTING GEMINI LIVE TRANSCRIPTION', {
            model,
            language
        }, 'LIVE');
        // #endregion

        const apiKey = await getApiKey('google');
        if (!apiKey) {
            throw new Error('Google API Key not found. Please add it in Settings.');
        }

        // WebSocket URL for Gemini Live API
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

        let ws: WebSocket | null = null;
        let isConnected = false;
        let fullTranscript = '';

        return new Promise((resolve, reject) => {
            try {
                ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                    isConnected = true;
                    // #region agent log
                    debugLog('useAI:startGeminiLive', '✅ WEBSOCKET CONNECTED', {}, 'LIVE');
                    // #endregion

                    // Send setup message
                    const setupMessage = {
                        setup: {
                            model: `models/${model}`,
                            generation_config: {
                                response_modalities: ['TEXT'],
                                speech_config: {
                                    voice_config: {
                                        prebuilt_voice_config: {
                                            voice_name: 'Aoede'
                                        }
                                    }
                                }
                            },
                            system_instruction: {
                                parts: [{
                                    text: `You are a real-time transcription assistant. 
                                    Transcribe the audio input accurately in ${language}.
                                    Identify different speakers if possible (Speaker_01, Speaker_02, etc.).
                                    Output ONLY the transcription, no commentary.`
                                }]
                            },
                            tools: [],
                            // Enable input audio transcription
                            input_audio_transcription: {}
                        }
                    };

                    ws!.send(JSON.stringify(setupMessage));

                    // #region agent log
                    debugLog('useAI:startGeminiLive', '📤 SETUP MESSAGE SENT', { model }, 'LIVE');
                    // #endregion

                    resolve({
                        sendAudioChunk: (chunk: ArrayBuffer) => {
                            if (ws && isConnected && ws.readyState === WebSocket.OPEN) {
                                // Convert to base64
                                const base64 = btoa(
                                    new Uint8Array(chunk).reduce((data, byte) => data + String.fromCharCode(byte), '')
                                );

                                const audioMessage = {
                                    realtime_input: {
                                        media_chunks: [{
                                            mime_type: 'audio/pcm',
                                            data: base64
                                        }]
                                    }
                                };

                                ws.send(JSON.stringify(audioMessage));
                            }
                        },
                        stop: () => {
                            if (ws) {
                                // Send end of turn
                                ws.send(JSON.stringify({ client_content: { turn_complete: true } }));
                                
                                setTimeout(() => {
                                    if (ws) {
                                        ws.close();
                                        isConnected = false;
                                    }
                                }, 500);
                            }
                            // #region agent log
                            debugLog('useAI:startGeminiLive', '🛑 STOPPED', { fullTranscript: fullTranscript.substring(0, 200) }, 'LIVE');
                            // #endregion
                        },
                        isConnected: () => isConnected && ws?.readyState === WebSocket.OPEN
                    });
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);

                        // Handle setup complete
                        if (data.setupComplete) {
                            // #region agent log
                            debugLog('useAI:startGeminiLive', '✅ SETUP COMPLETE', {}, 'LIVE');
                            // #endregion
                            return;
                        }

                        // Handle transcription from input audio
                        if (data.serverContent?.inputTranscription) {
                            const transcript = data.serverContent.inputTranscription.text || '';
                            const isFinal = data.serverContent.inputTranscription.finished || false;
                            
                            if (transcript) {
                                fullTranscript = isFinal ? fullTranscript + transcript + ' ' : fullTranscript;
                                options.onTranscript?.(transcript, isFinal);
                                
                                // #region agent log
                                if (isFinal) {
                                    debugLog('useAI:startGeminiLive', '📝 TRANSCRIPT CHUNK', {
                                        text: transcript.substring(0, 100),
                                        isFinal
                                    }, 'LIVE');
                                }
                                // #endregion
                            }
                        }

                        // Handle model output (text response)
                        if (data.serverContent?.modelTurn?.parts) {
                            const parts = data.serverContent.modelTurn.parts;
                            for (const part of parts) {
                                if (part.text) {
                                    options.onTranscript?.(part.text, true);
                                }
                            }
                        }

                        // Handle turn complete
                        if (data.serverContent?.turnComplete) {
                            // #region agent log
                            debugLog('useAI:startGeminiLive', '✅ TURN COMPLETE', {
                                fullTranscriptLength: fullTranscript.length
                            }, 'LIVE');
                            // #endregion
                        }

                    } catch (e) {
                        // Ignore parse errors for binary data
                    }
                };

                ws.onerror = (error) => {
                    // #region agent log
                    debugLog('useAI:startGeminiLive', '❌ WEBSOCKET ERROR', { error: String(error) }, 'LIVE');
                    // #endregion
                    options.onError?.(new Error('WebSocket error'));
                    isConnected = false;
                };

                ws.onclose = (event) => {
                    // #region agent log
                    debugLog('useAI:startGeminiLive', '🔌 WEBSOCKET CLOSED', {
                        code: event.code,
                        reason: event.reason
                    }, 'LIVE');
                    // #endregion
                    isConnected = false;
                };

            } catch (error) {
                // #region agent log
                debugLog('useAI:startGeminiLive', '❌ INIT ERROR', { error: (error as Error).message }, 'LIVE');
                // #endregion
                reject(error);
            }
        });
    }, []);

    return {
        generate,
        generateStream,
        generateParallel,
        transcribeWithGemini,
        startGeminiLiveTranscription,
        isGenerating
    };
}
