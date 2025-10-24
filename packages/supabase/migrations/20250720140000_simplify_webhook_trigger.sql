-- Drop the old trigger and function
drop trigger if exists on_new_meeting_for_transcription on public.meetings;
drop function if exists public.trigger_transcription_webhook();

-- Create a new, simpler function using the http_post helper
create or replace function public.trigger_transcription_webhook()
returns trigger as $$
begin
  perform http_post(
    'https://talk-2-web.netlify.app/.netlify/functions/transcribe',
    jsonb_build_object('meeting_id', new.id)
  );
  return new;
end;
$$ language plpgsql;

-- Re-create the trigger
create trigger on_new_meeting_for_transcription
  after insert on public.meetings
  for each row
  when (new.status = 'pending')
  execute function public.trigger_transcription_webhook(); 