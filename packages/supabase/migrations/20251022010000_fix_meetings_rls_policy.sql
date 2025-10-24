-- Fix RLS policies for meetings table to allow inserts

-- Function to auto-fill user_id from auth.uid()
CREATE OR REPLACE FUNCTION public.set_user_id_on_meeting()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-fill user_id on insert
DROP TRIGGER IF EXISTS set_user_id_trigger ON meetings;
CREATE TRIGGER set_user_id_trigger
  BEFORE INSERT ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_id_on_meeting();

-- Update INSERT policy to work with authenticated users
DROP POLICY IF EXISTS "Users can insert own meetings" ON meetings;
CREATE POLICY "Users can insert own meetings" 
ON meetings 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Also update other policies to use authenticated role
DROP POLICY IF EXISTS "Users can view own meetings" ON meetings;
CREATE POLICY "Users can view own meetings" 
ON meetings 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own meetings" ON meetings;
CREATE POLICY "Users can update own meetings" 
ON meetings 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own meetings" ON meetings;
CREATE POLICY "Users can delete own meetings" 
ON meetings 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

