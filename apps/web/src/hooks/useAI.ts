import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOllama } from './useOllama';
import toast from 'react-hot-toast';

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
        // Note: Gemini API structure is slightly different
        const modelId = model || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    { role: 'user', parts: [{ text: `${system}\n\n${user}` }] }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Google API error');
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    };

    const generate = useCallback(async ({ systemPrompt, userPrompt, model: overrideModel, provider: overrideProvider }: GenerateOptions) => {
        setIsGenerating(true);
        try {
            // 1. Get configurations
            const profile = await getProfileSettings();

            // Determine provider and model
            // Logic: Settings > Default to OpenAI if not set. BUT if override is provided, use that.
            // Actually, for Prompt Workshop, we want to respect the Global Settings, but allow falling back to local if configured?
            // "preferred_llm" in profile maps to 'openai', 'mistral', 'google', 'local' (conceptually, though UI might save 'openai' and model 'llama3' ?? No, see `prompts.tsx` logic)
            // Let's assume Profile saves provider in `preferred_llm`

            const provider = overrideProvider || profile?.preferred_llm || 'openai';
            const model = overrideModel || profile?.preferred_llm_model;

            console.log(`🤖 AI Generation: Using ${provider} (${model})`);

            let result = '';

            if (provider === 'local') {
                // Use Ollama
                // If model is 'none', well... we can't do much.
                if (!model || model === 'none') {
                    throw new Error('No local model selected in settings');
                }
                result = await generateOllama(model, `${systemPrompt}\n\n${userPrompt}`);

            } else {
                // Cloud Providers
                const apiKey = await getApiKey(provider);

                if (!apiKey) {
                    throw new Error(`API Key for ${provider} not found. Please add it in Settings.`);
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
