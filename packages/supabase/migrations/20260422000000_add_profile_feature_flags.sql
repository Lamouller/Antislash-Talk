-- Migration: Add feature_flags jsonb to profiles for progressive rollout
-- Phase 0 — transcription refactor feature flags infrastructure
--
-- Idempotent: ADD COLUMN IF NOT EXISTS is safe to run multiple times.
-- RLS: profiles already has SELECT/INSERT/UPDATE policies for authenticated users
-- (see initial_schema.sql), so no additional policy is required.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.feature_flags IS
  'User-level feature flag overrides. Resolution priority: user setting > env var (VITE_FLAG_*) > default(false). Keys must match FlagKey type in apps/web/src/lib/featureFlags.ts. Master flag: newTranscriptionFlow — if false, all sub-flags are forced false at read time.';
