-- Drop the trigger and the webhook function as they are no longer needed
drop trigger if exists on_new_meeting_for_transcription on public.meetings;
drop function if exists public.trigger_transcription_webhook();

-- Also, update the status check constraint to remove 'uploading' and 'pending' 
-- as the Edge function will now handle the 'processing' state directly.
alter table public.meetings
drop constraint if exists meetings_status_check;

alter table public.meetings
add constraint meetings_status_check
check (status in ('processing', 'completed', 'failed')); 