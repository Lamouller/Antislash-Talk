DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid);

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
    COALESCE((SELECT AVG(count) FROM meeting_participants WHERE meeting_id IN (SELECT id FROM user_meetings)), 0) AS avg_participants;
END;
$function$; 