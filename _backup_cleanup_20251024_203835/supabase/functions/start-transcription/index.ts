/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Initializing start-transcription function...");

const NETLIFY_WEBHOOK_URL = Deno.env.get('NETLIFY_WEBHOOK_URL');
if (!NETLIFY_WEBHOOK_URL) {
  console.error("CRITICAL: NETLIFY_WEBHOOK_URL environment variable is not set.");
}

Deno.serve(async (req) => {
  console.log("start-transcription function invoked at", new Date().toISOString());
  console.log("Request method:", req.method);
  console.log("Request URL:", req.url);
  console.log("Request headers:", Object.fromEntries(req.headers));

  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS preflight request.");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Parsed request body:", body);
    const { meeting_id } = body;

    if (!meeting_id) {
      console.error("Validation Error: meeting_id is missing from the request body.");
      throw new Error('Missing meeting_id in request body');
    }
    console.log("Received meeting_id:", meeting_id);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Auth Error: Authorization header is missing.");
      throw new Error('Missing Authorization header');
    }

    // We need the user_id to pass to the webhook
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    
    console.log("Attempting to get user from Supabase...");
    const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser();
    
    if (userError) {
      console.error("Supabase auth error:", userError);
      throw new Error(`User auth error: ${userError.message}`);
    }
    if (!user) {
      console.error("Auth Error: User not found for the provided token.");
      throw new Error('User not found');
    }

    console.log("Successfully authenticated user:", user.id);

    // Fetch user's profile to get preferred models
    console.log("Fetching user profile for transcription preferences...");
    const { data: profileData, error: profileError } = await userSupabaseClient
      .from('profiles')
      .select('preferred_transcription_provider, preferred_transcription_model')
      .eq('id', user.id)
      .single();

    console.log("Profile query result:", { profileData, profileError });

    let preferred_transcription_provider = 'openai'; // Default value
    let preferred_transcription_model = 'whisper-1'; // Default value

    if (profileError) {
      console.warn("Could not fetch profile, using defaults:", profileError.message);
    } else if (!profileData) {
      console.warn("Profile not found for user, using defaults:", user.id);
    } else {
      console.log("Successfully fetched user profile:", profileData);
      
      // Log the raw values from the database
      console.log("Raw provider from DB:", profileData.preferred_transcription_provider);
      console.log("Raw model from DB:", profileData.preferred_transcription_model);
      
      preferred_transcription_provider = profileData.preferred_transcription_provider || 'openai';
      preferred_transcription_model = profileData.preferred_transcription_model || 'whisper-1';
    }

    console.log("Final transcription settings:", { 
      provider: preferred_transcription_provider, 
      model: preferred_transcription_model 
    });

    // Validate the settings
    if (!preferred_transcription_provider || !preferred_transcription_model) {
      console.error("Invalid transcription settings:", {
        provider: preferred_transcription_provider,
        model: preferred_transcription_model
      });
      throw new Error("Invalid transcription settings");
    }

    if (!NETLIFY_WEBHOOK_URL) {
      console.error("Configuration Error: NETLIFY_WEBHOOK_URL is not set.");
      throw new Error("NETLIFY_WEBHOOK_URL is not set in environment variables.");
    }
    console.log("Found Netlify webhook URL. Ready to trigger.");

    // Call the Netlify webhook from the server.
    const webhookPayload = {
      meeting_id: meeting_id,
      user_id: user.id,
      provider: preferred_transcription_provider,
      model: preferred_transcription_model,
    };
    console.log("Triggering Netlify webhook with payload:", webhookPayload);
    
    const webhookResponse = await fetch(NETLIFY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    console.log(`Netlify webhook responded with status: ${webhookResponse.status}`);
    
    if (!webhookResponse.ok) {
      const errorBody = await webhookResponse.text();
      console.error(`Netlify webhook failed with status ${webhookResponse.status}:`, errorBody);
      throw new Error(`Netlify webhook failed: Status ${webhookResponse.status} - ${errorBody}`);
    }

    const responseBody = await webhookResponse.json();
    console.log("Successfully received response from Netlify webhook:", responseBody);

    // Immediately return a success response to the client.
    console.log("Returning 202 Accepted to the client.");
    return new Response(JSON.stringify({ message: `Transcription process started for meeting ${meeting_id}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 202
    });

  } catch (error) {
    console.error('Error in start-transcription function:', error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 