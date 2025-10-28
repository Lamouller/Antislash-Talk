#!/bin/bash

echo "🔧 Correction des permissions PostgreSQL pour Storage..."

ssh debian@37.59.118.101 << 'ENDSSH'
cd ~/antislash-talk

echo "🔐 Application des permissions PostgreSQL et RLS..."

docker exec antislash-talk-db psql -U postgres -d postgres << 'EOF'
-- Accorder toutes les permissions sur le schéma storage
GRANT ALL ON SCHEMA storage TO postgres, anon, authenticated, service_role, supabase_storage_admin;
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role;

-- Accorder les permissions sur toutes les tables storage
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, service_role, supabase_storage_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated, anon;

-- Accorder les permissions sur les séquences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA storage TO postgres, anon, authenticated, service_role, supabase_storage_admin;

-- Définir les permissions par défaut pour les futurs objets
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO postgres, service_role, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

\echo ""
\echo "✅ Permissions PostgreSQL accordées !"
\echo ""

-- Désactiver RLS temporairement
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Service role bypass objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Service role bypass buckets" ON storage.buckets;

-- Réactiver RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Politiques pour storage.objects
CREATE POLICY "Service role bypass objects"
ON storage.objects FOR ALL
TO service_role, postgres
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users full access"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id IN ('meetingrecordings', 'avatars', 'transcriptions', 'reports', 'meeting-audio'))
WITH CHECK (bucket_id IN ('meetingrecordings', 'avatars', 'transcriptions', 'reports', 'meeting-audio'));

-- Politiques pour storage.buckets
CREATE POLICY "Service role bypass buckets"
ON storage.buckets FOR ALL
TO service_role, postgres
USING (true)
WITH CHECK (true);

CREATE POLICY "Public buckets are viewable by everyone"
ON storage.buckets FOR SELECT
TO authenticated, anon
USING (true);

\echo ""
\echo "✅ Politiques RLS créées :"
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;
EOF

echo ""
echo "Redémarrage du service Storage..."
docker restart antislash-talk-storage

sleep 5
echo ""
echo "✅ Configuration terminée !"
ENDSSH

echo ""
echo "✅ Permissions PostgreSQL et RLS appliquées. Teste l'upload maintenant !"


