#!/bin/bash
set -e

echo "🚨 Emergency Database Restore"
echo "=============================="

cd ~/antislash-talk

echo ""
echo "⚠️  Ce script va recréer TOUTE la base de données"
echo "   Les anciennes données sont perdues"
echo ""

# 1. Arrêter tous les services
echo "🛑 Arrêt de tous les services..."
docker compose -f docker-compose.monorepo.yml down

# 2. Supprimer le volume de la base
echo "🗑️  Suppression du volume..."
docker volume rm antislash-talk_db-data 2>/dev/null || true

# 3. Corriger le htpasswd si nécessaire
echo "📝 Création du htpasswd..."
rm -rf studio.htpasswd 2>/dev/null || true
STUDIO_PASSWORD=$(grep "^STUDIO_PASSWORD=" .env.monorepo | cut -d= -f2 || echo "antislash2024")
if command -v htpasswd &> /dev/null; then
    htpasswd -bc studio.htpasswd antislash "${STUDIO_PASSWORD}"
else
    echo "antislash:$(openssl passwd -apr1 ${STUDIO_PASSWORD})" > studio.htpasswd
fi

# 4. Redémarrer tous les services
echo "🚀 Démarrage des services..."
docker compose -f docker-compose.monorepo.yml up -d

# 5. Attendre que la base soit prête
echo "⏳ Attente de la base de données (30s max)..."
for i in {1..30}; do
    if docker exec antislash-talk-db pg_isready -U postgres >/dev/null 2>&1; then
        echo "✅ Base de données prête"
        break
    fi
    echo "   Tentative $i/30..."
    sleep 2
done

# 6. Appliquer TOUTES les migrations
echo ""
echo "📦 Application des migrations..."
for migration in packages/supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "   📄 $(basename $migration)"
        docker exec -i antislash-talk-db psql -U postgres -d postgres < "$migration" 2>&1 | grep -v "already exists" | grep -v "does not exist" || true
    fi
done

# 7. Configuration PostgreSQL COMPLÈTE
echo ""
echo "⚙️  Configuration PostgreSQL..."

POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.monorepo | cut -d= -f2)
JWT_SECRET=$(grep "^JWT_SECRET=" .env.monorepo | cut -d= -f2)

docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- Créer les schémas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS public;

-- Créer les rôles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
END
$$;

-- Permissions globales
GRANT USAGE ON SCHEMA public, auth, storage TO postgres, anon, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
GRANT ALL ON SCHEMA public, auth, storage TO postgres, service_role, supabase_auth_admin, supabase_storage_admin;
GRANT ALL ON DATABASE postgres TO postgres, service_role, supabase_auth_admin, supabase_storage_admin;

-- Permissions sur toutes les tables
GRANT ALL ON ALL TABLES IN SCHEMA public, auth, storage TO postgres, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public, auth, storage TO postgres, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public, auth, storage TO postgres, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;

-- Default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public, auth, storage GRANT ALL ON TABLES TO postgres, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, auth, storage GRANT ALL ON SEQUENCES TO postgres, authenticated, service_role, supabase_auth_admin, supabase_storage_admin;

-- RLS pour storage.objects
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "service_role_all" ON storage.objects;
        CREATE POLICY "service_role_all" ON storage.objects
        FOR ALL TO service_role, postgres, supabase_storage_admin
        USING (true) WITH CHECK (true);
        
        DROP POLICY IF EXISTS "authenticated_all" ON storage.objects;
        CREATE POLICY "authenticated_all" ON storage.objects
        FOR ALL TO authenticated
        USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- RLS pour storage.buckets
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
        ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "service_role_all_buckets" ON storage.buckets;
        CREATE POLICY "service_role_all_buckets" ON storage.buckets
        FOR ALL TO service_role, postgres, supabase_storage_admin
        USING (true) WITH CHECK (true);
        
        DROP POLICY IF EXISTS "authenticated_all_buckets" ON storage.buckets;
        CREATE POLICY "authenticated_all_buckets" ON storage.buckets
        FOR ALL TO authenticated
        USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- Créer le bucket recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recordings', 'recordings', false, 104857600, ARRAY['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4'])
ON CONFLICT (id) DO NOTHING;
SQL

# 8. Créer un utilisateur par défaut depuis .env.monorepo
echo ""
echo "👤 Création de l'utilisateur par défaut..."

APP_USER_EMAIL=$(grep "^APP_USER_EMAIL=" .env.monorepo | cut -d= -f2 || echo "admin@antislash.studio")
APP_USER_PASSWORD=$(grep "^APP_USER_PASSWORD=" .env.monorepo | cut -d= -f2 || echo "antislash2024")

docker exec antislash-talk-db psql -U postgres -d postgres << SQL
-- Créer l'utilisateur
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    raw_app_meta_data,
    aud,
    role
)
VALUES (
    gen_random_uuid(),
    '${APP_USER_EMAIL}',
    crypt('${APP_USER_PASSWORD}', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"display_name": "Admin"}',
    '{"provider": "email"}',
    'authenticated',
    'authenticated'
)
ON CONFLICT (email) DO NOTHING
RETURNING id, email;

-- Créer le profil correspondant
INSERT INTO public.profiles (id, email, display_name, created_at, updated_at, preferred_llm)
SELECT id, email, 'Admin', created_at, NOW(), 'gpt-4'
FROM auth.users
WHERE email = '${APP_USER_EMAIL}'
ON CONFLICT (id) DO NOTHING;
SQL

# 9. Redémarrer tous les services
echo ""
echo "🔄 Redémarrage de tous les services..."
docker compose -f docker-compose.monorepo.yml restart

echo ""
echo "✅ Base de données restaurée !"
echo ""
echo "📊 État final:"
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
SELECT 
    (SELECT COUNT(*) FROM auth.users) as users,
    (SELECT COUNT(*) FROM public.profiles) as profiles,
    (SELECT COUNT(*) FROM storage.buckets) as buckets,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname IN ('public', 'auth', 'storage')) as tables;
SQL

echo ""
echo "🔑 Identifiants:"
echo "   Email: ${APP_USER_EMAIL}"
echo "   Password: ${APP_USER_PASSWORD}"
