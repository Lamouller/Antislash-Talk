#!/bin/bash

echo "🔧 Désactivation temporaire de RLS sur storage.objects pour déboguer..."

ssh debian@37.59.118.101 << 'ENDSSH'
cd ~/antislash-talk

docker exec antislash-talk-db psql -U postgres -d postgres << 'EOF'
-- Vérifier l'état actuel de RLS
\echo "État actuel de RLS sur storage.objects:"
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects';

\echo ""
\echo "Politiques actuelles:"
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';

\echo ""
\echo "Désactivation de RLS sur storage.objects..."
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

\echo ""
\echo "✅ RLS désactivé sur storage.objects"
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects';
EOF

echo ""
echo "Redémarrage du service Storage..."
docker restart antislash-talk-storage

sleep 5
echo ""
echo "✅ RLS désactivé ! Teste maintenant l'upload."
echo "⚠️  ATTENTION: Ceci est temporaire pour déboguer. Ne pas laisser en production."
ENDSSH

