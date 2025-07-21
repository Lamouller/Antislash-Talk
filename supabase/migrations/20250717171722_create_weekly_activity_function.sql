CREATE OR REPLACE FUNCTION get_weekly_activity(p_user_id UUID)
RETURNS TABLE(day_name TEXT, meetings_count BIGINT, duration_minutes BIGINT)
AS $$
BEGIN
  RETURN QUERY
  WITH last_7_days AS (
    SELECT generate_series(
      (NOW() - INTERVAL '6 days')::date,
      NOW()::date,
      '1 day'
    )::date AS day
  )
  SELECT
    TO_CHAR(d.day, 'Dy') AS day_name,
    COUNT(m.id) AS meetings_count,
    COALESCE(SUM(m.duration), 0)::BIGINT / 60 AS duration_minutes
  FROM
    last_7_days d
  LEFT JOIN
    meetings m ON m.created_at::date = d.day AND m.user_id = p_user_id
  GROUP BY
    d.day
  ORDER BY
    d.day;
END;
$$ LANGUAGE plpgsql;
