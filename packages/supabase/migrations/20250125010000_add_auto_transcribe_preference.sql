-- Add auto transcribe preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN auto_transcribe_after_recording BOOLEAN DEFAULT true;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.auto_transcribe_after_recording IS 'If true, automatically start transcription after recording. If false, ask user for confirmation.'; 