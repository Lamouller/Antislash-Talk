#!/bin/bash

# Script spécifique pour réparer Auth
set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

cd /home/debian/antislash-talk

print_info "Réparation spécifique du service Auth..."

# 1. Arrêter Auth
docker stop antislash-talk-auth 2>/dev/null || true

# 2. Récupérer les variables
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.monorepo | cut -d'=' -f2- | tr -d '"' | tr -d "'")
print_info "Mot de passe : ${POSTGRES_PASSWORD:0:3}***"

# 3. Créer manuellement le schéma et les tables minimales pour Auth
print_info "Création du schéma auth et tables de base..."

docker exec -i antislash-talk-db psql -U postgres << EOF
-- Créer le schéma auth s'il n'existe pas
CREATE SCHEMA IF NOT EXISTS auth;

-- S'assurer que supabase_auth_admin a TOUS les droits
ALTER ROLE supabase_auth_admin WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD '${POSTGRES_PASSWORD}';
GRANT ALL PRIVILEGES ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_auth_admin;

-- Créer la table schema_migrations si elle n'existe pas
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version text NOT NULL PRIMARY KEY
);
ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

-- Créer le type factor_type s'il n'existe pas
DO \$\$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
        CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
    END IF;
END \$\$;

-- Donner tous les droits sur le schéma public aussi
GRANT ALL PRIVILEGES ON SCHEMA public TO supabase_auth_admin;

-- S'assurer que les extensions sont disponibles
GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin;

SELECT 'Auth schema préparé' as status;
EOF

# 4. Vérifier la DATABASE_URL dans le service Auth
print_info "Vérification de la DATABASE_URL pour Auth..."
docker compose -f docker-compose.monorepo.yml run --rm -e DATABASE_URL="postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/postgres" auth env | grep DATABASE_URL || true

# 5. Redémarrer Auth avec les bonnes variables
print_info "Redémarrage d'Auth..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d auth

# 6. Suivre les logs en temps réel pendant 20 secondes
print_info "Surveillance des logs Auth (20s)..."
timeout 20 docker logs -f antislash-talk-auth 2>&1 || true

# 7. Vérifier l'état final
print_info "État final d'Auth :"
docker ps --filter "name=antislash-talk-auth" --format "table {{.Names}}\t{{.Status}}"

# 8. Vérifier si auth.users existe maintenant
if docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users');" | grep -q 't'; then
    print_success "Table auth.users créée avec succès !"
    print_info "Vous pouvez maintenant exécuter : ./continue-deployment.sh"
else
    print_error "Table auth.users toujours manquante"
    print_info "Dernières erreurs Auth :"
    docker logs antislash-talk-auth --tail 5 2>&1 | grep -i "error\|fatal" || echo "Pas d'erreur visible"
fi
