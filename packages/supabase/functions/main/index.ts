import { handler as prepareNextMeeting } from '../prepare-next-meeting/index.ts';
import { handler as transcribeWithGemini } from '../transcribe-with-gemini/index.ts';
import { handler as startTranscription } from '../start-transcription/index.ts';
import { handler as enhanceLocalTranscription } from '../enhance-local-transcription/index.ts';
import { handler as uploadAsyncFile } from '../upload-async-file/index.ts';
import { handler as cleanupExpiredAudio } from '../cleanup-expired-audio/index.ts';
import { corsHeaders } from '../_shared/cors.ts';

console.log("🚀 Edge Function Router started");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, ''); // Remove trailing slash
  
  console.log(`📨 Request: ${req.method} ${path}`);
  console.log(`🔍 Full URL: ${req.url}`);
  console.log(`🔍 Pathname: ${url.pathname}`);

  // Handle CORS for options globally if needed, or let handlers do it
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Route to prepare-next-meeting
    if (path.endsWith('/prepare-next-meeting')) {
      console.log('✅ Routing to prepare-next-meeting handler');
      return await prepareNextMeeting(req);
    }

    // Route to transcribe-with-gemini
    if (path.endsWith('/transcribe-with-gemini')) {
      console.log('✅ Routing to transcribe-with-gemini handler');
      return await transcribeWithGemini(req);
    }

    // Route to start-transcription
    if (path.endsWith('/start-transcription')) {
      console.log('✅ Routing to start-transcription handler');
      return await startTranscription(req);
    }

    // Route to enhance-local-transcription
    if (path.endsWith('/enhance-local-transcription')) {
      console.log('✅ Routing to enhance-local-transcription handler');
      return await enhanceLocalTranscription(req);
    }

    // Route to upload-async-file
    if (path.endsWith('/upload-async-file')) {
      console.log('✅ Routing to upload-async-file handler');
      return await uploadAsyncFile(req);
    }

    // Route to cleanup-expired-audio
    if (path.endsWith('/cleanup-expired-audio')) {
      console.log('✅ Routing to cleanup-expired-audio handler');
      return await cleanupExpiredAudio(req);
    }

    // Default route or 404
    console.log('❌ No matching route found for:', path);
    return new Response(JSON.stringify({ error: `Function not found: ${path}` }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error(`❌ Router error:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

