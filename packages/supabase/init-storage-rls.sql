-- Init script to disable RLS on storage.objects for public bucket
-- This runs as postgres superuser on container start

\c postgres

-- Disable RLS on storage.objects since bucket is public
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON storage.objects TO supabase_storage_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;

