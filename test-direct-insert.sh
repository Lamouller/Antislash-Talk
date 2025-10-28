#!/bin/bash

echo "🧪 Test direct d'INSERT dans storage.objects..."

ssh debian@37.59.118.101 << 'ENDSSH'
cd ~/antislash-talk

echo "1️⃣ Vérification des permissions actuelles:"
docker exec antislash-talk-db psql -U postgres -d postgres << 'EOF'
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'storage' AND table_name = 'objects' 
ORDER BY grantee, privilege_type;
EOF

echo ""
echo "2️⃣ Test INSERT en tant que supabase_storage_admin:"
docker exec antislash-talk-db psql -U supabase_storage_admin -d postgres << 'EOF'
SET ROLE supabase_storage_admin;
INSERT INTO storage.objects (bucket_id, name, owner, owner_id, version) 
VALUES ('meetingrecordings', 'test-file.txt', 'test-owner', 'test-uuid', 'test-version');
EOF

echo ""
echo "3️⃣ Vérification de l'insertion:"
docker exec antislash-talk-db psql -U postgres -d postgres << 'EOF'
SELECT id, bucket_id, name, owner FROM storage.objects WHERE name = 'test-file.txt';
EOF

echo ""
echo "4️⃣ Nettoyage:"
docker exec antislash-talk-db psql -U postgres -d postgres << 'EOF'
DELETE FROM storage.objects WHERE name = 'test-file.txt';
EOF

echo ""
echo "✅ Test terminé"
ENDSSH

