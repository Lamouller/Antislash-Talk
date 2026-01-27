import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_API_BASE_URL = 'https://api.openai.com/v1'

interface EnhancementRequest {
  raw_transcript: string;
  chunks?: Array<{
    start: number;
    end: number;
    speaker: string;
    text: string;
  }>;
  prompts: {
    title: string;
    summary: string;
    transcript: string;
  };
  user_id: string;
}

// Helper function to enhance transcription with OpenAI
async function enhanceWithOpenAI(apiKey: string, request: EnhancementRequest) {
  const analysisPrompt = `
Analyze the following meeting transcript, which is in French. Generate a structured JSON object with the following three fields: "title", "summary", and "transcript".

1. **title**: ${request.prompts.title}
2. **summary**: ${request.prompts.summary}  
3. **transcript**: ${request.prompts.transcript}

The output for the "transcript" field must be an array of objects, where each object has "speaker" and "text" properties.

Here is the transcript to analyze:
---
${request.raw_transcript}
---

${request.chunks ? `
Original speaker segments for reference:
${request.chunks.map((chunk, i) => `[${i}] ${chunk.speaker}: ${chunk.text.substring(0, 100)}...`).join('\n')}
` : ''}
`;

  const response = await fetch(`${OPENAI_API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-5-mini', // Latest cost-effective model for post-processing
      messages: [{ role: 'user', content: analysisPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Low temperature for consistent results
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API failed: ${errorBody}`);
  }

  const result = await response.json();
  const enhancedData = JSON.parse(result.choices[0].message.content);
  
  // Convert transcript format if needed
  if (enhancedData.transcript && typeof enhancedData.transcript === 'string') {
    try {
      enhancedData.transcript = JSON.parse(enhancedData.transcript);
    } catch (e) {
      console.error("Failed to parse transcript string:", e);
    }
  }

  // Ensure transcript is in correct format
  if (enhancedData.transcript && Array.isArray(enhancedData.transcript)) {
    enhancedData.transcript = {
      utterances: enhancedData.transcript.map((item: any, index: number) => ({
        start: request.chunks?.[index]?.start || index * 10,
        end: request.chunks?.[index]?.end || (index + 1) * 10,
        speaker: typeof item.speaker === 'string' && item.speaker.includes('Locuteur') 
          ? parseInt(item.speaker.replace('Locuteur_', '')) - 1 
          : index % 2, // Default alternating speakers
        text: item.text || item
      }))
    };
  }

  // Count unique speakers
  const speakers = new Set();
  if (enhancedData.transcript?.utterances) {
    enhancedData.transcript.utterances.forEach((u: any) => speakers.add(u.speaker));
  }
  enhancedData.participant_count = speakers.size;

  return enhancedData;
}

// Helper function to enhance with Google/Gemini
async function enhanceWithGoogle(apiKey: string, request: EnhancementRequest) {
  // Similar implementation for Google Gemini
  // For now, return a basic structure
  return {
    title: request.raw_transcript.split('.')[0]?.substring(0, 50) + '...',
    summary: `Résumé automatique: ${request.raw_transcript.substring(0, 200)}...`,
    transcript: {
      utterances: request.chunks ? request.chunks.map(chunk => ({
        start: chunk.start,
        end: chunk.end,
        speaker: chunk.speaker.includes('Locuteur') ? parseInt(chunk.speaker.replace('Locuteur_', '')) - 1 : 0,
        text: chunk.text
      })) : [{ start: 0, end: 0, speaker: 0, text: request.raw_transcript }]
    },
    participant_count: request.chunks ? new Set(request.chunks.map(c => c.speaker)).size : 1
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const requestBody: EnhancementRequest = await req.json()
    
    console.log('Enhancement request received for user:', requestBody.user_id)

    // Get user's preferred LLM and API key
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferred_llm')
      .eq('id', requestBody.user_id)
      .single()

    const preferredProvider = profile?.preferred_llm || 'openai'
    
    // Get API key for the preferred provider
    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('encrypted_key')
      .eq('user_id', requestBody.user_id)
      .eq('provider', preferredProvider)
      .single()

    if (!apiKeyData?.encrypted_key) {
      throw new Error(`No API key found for provider: ${preferredProvider}`)
    }

    const apiKey = apiKeyData.encrypted_key // In production, this should be decrypted

    let enhancedResult
    
    switch (preferredProvider) {
      case 'openai':
        enhancedResult = await enhanceWithOpenAI(apiKey, requestBody)
        break
      case 'google':
        enhancedResult = await enhanceWithGoogle(apiKey, requestBody)
        break
      default:
        // Fallback to OpenAI
        enhancedResult = await enhanceWithOpenAI(apiKey, requestBody)
    }

    console.log('Enhancement completed successfully')

    return new Response(JSON.stringify(enhancedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Enhancement error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 