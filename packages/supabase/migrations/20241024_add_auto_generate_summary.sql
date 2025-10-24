-- Migration: Ajouter la colonne auto_generate_summary_after_streaming à la table profiles
-- Date: 2024-10-24
-- Description: Permet d'activer/désactiver la génération automatique du summary par Ollama en background après streaming

-- Ajouter la colonne auto_generate_summary_after_streaming (activé par défaut)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS auto_generate_summary_after_streaming BOOLEAN DEFAULT true;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN profiles.auto_generate_summary_after_streaming IS 'Automatically generate AI summary with Ollama in background after streaming transcription completes. Does not block the user.';

-- Log de migration
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed: auto_generate_summary_after_streaming column added to profiles table';
END $$;

