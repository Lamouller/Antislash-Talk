-- Migration: Add LLM provider and model columns to meetings table
-- Date: 2025-10-23
-- Description: Add llm_provider and llm_model columns to track which LLM was used for generating summaries

-- Add llm_provider column
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS llm_provider TEXT;

-- Add llm_model column
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS llm_model TEXT;

-- Add comment to columns
COMMENT ON COLUMN public.meetings.llm_provider IS 'The LLM provider used for summary generation (e.g., openai, anthropic, google)';
COMMENT ON COLUMN public.meetings.llm_model IS 'The specific LLM model used (e.g., gpt-4o-mini, claude-3-5-sonnet)';

