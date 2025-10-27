#!/bin/bash
set -e

echo "🪣 Correction complète des buckets Storage"
echo "=========================================="
echo ""

cd ~/antislash-talk

echo "1️⃣ Vérification des logs Storage..."
echo ""
docker logs antislash-talk-storage --tail 30
echo ""

echo "2️⃣ Vérification des buckets existants..."
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
SELECT id, name, public, created_at FROM storage.buckets;
SQL

echo ""
echo "3️⃣ Désactivation RLS et création de TOUS les buckets..."
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- Désactiver RLS
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.migrations DISABLE ROW LEVEL SECURITY;

-- Supprimer tous les buckets existants pour repartir de zéro
DELETE FROM storage.objects;
DELETE FROM storage.buckets;

-- Créer tous les buckets essentiels
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at, owner)
VALUES 
  ('recordings', 'recordings', false, 104857600, ARRAY['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg']::text[], now(), now(), NULL),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[], now(), now(), NULL),
  ('public', 'public', true, 10485760, NULL, now(), now(), NULL),
  ('private', 'private', false, 104857600, NULL, now(), now(), NULL);

-- Vérifier la création
SELECT id, name, public, file_size_limit FROM storage.buckets ORDER BY name;

-- Configurer les permissions Storage
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role, supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, service_role, supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres, service_role, supabase_storage_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA storage TO anon, authenticated;

-- Forcer RLS pour tous les rôles
ALTER TABLE storage.buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Service role bypass" ON storage.buckets;
DROP POLICY IF EXISTS "Service role bypass" ON storage.objects;
DROP POLICY IF EXISTS "Anon read buckets" ON storage.buckets;
DROP POLICY IF EXISTS "Authenticated read buckets" ON storage.buckets;

-- Créer policies pour service_role (bypass complet)
CREATE POLICY "Service role bypass"
  ON storage.buckets
  FOR ALL
  TO service_role, postgres
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role bypass"
  ON storage.objects
  FOR ALL
  TO service_role, postgres
  USING (true)
  WITH CHECK (true);

-- Créer policies pour anon et authenticated (lecture seule des buckets)
CREATE POLICY "Anon read buckets"
  ON storage.buckets
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Vérifier les policies
SELECT schemaname, tablename, policyname, roles 
FROM pg_policies 
WHERE schemaname = 'storage' 
ORDER BY tablename, policyname;

SELECT '✅ Configuration terminée' as status;
SQL

echo ""
echo "4️⃣ Redémarrage de Storage..."
docker compose -f docker-compose.monorepo.yml restart storage

echo ""
echo "⏳ Attente de redémarrage (10s)..."
sleep 10

echo ""
echo "5️⃣ Vérification finale..."
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
SELECT id, name, public, file_size_limit, created_at FROM storage.buckets ORDER BY name;
SQL

echo ""
echo "6️⃣ Test API Storage..."
SERVICE_ROLE_KEY=$(grep '^SERVICE_ROLE_KEY=' .env.monorepo | cut -d'=' -f2-)
echo "Test GET /storage/v1/bucket:"
curl -s http://localhost:54321/storage/v1/bucket \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" | head -30

echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Correction terminée !"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Vérifie dans Studio : http://37.59.118.101:54327"
echo "   Onglet : Storage"
echo ""

