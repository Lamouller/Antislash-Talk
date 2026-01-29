import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOllama } from './useOllama';


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
            throw new Error(error.error?.message || 'OpenAI API error');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

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
                                callbacks.onChunk?.(content);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        }

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

        console.log(`🚀 Streaming Google API: ${cleanModel} (${apiVersion})`);

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
            throw new Error(error.error?.message || `Google API error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

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
                                callbacks.onChunk?.(content);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        }

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
        
        try {
            let profile;
            try {
                profile = await getProfileSettings();
            } catch (err) {
                console.warn('⚠️ Failed to fetch user profile:', err);
            }

            let provider = overrideProvider || profile?.preferred_llm || 'openai';
            let model = overrideModel || profile?.preferred_llm_model;

            if (provider !== 'local') {
                const apiKey = await getApiKey(provider);

                if (!apiKey) {
                    const providers = ['google', 'openai', 'mistral'];
                    for (const p of providers) {
                        const key = await getApiKey(p);
                        if (key) {
                            provider = p as AIProvider;
                            model = undefined;
                            break;
                        }
                    }
                }
            }

            const apiKey = await getApiKey(provider);
            if (!apiKey && provider !== 'local') {
                throw new Error(`API Key for ${provider.toUpperCase()} not found.`);
            }

            console.log(`🚀 Streaming with ${provider.toUpperCase()} (${model || 'default'})`);

            let result = '';
            switch (provider) {
                case 'openai':
                    result = await generateOpenAIStream(apiKey!, model || 'gpt-4o-mini', systemPrompt, userPrompt, callbacks);
                    break;
                case 'google':
                    result = await generateGoogleStream(apiKey!, model || 'gemini-2.5-flash', systemPrompt, userPrompt, callbacks);
                    break;
                default:
                    // Fallback to non-streaming for other providers
                    result = await generate({ systemPrompt, userPrompt, model, provider });
                    callbacks.onComplete?.(result);
            }

            return result;
        } catch (error: any) {
            callbacks.onError?.(error);
            throw error;
        } finally {
            setIsGenerating(false);
        }
    }, [generate]);

    // ⚡ PARALLEL GENERATION - Generate title and summary at the same time
    const generateParallel = useCallback(async (
        transcript: string,
        titlePrompt: string,
        summaryPrompt: string,
        onSummaryChunk?: (chunk: string) => void
    ): Promise<{ title: string; summary: string }> => {
        console.log('⚡ Starting PARALLEL generation (title + summary)');
        const startTime = Date.now();

        // Generate title and summary in parallel
        const [titleResult, summaryResult] = await Promise.all([
            // Title generation (non-streaming, usually fast)
            generate({
                systemPrompt: titlePrompt,
                userPrompt: transcript.substring(0, 3000) // First 3000 chars for title
            }),
            // Summary generation (streaming if callback provided)
            onSummaryChunk 
                ? generateStream({
                    systemPrompt: summaryPrompt,
                    userPrompt: transcript,
                    callbacks: {
                        onChunk: onSummaryChunk,
                        onComplete: (text) => console.log(`✅ Summary complete: ${text.length} chars`)
                    }
                })
                : generate({
                    systemPrompt: summaryPrompt,
                    userPrompt: transcript
                })
        ]);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⚡ PARALLEL generation complete in ${duration}s`);

        return {
            title: titleResult.trim(),
            summary: summaryResult.trim()
        };
    }, [generate, generateStream]);

    return {
        generate,
        generateStream,
        generateParallel,
        isGenerating
    };
}
