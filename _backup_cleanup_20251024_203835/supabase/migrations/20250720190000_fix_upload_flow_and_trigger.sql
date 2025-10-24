-- First, update the status check constraint to include 'uploading'
alter table public.meetings
drop constraint if exists meetings_status_check;

alter table public.meetings
add constraint meetings_status_check
check (status in ('pending', 'processing', 'completed', 'failed', 'uploading'));

-- Then, drop the old trigger
drop trigger if exists on_new_meeting_for_transcription on public.meetings;

-- Re-create the trigger to fire on UPDATE to 'pending' state
create trigger on_new_meeting_for_transcription
  after update on public.meetings
  for each row
  when (old.status is distinct from 'pending' and new.status = 'pending')
  execute function public.trigger_transcription_webhook(); 