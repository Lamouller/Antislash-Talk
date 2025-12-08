-- Add prompt columns to meetings table for per-meeting custom prompts
ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS prompt_title TEXT,
ADD COLUMN IF NOT EXISTS prompt_summary TEXT,
ADD COLUMN IF NOT EXISTS prompt_transcript TEXT;

-- Add comment
COMMENT ON COLUMN public.meetings.prompt_title IS 'Custom prompt for generating meeting title';
COMMENT ON COLUMN public.meetings.prompt_summary IS 'Custom prompt for generating meeting summary';
COMMENT ON COLUMN public.meetings.prompt_transcript IS 'Custom prompt for processing transcript';
