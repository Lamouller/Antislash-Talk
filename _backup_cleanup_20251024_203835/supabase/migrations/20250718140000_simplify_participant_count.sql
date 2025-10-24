-- Step 1: Add participant_count to the meetings table
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS participant_count integer DEFAULT 0;

-- Step 2: Drop the now unused meeting_participants table
DROP TABLE IF EXISTS public.meeting_participants;

-- Step 3: Re-create the dashboard stats function to read from the meetings table
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_user_id uuid)
RETURNS TABLE(total_meetings bigint, total_recordings bigint, total_duration_sec numeric, avg_participants numeric)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(m.id) AS total_meetings,
    COUNT(m.recording_url) AS total_recordings,
    COALESCE(SUM(m.duration), 0) AS total_duration_sec,
    COALESCE(AVG(m.participant_count), 0) AS avg_participants
  FROM
    meetings m
  WHERE
    m.user_id = p_user_id;
END;
$function$; 