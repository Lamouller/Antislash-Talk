#!/bin/bash
# 🔐 Script de correction des mots de passe de la base de données
# Corrige les erreurs d'authentification PostgreSQL

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}    $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Détecter le répertoire du projet
if [ -n "$1" ]; then
    PROJECT_DIR="$1"
elif [ -f "docker-compose.monorepo.yml" ] && [ -f ".env.monorepo" ]; then
    PROJECT_DIR=$(pwd)
else
    PROJECT_DIR=$(find /home -maxdepth 2 -name "antislash-talk" -type d 2>/dev/null | head -1)
    if [ -z "$PROJECT_DIR" ]; then
        PROJECT_DIR="/root/antislash-talk"
    fi
fi

cd "$PROJECT_DIR" || exit 1

print_header "🔐 CORRECTION DES MOTS DE PASSE DE LA BASE DE DONNÉES"

# Charger la configuration
if [ -f ".env.monorepo" ]; then
    source .env.monorepo
    print_success "Configuration chargée"
else
    print_error "Fichier .env.monorepo introuvable"
    exit 1
fi

# Vérifier le mot de passe actuel
print_header "1️⃣  Vérification du mot de passe PostgreSQL"

echo ""
print_info "Mot de passe PostgreSQL actuel dans .env.monorepo :"
echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD:0:10}..."

# Tester la connexion à la DB
print_info "Test de connexion à la base de données..."

if docker exec antislash-talk-db psql -U supabase_admin -d postgres -c "SELECT 1;" &>/dev/null; then
    print_success "Connexion PostgreSQL OK avec le mot de passe actuel"
    DB_PASSWORD_OK=true
else
    print_error "Impossible de se connecter avec le mot de passe actuel"
    DB_PASSWORD_OK=false
fi

# Si la connexion échoue, on doit réinitialiser les mots de passe
if [ "$DB_PASSWORD_OK" = false ]; then
    print_header "2️⃣  Réinitialisation des mots de passe"
    
    print_warning "Les mots de passe de la base de données doivent être réinitialisés"
    print_info "Le script va :"
    echo "  1. Arrêter tous les services"
    echo "  2. Recréer la base de données avec les bons mots de passe"
    echo "  3. Redémarrer tous les services"
    echo ""
    
    read -p "Continuer ? [o/N] : " CONFIRM
    
    if [ "$CONFIRM" != "o" ] && [ "$CONFIRM" != "O" ]; then
        print_info "Opération annulée"
        exit 0
    fi
    
    print_info "Arrêt de tous les services..."
    docker compose -f docker-compose.monorepo.yml down
    
    print_info "Suppression du volume de la base de données..."
    docker volume rm antislash-talk_db-data 2>/dev/null || true
    
    print_info "Redémarrage de la base de données..."
    docker compose -f docker-compose.monorepo.yml up -d db
    
    sleep 10
    print_success "Base de données réinitialisée"
    
else
    print_header "2️⃣  Synchronisation des mots de passe"
fi

# Récupérer le mot de passe depuis .env.monorepo
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"

print_info "Création/Mise à jour des utilisateurs de la base de données..."

# Créer ou mettre à jour les mots de passe des utilisateurs
docker exec antislash-talk-db psql -U supabase_admin -d postgres << EOSQL
-- Créer les utilisateurs s'ils n'existent pas et définir les mots de passe
DO \$\$
BEGIN
    -- supabase_auth_admin
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'supabase_auth_admin') THEN
        CREATE USER supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
    ELSE
        ALTER USER supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
    
    -- supabase_storage_admin
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'supabase_storage_admin') THEN
        CREATE USER supabase_storage_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
    ELSE
        ALTER USER supabase_storage_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
    
    -- authenticator
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'authenticator') THEN
        CREATE USER authenticator WITH PASSWORD '${POSTGRES_PASSWORD}';
    ELSE
        ALTER USER authenticator WITH PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
    
    -- supabase_functions_admin
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'supabase_functions_admin') THEN
        CREATE USER supabase_functions_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
    ELSE
        ALTER USER supabase_functions_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
    
    -- dashboard_user
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'dashboard_user') THEN
        CREATE USER dashboard_user WITH PASSWORD '${POSTGRES_PASSWORD}';
    ELSE
        ALTER USER dashboard_user WITH PASSWORD '${POSTGRES_PASSWORD}';
    END IF;
END \$\$;

-- Accorder les permissions nécessaires
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_functions_admin;
GRANT USAGE ON SCHEMA public TO authenticator;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;

ALTER USER supabase_admin WITH SUPERUSER;
ALTER USER supabase_auth_admin WITH CREATEDB;
EOSQL

if [ $? -eq 0 ]; then
    print_success "Mots de passe mis à jour dans PostgreSQL"
else
    print_error "Erreur lors de la mise à jour des mots de passe"
    exit 1
fi

# Mettre à jour les chaînes de connexion dans .env.monorepo
print_header "3️⃣  Mise à jour des chaînes de connexion"

print_info "Mise à jour de .env.monorepo..."

# Backup
cp .env.monorepo ".env.monorepo.backup.$(date +%Y%m%d_%H%M%S)"

# Mettre à jour les chaînes de connexion
sed -i.bak "s|postgres://supabase_auth_admin:[^@]*@|postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@|g" .env.monorepo
sed -i.bak "s|postgres://supabase_storage_admin:[^@]*@|postgres://supabase_storage_admin:${POSTGRES_PASSWORD}@|g" .env.monorepo
sed -i.bak "s|postgres://authenticator:[^@]*@|postgres://authenticator:${POSTGRES_PASSWORD}@|g" .env.monorepo
sed -i.bak "s|postgres://supabase_functions_admin:[^@]*@|postgres://supabase_functions_admin:${POSTGRES_PASSWORD}@|g" .env.monorepo

rm -f .env.monorepo.bak

print_success "Chaînes de connexion mises à jour"

# Redémarrer tous les services
print_header "4️⃣  Redémarrage des services"

print_info "Arrêt de tous les services..."
docker compose -f docker-compose.monorepo.yml down

print_info "Redémarrage avec la nouvelle configuration..."
docker compose -f docker-compose.monorepo.yml up -d

print_success "Services redémarrés"

# Attendre que les services démarrent
print_info "Attente du démarrage des services (30 secondes)..."
sleep 30

# Vérifier les logs d'auth
print_header "5️⃣  Vérification des logs"

echo ""
print_info "Derniers logs du service auth :"
docker compose -f docker-compose.monorepo.yml logs --tail=20 auth

echo ""
if docker compose -f docker-compose.monorepo.yml logs auth 2>&1 | grep -q "password authentication failed"; then
    print_error "Des erreurs d'authentification persistent"
    print_info "Logs complets :"
    docker compose -f docker-compose.monorepo.yml logs auth | tail -50
else
    print_success "Aucune erreur d'authentification détectée"
fi

# Vérifier l'état des services
print_header "6️⃣  État des services"

echo ""
docker compose -f docker-compose.monorepo.yml ps

print_header "✅ CORRECTION TERMINÉE"

echo ""
print_success "Les mots de passe de la base de données ont été synchronisés !"
echo ""
print_info "Prochaines étapes :"
echo "  1. Vérifiez que tous les services sont 'Up'"
echo "  2. Attendez 1-2 minutes que tout se stabilise"
echo "  3. Testez l'authentification dans le navigateur"
echo ""
print_info "Si le problème persiste :"
echo "  docker compose -f docker-compose.monorepo.yml logs -f auth"
echo ""

