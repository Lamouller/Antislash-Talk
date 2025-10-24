-- Drop the old trigger and function to ensure a clean slate
drop trigger if exists on_new_meeting_for_transcription on public.meetings;
drop function if exists public.trigger_transcription_webhook();

-- Create the definitive function with the correct 3-argument http_post call to send valid JSON
create or replace function public.trigger_transcription_webhook()
returns trigger as $$
begin
  perform http_post(
    'https://talk-2-web.netlify.app/.netlify/functions/transcribe',
    jsonb_build_object(
      'meeting_id', new.id,
      'user_id', new.user_id
    )::text,
    'application/json'
  );
  return new;
end;
$$ language plpgsql;

-- Re-create the trigger to fire ONLY on the UPDATE to 'pending' state
create trigger on_new_meeting_for_transcription
  after update on public.meetings
  for each row
  when (old.status is distinct from 'pending' and new.status = 'pending')
  execute function public.trigger_transcription_webhook(); 