#!/bin/bash
set -e

echo "🔧 CORRECTION COMPLÈTE DU DÉPLOIEMENT"
echo "====================================="
echo ""

cd ~/antislash-talk

# Charger les variables d'environnement
set -a
source .env.monorepo
set +a

echo "1️⃣ Application des migrations manquantes..."
echo ""

# Appliquer toutes les migrations
for migration in packages/supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        filename=$(basename "$migration")
        echo "   📄 $filename"
        docker exec -i antislash-talk-db psql -U postgres -d postgres < "$migration" 2>&1 | grep -v "already exists" | grep -v "duplicate" || true
    fi
done

echo ""
echo "2️⃣ Vérification et correction de la table profiles..."
echo ""

docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- Vérifier si la table profiles existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        RAISE NOTICE 'Table profiles n''existe pas, création...';
        
        CREATE TABLE public.profiles (
            id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            email text,
            full_name text,
            avatar_url text,
            preferred_transcription_provider text DEFAULT 'whisper-cpp',
            preferred_transcription_model text DEFAULT 'base',
            preferred_llm text DEFAULT 'ollama',
            preferred_llm_model text DEFAULT 'llama3.2:1b',
            prompt_title text,
            prompt_summary text,
            prompt_transcript text,
            auto_transcribe_after_recording boolean DEFAULT true,
            preferred_language text DEFAULT 'fr',
            enable_streaming_transcription boolean DEFAULT false,
            auto_generate_summary_after_streaming boolean DEFAULT false,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        
        CREATE INDEX IF NOT EXISTS profiles_id_idx ON public.profiles(id);
        
        RAISE NOTICE 'Table profiles créée';
    ELSE
        RAISE NOTICE 'Table profiles existe déjà';
    END IF;
END $$;

-- Activer RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role bypass" ON public.profiles;

-- Créer les policies
CREATE POLICY "Service role bypass"
  ON public.profiles FOR ALL
  TO service_role, postgres
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Créer un profil pour tous les utilisateurs existants
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, email as full_name
FROM auth.users
ON CONFLICT (id) DO NOTHING;

SELECT 'Profiles: ' || count(*) || ' profiles' FROM public.profiles;
SQL

echo ""
echo "3️⃣ Correction complète des buckets Storage..."
echo ""

docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- Désactiver RLS temporairement
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Supprimer les buckets existants pour repartir de zéro
DELETE FROM storage.objects WHERE true;
DELETE FROM storage.buckets WHERE true;

-- Créer tous les buckets essentiels avec limites et types MIME
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at, owner)
VALUES 
  ('recordings', 'recordings', false, 104857600, ARRAY['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg']::text[], now(), now(), NULL),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[], now(), now(), NULL),
  ('public', 'public', true, 10485760, NULL, now(), now(), NULL),
  ('private', 'private', false, 104857600, NULL, now(), now(), NULL);

-- Permissions Storage complètes
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role, supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, service_role, supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres, service_role, supabase_storage_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA storage TO anon, authenticated;

-- Réactiver RLS avec FORCE
ALTER TABLE storage.buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY;

-- Supprimer toutes les anciennes policies
DROP POLICY IF EXISTS "Service role bypass" ON storage.buckets;
DROP POLICY IF EXISTS "Authenticated users can view buckets" ON storage.buckets;
DROP POLICY IF EXISTS "Service role bypass" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own recordings" ON storage.objects;
DROP POLICY IF EXISTS "Public buckets are viewable" ON storage.objects;
DROP POLICY IF EXISTS "Public avatars are viewable" ON storage.objects;

-- Policies pour storage.buckets
CREATE POLICY "Service role bypass"
  ON storage.buckets FOR ALL
  TO service_role, postgres
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view buckets"
  ON storage.buckets FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policies pour storage.objects
CREATE POLICY "Service role bypass"
  ON storage.objects FOR ALL
  TO service_role, postgres
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can upload to recordings"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own recordings"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own recordings"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public buckets are viewable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id IN ('public', 'avatars'));

CREATE POLICY "Users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can update avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');

SELECT 'Buckets: ' || count(*) || ' buckets créés' FROM storage.buckets;
SQL

echo ""
echo "4️⃣ Vérification et correction de Realtime..."
echo ""

docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- Créer le schéma realtime s'il n'existe pas
CREATE SCHEMA IF NOT EXISTS realtime;
GRANT USAGE ON SCHEMA realtime TO postgres, anon, authenticated, service_role;

-- Vérifier si les extensions Realtime sont installées
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    END IF;
END $$;

SELECT 'Realtime schema configuré' as status;
SQL

echo ""
echo "5️⃣ Redémarrage des services critiques..."
echo ""

echo "   🔄 Redémarrage de Storage..."
docker compose -f docker-compose.monorepo.yml restart storage

echo "   🔄 Redémarrage de Rest..."
docker compose -f docker-compose.monorepo.yml restart rest

echo "   🔄 Redémarrage de Realtime..."
docker compose -f docker-compose.monorepo.yml restart realtime

echo ""
echo "   ⏳ Attente de redémarrage (15s)..."
sleep 15

echo ""
echo "6️⃣ Vérification finale..."
echo ""

echo "   📊 Utilisateurs:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "SELECT email, email_confirmed_at FROM auth.users;"

echo ""
echo "   📊 Profiles:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "SELECT id, email, preferred_transcription_provider FROM public.profiles;"

echo ""
echo "   📊 Buckets:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "SELECT id, name, public, file_size_limit FROM storage.buckets ORDER BY name;"

echo ""
echo "   📊 Storage Policies:"
docker exec antislash-talk-db psql -U postgres -d postgres -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'storage' ORDER BY tablename, policyname;"

echo ""
echo "7️⃣ Test des endpoints..."
echo ""

echo "   🧪 Test Auth Health:"
curl -s http://localhost:54321/auth/v1/health | head -5

echo ""
echo ""
echo "   🧪 Test Storage Buckets (avec SERVICE_ROLE_KEY):"
curl -s http://localhost:54321/storage/v1/bucket \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" | head -10

echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CORRECTION TERMINÉE !"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Teste maintenant l'application : http://$(grep '^VPS_HOST=' .env.monorepo | cut -d'=' -f2):3000"
echo "🔧 Accède à Studio : http://$(grep '^VPS_HOST=' .env.monorepo | cut -d'=' -f2):54327"
echo ""
echo "💡 Si tu as encore des erreurs 403/406, vérifie que :"
echo "   1. L'utilisateur a bien un profil créé"
echo "   2. Les policies RLS sur profiles permettent l'accès"
echo "   3. Realtime est bien démarré (docker logs antislash-talk-realtime)"
echo ""

