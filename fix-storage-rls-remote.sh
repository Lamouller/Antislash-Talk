#!/bin/bash

# Script pour corriger les permissions Storage (RLS) depuis la machine locale

echo "🔧 Correction des permissions Storage sur le VPS..."

ssh debian@37.59.118.101 << 'ENDSSH'
cd ~/antislash-talk

echo "📦 Buckets existants :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "SELECT name, public FROM storage.buckets;"

echo ""
echo "🔐 Application des politiques RLS pour storage.objects..."

docker exec antislash-talk-db psql -U postgres -d postgres << 'EOF'
-- Désactiver temporairement RLS
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Service role bypass objects" ON storage.objects;

-- Réactiver RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Créer les nouvelles politiques
CREATE POLICY "Service role bypass objects"
ON storage.objects FOR ALL
TO service_role, postgres
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('meetingrecordings', 'avatars', 'transcriptions', 'reports', 'meeting-audio') 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id IN ('meetingrecordings', 'avatars', 'transcriptions', 'reports', 'meeting-audio')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('meetingrecordings', 'avatars', 'transcriptions', 'reports', 'meeting-audio')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Vérifier les politiques créées
\echo ""
\echo "✅ Politiques RLS créées :"
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename = 'objects';
EOF

echo ""
echo "Redémarrage du service Storage..."
docker restart antislash-talk-storage

sleep 3
echo ""
echo "✅ Configuration terminée !"
ENDSSH

echo ""
echo "✅ Tout est prêt ! Teste maintenant l'upload depuis l'app."


