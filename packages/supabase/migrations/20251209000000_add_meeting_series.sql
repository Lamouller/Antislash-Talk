-- Migration: Add meeting series and preparation features
-- Date: 2025-12-09
-- Description: Adds support for linked meetings, series tracking, and preparation notes

-- 1. Add columns for meeting relationships and preparation
ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS parent_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS series_name TEXT,
ADD COLUMN IF NOT EXISTS preparation_notes TEXT,
ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS meeting_status TEXT DEFAULT 'completed' CHECK (meeting_status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled'));

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_parent ON meetings(parent_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_series ON meetings(series_name);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(meeting_status);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_date);

-- 3. Add comments for documentation
COMMENT ON COLUMN meetings.parent_meeting_id IS 'Reference to the previous meeting in the series';
COMMENT ON COLUMN meetings.series_name IS 'Name of the meeting series (e.g., "Weekly Standup")';
COMMENT ON COLUMN meetings.preparation_notes IS 'Auto-generated preparation notes for the meeting';
COMMENT ON COLUMN meetings.scheduled_date IS 'Scheduled date/time for the meeting';
COMMENT ON COLUMN meetings.meeting_status IS 'Status: draft (planned), scheduled, in_progress (recording), completed, cancelled';

-- 4. Extend prompt_templates category to include 'preparation'
ALTER TABLE prompt_templates DROP CONSTRAINT IF EXISTS prompt_templates_category_check;
ALTER TABLE prompt_templates ADD CONSTRAINT prompt_templates_category_check 
  CHECK (category IN ('summary', 'title', 'system', 'transcript', 'custom', 'preparation'));

COMMENT ON COLUMN prompt_templates.category IS 'Type of prompt: summary, title, system, transcript, custom, or preparation';

-- 5. Create view for meeting series
CREATE OR REPLACE VIEW meeting_series AS
SELECT 
  COALESCE(series_name, 'Standalone Meeting') as series_name,
  COUNT(*) as meeting_count,
  MIN(created_at) as first_meeting_date,
  MAX(created_at) as last_meeting_date,
  user_id
FROM meetings
GROUP BY series_name, user_id;

COMMENT ON VIEW meeting_series IS 'Aggregated view of meeting series with counts and dates';

-- 6. Function to get meeting timeline (all meetings in a series)
CREATE OR REPLACE FUNCTION get_meeting_timeline(meeting_id_param UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  meeting_status TEXT,
  is_current BOOLEAN,
  position_in_series INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE ancestors AS (
    -- Start from the given meeting and go up (parents)
    SELECT 
      m.id,
      m.title,
      m.created_at,
      m.meeting_status,
      m.parent_meeting_id,
      m.series_name,
      0 as depth,
      CASE WHEN m.id = meeting_id_param THEN TRUE ELSE FALSE END as is_current
    FROM meetings m
    WHERE m.id = meeting_id_param
    
    UNION ALL
    
    -- Recursive step: get parents
    SELECT 
      m.id,
      m.title,
      m.created_at,
      m.meeting_status,
      m.parent_meeting_id,
      m.series_name,
      a.depth - 1,
      FALSE
    FROM meetings m
    INNER JOIN ancestors a ON m.id = a.parent_meeting_id
  ),
  descendants AS (
    -- Start from children of the given meeting
    SELECT 
      m.id,
      m.title,
      m.created_at,
      m.meeting_status,
      m.parent_meeting_id,
      m.series_name,
      1 as depth,
      FALSE as is_current
    FROM meetings m
    WHERE m.parent_meeting_id = meeting_id_param
    
    UNION ALL
    
    -- Recursive step: get children of children
    SELECT 
      m.id,
      m.title,
      m.created_at,
      m.meeting_status,
      m.parent_meeting_id,
      m.series_name,
      d.depth + 1,
      FALSE
    FROM meetings m
    INNER JOIN descendants d ON m.parent_meeting_id = d.id
  ),
  all_meetings AS (
    SELECT * FROM ancestors
    UNION ALL
    SELECT * FROM descendants
  )
  SELECT 
    am.id,
    am.title,
    am.created_at,
    am.meeting_status,
    am.is_current,
    ROW_NUMBER() OVER (ORDER BY am.created_at)::INTEGER as position_in_series
  FROM all_meetings am
  ORDER BY am.created_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_meeting_timeline IS 'Returns the complete timeline of meetings in a series, ordered chronologically';

-- 7. Update existing meetings to have 'completed' status
UPDATE meetings 
SET meeting_status = 'completed' 
WHERE meeting_status IS NULL AND status = 'completed';

UPDATE meetings 
SET meeting_status = 'draft' 
WHERE meeting_status IS NULL AND status = 'pending';
