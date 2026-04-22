-- Rollback: Remove feature_flags column from profiles
-- Pair of: 20260422000000_add_profile_feature_flags.sql

ALTER TABLE public.profiles DROP COLUMN IF EXISTS feature_flags;
