-- Add 'preparation' category to prompt_templates
-- This category is used for meeting preparation prompts

-- Drop the old constraint
ALTER TABLE public.prompt_templates
DROP CONSTRAINT IF EXISTS prompt_templates_category_check;

-- Add the new constraint with 'preparation' included
ALTER TABLE public.prompt_templates
ADD CONSTRAINT prompt_templates_category_check
CHECK (category IN ('summary', 'title', 'system', 'transcript', 'custom', 'preparation'));

COMMENT ON COLUMN public.prompt_templates.category IS 'Prompt category: summary, title, system, transcript, custom, or preparation';

