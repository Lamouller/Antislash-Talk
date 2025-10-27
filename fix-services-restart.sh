#!/bin/bash

# Script de réparation rapide pour les services qui redémarrent
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}    $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

cd /home/debian/antislash-talk

print_header "RÉPARATION DES SERVICES"

# Charger les variables d'environnement
source .env.monorepo

# 1. Arrêter les services problématiques
print_info "Arrêt des services en erreur..."
docker stop antislash-talk-auth antislash-talk-storage antislash-talk-rest 2>/dev/null || true

# 2. Corriger PostgreSQL
print_header "Configuration PostgreSQL"

docker exec -i antislash-talk-db psql -U postgres << EOF
-- S'assurer que password_encryption est correct
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
SELECT pg_reload_conf();

-- Créer/mettre à jour TOUS les rôles avec le bon mot de passe
DO \$\$
DECLARE
    db_password text := '${POSTGRES_PASSWORD}';
BEGIN
    -- Mettre à jour postgres lui-même
    ALTER ROLE postgres PASSWORD db_password;
    
    -- Créer/mettre à jour supabase_auth_admin
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin;
    END IF;
    ALTER ROLE supabase_auth_admin WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD db_password;
    
    -- Créer/mettre à jour supabase_storage_admin
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin;
    END IF;
    ALTER ROLE supabase_storage_admin WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD db_password;
    
    -- Créer/mettre à jour authenticator
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator;
    END IF;
    ALTER ROLE authenticator WITH LOGIN PASSWORD db_password;
    
    -- Créer/mettre à jour service_role
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
    END IF;
    ALTER ROLE service_role WITH NOLOGIN;
    
    -- Créer/mettre à jour anon
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
    ALTER ROLE anon WITH NOLOGIN;
    
    -- Créer/mettre à jour supabase_admin
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin;
    END IF;
    ALTER ROLE supabase_admin WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD db_password;
END \$\$;

-- Permissions
GRANT ALL PRIVILEGES ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres, supabase_admin;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_admin, supabase_auth_admin, supabase_storage_admin;
GRANT USAGE ON SCHEMA auth TO authenticator;
GRANT USAGE ON SCHEMA storage TO authenticator;
GRANT USAGE ON SCHEMA public TO authenticator, anon, service_role;
GRANT anon TO authenticator;
GRANT service_role TO authenticator;

-- S'assurer que les extensions sont créées
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions CASCADE;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions CASCADE;

-- Créer le type auth.factor_type s'il n'existe pas
DO \$\$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
        CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
    END IF;
END \$\$;

-- Créer auth.schema_migrations si elle n'existe pas
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version text NOT NULL PRIMARY KEY
);
EOF

print_success "PostgreSQL configuré"

# 3. Reconfigurer pg_hba.conf
print_info "Configuration de pg_hba.conf..."
docker exec antislash-talk-db bash -c "
cat > /var/lib/postgresql/data/pg_hba.conf << 'EOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    all             all             0.0.0.0/0               scram-sha-256
host    all             all             ::/0                    scram-sha-256
EOF
"

# 4. Redémarrer PostgreSQL
print_info "Redémarrage de PostgreSQL..."
docker restart antislash-talk-db
sleep 10

# 5. Vérifier que PostgreSQL est prêt
until docker exec antislash-talk-db pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
done
print_success "PostgreSQL redémarré"

# 6. Redémarrer les services avec force-recreate
print_header "Redémarrage des services"
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d --force-recreate auth storage rest

# 7. Attendre un peu
print_info "Attente du démarrage des services (30s)..."
sleep 30

# 8. Vérifier l'état
print_header "État des services"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(auth|storage|rest)"

# 9. Vérifier si les tables ont été créées
print_header "Vérification des tables"
AUTH_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users');" | tr -d ' ')
STORAGE_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets');" | tr -d ' ')

if [ "$AUTH_EXISTS" = "t" ]; then
    print_success "Table auth.users créée !"
else
    print_error "Table auth.users non créée"
    print_info "Vérifiez les logs : docker logs antislash-talk-auth"
fi

if [ "$STORAGE_EXISTS" = "t" ]; then
    print_success "Table storage.buckets créée !"
else
    print_error "Table storage.buckets non créée"
    print_info "Vérifiez les logs : docker logs antislash-talk-storage"
fi

print_info "Si les services redémarrent encore, exécutez ./check-service-errors.sh"
