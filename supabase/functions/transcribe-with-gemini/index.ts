import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const OPENAI_API_BASE_URL = 'https://api.openai.com/v1'

interface Prompts {
  title?: string;
  summary?: string;
  transcript?: string;
}

// --- Helper for Google Gemini ---
async function handleGoogleTranscription(apiKey: string, model: string, audioBlob: Blob, prompts: Prompts) {
  const audioBase64 = btoa(
    new Uint8Array(await audioBlob.arrayBuffer())
      .reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  const defaultPrompts = {
    title: 'A short, descriptive title for the meeting (in French).',
    summary: 'A concise one-paragraph summary of the key discussion points and decisions (in French).',
    transcript: `A detailed, diarized transcript. Here's how to identify speakers:
    - **Priority 1:** If a speaker introduces themselves or is named (e.g., "Hello, this is Marc," "Paul, what do you think?"), use that name as their identifier for all their speech segments.
    - **Priority 2:** If names are not mentioned, use generic identifiers like "Locuteur_01", "Locuteur_02", etc.
    - **Crucial Rule:** If you only detect one distinct voice throughout the recording, all text must be attributed to a single speaker (e.g., "Locuteur_01" or their identified name). Do NOT invent a second speaker.
    - Ensure each speech segment is correctly attributed to the speaker.`
  };

  const finalPrompt = `
Analyze this audio recording of a meeting. The recording is in French. Provide the following information in a structured JSON format. IMPORTANT: The "title", "summary", and "transcript" texts MUST be in French.

1. "title": ${prompts.title || defaultPrompts.title}
2. "summary": ${prompts.summary || defaultPrompts.summary}
3. "transcript": ${prompts.transcript || defaultPrompts.transcript}
    `;
  
  const response = await fetch(`${GEMINI_API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: finalPrompt },
          { inline_data: { mime_type: 'audio/webm', data: audioBase64 } }
        ]
      }],
      generation_config: { "response_mime_type": "application/json" },
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google API (transcription) failed: ${errorBody}`);
  }
  
  const result = await response.json();
  if (!result.candidates || !result.candidates[0]?.content?.parts[0]?.text) {
    throw new Error("Transcription result from Google was empty or in an unexpected format.");
  }

  const cleanedText = result.candidates[0].content.parts[0].text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  const parsedJson = JSON.parse(cleanedText);

  if (parsedJson && typeof parsedJson.transcript === 'string') {
    parsedJson.transcript = JSON.parse(parsedJson.transcript);
  }

  return parsedJson;
}

// --- Helper for OpenAI ---
async function handleOpenAITranscription(apiKey: string, model: string, audioBlob: Blob, prompts: Prompts) {
  // Step 1: Transcribe with Whisper
  const formData = new FormData();
  formData.append('file', audioBlob, 'meeting.webm');
  formData.append('model', model);
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'fr');

  const whisperResponse = await fetch(`${OPENAI_API_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (!whisperResponse.ok) {
    const errorBody = await whisperResponse.text();
    throw new Error(`OpenAI Whisper API failed: ${errorBody}`);
  }

  const whisperResult = await whisperResponse.json();
  const rawTranscript = whisperResult.text;

  const defaultPrompts = {
    title: 'A short, descriptive title for the meeting (in French).',
    summary: 'A concise one-paragraph summary of the key discussion points and decisions (in French).',
    transcript: `A detailed, diarized transcript in French. Re-create the transcript from the text provided below. The output for this field must be an array of objects, where each object has "speaker" and "text" properties. Follow these rules for identifying speakers:
     - **Priority 1:** Try to identify speakers by name if they introduce themselves or are mentioned in the text.
     - **Priority 2:** If names are not available, use generic identifiers like "Locuteur_01", "Locuteur_02", etc.
     - **Crucial Rule:** If the context suggests only one person is speaking, attribute all text to a single speaker. Do not invent extra speakers.`
  };

  // Step 2: Analyze with GPT
  const analysisPrompt = `
  Analyze the following meeting transcript, which is in French. Generate a structured JSON object with the following three fields: "title", "summary", and "transcript".

  1.  **title**: ${prompts.title || defaultPrompts.title}
  2.  **summary**: ${prompts.summary || defaultPrompts.summary}
  3.  **transcript**: ${prompts.transcript || defaultPrompts.transcript}

  Here is the transcript to analyze:
  ---
  ${rawTranscript}
  ---
  `;

  const gptResponse = await fetch(`${OPENAI_API_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o', // Or another powerful model
      messages: [{ role: 'user', content: analysisPrompt }],
      response_format: { type: 'json_object' }
    })
  });

  if (!gptResponse.ok) {
    const errorBody = await gptResponse.text();
    throw new Error(`OpenAI GPT API failed: ${errorBody}`);
  }

  const gptResult = await gptResponse.json();
  const resultJson = JSON.parse(gptResult.choices[0].message.content);
  
  // Robustness check: if transcript is a string, parse it again.
  if (resultJson && typeof resultJson.transcript === 'string') {
    try {
      resultJson.transcript = JSON.parse(resultJson.transcript);
    } catch (e) {
      console.error("Failed to re-parse transcript string:", e);
      // Keep it as a string if re-parsing fails, to avoid crashing.
    }
  }

  return resultJson;
}


// --- Main Function ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { meeting_id } = await req.json();
    if (!meeting_id) throw new Error('Missing meeting_id');

    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );

    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (!user) throw new Error('User not found');

    const serviceSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: profile } = await serviceSupabaseClient
      .from('profiles')
      .select('preferred_transcription_provider, preferred_transcription_model, prompt_title, prompt_summary, prompt_transcript')
      .eq('id', user.id)
      .single();

    const provider = profile?.preferred_transcription_provider || 'google';
    const model = profile?.preferred_transcription_model || (provider === 'google' ? 'gemini-1.5-pro-latest' : 'whisper-1');

    console.log(`Using provider: ${provider}, model: ${model}`);

    const { data: apiKeyData } = await serviceSupabaseClient
      .from('api_keys')
      .select('encrypted_key')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();

    if (!apiKeyData?.encrypted_key) throw new Error(`${provider} API key not found.`);

    const recordingPath = `${user.id}/${meeting_id}.webm`;

    const audioBlob = await serviceSupabaseClient.storage
      .from('meetingrecordings')
      .download(recordingPath);
      
    if (audioBlob.error) throw new Error(`Failed to download audio: ${audioBlob.error.message}`);
    if (!audioBlob.data) throw new Error('Downloaded audio data is null.');

    const userPrompts: Prompts = {
      title: profile?.prompt_title,
      summary: profile?.prompt_summary,
      transcript: profile?.prompt_transcript,
    };

    let analysisResult;
    if (provider === 'google') {
      analysisResult = await handleGoogleTranscription(apiKeyData.encrypted_key, model, audioBlob.data, userPrompts);
    } else if (provider === 'openai') {
      analysisResult = await handleOpenAITranscription(apiKeyData.encrypted_key, model, audioBlob.data, userPrompts);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const speakers = new Set(analysisResult.transcript?.map((segment: any) => segment.speaker) || []);
    const participantCount = speakers.size;

    const { error: updateError } = await serviceSupabaseClient
      .from('meetings')
      .update({
        recording_url: `${user.id}/${meeting_id}.webm`,
        transcript: analysisResult.transcript || null,
        summary: analysisResult.summary || null,
        title: analysisResult.title || `Meeting - ${new Date().toLocaleDateString()}`,
        status: 'completed',
        transcription_provider: provider,
        transcription_model: model,
        participant_count: participantCount,
      })
      .eq('id', meeting_id);

    if (updateError) throw updateError;
    
    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in main function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 