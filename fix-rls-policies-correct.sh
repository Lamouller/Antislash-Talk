#!/bin/bash
# Créer les bonnes policies RLS pour meetingrecordings

echo "🔧 Application des policies RLS CORRECTES pour meetingrecordings..."

docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- Réactiver RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Service role bypass" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Public buckets are viewable" ON storage.objects;

-- Policy 1: Service role bypass (CRITIQUE pour que Storage service fonctionne)
CREATE POLICY "service_role_all"
ON storage.objects FOR ALL
TO service_role, postgres, supabase_storage_admin
USING (true)
WITH CHECK (true);

-- Policy 2: Authenticated users - ULTRA PERMISSIVE (pour tous les buckets)
CREATE POLICY "authenticated_insert_all"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_select_all"
ON storage.objects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_update_all"
ON storage.objects FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_delete_all"
ON storage.objects FOR DELETE
TO authenticated
USING (true);

-- Policy 3: Public buckets pour anon
CREATE POLICY "anon_select_public"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id IN (SELECT id FROM storage.buckets WHERE public = true));

-- Policies pour storage.buckets
DROP POLICY IF EXISTS "authenticated_buckets_select" ON storage.buckets;
DROP POLICY IF EXISTS "service_role_buckets_all" ON storage.buckets;

CREATE POLICY "authenticated_buckets_select"
ON storage.buckets FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "service_role_buckets_all"
ON storage.buckets FOR ALL
TO service_role, postgres, supabase_storage_admin
USING (true)
WITH CHECK (true);

SELECT 'Policies créées avec succès' as status;
SQL

echo ""
echo "✅ Vérification des policies:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT policyname, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
"

echo ""
echo "✅ Vérification de l'état RLS:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename IN ('buckets', 'objects');
"

echo ""
echo "🔄 Redémarrage Storage..."
docker compose -f ~/antislash-talk/docker-compose.monorepo.yml restart storage

echo ""
echo "✅ TERMINÉ ! RLS réactivé avec des policies ultra-permissives."
echo "🎯 Teste maintenant l'upload - ça devrait fonctionner !"

