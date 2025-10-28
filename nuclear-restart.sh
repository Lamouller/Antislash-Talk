#!/bin/bash

echo "💥 REDÉMARRAGE COMPLET DE TOUS LES SERVICES..."

ssh debian@37.59.118.101 << 'ENDSSH'
cd ~/antislash-talk

echo "1️⃣ Arrêt de TOUS les services..."
docker compose -f docker-compose.monorepo.yml down

echo ""
echo "2️⃣ Application des permissions PostgreSQL..."
docker compose -f docker-compose.monorepo.yml up -d db
sleep 10

docker exec antislash-talk-db psql -U postgres -d postgres << 'EOF'
-- Désactiver RLS
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- Accorder TOUTES les permissions à supabase_storage_admin
GRANT ALL PRIVILEGES ON SCHEMA storage TO supabase_storage_admin, postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin, postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin, postgres;

-- Permissions spécifiques
GRANT ALL ON storage.objects TO supabase_storage_admin, postgres, authenticated, anon;
GRANT ALL ON storage.buckets TO supabase_storage_admin, postgres, authenticated, anon;

-- Vérification
\echo "Permissions finales:"
SELECT grantee, string_agg(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' AND table_name = 'objects'
GROUP BY grantee
ORDER BY grantee;
EOF

echo ""
echo "3️⃣ Démarrage de tous les services..."
set -a
source .env.monorepo
set +a

docker compose -f docker-compose.monorepo.yml up -d

echo ""
echo "4️⃣ Attente du démarrage des services..."
sleep 15

echo ""
echo "5️⃣ Vérification des services actifs..."
docker compose -f docker-compose.monorepo.yml ps

echo ""
echo "✅ Redémarrage complet terminé !"
ENDSSH

echo ""
echo "🎉 Tous les services sont redémarrés avec les bonnes permissions."
echo "Teste maintenant l'upload !"

