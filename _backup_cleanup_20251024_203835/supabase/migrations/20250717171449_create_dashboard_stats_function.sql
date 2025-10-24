CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID)
RETURNS TABLE(total_meetings BIGINT, total_duration_sec BIGINT, avg_participants NUMERIC)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(m.id) AS total_meetings,
    COALESCE(SUM(m.duration), 0) AS total_duration_sec,
    COALESCE(AVG(mp.count), 0) AS avg_participants
  FROM
    meetings m
  LEFT JOIN
    meeting_participants mp ON m.id = mp.meeting_id
  WHERE
    m.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
