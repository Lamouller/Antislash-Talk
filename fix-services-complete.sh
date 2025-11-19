#!/bin/bash

# =========================================================
# Script de Diagnostic et Correction des Services
# =========================================================

set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# =========================================================
# 1. DIAGNOSTIC DES CONTENEURS
# =========================================================

print_header "1. DIAGNOSTIC DES CONTENEURS DOCKER"

print_info "Conteneurs en cours d'exécution :"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "antislash|NAMES"

echo ""
print_info "Services critiques à vérifier :"
services=("antislash-talk-kong" "antislash-talk-functions" "antislash-talk-realtime" "antislash-talk-db")

for service in "${services[@]}"; do
    if docker ps --format "{{.Names}}" | grep -q "^${service}$"; then
        print_success "$service : ✅ Running"
    else
        print_error "$service : ❌ Not Running"
    fi
done

# =========================================================
# 2. VÉRIFICATION DES LOGS D'ERREUR
# =========================================================

print_header "2. VÉRIFICATION DES LOGS (dernières erreurs)"

print_info "Logs Edge Functions (dernières 20 lignes) :"
docker logs antislash-talk-functions --tail 20 2>&1 | grep -i "error\|fail\|500" || echo "Pas d'erreurs récentes"

echo ""
print_info "Logs Realtime (dernières 20 lignes) :"
docker logs antislash-talk-realtime --tail 20 2>&1 | grep -i "error\|fail" || echo "Pas d'erreurs récentes"

# =========================================================
# 3. TEST DES ENDPOINTS CRITIQUES
# =========================================================

print_header "3. TEST DES ENDPOINTS"

# Lire le domaine depuis .env.monorepo
if [ -f .env.monorepo ]; then
    source .env.monorepo
    DOMAIN=${VPS_HOST:-localhost}
else
    print_warning ".env.monorepo non trouvé, utilisation de localhost"
    DOMAIN="localhost"
fi

# Déterminer si on utilise des sous-domaines
if [[ $DOMAIN != *"."* ]] || [[ $DOMAIN == "localhost" ]] || [[ $DOMAIN =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # IP ou localhost - ports
    API_URL="http://localhost:54321"
    FUNCTIONS_URL="http://localhost:54321/functions/v1"
else
    # Domaine - sous-domaines
    API_URL="https://api.${DOMAIN}"
    FUNCTIONS_URL="https://api.${DOMAIN}/functions/v1"
fi

echo ""
print_info "Test de l'API Supabase..."
if curl -s -f -o /dev/null -w "%{http_code}" "${API_URL}/rest/v1/" -H "apikey: ${ANON_KEY}" | grep -q "200\|401"; then
    print_success "API Supabase accessible"
else
    print_error "API Supabase inaccessible"
fi

echo ""
print_info "Test des Edge Functions..."
if curl -s -f -o /dev/null -w "%{http_code}" "${FUNCTIONS_URL}/" -H "Authorization: Bearer ${ANON_KEY}" 2>&1 | grep -q "200\|404"; then
    print_success "Edge Functions accessibles"
else
    print_error "Edge Functions inaccessibles"
fi

# =========================================================
# 4. VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT
# =========================================================

print_header "4. VARIABLES D'ENVIRONNEMENT EDGE FUNCTIONS"

print_info "Vérification des variables Edge Functions dans le conteneur..."
docker exec antislash-talk-functions sh -c 'env | grep -E "SUPABASE_URL|ANON_KEY|SERVICE_ROLE|WEBHOOK"' || print_warning "Certaines variables manquent"

# =========================================================
# 5. VÉRIFICATION NGINX
# =========================================================

print_header "5. CONFIGURATION NGINX"

print_info "Vérification de la config nginx..."
if [ -f /etc/nginx/sites-enabled/antislash-talk-ssl ]; then
    print_info "Routes proxy configurées :"
    grep -E "location\s+/(whisperx|pytorch|functions|realtime)" /etc/nginx/sites-enabled/antislash-talk-ssl || print_warning "Certaines routes manquent"
else
    print_warning "Fichier nginx non trouvé (normal si pas encore appliqué)"
fi

# =========================================================
# 6. CORRECTION AUTOMATIQUE
# =========================================================

print_header "6. CORRECTION AUTOMATIQUE"

echo ""
read -p "Voulez-vous redémarrer les services défaillants ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Redémarrage des services Edge Functions et Realtime..."
    
    docker compose -f docker-compose.monorepo.yml restart functions realtime
    
    sleep 5
    
    print_success "Services redémarrés"
    
    print_info "Vérification post-redémarrage..."
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "functions|realtime"
fi

# =========================================================
# 7. TESTS FINAUX
# =========================================================

print_header "7. TESTS FINAUX"

print_info "Test complet de l'Edge Function start-transcription..."
HEALTH_CHECK=$(curl -s -X POST "${FUNCTIONS_URL}/start-transcription" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"meeting_id":"test"}' \
    -w "%{http_code}" -o /tmp/function_test_output)

if [ "$HEALTH_CHECK" == "401" ] || [ "$HEALTH_CHECK" == "400" ]; then
    print_success "Edge Function répond correctement (erreur auth/validation attendue)"
elif [ "$HEALTH_CHECK" == "500" ]; then
    print_error "Edge Function retourne 500 - voir logs ci-dessus"
    print_info "Contenu de la réponse :"
    cat /tmp/function_test_output
else
    print_warning "Edge Function retourne $HEALTH_CHECK"
fi

# =========================================================
# 8. RÉSUMÉ ET RECOMMANDATIONS
# =========================================================

print_header "8. RÉSUMÉ ET RECOMMANDATIONS"

echo ""
print_info "Services installés :"
echo "  • WhisperX : $(docker ps | grep whisperx > /dev/null && echo '✅' || echo '❌')"
echo "  • PyTorch : $(docker ps | grep pytorch > /dev/null && echo '✅' || echo '❌')"
echo "  • Ollama : $(docker ps | grep ollama > /dev/null && echo '✅' || echo '❌')"

echo ""
print_info "Variables d'environnement à vérifier dans .env.monorepo :"
echo "  • VITE_WHISPERX_URL : ${VITE_WHISPERX_URL}"
echo "  • VITE_PYTORCH_SERVICE_URL : ${VITE_PYTORCH_SERVICE_URL}"
echo "  • VITE_OLLAMA_URL : ${VITE_OLLAMA_URL}"

echo ""
print_warning "Pour des diagnostics plus détaillés, utilisez :"
echo "  docker logs antislash-talk-functions --tail 100"
echo "  docker logs antislash-talk-realtime --tail 100"

print_header "DIAGNOSTIC TERMINÉ"

