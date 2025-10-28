#!/bin/bash

echo "🔧 Correction FINALE des permissions authenticated sur storage.objects..."

ssh debian@37.59.118.101 << 'ENDSSH'
cd ~/antislash-talk

docker exec antislash-talk-db psql -U postgres -d postgres << 'EOF'
\echo "Avant modification:"
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' AND table_name = 'objects' AND grantee = 'authenticated'
ORDER BY privilege_type;

\echo ""
\echo "Ajout des permissions INSERT, UPDATE, DELETE pour authenticated..."

GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.buckets TO authenticated;

\echo ""
\echo "Après modification:"
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' AND table_name = 'objects' AND grantee = 'authenticated'
ORDER BY privilege_type;

\echo ""
\echo "✅ Permissions accordées !"
EOF

echo ""
echo "Redémarrage du service Storage..."
docker restart antislash-talk-storage

sleep 5
echo ""
echo "✅ Terminé ! Teste maintenant l'upload."
ENDSSH

