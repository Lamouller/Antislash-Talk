#!/bin/bash

# Script pour vérifier l'état actuel après le fix des mots de passe
set -e

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
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

print_info "Vérification de l'état des services après 30 secondes..."

# 1. État des services
print_info "État actuel des services :"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(auth|storage|rest)" || echo "Services non trouvés"

# 2. Vérifier si les services redémarrent encore
print_info "Vérification des redémarrages..."
for service in auth storage rest; do
    STATUS=$(docker ps --filter "name=antislash-talk-$service" --format "{{.Status}}" | head -1)
    if echo "$STATUS" | grep -q "Up"; then
        print_success "$service est stable : $STATUS"
    else
        print_error "$service redémarre : $STATUS"
    fi
done

# 3. Test de connexion avec TCP (pas socket)
print_info "Test de connexion PostgreSQL via TCP..."
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.monorepo | cut -d'=' -f2- | tr -d '"' | tr -d "'")

# Test avec -h localhost pour forcer TCP
if PGPASSWORD="${POSTGRES_PASSWORD}" docker exec antislash-talk-db psql -h localhost -U supabase_auth_admin -d postgres -c "SELECT 'OK' as status;" 2>&1; then
    print_success "Connexion PostgreSQL OK via TCP !"
else
    print_error "Connexion PostgreSQL échouée"
fi

# 4. Vérifier les tables
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

# 5. Si les tables existent, créer les données
AUTH_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users');" | tr -d ' ')
STORAGE_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets');" | tr -d ' ')

if [ "$AUTH_EXISTS" = "t" ] && [ "$STORAGE_EXISTS" = "t" ]; then
    print_success "Les tables existent ! Prêt pour créer les données."
    print_info "Exécutez maintenant : ./continue-deployment.sh"
else
    print_error "Les tables n'existent pas encore."
    print_info "Vérifiez les logs des services :"
    print_info "docker logs antislash-talk-auth --tail 10"
    print_info "docker logs antislash-talk-storage --tail 10"
fi
