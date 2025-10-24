-- Add preferred_language column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN preferred_language TEXT DEFAULT 'fr' CHECK (preferred_language IN ('fr', 'en'));

-- Update existing records to have French as default
UPDATE public.profiles 
SET preferred_language = 'fr' 
WHERE preferred_language IS NULL; 