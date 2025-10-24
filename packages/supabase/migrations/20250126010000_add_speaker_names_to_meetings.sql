-- Add speaker_names column to meetings table to store custom speaker names
ALTER TABLE public.meetings 
ADD COLUMN speaker_names JSONB DEFAULT NULL;

-- Add a comment to describe the column
COMMENT ON COLUMN public.meetings.speaker_names IS 'Custom speaker names mapping: {original_speaker: custom_name}'; 