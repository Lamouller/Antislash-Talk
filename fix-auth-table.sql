-- Create missing user_api_keys table for auth schema
-- This table is required by newer versions of GoTrue

BEGIN;

-- Create the table
CREATE TABLE IF NOT EXISTS auth.user_api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text,
    key_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);

-- Create indexes
CREATE INDEX IF NOT EXISTS user_api_keys_user_id_idx ON auth.user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS user_api_keys_key_hash_idx ON auth.user_api_keys(key_hash);

-- Grant necessary permissions
GRANT ALL ON auth.user_api_keys TO supabase_auth_admin;
GRANT SELECT ON auth.user_api_keys TO postgres, dashboard_user;

COMMIT;

