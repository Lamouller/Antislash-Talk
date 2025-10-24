-- First, drop the old trigger that uses the function
drop trigger if exists on_new_meeting_for_transcription on public.meetings;

-- Then, drop the old function
drop function if exists public.trigger_transcription_webhook();

-- Now, create the corrected function
create or replace function public.trigger_transcription_webhook()
returns trigger as $$
begin
  perform
    http((
      'POST',
      'https://talk-2-web.netlify.app/.netlify/functions/transcribe',
      array[http_header('Content-Type', 'application/json')],
      jsonb_build_object('meeting_id', new.id)
    ));
  return new;
end;
$$ language plpgsql;

-- Finally, re-create the trigger
create trigger on_new_meeting_for_transcription
  after insert on public.meetings
  for each row
  execute function public.trigger_transcription_webhook(); 