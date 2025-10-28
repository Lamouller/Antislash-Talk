#!/bin/bash

echo "🔧 Correction FINALE de pg_hba.conf pour supabase_storage_admin..."

ssh debian@37.59.118.101 << 'ENDSSH'
cd ~/antislash-talk

echo "1️⃣ Modification de pg_hba.conf..."
docker exec antislash-talk-db bash -c "cat > /tmp/pg_hba.conf << 'PGEOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                trust
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
host    all             all             0.0.0.0/0               scram-sha-256
host    all             all             ::/0                    scram-sha-256
PGEOF
cat /tmp/pg_hba.conf > /var/lib/postgresql/data/pg_hba.conf"

echo ""
echo "2️⃣ Rechargement de la configuration PostgreSQL..."
docker exec antislash-talk-db psql -U postgres -d postgres -c "SELECT pg_reload_conf();"

echo ""
echo "3️⃣ Vérification du mot de passe supabase_storage_admin..."
STORAGE_PASS=$(grep "^POSTGRES_PASSWORD=" ~/antislash-talk/.env.monorepo | cut -d= -f2)
echo "Mot de passe extrait: ${STORAGE_PASS:0:10}..."

docker exec antislash-talk-db psql -U postgres -d postgres << EOF
ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD '$STORAGE_PASS';
ALTER ROLE supabase_storage_admin WITH SUPERUSER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON SCHEMA storage TO supabase_storage_admin;
EOF

echo ""
echo "4️⃣ Test de connexion avec supabase_storage_admin..."
docker exec -e PGPASSWORD="$STORAGE_PASS" antislash-talk-db psql -U supabase_storage_admin -h localhost -d postgres -c "SELECT current_user, session_user;"

echo ""
echo "5️⃣ Test INSERT..."
docker exec -e PGPASSWORD="$STORAGE_PASS" antislash-talk-db psql -U supabase_storage_admin -h localhost -d postgres << 'EOF'
INSERT INTO storage.objects (bucket_id, name, owner, owner_id, version) 
VALUES ('meetingrecordings', 'test-connection.txt', 'test', 'test-uuid', 'v1');

SELECT id, bucket_id, name FROM storage.objects WHERE name = 'test-connection.txt';

DELETE FROM storage.objects WHERE name = 'test-connection.txt';
EOF

echo ""
echo "6️⃣ Redémarrage de Storage..."
docker restart antislash-talk-storage

sleep 5
echo ""
echo "✅ Configuration terminée ! Teste maintenant l'upload."
ENDSSH

