-- Migration: Fix RLS policy on meetings table
-- Date: 2026-03-04
-- Issue: Current policy "Users can view own meetings" uses USING (true)
--        which allows ALL users (even unauthenticated) to see ALL meetings
-- Fix: Replace with proper user_id check

BEGIN;

-- Drop the existing insecure policy
DROP POLICY IF EXISTS "Users can view own meetings" ON "public"."meetings";

-- Create a new secure policy that only allows users to see their own meetings
CREATE POLICY "Users can view own meetings" ON "public"."meetings"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Verify other policies on meetings table are secure
-- INSERT policy (line 953) - SECURE: WITH CHECK (auth.uid() = user_id)
-- UPDATE policy (line 1001) - SECURE: USING (auth.uid() = user_id)
-- DELETE policy (line 931) - SECURE: USING (auth.uid() = user_id)

COMMIT;

-- Notes:
-- - This migration only affects SELECT policy
-- - Other policies (INSERT, UPDATE, DELETE) were already secure
-- - Added TO authenticated to ensure only logged-in users can query
