#!/bin/bash
# Désactiver COMPLÈTEMENT RLS pour tester

echo "🔧 Désactivation COMPLÈTE de RLS sur storage.objects..."

docker exec antislash-talk-db psql -U postgres -d postgres -c "
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
"

echo ""
echo "✅ Vérification:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename IN ('buckets', 'objects');
"

echo ""
echo "🔄 Redémarrage Storage..."
docker compose -f ~/antislash-talk/docker-compose.monorepo.yml restart storage

echo ""
echo "⚠️  RLS DÉSACTIVÉ ! C'est pour déboguer uniquement."
echo "✅ Teste maintenant l'upload. Si ça marche, on saura que le problème vient des policies RLS."

