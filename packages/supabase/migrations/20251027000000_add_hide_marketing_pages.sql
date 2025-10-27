-- Add hide_marketing_pages column to profiles table
-- This allows users to skip marketing/presentation pages and go directly to login
-- Can be overridden globally via VITE_HIDE_MARKETING_PAGES environment variable

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hide_marketing_pages BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.hide_marketing_pages IS 'If true, skip marketing pages (home, auth index) and redirect directly to login. Can be forced globally via VITE_HIDE_MARKETING_PAGES env var.';

