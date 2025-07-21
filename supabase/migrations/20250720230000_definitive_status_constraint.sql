-- Drop the old constraint to ensure we can apply the new one cleanly.
alter table public.meetings
drop constraint if exists meetings_status_check;

-- Create the definitive, final check constraint with all required statuses for the async Netlify flow.
alter table public.meetings
add constraint meetings_status_check
check (status in ('uploading', 'pending', 'processing', 'completed', 'failed')); 