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

cd ~/antislash-talk || cd /root/antislash-talk || exit 1

print_header "1️⃣  Variables dans .env.monorepo"

echo "VITE_SUPABASE_URL:"
grep "^VITE_SUPABASE_URL=" .env.monorepo

echo ""
echo "VITE_SUPABASE_ANON_KEY:"
grep "^VITE_SUPABASE_ANON_KEY=" .env.monorepo

echo ""
echo "ANON_KEY:"
grep "^ANON_KEY=" .env.monorepo

print_header "2️⃣  Variables dans le container web"

print_info "Inspection du container web..."
docker exec antislash-talk-web env | grep -E "VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY" || print_warning "Pas de variables VITE dans le container (normal si compilé)"

print_header "3️⃣  Vérification du build web"

print_info "Fichiers JS buildés contiennent-ils l'URL ?"
docker exec antislash-talk-web find /usr/share/nginx/html/assets -name "*.js" -exec grep -l "https://riquelme-talk.antislash.studio" {} \; 2>/dev/null | head -5

print_info "Extraction de la config Supabase du bundle..."
docker exec antislash-talk-web sh -c 'grep -o "https://riquelme-talk.antislash.studio[^\"]*" /usr/share/nginx/html/assets/*.js 2>/dev/null | head -1'

print_header "4️⃣  Test de l'API Auth directement"

ANON_KEY=$(grep "^ANON_KEY=" .env.monorepo | cut -d'=' -f2)

print_info "Test avec curl (devrait retourner 200)..."
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  "https://riquelme-talk.antislash.studio:8443/auth/v1/health"

print_header "5️⃣  Logs du service auth (dernières 30 lignes)"

docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo logs --tail=30 auth

print_header "6️⃣  Test de connexion avec credentials"

print_info "Entrez l'email de test: "
read -r TEST_EMAIL

print_info "Entrez le mot de passe: "
read -rs TEST_PASSWORD
echo ""

print_info "Tentative de connexion..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" \
  "https://riquelme-talk.antislash.studio:8443/auth/v1/token?grant_type=password")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" = "200" ]; then
    print_success "Connexion API réussie !"
else
    print_error "Échec de connexion API"
fi

print_header "7️⃣  Vérification SSL"

print_info "Certificat SSL pour le domaine:"
echo | openssl s_client -servername riquelme-talk.antislash.studio -connect riquelme-talk.antislash.studio:443 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null

print_header "8️⃣  Recommandations"

if [ "$HTTP_CODE" != "200" ]; then
    echo ""
    print_warning "L'API Auth ne fonctionne pas correctement."
    echo ""
    echo "Solutions possibles :"
    echo "1. Rebuild complet du web avec les bonnes variables:"
    echo "   cd ~/antislash-talk"
    echo "   source .env.monorepo"
    echo "   docker compose -f docker-compose.monorepo.yml build --no-cache \\"
    echo "     --build-arg VITE_SUPABASE_URL=\"\$VITE_SUPABASE_URL\" \\"
    echo "     --build-arg VITE_SUPABASE_ANON_KEY=\"\$ANON_KEY\" \\"
    echo "     web"
    echo "   docker compose -f docker-compose.monorepo.yml up -d web"
    echo ""
    echo "2. Vérifier que le user existe dans la DB:"
    echo "   docker exec -it antislash-talk-db psql -U postgres -d postgres -c \"SELECT email FROM auth.users;\""
fi

print_success "Diagnostic terminé"

