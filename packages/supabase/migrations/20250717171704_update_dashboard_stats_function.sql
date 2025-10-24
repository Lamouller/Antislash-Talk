DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_user_id uuid)
RETURNS TABLE(total_meetings bigint, total_recordings bigint, total_duration_sec bigint, avg_participants numeric)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(m.id) AS total_meetings,
    COUNT(m.recording_url) AS total_recordings,
    COALESCE(SUM(m.duration), 0) AS total_duration_sec,
    COALESCE(AVG(mp.count), 0) AS avg_participants
  FROM
    meetings m
  LEFT JOIN
    meeting_participants mp ON m.id = mp.meeting_id
  WHERE
    m.user_id = p_user_id;
END;
$function$;
