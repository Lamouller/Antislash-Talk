#!/bin/bash

echo "=== FIX AUTH/STORAGE POUR VPS ==="
echo ""

# Récupérer le mot de passe depuis .env.monorepo
POSTGRES_PASSWORD=$(grep "POSTGRES_PASSWORD=" .env.monorepo | cut -d'=' -f2)
if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ Impossible de récupérer POSTGRES_PASSWORD depuis .env.monorepo"
    exit 1
fi

echo "1. Arrêt temporaire d'Auth et Storage..."
docker stop antislash-talk-auth antislash-talk-storage antislash-talk-rest

echo ""
echo "2. Configuration complète de PostgreSQL..."
docker exec antislash-talk-db psql -U postgres << SQLEOF
-- Forcer SCRAM-SHA-256
SET password_encryption = 'scram-sha-256';
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
SELECT pg_reload_conf();

-- Créer les schémas si manquants
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

-- Créer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgjwt SCHEMA extensions;

-- Créer le type ENUM pour Auth
DO \$\$ 
BEGIN
    CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
EXCEPTION
    WHEN duplicate_object THEN null;
END \$\$;

-- Créer la table schema_migrations pour Auth
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version VARCHAR(255) PRIMARY KEY
);

-- Supprimer et recréer les rôles avec les bons mots de passe
-- supabase_auth_admin
DROP ROLE IF EXISTS supabase_auth_admin;
CREATE ROLE supabase_auth_admin WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' SUPERUSER CREATEDB CREATEROLE REPLICATION;

-- supabase_storage_admin  
DROP ROLE IF EXISTS supabase_storage_admin;
CREATE ROLE supabase_storage_admin WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' SUPERUSER CREATEDB CREATEROLE REPLICATION;

-- supabase_admin
DROP ROLE IF EXISTS supabase_admin;
CREATE ROLE supabase_admin WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' SUPERUSER CREATEDB CREATEROLE REPLICATION;

-- authenticator
DROP ROLE IF EXISTS authenticator;
CREATE ROLE authenticator WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' NOINHERIT;

-- anon
DROP ROLE IF EXISTS anon;
CREATE ROLE anon NOLOGIN NOINHERIT;

-- authenticated
DROP ROLE IF EXISTS authenticated;
CREATE ROLE authenticated NOLOGIN NOINHERIT;

-- service_role
DROP ROLE IF EXISTS service_role;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;

-- Accorder les permissions
GRANT anon, authenticated, service_role TO authenticator;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_auth_admin, supabase_storage_admin, supabase_admin;
GRANT ALL ON SCHEMA auth, public TO supabase_auth_admin, supabase_admin;
GRANT ALL ON SCHEMA storage, public TO supabase_storage_admin, supabase_admin;
GRANT ALL ON SCHEMA extensions TO anon, authenticated, service_role;

-- Permissions sur toutes les tables existantes et futures
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON FUNCTIONS TO supabase_auth_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON SEQUENCES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON FUNCTIONS TO supabase_storage_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
SQLEOF

echo ""
echo "3. Configuration de pg_hba.conf pour SCRAM-SHA-256..."
docker exec antislash-talk-db bash -c "cat > /var/lib/postgresql/data/pg_hba.conf << 'PGEOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                trust
local   all             all                                     scram-sha-256
host    all             all             0.0.0.0/0               scram-sha-256
host    all             all             ::/0                    scram-sha-256
PGEOF"

echo ""
echo "4. Redémarrage de PostgreSQL..."
docker restart antislash-talk-db
sleep 10

echo ""
echo "5. Test de connexion avec les nouveaux mots de passe..."
echo "Test supabase_auth_admin:"
docker exec antislash-talk-db psql -U supabase_auth_admin -d postgres -c "SELECT current_user;" 2>&1 | grep -E "current_user|error"

echo "Test supabase_storage_admin:"
docker exec antislash-talk-db psql -U supabase_storage_admin -d postgres -c "SELECT current_user;" 2>&1 | grep -E "current_user|error"

echo ""
echo "6. Redémarrage d'Auth, Storage et Rest..."
docker start antislash-talk-auth antislash-talk-storage antislash-talk-rest

echo ""
echo "7. Attente de 30 secondes pour laisser les services démarrer..."
sleep 30

echo ""
echo "8. Vérification des tables créées..."
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT 'Tables auth:' as info, COUNT(*) as count FROM pg_tables WHERE schemaname = 'auth'
UNION ALL
SELECT 'Tables storage:', COUNT(*) FROM pg_tables WHERE schemaname = 'storage';
"

echo ""
echo "9. Si les tables sont créées, création des données..."
if [ $(docker exec antislash-talk-db psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users';") -eq 1 ]; then
    echo "✅ Table auth.users existe, création de l'utilisateur..."
    
    # Récupérer les infos utilisateur depuis deployment-info.txt ou utiliser des valeurs par défaut
    APP_USER_EMAIL="admin@antislash-talk.fr"
    APP_USER_PASSWORD="AntiSlash2024!"
    APP_USER_PASSWORD_HASH=$(docker run --rm httpd:alpine htpasswd -nbB -C 10 temp "$APP_USER_PASSWORD" | cut -d: -f2)
    
    docker exec antislash-talk-db psql -U postgres -d postgres << SQLEOF
-- Désactiver RLS temporairement
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- Créer l'utilisateur
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    '$APP_USER_EMAIL',
    '$APP_USER_PASSWORD_HASH',
    NOW(), NOW(), NOW()
)
ON CONFLICT (email) WHERE is_sso_user = false DO NOTHING;

-- Réactiver RLS
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Compter les utilisateurs
SELECT 'Utilisateurs créés:', COUNT(*) FROM auth.users;
SQLEOF
fi

if [ $(docker exec antislash-talk-db psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets';") -eq 1 ]; then
    echo "✅ Table storage.buckets existe, création des buckets..."
    
    docker exec antislash-talk-db psql -U postgres -d postgres << SQLEOF
-- Désactiver RLS sur storage
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Créer les buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
    ('recordings', 'recordings', false),
    ('exports', 'exports', false),
    ('speakers', 'speakers', false)
ON CONFLICT (id) DO NOTHING;

-- Compter les buckets
SELECT 'Buckets créés:', COUNT(*) FROM storage.buckets;
SQLEOF
fi

echo ""
echo "10. État final des services :"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "auth|storage|rest|db"

echo ""
echo "✅ Fix terminé ! Si les services sont UP, testez l'accès :"
echo "   - Application: http://$(curl -s ifconfig.me):3000"
echo "   - Studio: http://$(curl -s ifconfig.me):54323"
echo "   - Login: admin@antislash-talk.fr / AntiSlash2024!"
