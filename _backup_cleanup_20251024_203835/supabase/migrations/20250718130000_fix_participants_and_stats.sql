-- Step 1: Create the meeting_participants table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.meeting_participants (
    meeting_id uuid NOT NULL,
    participant_count integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (meeting_id),
    CONSTRAINT meeting_participants_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

-- Step 2: Drop the old function to be safe
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid);

-- Step 3: Re-create the function with the correct column name
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_user_id uuid)
RETURNS TABLE(total_meetings bigint, total_recordings bigint, total_duration_sec numeric, avg_participants numeric)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH user_meetings AS (
    SELECT
      id,
      recording_url,
      duration
    FROM meetings
    WHERE user_id = p_user_id
  )
  SELECT
    (SELECT COUNT(*) FROM user_meetings) AS total_meetings,
    (SELECT COUNT(recording_url) FROM user_meetings) AS total_recordings,
    COALESCE((SELECT SUM(duration) FROM user_meetings), 0) AS total_duration_sec,
    COALESCE((SELECT AVG(participant_count) FROM meeting_participants WHERE meeting_id IN (SELECT id FROM user_meetings)), 0) AS avg_participants;
END;
$function$; 