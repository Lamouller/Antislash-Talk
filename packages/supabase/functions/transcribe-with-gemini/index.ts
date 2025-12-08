import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const OPENAI_API_BASE_URL = 'https://api.openai.com/v1'
const PYTORCH_SERVICE_URL = Deno.env.get('PYTORCH_SERVICE_URL') || 'http://transcription-pytorch:8000'

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

  // Language will be determined by the caller, use 'fr' as default
  const isEnglish = false; // Will be updated by caller

  const defaultPrompts = {
    title: isEnglish
      ? 'Concise and informative meeting title (60 chars max, in English). Gemini, use your contextual understanding to capture the essence of the discussion.'
      : 'Titre de réunion concis et informatif (60 caractères max, en français). Gemini, utilisez votre compréhension contextuelle pour capturer l\'essence de la discussion.',
    summary: isEnglish
      ? 'Structured summary of essential meeting elements in English. Gemini excels at contextual analysis - identify main themes, consensus, and divergences.'
      : 'Résumé structuré des éléments essentiels de la réunion en français. Gemini excelle dans l\'analyse contextuelle - identifiez les thèmes principaux, consensus et divergences.',
    transcript: isEnglish
      ? `Transcript with advanced diarization in English. Gemini has excellent audio comprehension capabilities:
OPTIMAL USE of Gemini for diarization:
- **Gemini Advantage**: Direct audio analysis, natural voice change detection
- **Speaker identification**: Use names if mentioned, otherwise "Speaker_01", "Speaker_02"
- **Absolute rule**: If only one voice is detectable, do NOT invent additional speakers
- **Output format**: Array of objects with "speaker", "text", "start", "end"
- **Key advantage**: Gemini can process raw audio and detect vocal nuances that Whisper misses`
      : `Transcription avec diarization avancée en français. Gemini a d'excellentes capacités de compréhension audio :
UTILISATION OPTIMALE de Gemini pour la diarization :
- **Avantage Gemini**: Analyse directement l'audio, détection naturelle des changements de voix
- **Identification des locuteurs**: Utilisez les noms si mentionnés, sinon "Locuteur_01", "Locuteur_02"
- **Règle absolue**: Si une seule voix est détectable, n'inventez PAS de locuteurs supplémentaires
- **Format de sortie**: Array d'objets avec "speaker", "text", "start", "end"
- **Avantage clé**: Gemini peut traiter l'audio brut et détecter les nuances vocales que Whisper rate`
  };

  const finalPrompt = `
CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No markdown, no code blocks, no extra text. Just pure JSON.

Analyze this audio recording of a meeting. The recording is in French. Provide the following information in a structured JSON format. IMPORTANT: The "title", "summary", and "transcript" texts MUST be in French.

REQUIRED JSON STRUCTURE (respond with EXACTLY this format):
{
  "title": "string (60 chars max)",
  "summary": "string",
  "transcript": [
    {
      "speaker": "string",
      "text": "string",
      "start": number (seconds),
      "end": number (seconds)
    }
  ]
}

DETAILED INSTRUCTIONS:

1. "title": ${prompts.title || defaultPrompts.title}

2. "summary": ${prompts.summary || defaultPrompts.summary}

3. "transcript": ${prompts.transcript || defaultPrompts.transcript}

SPEAKER IDENTIFICATION RULES (CRITICAL):
   - **Priority 1:** If a speaker introduces themselves or is named (e.g., "Bonjour, c'est Marc," "Paul, qu'en penses-tu?"), use that name as their identifier for ALL their speech segments (e.g., "Marc", "Paul").
   - **Priority 2:** If names are not mentioned, use generic identifiers like "Locuteur_01", "Locuteur_02", etc.
   - **CRUCIAL RULE:** If you only detect ONE distinct voice throughout the recording, ALL text must be attributed to a SINGLE speaker (e.g., "Locuteur_01" or their identified name). Do NOT invent a second speaker.
   - Ensure each speech segment is correctly attributed to the speaker.
   - Format: Array of objects with "speaker" (string), "text" (string), "start" (number in seconds), "end" (number in seconds).

EXAMPLE RESPONSE (ONE SPEAKER):
{
  "title": "Discussion sur la Transcription Audio",
  "summary": "Une personne teste le système de transcription audio.",
  "transcript": [
    {
      "speaker": "Locuteur_01",
      "text": "Bonjour, je teste la transcription audio.",
      "start": 0.0,
      "end": 3.5
    },
    {
      "speaker": "Locuteur_01",
      "text": "Ceci est un test de diarization.",
      "start": 3.5,
      "end": 6.0
    }
  ]
}

REMINDER: Respond with ONLY the JSON object. No markdown formatting (no \`\`\`json), no explanations, just the raw JSON.
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

  const rawText = result.candidates[0].content.parts[0].text;
  console.log("🔍 RAW TEXT FROM GEMINI (first 500 chars):", rawText.substring(0, 500));

  // Nettoyage plus agressif
  let cleanedText = rawText
    .replace(/^```json\n?/, '')  // Supprime ```json au début
    .replace(/\n?```$/, '')       // Supprime ``` à la fin
    .replace(/^```\n?/, '')       // Supprime ``` seul au début
    .trim();

  console.log("🧹 CLEANED TEXT (first 500 chars):", cleanedText.substring(0, 500));

  let parsedJson;
  try {
    parsedJson = JSON.parse(cleanedText);
  } catch (parseError) {
    console.error("❌ JSON PARSE ERROR:", parseError);
    console.error("❌ FAILED TEXT (first 1000 chars):", cleanedText.substring(0, 1000));
    throw new Error(`Failed to parse Gemini response as JSON: ${parseError.message}. Raw text: ${cleanedText.substring(0, 200)}...`);
  }

  // Gemini peut renvoyer un array au lieu d'un objet direct
  if (Array.isArray(parsedJson) && parsedJson.length > 0) {
    parsedJson = parsedJson[0];
  }

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

// --- Helper for PyTorch Local Service (OPTIONNEL) ---
async function handlePyTorchTranscription(model: string, audioBlob: Blob, language: string) {
  console.log(`📡 Calling PyTorch service at: ${PYTORCH_SERVICE_URL}`);

  // Vérifier que le service est disponible
  try {
    const healthCheck = await fetch(`${PYTORCH_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // Timeout 5s
    });

    if (!healthCheck.ok) {
      throw new Error(`PyTorch service unavailable (HTTP ${healthCheck.status})`);
    }

    console.log('✅ PyTorch service is healthy');
  } catch (error) {
    console.error('❌ PyTorch service health check failed:', error);
    throw new Error(
      'PyTorch local service is not available. Please use Google or OpenAI API instead, ' +
      'or start the service with: docker-compose --profile pytorch up -d'
    );
  }

  // Créer FormData pour l'upload
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('language', language);
  formData.append('model', model || 'medium');
  formData.append('enable_diarization', 'true');

  console.log(`🎯 Transcribing with PyTorch model: ${model || 'medium'}`);

  const response = await fetch(`${PYTORCH_SERVICE_URL}/transcribe`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(300000), // Timeout 5min pour transcription
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ PyTorch transcription failed:', errorText);
    throw new Error(`PyTorch transcription failed: ${errorText}`);
  }

  const result = await response.json();
  console.log(`✅ PyTorch transcription completed in ${result.processing_time}s`);

  // Convertir le format PyTorch au format attendu
  return {
    title: `Meeting - ${new Date().toLocaleDateString()}`,
    summary: generateSummaryFromTranscript(result.transcript, result.segments),
    transcript: result.segments.map((seg: any, idx: number) => ({
      id: idx,
      speaker: result.speakers?.find((s: any) =>
        s.start <= seg.start && s.end >= seg.end
      )?.speaker || 'Speaker_01',
      text: seg.text,
      start: seg.start,
      end: seg.end
    }))
  };
}

// Générer un résumé simple à partir de la transcription
function generateSummaryFromTranscript(fullText: string, segments: any[]): string {
  const duration = segments.length > 0 ? Math.round(segments[segments.length - 1].end) : 0;

  return `📊 Résumé de la réunion:
  
**Durée**: ${Math.floor(duration / 60)} minutes
**Transcription**: ${fullText.substring(0, 500)}${fullText.length > 500 ? '...' : ''}

_Note: Résumé basique généré localement. Pour une analyse IA avancée, utilisez Google Gemini ou OpenAI._`;
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

    // Get meeting to retrieve recording_url AND prompts
    const { data: meeting } = await serviceSupabaseClient
      .from('meetings')
      .select('recording_url, user_id, prompt_title, prompt_summary, prompt_transcript')
      .eq('id', meeting_id)
      .single();

    if (!meeting) throw new Error('Meeting not found');
    if (meeting.user_id !== user.id) throw new Error('Unauthorized access to meeting');

    const { data: profile } = await serviceSupabaseClient
      .from('profiles')
      .select('preferred_transcription_provider, preferred_transcription_model, prompt_title, prompt_summary, prompt_transcript, preferred_language')
      .eq('id', user.id)
      .single();

    const provider = profile?.preferred_transcription_provider || 'google';
    const model = profile?.preferred_transcription_model || (provider === 'google' ? 'gemini-1.5-pro-latest' : 'whisper-1');

    console.log(`Using provider: ${provider}, model: ${model}`);

    // Pour PyTorch local, pas besoin de clé API
    let apiKey = null;
    if (provider !== 'pytorch') {
      const { data: apiKeyData } = await serviceSupabaseClient
        .from('api_keys')
        .select('encrypted_key')
        .eq('user_id', user.id)
        .eq('provider', provider)
        .single();

      if (!apiKeyData?.encrypted_key) throw new Error(`${provider} API key not found.`);
      apiKey = apiKeyData.encrypted_key;
    }

    // Use the recording_url from the meeting instead of reconstructing it
    const recordingPath = meeting.recording_url;

    const audioBlob = await serviceSupabaseClient.storage
      .from('meetingrecordings')
      .download(recordingPath);

    if (audioBlob.error) throw new Error(`Failed to download audio: ${audioBlob.error.message}`);
    if (!audioBlob.data) throw new Error('Downloaded audio data is null.');

    // 🔥 USE PROMPTS FROM MEETING FIRST, FALLBACK TO PROFILE
    const userPrompts: Prompts = {
      title: meeting.prompt_title || profile?.prompt_title,
      summary: meeting.prompt_summary || profile?.prompt_summary,
      transcript: meeting.prompt_transcript || profile?.prompt_transcript,
    };

    console.log('🎯 Using prompts:', {
      title: userPrompts.title ? 'Custom' : 'Default',
      summary: userPrompts.summary ? 'Custom (' + userPrompts.summary.substring(0, 50) + '...)' : 'Default',
      transcript: userPrompts.transcript ? 'Custom' : 'Default'
    });


    // Pass language preference separately
    const userLanguage = profile?.preferred_language || 'fr';

    let analysisResult;
    if (provider === 'pytorch') {
      // ✅ NOUVEAU: Service PyTorch local (OPTIONNEL)
      console.log('🚀 Using PyTorch local transcription service');
      analysisResult = await handlePyTorchTranscription(model, audioBlob.data, userLanguage);
    } else if (provider === 'google') {
      analysisResult = await handleGoogleTranscription(apiKey, model, audioBlob.data, userPrompts, userLanguage);
    } else if (provider === 'openai') {
      analysisResult = await handleOpenAITranscription(apiKey, model, audioBlob.data, userPrompts, userLanguage);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const speakers = new Set(analysisResult.transcript?.map((segment: any) => segment.speaker) || []);
    const participantCount = speakers.size;

    const { error: updateError } = await serviceSupabaseClient
      .from('meetings')
      .update({
        // Keep the existing recording_url, don't overwrite it
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