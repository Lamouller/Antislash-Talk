#!/bin/bash
# Fix auth schema permissions to allow creating user_api_keys table

set -e

echo "Fixing auth schema permissions..."

# Wait for database to be ready
until psql -U postgres -d postgres -c '\l' > /dev/null 2>&1; do
  echo "Waiting for database..."
  sleep 1
done

# Grant create permissions on auth schema
psql -U postgres -d postgres << 'EOF'
-- Make postgres owner of auth schema temporarily
ALTER SCHEMA auth OWNER TO postgres;

-- Create the missing table
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

-- Change owner back to supabase_admin
ALTER SCHEMA auth OWNER TO supabase_admin;
ALTER TABLE auth.user_api_keys OWNER TO supabase_auth_admin;

-- Grant necessary permissions
GRANT ALL ON auth.user_api_keys TO supabase_auth_admin;
GRANT SELECT ON auth.user_api_keys TO postgres, dashboard_user;

EOF

echo "Auth schema permissions fixed!"

