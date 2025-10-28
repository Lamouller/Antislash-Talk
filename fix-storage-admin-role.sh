#!/bin/bash

echo "🔧 Correction des permissions pour supabase_storage_admin..."

ssh debian@37.59.118.101 << 'ENDSSH'
cd ~/antislash-talk

docker exec antislash-talk-db psql -U postgres -d postgres << 'EOF'
\echo "Permissions actuelles de supabase_storage_admin:"
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' AND table_name = 'objects' AND grantee = 'supabase_storage_admin'
ORDER BY privilege_type;

\echo ""
\echo "Accordons TOUTES les permissions à supabase_storage_admin..."

-- Accorder toutes les permissions sur storage schema
GRANT ALL PRIVILEGES ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin;

-- Spécifiquement pour les tables principales
GRANT ALL PRIVILEGES ON storage.objects TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON storage.buckets TO supabase_storage_admin;

-- S'assurer que le rôle peut se connecter
ALTER ROLE supabase_storage_admin WITH LOGIN;

\echo ""
\echo "Permissions finales de supabase_storage_admin:"
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' AND table_name = 'objects' AND grantee = 'supabase_storage_admin'
ORDER BY privilege_type;

\echo ""
\echo "✅ Permissions accordées !"
EOF

echo ""
echo "Redémarrage de Storage pour prendre en compte les changements..."
docker restart antislash-talk-storage

sleep 5
echo ""
echo "✅ Terminé ! Teste maintenant l'upload."
ENDSSH

