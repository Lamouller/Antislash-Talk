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

export function useAI() {
    const [isGenerating, setIsGenerating] = useState(false);
    const { generate: generateOllama } = useOllama();

    const getProfileSettings = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not logged in');

        const { data: profile } = await supabase
            .from('profiles')
            .select('preferred_llm, preferred_llm_model')
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
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || 'gpt-4o',
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API error');
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    };

    const generateMistral = async (apiKey: string, model: string, system: string, user: string) => {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || 'mistral-small-latest',
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user }
                ]
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
        // Default to the latest stable flash model (002) which is very reliable
        const cleanModel = (model || 'gemini-1.5-flash-002').replace(/^models\//, '');

        // Use v1beta for widespread compatibility (1.5, 2.0, etc.)
        const apiVersion = 'v1beta';

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
                            // Reset model to default for that provider since the old model ID might be invalid
                            model = undefined;
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

    return {
        generate,
        isGenerating
    };
}
