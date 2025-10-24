-- Drop the old trigger
drop trigger if exists on_new_meeting_for_transcription on public.meetings;

-- Re-create the trigger with a conditional WHEN clause
create trigger on_new_meeting_for_transcription
  after insert on public.meetings
  for each row
  when (new.status = 'pending')
  execute function public.trigger_transcription_webhook(); 