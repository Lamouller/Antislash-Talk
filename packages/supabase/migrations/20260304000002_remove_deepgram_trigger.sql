-- Migration: Remove hardcoded Deepgram API key trigger
-- Date: 2026-03-04
-- Issue: Trigger "add_deepgram_key_trigger" automatically inserts hardcoded
--        Deepgram API key (0adfb28b3269b392c01ac047af06391a49a27ff6)
--        into user_api_keys for every new user
-- Security Risk: Shared API key across all users, key exposed in codebase
-- Fix: Remove trigger, function, and optionally clean existing hardcoded keys

BEGIN;

-- Drop the trigger on profiles table
DROP TRIGGER IF EXISTS "add_deepgram_key_trigger" ON "public"."profiles";

-- Drop the function that inserts the hardcoded key
DROP FUNCTION IF EXISTS "public"."add_default_deepgram_key"();

-- Optional: Remove all existing hardcoded Deepgram keys
-- Uncomment the following lines if you want to clean up existing data:
-- DELETE FROM "public"."user_api_keys"
-- WHERE service = 'deepgram'
--   AND api_key = '0adfb28b3269b392c01ac047af06391a49a27ff6';

COMMIT;

-- Notes:
-- - Users will now need to provide their own Deepgram API keys
-- - Existing hardcoded keys are NOT automatically deleted (commented out)
-- - If you want to clean existing keys, uncomment the DELETE statement above
-- - Consider implementing a user-facing UI to let users add their own API keys
