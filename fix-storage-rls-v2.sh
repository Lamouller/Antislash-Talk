#!/bin/bash

echo "🔧 Correction des permissions Storage (version 2 - plus permissive)..."

ssh debian@37.59.118.101 << 'ENDSSH'
cd ~/antislash-talk

echo "📋 Logs Storage récents :"
docker logs antislash-talk-storage --tail 20

echo ""
echo "🔐 Application des politiques RLS simplifiées..."

docker exec antislash-talk-db psql -U postgres -d postgres << 'EOF'
-- Désactiver temporairement RLS
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Service role bypass objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- Réactiver RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Créer des politiques plus simples et permissives pour authenticated users
CREATE POLICY "Service role bypass objects"
ON storage.objects FOR ALL
TO service_role, postgres
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('meetingrecordings', 'avatars', 'transcriptions', 'reports', 'meeting-audio')
);

CREATE POLICY "Authenticated users can read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id IN ('meetingrecordings', 'avatars', 'transcriptions', 'reports', 'meeting-audio')
);

CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('meetingrecordings', 'avatars', 'transcriptions', 'reports', 'meeting-audio')
)
WITH CHECK (
  bucket_id IN ('meetingrecordings', 'avatars', 'transcriptions', 'reports', 'meeting-audio')
);

CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('meetingrecordings', 'avatars', 'transcriptions', 'reports', 'meeting-audio')
);

-- Vérifier les politiques créées
\echo ""
\echo "✅ Politiques RLS créées :"
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE tablename = 'objects'
ORDER BY policyname;
EOF

echo ""
echo "Redémarrage du service Storage..."
docker restart antislash-talk-storage

sleep 3
echo ""
echo "✅ Configuration terminée avec politiques permissives !"
ENDSSH

echo ""
echo "✅ Teste maintenant l'upload depuis l'app."

