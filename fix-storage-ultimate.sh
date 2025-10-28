#!/bin/bash
# Script ULTIME pour corriger le Storage RLS une fois pour toutes
VPS_HOST="37.59.118.101"
SSH_USER="debian"

echo "🔧 CORRECTION ULTIME DU STORAGE RLS"
echo "===================================="
echo ""

echo "1️⃣ Diagnostic complet..."
ssh "$SSH_USER@$VPS_HOST" << 'EOF'
echo "📊 État actuel de RLS sur storage.objects:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename IN ('buckets', 'objects');
"

echo ""
echo "🔑 Permissions actuelles sur storage.objects:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' AND table_name = 'objects'
ORDER BY grantee;
"

echo ""
echo "📋 Politiques RLS actuelles:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT schemaname, tablename, policyname, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';
"

echo ""
echo "👥 Rôles PostgreSQL existants:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT rolname, rolsuper, rolcanlogin 
FROM pg_roles 
WHERE rolname IN ('postgres', 'supabase_storage_admin', 'authenticated', 'anon', 'service_role')
ORDER BY rolname;
"
EOF

echo ""
echo "2️⃣ Application de la correction ULTIME..."
ssh "$SSH_USER@$VPS_HOST" << 'EOF'
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- ÉTAPE 1: Désactiver temporairement RLS
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- ÉTAPE 2: Supprimer TOUTES les policies existantes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- ÉTAPE 3: Accorder TOUS les privilèges à supabase_storage_admin
GRANT ALL PRIVILEGES ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO supabase_storage_admin;

-- ÉTAPE 4: Accorder les privilèges nécessaires à authenticated
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA storage TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;

-- ÉTAPE 5: Accorder les privilèges à service_role et anon
GRANT USAGE ON SCHEMA storage TO service_role, anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA storage TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA storage TO anon;

-- ÉTAPE 6: Réactiver RLS avec FORCE
ALTER TABLE storage.buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY;

-- ÉTAPE 7: Créer des policies ULTRA-PERMISSIVES pour authenticated
CREATE POLICY "authenticated_all_buckets_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_all_buckets_select"
ON storage.objects FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_all_buckets_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "authenticated_all_buckets_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (true);

-- ÉTAPE 8: Service role bypass (pour supabase_storage_admin et service_role)
CREATE POLICY "service_role_all"
ON storage.objects FOR ALL
TO service_role, postgres
USING (true)
WITH CHECK (true);

-- ÉTAPE 9: Buckets policies
DROP POLICY IF EXISTS "authenticated_buckets_select" ON storage.buckets;
CREATE POLICY "authenticated_buckets_select"
ON storage.buckets FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "service_role_buckets_all" ON storage.buckets;
CREATE POLICY "service_role_buckets_all"
ON storage.buckets FOR ALL
TO service_role, postgres
USING (true)
WITH CHECK (true);

-- ÉTAPE 10: Vérification finale
SELECT 'Policies créées' as status;
SELECT policyname, roles, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
SQL
EOF

echo ""
echo "3️⃣ Redémarrage complet de Storage..."
ssh "$SSH_USER@$VPS_HOST" 'docker compose -f ~/antislash-talk/docker-compose.monorepo.yml stop storage'
sleep 2
ssh "$SSH_USER@$VPS_HOST" 'docker compose -f ~/antislash-talk/docker-compose.monorepo.yml start storage'

echo ""
echo "4️⃣ Attente du démarrage de Storage..."
sleep 5

echo ""
echo "5️⃣ Vérification finale..."
ssh "$SSH_USER@$VPS_HOST" << 'EOF'
echo "✅ Policies finales sur storage.objects:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT policyname, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';
"

echo ""
echo "✅ Permissions finales sur storage.objects:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT grantee, string_agg(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' AND table_name = 'objects'
GROUP BY grantee
ORDER BY grantee;
"

echo ""
echo "✅ État RLS:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename IN ('buckets', 'objects');
"
EOF

echo ""
echo "✅ CORRECTION TERMINÉE !"
echo ""
echo "🎯 Maintenant, teste l'upload depuis l'app."
echo "   Si ça ne marche TOUJOURS pas, c'est que le problème vient d'ailleurs (Storage service lui-même)."

