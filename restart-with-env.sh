#!/bin/bash

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}    $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

cd ~/antislash-talk || cd /root/antislash-talk || cd /home/debian/antislash-talk || exit 1

print_header "🔄 REDÉMARRAGE AVEC VARIABLES D'ENVIRONNEMENT"

if [ ! -f .env.monorepo ]; then
    print_error "Fichier .env.monorepo introuvable"
    exit 1
fi

print_header "1️⃣  Chargement des variables"

# Exporter TOUTES les variables dans l'environnement
set -a
source .env.monorepo
set +a

print_info "Variables critiques chargées:"
echo "  ANON_KEY: ${ANON_KEY:0:30}..."
echo "  SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY:0:30}..."
echo "  API_EXTERNAL_URL: $API_EXTERNAL_URL"
echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:0:10}..."

# Créer un fichier d'environnement temporaire avec TOUTES les variables
print_info "Création d'un fichier d'environnement complet..."

cat .env.monorepo > .env.monorepo.complete

# S'assurer que toutes les variables critiques sont présentes
if ! grep -q "^ANON_KEY=" .env.monorepo.complete; then
    echo "ANON_KEY=${ANON_KEY}" >> .env.monorepo.complete
fi
if ! grep -q "^SERVICE_ROLE_KEY=" .env.monorepo.complete; then
    echo "SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}" >> .env.monorepo.complete
fi
if ! grep -q "^API_EXTERNAL_URL=" .env.monorepo.complete; then
    echo "API_EXTERNAL_URL=${API_EXTERNAL_URL}" >> .env.monorepo.complete
fi

print_success "Variables préparées"

print_header "2️⃣  Arrêt des services"

docker compose -f docker-compose.monorepo.yml down

print_success "Services arrêtés"

sleep 3

print_header "3️⃣  Démarrage avec les variables correctes"

print_info "Variables exportées dans l'environnement:"
env | grep -E "ANON_KEY|SERVICE_ROLE_KEY|API_EXTERNAL_URL|POSTGRES_PASSWORD" | head -5

# Démarrer avec --env-file ET les variables exportées
docker compose -f docker-compose.monorepo.yml \
    --env-file .env.monorepo.complete \
    up -d

print_success "Services démarrés"

print_header "4️⃣  Attente du démarrage (30s)"

for i in {30..1}; do
    echo -ne "\r⏳ Attente... $i secondes restantes"
    sleep 1
done
echo ""

print_header "5️⃣  Vérification des variables dans les containers"

print_info "Variables dans Kong:"
docker exec antislash-talk-kong env | grep -E "ANON_KEY|SERVICE_ROLE_KEY" || print_warning "Variables non trouvées dans Kong"

print_info "Variables dans Auth:"
docker exec antislash-talk-auth env | grep -E "DATABASE_URL|JWT_SECRET" | head -2 || print_warning "Variables non trouvées dans Auth"

print_header "6️⃣  Tests d'API"

print_info "Test avec ANON_KEY:"
curl -k -s -H "apikey: ${ANON_KEY}" \
    "https://localhost:8443/auth/v1/health" | jq . 2>/dev/null || echo "Erreur"

echo ""
print_info "Test avec SERVICE_ROLE_KEY:"
curl -k -s -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    "https://localhost:8443/auth/v1/admin/users" | jq . 2>/dev/null || echo "Erreur"

print_header "7️⃣  État des services"

docker compose -f docker-compose.monorepo.yml ps

print_header "✅ TERMINÉ"

echo ""
print_info "Si vous voyez encore des erreurs 401:"
echo "  1. Vérifiez les logs de Kong: docker compose -f docker-compose.monorepo.yml logs kong | tail -30"
echo "  2. Vérifiez que les clés JWT sont valides"
echo "  3. Recréez les clés si nécessaire avec: node generate-supabase-keys.js"
echo ""
print_warning "Si rien ne fonctionne, il faut peut-être regénérer toutes les clés JWT"

