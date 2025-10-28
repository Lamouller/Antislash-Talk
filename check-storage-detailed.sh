#!/bin/bash

echo "🔍 Diagnostic Storage détaillé..."

ssh debian@37.59.118.101 << 'ENDSSH'
cd ~/antislash-talk

echo "📋 État de RLS sur storage.objects:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'storage' AND tablename IN ('objects', 'buckets');"

echo ""
echo "🔑 Permissions sur storage.objects:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema = 'storage' AND table_name = 'objects' ORDER BY grantee, privilege_type;"

echo ""
echo "📊 Politiques actuelles:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "SELECT schemaname, tablename, policyname, permissive, roles, cmd FROM pg_policies WHERE schemaname = 'storage' ORDER BY tablename, policyname;"

echo ""
echo "🔄 Variables d'environnement Storage:"
docker exec antislash-talk-storage env | grep -E "(DATABASE_URL|PGRST|POSTGREST|AUTH)" | head -10

echo ""
echo "📝 Derniers logs Storage (erreurs uniquement):"
docker logs antislash-talk-storage 2>&1 | grep -E "(error|Error|ERROR|violate|Violate)" | tail -20

echo ""
echo "🧪 Test direct avec service_role key:"
SERVICE_ROLE_KEY=$(grep "^SERVICE_ROLE_KEY=" ~/antislash-talk/.env.monorepo | cut -d= -f2)
curl -k -s -X POST "https://37.59.118.101:8443/storage/v1/object/meetingrecordings/test-file.txt" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: text/plain" \
  -d "test content" | head -c 200

echo ""
echo ""
echo "✅ Diagnostic terminé"
ENDSSH


