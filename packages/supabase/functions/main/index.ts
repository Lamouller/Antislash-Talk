import { handler as prepareNextMeeting } from '../prepare-next-meeting/index.ts';
import { handler as transcribeWithGemini } from '../transcribe-with-gemini/index.ts';
import { handler as startTranscription } from '../start-transcription/index.ts';
import { handler as enhanceLocalTranscription } from '../enhance-local-transcription/index.ts';
import { handler as uploadAsyncFile } from '../upload-async-file/index.ts';
import { handler as cleanupExpiredAudio } from '../cleanup-expired-audio/index.ts';
import { corsHeaders } from '../_shared/cors.ts';

console.log("🚀 Edge Function Router started");
console.log("📦 Available routes:");
console.log("  - /functions/v1/prepare-next-meeting");
console.log("  - /functions/v1/transcribe-with-gemini");
console.log("  - /functions/v1/start-transcription");
console.log("  - /functions/v1/enhance-local-transcription");
console.log("  - /functions/v1/upload-async-file");
console.log("  - /functions/v1/cleanup-expired-audio");

// Environment check
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

console.log("🔐 Environment check:");
console.log(`  SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
console.log(`  SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? '✅ Set' : '❌ Missing'}`);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, ''); // Remove trailing slash

  console.log(`📨 Request: ${req.method} ${path}`);

  // Handle CORS for OPTIONS requests globally
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Health check endpoint
    if (path === '/' || path === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'edge-functions-router',
        routes: [
          'prepare-next-meeting',
          'transcribe-with-gemini',
          'start-transcription',
          'enhance-local-transcription',
          'upload-async-file',
          'cleanup-expired-audio'
        ]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
    return new Response(JSON.stringify({
      error: `Function not found: ${path}`,
      availableRoutes: [
        '/functions/v1/prepare-next-meeting',
        '/functions/v1/transcribe-with-gemini',
        '/functions/v1/start-transcription',
        '/functions/v1/enhance-local-transcription',
        '/functions/v1/upload-async-file',
        '/functions/v1/cleanup-expired-audio'
      ]
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ Router error:`, error);
    console.error(`❌ Error stack:`, error.stack);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

