-- Add context_notes column to meetings table
-- This column stores user-added notes during recording that will be used to enrich AI summary generation

ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS context_notes TEXT;

COMMENT ON COLUMN meetings.context_notes IS 'User-added contextual notes during recording to enrich AI summary generation';

