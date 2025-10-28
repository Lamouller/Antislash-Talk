#!/bin/bash

echo "🔧 Synchronisation du mot de passe supabase_storage_admin..."

ssh debian@37.59.118.101 << 'ENDSSH'
cd ~/antislash-talk

echo "1️⃣ Extraction du mot de passe depuis DATABASE_URL..."
STORAGE_PASS=$(docker exec antislash-talk-storage env | grep DATABASE_URL | cut -d: -f3 | cut -d@ -f1)
echo "Mot de passe extrait: ${STORAGE_PASS:0:10}..."

echo ""
echo "2️⃣ Mise à jour du mot de passe dans PostgreSQL..."
docker exec antislash-talk-db psql -U postgres -d postgres << EOF
ALTER ROLE supabase_storage_admin WITH PASSWORD '$STORAGE_PASS';
ALTER ROLE supabase_storage_admin WITH LOGIN SUPERUSER;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin;
EOF

echo ""
echo "3️⃣ Test de connexion avec le mot de passe..."
docker exec -e PGPASSWORD="$STORAGE_PASS" antislash-talk-db psql -U supabase_storage_admin -h db -d postgres -c "SELECT current_user, version();" 2>&1 | head -5

echo ""
echo "4️⃣ Test INSERT direct..."
docker exec -e PGPASSWORD="$STORAGE_PASS" antislash-talk-db psql -U supabase_storage_admin -h db -d postgres << 'EOF'
BEGIN;
INSERT INTO storage.objects (bucket_id, name, owner, owner_id, version) 
VALUES ('meetingrecordings', 'final-test.txt', 'test', gen_random_uuid()::text, 'v1');
SELECT 'INSERT SUCCESS' as result;
ROLLBACK;
EOF

echo ""
echo "5️⃣ Redémarrage complet de Storage..."
docker stop antislash-talk-storage
sleep 2
docker start antislash-talk-storage
sleep 5

echo ""
echo "6️⃣ Vérification que Storage est démarré..."
docker logs antislash-talk-storage --tail 5

echo ""
echo "✅ Synchronisation terminée ! Teste maintenant l'upload."
ENDSSH

