#!/bin/bash
# Script ultra-simple pour donner TOUS les droits à authenticated

echo "🔧 Ajout des permissions INSERT/UPDATE/DELETE à authenticated..."

docker exec antislash-talk-db psql -U postgres -d postgres -c "
GRANT INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT INSERT, UPDATE, DELETE ON storage.buckets TO authenticated;
"

echo ""
echo "✅ Vérification:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT grantee, string_agg(privilege_type, ', ') as privileges
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' AND table_name = 'objects'
GROUP BY grantee
ORDER BY grantee;
"

echo ""
echo "🔄 Redémarrage Storage..."
docker compose -f ~/antislash-talk/docker-compose.monorepo.yml restart storage

echo ""
echo "✅ FAIT ! Authenticated devrait maintenant avoir INSERT, UPDATE, DELETE, SELECT"

