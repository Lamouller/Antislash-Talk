import { handler as prepareNextMeeting } from '../prepare-next-meeting/index.ts';
import { handler as transcribeWithGemini } from '../transcribe-with-gemini/index.ts';
import { corsHeaders } from '../_shared/cors.ts';

console.log("🚀 Edge Function Router started");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, ''); // Remove trailing slash
  
  console.log(`📨 Request: ${req.method} ${path}`);

  // Handle CORS for options globally if needed, or let handlers do it
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Route to prepare-next-meeting
    if (path.endsWith('/prepare-next-meeting')) {
      return await prepareNextMeeting(req);
    }

    // Route to transcribe-with-gemini
    if (path.endsWith('/transcribe-with-gemini')) {
      return await transcribeWithGemini(req);
    }

    // Default route or 404
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

