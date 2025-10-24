import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let meetingId = '';

  try {
    // 1. Get user and audio blob from the request
    const userSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );

    const { data: { user } } = await userSupabaseClient.auth.getUser();
    if (!user) throw new Error('User not found');

    const { title, duration, audio_blob } = await req.json();
    if (!audio_blob) throw new Error("Missing audio_blob in request body");
    
    const audioBlob = await (await fetch(audio_blob)).blob();

    // 2. Create the meeting record with 'uploading' status
    const meetingTitle = title.trim() || `Meeting - ${new Date().toLocaleString()}`;
    const serviceSupabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: meeting, error: meetingError } = await serviceSupabaseClient
      .from('meetings')
      .insert({ 
        user_id: user.id, 
        title: meetingTitle, 
        duration: duration,
        status: 'uploading'
      })
      .select('id')
      .single();

    if (meetingError || !meeting) throw new Error(meetingError?.message || "Failed to create meeting record.");
    meetingId = meeting.id;

    // 3. Upload the file from the server
    const filePath = `${user.id}/${meetingId}.webm`;
    const { error: uploadError } = await serviceSupabaseClient.storage
      .from('meetingrecordings')
      .upload(filePath, audioBlob, { upsert: false });

    if (uploadError) throw uploadError;

    // 4. Update status to 'pending' to trigger the webhook
    const { error: updateError } = await serviceSupabaseClient
      .from('meetings')
      .update({ status: 'pending', recording_url: filePath })
      .eq('id', meetingId);

    if (updateError) throw updateError;
    
    // 5. Return a success response to the client
    return new Response(JSON.stringify({ meeting_id: meetingId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in upload-async-file function:', error);
    // If an error occurs, try to update the meeting status to 'failed'
    if (meetingId) {
      const serviceSupabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      await serviceSupabaseClient.from('meetings').update({ status: 'failed' }).eq('id', meetingId);
    }
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 