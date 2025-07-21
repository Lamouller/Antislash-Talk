import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getTranscriptionProvider(user_id, provider, model) {
    if (provider === 'openai') {
        const { data: apiKey, error } = await supabase
            .from('api_keys')
            .select('encrypted_key')
            .eq('user_id', user_id)
            .eq('provider', 'openai')
            .single();

        if (error || !apiKey) {
            throw new Error('OpenAI API key not found for user.');
        }

        return new OpenAI({ apiKey: apiKey.encrypted_key });
    }
    
    if (provider === 'google') {
       const { data: apiKey, error } = await supabase
            .from('api_keys')
            .select('encrypted_key')
            .eq('user_id', user_id)
            .eq('provider', 'google')
            .single();

        if (error || !apiKey) {
            throw new Error('Google API key not found for user.');
        }

        return new GoogleGenerativeAI(apiKey.encrypted_key);
    }

    throw new Error(`Unsupported transcription provider: ${provider}`);
}

async function fetchMeetingWithRetry(meeting_id, retries = 3, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    const { data, error } = await supabase
      .from('meetings')
      .select('recording_url')
      .eq('id', meeting_id)
      .single();

    if (!error && data?.recording_url) {
      return data; // Success!
    }
    
    if (i < retries - 1) {
      console.log(`Meeting data not found on attempt ${i + 1}. Retrying in ${delayMs}ms...`);
      await delay(delayMs);
    }
  }
  throw new Error(`Could not retrieve meeting data after ${retries} attempts.`);
}


const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  console.log("Received webhook event:", event.body);
  const { meeting_id, user_id, provider, model: modelId } = JSON.parse(event.body);
  if (!meeting_id || !user_id || !provider || !modelId) {
    console.error("Missing required fields in request body. Payload:", event.body);
    return { statusCode: 400, body: 'Missing required fields in request body' };
  }

  try {
    const transcriptionProvider = await getTranscriptionProvider(user_id, provider, modelId);
    
    // 1. Get user profile to fetch custom prompts
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('prompt_title, prompt_summary, prompt_transcript')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.warn(`Could not fetch profile for user ${user_id}. Using default prompts. Error: ${profileError.message}`);
    }

    // 2. Get meeting data (with retry logic for replication delay)
    const meeting = await fetchMeetingWithRetry(meeting_id);
    
    // 3. Update meeting status to "processing"
    await supabase
      .from('meetings')
      .update({ status: 'processing' })
      .eq('id', meeting_id);

    // 4. Download audio file from Supabase Storage
    console.log(`Downloading audio file from: ${meeting.recording_url}`);
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('meetingrecordings')
      .download(meeting.recording_url);

    if (downloadError) {
      console.error(`Failed to download file from ${meeting.recording_url}:`, downloadError);
      throw new Error(`Failed to download file from ${meeting.recording_url}: ${downloadError.message}`);
    }

    console.log(`Successfully downloaded file. Size: ${fileData.size} bytes`);
    const audioBytes = Buffer.from(await fileData.arrayBuffer()).toString('base64');
    
    let analysisResult;

    if (provider === 'google') {
        const model = transcriptionProvider.getGenerativeModel({ model: modelId });
        const audio = {
            inlineData: {
                data: audioBytes,
                mimeType: 'audio/webm',
            },
        };

        const defaultTitlePrompt = "A short, descriptive title for the meeting in French.";
        const defaultSummaryPrompt = "A concise one-paragraph summary of the key discussion points and decisions, in French.";
        const defaultTranscriptPrompt = `Follow these rules for the "transcript" field:
1. Speaker Identification:
    - Priority 1: If a speaker introduces themselves or is named (e.g., "Hello, this is Marc," "Paul, what do you think?"), use that name as their identifier for all their speech segments.
    - Priority 2: If names are not mentioned, use generic identifiers like "Locuteur_01", "Locuteur_02", etc.
    - Crucial Rule: If you only detect one distinct voice, all text must be attributed to a single speaker.
2. Accuracy: Ensure each speech segment is correctly attributed and transcribed accurately.
3. Timestamps: Provide 'start' and 'end' times in seconds for each segment.`;

        const prompt = `Your task is to process the provided audio meeting and return a clean JSON object. Do not include any text outside of the JSON object. The JSON object must have the following structure:
{
  "title": "${profile?.prompt_title || defaultTitlePrompt}",
  "summary": "${profile?.prompt_summary || defaultSummaryPrompt}",
  "transcript": [
    { "start": 0.0, "end": 5.2, "speaker": "Locuteur_01", "text": "..." }
  ]
}
${profile?.prompt_transcript || defaultTranscriptPrompt}`;

        const result = await model.generateContent([prompt, audio]);
        const geminiResponseText = result.response.text();
        
        console.log("Raw Gemini response:", geminiResponseText);
        
        // Better JSON parsing with multiple fallback strategies
        let cleanedJson = geminiResponseText;
        
        // Remove common prefixes
        cleanedJson = cleanedJson.replace(/^```json\s*/gi, '');
        cleanedJson = cleanedJson.replace(/\s*```\s*$/gi, '');
        
        // Find JSON object boundaries
        const jsonStart = cleanedJson.indexOf('{');
        const jsonEnd = cleanedJson.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleanedJson = cleanedJson.substring(jsonStart, jsonEnd + 1);
        }
        
        console.log("Cleaned JSON for parsing:", cleanedJson);
        
        try {
            analysisResult = JSON.parse(cleanedJson);
        } catch (parseError) {
            console.error("JSON parsing failed. Raw response:", geminiResponseText);
            console.error("Cleaned JSON:", cleanedJson);
            throw new Error(`Invalid JSON response from Gemini. Parse error: ${parseError.message}`);
        }

    } else if (provider === 'openai') {
        console.log(`Using OpenAI Whisper transcription with model: ${modelId}`);
        
        // Create a Blob-like object for OpenAI (Node.js compatible)
        const audioBuffer = Buffer.from(await fileData.arrayBuffer());
        const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
        
        // Add a name property to mimic a File object
        Object.defineProperty(audioBlob, 'name', {
            value: `${meeting_id}.webm`,
            writable: false
        });
        
        console.log(`Sending audio file to OpenAI. Size: ${audioBuffer.length} bytes`);
        
        const transcription = await transcriptionProvider.audio.transcriptions.create({
            file: audioBlob,
            model: modelId,
            response_format: "verbose_json",
            timestamp_granularities: ["segment"]
        });
        
        console.log("OpenAI transcription result:", transcription);
        
        // Structure the response similar to Gemini's format
        analysisResult = {
            title: profile?.prompt_title || 'Meeting Transcription',
            summary: profile?.prompt_summary || 'Summary not available for OpenAI transcription.',
            transcript: transcription.segments ? transcription.segments.map(seg => ({
                start: seg.start,
                end: seg.end,
                speaker: `Locuteur_01`, // OpenAI doesn't provide speaker diarization by default
                text: seg.text
            })) : [{
                start: 0,
                end: transcription.duration || 0,
                speaker: 'Locuteur_01',
                text: transcription.text
            }]
        };
    } else {
        throw new Error(`Transcription for provider ${provider} not implemented.`);
    }

    const { title, summary, transcript } = analysisResult;

    // 6. Move the file to its final, private location.
    const privateFilePath = `${user_id}/${meeting_id}.webm`;
    const { error: moveError } = await supabase.storage
      .from('meetingrecordings')
      .move(meeting.recording_url, privateFilePath);

    if (moveError) {
      console.error(`Failed to move file from ${meeting.recording_url} to ${privateFilePath}:`, moveError);
    }

    // 7. Update meeting with transcript and FINAL recording_url
    const updatePayload = {
        title: title,
        summary: summary,
        transcript: transcript,
        status: 'completed',
        recording_url: privateFilePath,
        transcription_provider: provider,
        transcription_model: modelId,
        participant_count: new Set(transcript.map(t => t.speaker)).size
    };

    console.log("Attempting to update meeting with payload:", JSON.stringify(updatePayload, null, 2));

    await supabase
        .from('meetings')
        .update(updatePayload)
        .eq('id', meeting_id);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Transcription completed successfully' }),
    };
  } catch (error) {
    console.error(`Error during transcription process for meeting ${meeting_id}:`, error);
    
    // Attempt to update meeting status to "failed"
    try {
      await supabase
          .from('meetings')
          .update({ status: 'failed' })
          .eq('id', meeting_id);
    } catch (dbError) {
        console.error(`Failed to update meeting ${meeting_id} status to "failed":`, dbError)
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}; 

export { handler }; 