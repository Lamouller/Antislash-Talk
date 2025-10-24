-- Add preferred_llm_model column to profiles table for local LLM selection
-- This allows users to choose which Ollama model to use for title/summary generation

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_llm_model text DEFAULT 'none';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.preferred_llm_model IS 'Local LLM model for title/summary generation (ollama models: mistral, llama3.1, phi3, gemma2, or none for rule-based)';

