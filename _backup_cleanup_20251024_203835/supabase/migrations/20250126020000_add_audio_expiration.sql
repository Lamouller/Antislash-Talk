-- Add audio expiration management to meetings table
ALTER TABLE public.meetings 
ADD COLUMN audio_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Set expiration date for existing meetings (48h from creation)
UPDATE public.meetings 
SET audio_expires_at = created_at + INTERVAL '48 hours'
WHERE recording_url IS NOT NULL 
AND audio_expires_at IS NULL;

-- Create function to automatically set audio expiration on insert
CREATE OR REPLACE FUNCTION set_audio_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Set expiration to 48 hours from creation if recording_url is set
  IF NEW.recording_url IS NOT NULL THEN
    NEW.audio_expires_at = NEW.created_at + INTERVAL '48 hours';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set expiration on new recordings
CREATE TRIGGER trigger_set_audio_expiration
  BEFORE INSERT OR UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION set_audio_expiration();

-- Add comment to document the policy
COMMENT ON COLUMN public.meetings.audio_expires_at IS 'Audio files are automatically deleted 48 hours after meeting creation for security and storage optimization'; 