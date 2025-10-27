#!/bin/bash

# Script direct pour corriger les mots de passe PostgreSQL
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
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

print_info "Correction des mots de passe PostgreSQL..."

# 1. Récupérer le mot de passe depuis .env.monorepo
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.monorepo | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$POSTGRES_PASSWORD" ]; then
    print_error "Impossible de trouver POSTGRES_PASSWORD dans .env.monorepo"
    exit 1
fi

print_info "Mot de passe trouvé : ${POSTGRES_PASSWORD:0:3}***"

# 2. Arrêter les services qui échouent
print_info "Arrêt des services..."
docker stop antislash-talk-auth antislash-talk-storage antislash-talk-rest 2>/dev/null || true

# 3. Mettre à jour TOUS les mots de passe directement
print_info "Mise à jour des mots de passe..."

docker exec -i antislash-talk-db psql -U postgres << EOF
-- Afficher le mot de passe actuel pour debug
SELECT 'Mise à jour des mots de passe avec : ${POSTGRES_PASSWORD:0:3}***' as info;

-- Mettre à jour tous les rôles
ALTER ROLE postgres PASSWORD '${POSTGRES_PASSWORD}';
ALTER ROLE supabase_auth_admin PASSWORD '${POSTGRES_PASSWORD}';
ALTER ROLE supabase_storage_admin PASSWORD '${POSTGRES_PASSWORD}';
ALTER ROLE authenticator PASSWORD '${POSTGRES_PASSWORD}';
ALTER ROLE supabase_admin PASSWORD '${POSTGRES_PASSWORD}';

-- S'assurer que les rôles peuvent se connecter
ALTER ROLE supabase_auth_admin WITH LOGIN;
ALTER ROLE supabase_storage_admin WITH LOGIN;
ALTER ROLE authenticator WITH LOGIN;
ALTER ROLE supabase_admin WITH LOGIN;

-- Vérifier
SELECT rolname, rolcanlogin FROM pg_roles 
WHERE rolname IN ('postgres', 'authenticator', 'supabase_auth_admin', 'supabase_storage_admin', 'supabase_admin')
ORDER BY rolname;
EOF

print_success "Mots de passe mis à jour"

# 4. Reconfigurer pg_hba.conf pour être sûr
print_info "Configuration de pg_hba.conf..."
docker exec antislash-talk-db bash -c "cat > /var/lib/postgresql/data/pg_hba.conf << 'EOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    all             all             0.0.0.0/0               scram-sha-256
host    all             all             ::/0                    scram-sha-256
EOF"

# 5. Recharger PostgreSQL
print_info "Rechargement de la configuration PostgreSQL..."
docker exec antislash-talk-db psql -U postgres -c "SELECT pg_reload_conf();"

# 6. Test de connexion
print_info "Test de connexion avec supabase_auth_admin..."
if PGPASSWORD="${POSTGRES_PASSWORD}" docker exec antislash-talk-db psql -U supabase_auth_admin -d postgres -c "SELECT 'Connexion OK' as status;" 2>&1; then
    print_success "Connexion réussie !"
else
    print_error "Connexion échouée"
    print_info "Vérification de la DATABASE_URL dans les services..."
fi

# 7. Redémarrer les services
print_info "Redémarrage des services..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d auth storage rest

# 8. Attendre et vérifier
print_info "Attente du démarrage (30s)..."
sleep 30

# 9. État final
print_info "État des services :"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(auth|storage|rest)"

# 10. Vérifier si les tables existent maintenant
print_info "Vérification des tables :"
docker exec antislash-talk-db psql -U postgres -c "
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') 
    THEN '✅ auth.users existe' 
    ELSE '❌ auth.users manquante' 
    END as auth_status,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') 
    THEN '✅ storage.buckets existe' 
    ELSE '❌ storage.buckets manquante' 
    END as storage_status;"

print_success "Script terminé !"
print_info "Si les services redémarrent encore, exécutez : ./diagnose-services-quick.sh"
