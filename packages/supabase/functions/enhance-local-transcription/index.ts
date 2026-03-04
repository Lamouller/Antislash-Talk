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
  const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

  // Check if API key is available
  if (!apiKey) {
    console.error('⚠️ No Google API key available, returning transcript as-is with warning');
    return {
      title: request.raw_transcript.split('.')[0]?.substring(0, 50) || 'Meeting',
      summary: `⚠️ Google API key not configured. Original transcript: ${request.raw_transcript.substring(0, 300)}...`,
      transcript: {
        utterances: request.chunks ? request.chunks.map(chunk => ({
          start: chunk.start,
          end: chunk.end,
          speaker: chunk.speaker.includes('Locuteur') ? parseInt(chunk.speaker.replace('Locuteur_', '')) - 1 : 0,
          text: chunk.text
        })) : [{ start: 0, end: 0, speaker: 0, text: request.raw_transcript }]
      },
      participant_count: request.chunks ? new Set(request.chunks.map(c => c.speaker)).size : 1,
      warning: 'Google API key not configured'
    };
  }

  // Build the prompt using user-provided prompts
  const analysisPrompt = `
CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No markdown, no code blocks, no extra text. Just pure JSON.

Analyze the following meeting transcript (in French). Generate a structured JSON object with the following three fields: "title", "summary", and "transcript".

REQUIRED JSON STRUCTURE:
{
  "title": "string (concise, 60 chars max)",
  "summary": "string (structured summary)",
  "transcript": {
    "utterances": [
      {
        "start": number (seconds),
        "end": number (seconds),
        "speaker": number (0-indexed speaker ID),
        "text": "string"
      }
    ]
  }
}

DETAILED INSTRUCTIONS:

1. **title**: ${request.prompts.title}

2. **summary**: ${request.prompts.summary}

3. **transcript**: ${request.prompts.transcript}
   - Output format: Object with "utterances" array
   - Each utterance has: start (number), end (number), speaker (number, 0-indexed), text (string)
   - Use timestamps from the original chunks if available
   - Ensure speaker IDs are consistent throughout

${request.chunks ? `
Original speaker segments for reference:
${request.chunks.map((chunk, i) => `[${i}] ${chunk.speaker} (${chunk.start}s-${chunk.end}s): ${chunk.text.substring(0, 100)}...`).join('\n')}
` : ''}

Raw transcript to analyze:
---
${request.raw_transcript}
---

REMINDER: Respond with ONLY the JSON object. No markdown formatting, no explanations.
  `;

  try {
    const response = await fetch(`${GEMINI_API_BASE_URL}/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: analysisPrompt }]
        }],
        generation_config: {
          "response_mime_type": "application/json",
          "temperature": 0.3
        },
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('❌ Google API failed:', errorBody);
      throw new Error(`Google API (enhancement) failed: ${errorBody}`);
    }

    const result = await response.json();
    if (!result.candidates || !result.candidates[0]?.content?.parts[0]?.text) {
      throw new Error("Enhancement result from Google was empty or in an unexpected format.");
    }

    const rawText = result.candidates[0].content.parts[0].text;
    console.log("🔍 RAW TEXT FROM GEMINI (first 300 chars):", rawText.substring(0, 300));

    // Clean markdown formatting if present
    let cleanedText = rawText
      .replace(/^```json\n?/, '')
      .replace(/\n?```$/, '')
      .replace(/^```\n?/, '')
      .trim();

    let parsedJson;
    try {
      parsedJson = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("❌ JSON PARSE ERROR:", parseError);
      console.error("❌ FAILED TEXT:", cleanedText.substring(0, 500));
      throw new Error(`Failed to parse Gemini response as JSON: ${parseError.message}`);
    }

    // Handle array response (Gemini sometimes wraps in array)
    if (Array.isArray(parsedJson) && parsedJson.length > 0) {
      parsedJson = parsedJson[0];
    }

    // Ensure transcript.utterances format is correct
    if (parsedJson.transcript && Array.isArray(parsedJson.transcript)) {
      // Convert flat array to utterances format
      parsedJson.transcript = {
        utterances: parsedJson.transcript.map((item: any, index: number) => ({
          start: item.start || (request.chunks?.[index]?.start) || index * 10,
          end: item.end || (request.chunks?.[index]?.end) || (index + 1) * 10,
          speaker: typeof item.speaker === 'number' ? item.speaker : (typeof item.speaker === 'string' && item.speaker.includes('Locuteur')
            ? parseInt(item.speaker.replace('Locuteur_', '')) - 1
            : index % 2),
          text: item.text || ''
        }))
      };
    }

    // Count unique speakers
    const speakers = new Set();
    if (parsedJson.transcript?.utterances) {
      parsedJson.transcript.utterances.forEach((u: any) => speakers.add(u.speaker));
    }
    parsedJson.participant_count = speakers.size;

    console.log("✅ Google enhancement completed successfully");
    return parsedJson;

  } catch (error) {
    console.error('⚠️ Google API error, returning original transcript:', error);
    // Fallback: return original transcript with warning
    return {
      title: request.raw_transcript.split('.')[0]?.substring(0, 50) || 'Meeting',
      summary: `⚠️ Enhancement failed: ${error.message}. Original transcript: ${request.raw_transcript.substring(0, 300)}...`,
      transcript: {
        utterances: request.chunks ? request.chunks.map(chunk => ({
          start: chunk.start,
          end: chunk.end,
          speaker: chunk.speaker.includes('Locuteur') ? parseInt(chunk.speaker.replace('Locuteur_', '')) - 1 : 0,
          text: chunk.text
        })) : [{ start: 0, end: 0, speaker: 0, text: request.raw_transcript }]
      },
      participant_count: request.chunks ? new Set(request.chunks.map(c => c.speaker)).size : 1,
      warning: `Enhancement failed: ${error.message}`
    };
  }
}

export const handler = async (req: Request) => {
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
};

// Start server if this file is the main entry point
if (import.meta.main) {
  Deno.serve(handler);
} 