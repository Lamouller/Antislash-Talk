-- First, drop the old constraint to be able to modify it
alter table public.meetings
drop constraint if exists meetings_status_check;

-- Then, add the new, updated constraint that includes 'pending'
alter table public.meetings
add constraint meetings_status_check
check (status in ('pending', 'processing', 'completed', 'failed')); 