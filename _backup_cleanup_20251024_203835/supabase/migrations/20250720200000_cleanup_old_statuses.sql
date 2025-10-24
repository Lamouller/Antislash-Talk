-- Set any meetings that are stuck in an old, now-invalid state to 'failed'.
-- This allows the subsequent migration to apply a stricter check constraint.
update public.meetings
set status = 'failed'
where status in ('pending', 'uploading'); 