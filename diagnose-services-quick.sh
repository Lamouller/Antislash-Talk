#!/bin/bash

# Diagnostic rapide des services qui redémarrent
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

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

cd /home/debian/antislash-talk

print_header "DIAGNOSTIC RAPIDE DES SERVICES"

# 1. Afficher les dernières erreurs de chaque service
print_header "Erreur Auth (dernière ligne d'erreur)"
docker logs antislash-talk-auth 2>&1 | grep -i "error\|fatal\|panic" | tail -5 || echo "Pas d'erreur trouvée"

print_header "Erreur Storage (dernière ligne d'erreur)"
docker logs antislash-talk-storage 2>&1 | grep -i "error\|fatal\|panic" | tail -5 || echo "Pas d'erreur trouvée"

print_header "Erreur Rest (dernière ligne d'erreur)"
docker logs antislash-talk-rest 2>&1 | grep -i "error\|fatal\|panic" | tail -5 || echo "Pas d'erreur trouvée"

# 2. Vérifier la DATABASE_URL
print_header "Variables DATABASE_URL"
print_info "Auth:"
docker exec antislash-talk-auth env 2>/dev/null | grep DATABASE_URL | sed 's/password=[^@]*/password=***/' || echo "Service non accessible"

print_info "Storage:"
docker exec antislash-talk-storage env 2>/dev/null | grep DATABASE_URL | sed 's/password=[^@]*/password=***/' || echo "Service non accessible"

print_info "Rest:"
docker exec antislash-talk-rest env 2>/dev/null | grep PGRST_DB_URI | sed 's/password=[^@]*/password=***/' || echo "Service non accessible"

# 3. Tester la connexion directe avec les identifiants
print_header "Test de connexion avec les rôles"

# Récupérer le mot de passe depuis .env.monorepo
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.monorepo | cut -d'=' -f2-)
print_info "Mot de passe extrait : $(echo $POSTGRES_PASSWORD | head -c 3)***"

# Test avec authenticator
print_info "Test authenticator:"
PGPASSWORD="$POSTGRES_PASSWORD" docker exec antislash-talk-db psql -U authenticator -d postgres -c "SELECT 1;" 2>&1 || print_error "Échec authenticator"

# Test avec supabase_auth_admin
print_info "Test supabase_auth_admin:"
PGPASSWORD="$POSTGRES_PASSWORD" docker exec antislash-talk-db psql -U supabase_auth_admin -d postgres -c "SELECT 1;" 2>&1 || print_error "Échec supabase_auth_admin"

# 4. Solution proposée
print_header "SOLUTION PROPOSÉE"
print_info "Exécution du fix manuel des mots de passe..."

# Fix direct des mots de passe
docker exec antislash-talk-db psql -U postgres << EOF
-- Mettre à jour tous les mots de passe directement
ALTER ROLE postgres PASSWORD '$POSTGRES_PASSWORD';
ALTER ROLE supabase_auth_admin PASSWORD '$POSTGRES_PASSWORD';
ALTER ROLE supabase_storage_admin PASSWORD '$POSTGRES_PASSWORD';
ALTER ROLE authenticator PASSWORD '$POSTGRES_PASSWORD';
ALTER ROLE supabase_admin PASSWORD '$POSTGRES_PASSWORD';

-- Vérifier
SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname IN ('authenticator', 'supabase_auth_admin', 'supabase_storage_admin');
EOF

print_info "Mots de passe mis à jour. Redémarrage des services dans 5 secondes..."
sleep 5

# Redémarrer les services
docker restart antislash-talk-auth antislash-talk-storage antislash-talk-rest

print_info "Services redémarrés. Vérification dans 20 secondes..."
sleep 20

# Vérifier l'état final
print_header "ÉTAT FINAL"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(auth|storage|rest)"
