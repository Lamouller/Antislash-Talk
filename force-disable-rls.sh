#!/bin/bash

echo "🔧 Désactivation COMPLETE de RLS + verification permissions..."

ssh debian@37.59.118.101 << 'ENDSSH'
cd ~/antislash-talk

docker exec antislash-talk-db psql -U postgres -d postgres << 'EOF'
-- FORCER la désactivation de RLS
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques
DROP POLICY IF EXISTS "Users can upload to recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Service role bypass" ON storage.objects;
DROP POLICY IF EXISTS "Public buckets are viewable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view buckets" ON storage.buckets;
DROP POLICY IF EXISTS "Service role bypass" ON storage.buckets;

-- Accorder toutes les permissions de manière explicite
GRANT ALL PRIVILEGES ON storage.objects TO authenticated, anon;
GRANT ALL PRIVILEGES ON storage.buckets TO authenticated, anon;
GRANT ALL PRIVILEGES ON SCHEMA storage TO authenticated, anon;

\echo ""
\echo "État final RLS:"
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'storage' AND tablename IN ('objects', 'buckets');

\echo ""
\echo "Permissions finales sur storage.objects:"
SELECT grantee, string_agg(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' AND table_name = 'objects'
GROUP BY grantee
ORDER BY grantee;

\echo ""
\echo "✅ RLS désactivé et permissions accordées"
EOF

echo ""
echo "Arrêt complet des services Storage et PostgreSQL..."
docker stop antislash-talk-storage
docker stop antislash-talk-db

echo "Redémarrage de PostgreSQL..."
docker start antislash-talk-db
sleep 5

echo "Redémarrage de Storage..."
docker start antislash-talk-storage
sleep 5

echo ""
echo "✅ Tous les services redémarrés. Teste maintenant !"
ENDSSH


