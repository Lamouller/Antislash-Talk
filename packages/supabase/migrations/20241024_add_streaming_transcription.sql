-- Migration: Ajouter la colonne enable_streaming_transcription à la table profiles
-- Date: 2024-10-24
-- Description: Permet d'activer/désactiver la transcription en streaming temps réel

-- Ajouter la colonne enable_streaming_transcription (désactivé par défaut)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS enable_streaming_transcription BOOLEAN DEFAULT false;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN profiles.enable_streaming_transcription IS 'Enable real-time streaming transcription with Server-Sent Events (SSE). Requires WhisperX or whisper.cpp service.';

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_profiles_enable_streaming_transcription 
ON profiles(enable_streaming_transcription)
WHERE enable_streaming_transcription = true;

-- Log de migration
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed: enable_streaming_transcription column added to profiles table';
END $$;

