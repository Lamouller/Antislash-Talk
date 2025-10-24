-- Drop the old trigger and function as they are replaced by a Supabase Edge Function.
drop trigger if exists on_new_meeting_for_transcription on public.meetings;
drop function if exists public.trigger_transcription_webhook(); 