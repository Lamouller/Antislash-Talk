#!/bin/bash

echo "=== FIX FORCÉ AUTH/STORAGE ==="
echo ""

# Récupérer le mot de passe depuis .env.monorepo
POSTGRES_PASSWORD=$(grep "POSTGRES_PASSWORD=" .env.monorepo | cut -d'=' -f2)
if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ Impossible de récupérer POSTGRES_PASSWORD depuis .env.monorepo"
    exit 1
fi

echo "Mot de passe PostgreSQL trouvé : ${POSTGRES_PASSWORD:0:10}... (${#POSTGRES_PASSWORD} caractères)"
echo ""

# 1. Arrêter TOUS les services sauf PostgreSQL
echo "1. Arrêt de tous les services sauf PostgreSQL..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo stop auth storage rest kong realtime meta studio studio-proxy web

# 2. Se connecter à PostgreSQL et TOUT reconfigurer
echo ""
echo "2. Reconfiguration COMPLÈTE de PostgreSQL..."
docker exec -i antislash-talk-db psql -U postgres << SQLEOF
-- AFFICHER LES ERREURS
\set ON_ERROR_STOP off

-- 1. Forcer SCRAM-SHA-256
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
SELECT pg_reload_conf();

-- 2. Créer les schémas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

-- 3. Créer les extensions dans le bon schéma
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgjwt SCHEMA extensions;

-- 4. IMPORTANT: Créer le type auth.factor_type
DROP TYPE IF EXISTS auth.factor_type CASCADE;
CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');

-- 5. Créer la table schema_migrations pour Auth
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version VARCHAR(255) PRIMARY KEY
);

-- 6. Mettre à jour TOUS les mots de passe des rôles existants
ALTER USER postgres PASSWORD '$POSTGRES_PASSWORD';
ALTER USER supabase_auth_admin WITH PASSWORD '$POSTGRES_PASSWORD' SUPERUSER CREATEDB CREATEROLE REPLICATION;
ALTER USER supabase_storage_admin WITH PASSWORD '$POSTGRES_PASSWORD' SUPERUSER CREATEDB CREATEROLE REPLICATION;
ALTER USER supabase_admin WITH PASSWORD '$POSTGRES_PASSWORD' SUPERUSER CREATEDB CREATEROLE REPLICATION;
ALTER USER authenticator WITH PASSWORD '$POSTGRES_PASSWORD';

-- 7. S'assurer que les rôles sans login existent
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
    END IF;
END
\$\$;

-- 8. Accorder les permissions
GRANT anon, authenticated, service_role TO authenticator;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_auth_admin, supabase_storage_admin, supabase_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin, supabase_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin, supabase_admin;
GRANT ALL ON SCHEMA public TO supabase_auth_admin, supabase_storage_admin, supabase_admin;
GRANT ALL ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth, storage, public TO anon, authenticated, service_role;

-- 9. Permissions sur les objets futurs
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON FUNCTIONS TO supabase_auth_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON SEQUENCES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON FUNCTIONS TO supabase_storage_admin;

-- 10. Vérifier que tout est créé
SELECT 'Type auth.factor_type créé ?' as check, 
       EXISTS(SELECT 1 FROM pg_type WHERE typname = 'factor_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) as result;

SELECT 'Schémas créés ?' as check,
       COUNT(*) as result 
FROM information_schema.schemata 
WHERE schema_name IN ('auth', 'storage', 'extensions');

SELECT 'Rôles avec SUPERUSER ?' as check,
       COUNT(*) as result
FROM pg_roles 
WHERE rolname IN ('supabase_auth_admin', 'supabase_storage_admin', 'supabase_admin')
AND rolsuper = true;
SQLEOF

# 3. Redémarrer PostgreSQL pour appliquer les changements
echo ""
echo "3. Redémarrage de PostgreSQL..."
docker restart antislash-talk-db
sleep 10

# 4. Tester la connexion avec le mot de passe
echo ""
echo "4. Test de connexion avec le nouveau mot de passe..."
export PGPASSWORD="$POSTGRES_PASSWORD"
docker exec antislash-talk-db psql -h localhost -U supabase_auth_admin -d postgres -c "SELECT current_user, version();" 2>&1 | head -5

# 5. Redémarrer tous les services avec --force-recreate
echo ""
echo "5. Redémarrage de TOUS les services avec les nouvelles variables..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d --force-recreate

# 6. Attendre que les services démarrent
echo ""
echo "6. Attente de 45 secondes pour laisser les services démarrer..."
for i in {1..45}; do
    echo -ne "\r⏳ $i/45 secondes..."
    sleep 1
done
echo ""

# 7. Vérifier l'état final
echo ""
echo "7. État final des services :"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "auth|storage|rest|db"

echo ""
echo "8. Vérification des tables créées :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT 'Tables auth:' as info, COUNT(*) as count FROM pg_tables WHERE schemaname = 'auth'
UNION ALL
SELECT 'Tables storage:', COUNT(*) FROM pg_tables WHERE schemaname = 'storage';
"

# 9. Si les tables existent, créer les données
AUTH_TABLES=$(docker exec antislash-talk-db psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'auth';" 2>/dev/null || echo "0")
if [ "$AUTH_TABLES" -gt "0" ]; then
    echo ""
    echo "9. Création des données initiales..."
    
    # Créer l'utilisateur
    APP_USER_EMAIL="admin@antislash-talk.fr"
    APP_USER_PASSWORD="AntiSlash2024!"
    APP_USER_PASSWORD_HASH=$(docker run --rm httpd:alpine htpasswd -nbB -C 10 temp "$APP_USER_PASSWORD" | cut -d: -f2)
    
    docker exec antislash-talk-db psql -U postgres -d postgres << SQLEOF
-- Désactiver RLS
ALTER TABLE IF EXISTS auth.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS storage.buckets DISABLE ROW LEVEL SECURITY;

-- Créer l'utilisateur
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    '$APP_USER_EMAIL',
    '$APP_USER_PASSWORD_HASH',
    NOW(), NOW(), NOW()
) ON CONFLICT (email) WHERE is_sso_user = false DO NOTHING;

-- Créer les buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
    ('recordings', 'recordings', false),
    ('exports', 'exports', false),
    ('speakers', 'speakers', false)
ON CONFLICT (id) DO NOTHING;

-- Compter
SELECT 'Utilisateurs créés:', COUNT(*) FROM auth.users;
SELECT 'Buckets créés:', COUNT(*) FROM storage.buckets;
SQLEOF
fi

echo ""
echo "✅ Fix terminé !"
echo ""
echo "Si les services sont UP :"
echo "- Application: http://$(curl -s ifconfig.me 2>/dev/null || echo "VPS_IP"):3000"
echo "- Studio: http://$(curl -s ifconfig.me 2>/dev/null || echo "VPS_IP"):54323"
echo "- Login: admin@antislash-talk.fr / AntiSlash2024!"
