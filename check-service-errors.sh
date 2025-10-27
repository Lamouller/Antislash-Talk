#!/bin/bash

# Script pour diagnostiquer pourquoi Auth/Storage/Rest redémarrent
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

print_header "DIAGNOSTIC DES SERVICES EN ERREUR"

# 1. Vérifier les logs Auth
print_header "Logs Auth (dernières 30 lignes)"
docker logs antislash-talk-auth --tail 30 2>&1 || echo "Impossible de récupérer les logs"

# 2. Vérifier les logs Storage
print_header "Logs Storage (dernières 30 lignes)"
docker logs antislash-talk-storage --tail 30 2>&1 || echo "Impossible de récupérer les logs"

# 3. Vérifier les logs Rest
print_header "Logs Rest (dernières 30 lignes)"
docker logs antislash-talk-rest --tail 30 2>&1 || echo "Impossible de récupérer les logs"

# 4. Vérifier les rôles PostgreSQL
print_header "Vérification des rôles PostgreSQL"
docker exec antislash-talk-db psql -U postgres -c "
SELECT rolname, rolsuper, rolcanlogin 
FROM pg_roles 
WHERE rolname IN ('postgres', 'supabase_auth_admin', 'supabase_storage_admin', 'authenticator', 'service_role', 'anon')
ORDER BY rolname;"

# 5. Vérifier les schémas
print_header "Vérification des schémas"
docker exec antislash-talk-db psql -U postgres -c "
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN ('auth', 'storage', 'extensions', 'public')
ORDER BY schema_name;"

# 6. Vérifier le type auth.factor_type
print_header "Vérification du type auth.factor_type"
docker exec antislash-talk-db psql -U postgres -c "
SELECT t.typname, n.nspname
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'auth' AND t.typname = 'factor_type';"

# 7. Vérifier les variables d'environnement de Auth
print_header "Variables d'environnement de Auth"
docker exec antislash-talk-auth env | grep -E "(DATABASE_URL|GOTRUE_DB_DRIVER|GOTRUE_SITE_URL)" || echo "Service non accessible"

# 8. Test de connexion avec authenticator
print_header "Test de connexion avec le rôle authenticator"
docker exec antislash-talk-db psql -U authenticator -d postgres -c "SELECT 1;" 2>&1 || echo "Échec de connexion"

# 9. Vérifier password_encryption
print_header "Configuration password_encryption"
docker exec antislash-talk-db psql -U postgres -c "SHOW password_encryption;"

# 10. Suggestion de fix
print_header "SUGGESTION DE CORRECTION"
print_info "Si les services échouent à cause de l'authentification PostgreSQL,"
print_info "exécutez le script suivant : ./fix-auth-storage-force.sh"
