#!/bin/bash
# Script de diagnostic pour la connexion Ollama

set -e

# Couleurs pour l'affichage
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

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_header "DIAGNOSTIC OLLAMA"

# 1. Vérifier si le container Ollama existe et tourne
print_header "1. État du container Ollama"
if docker ps | grep -q antislash-talk-ollama; then
    print_success "Container Ollama en cours d'exécution"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ollama
else
    print_error "Container Ollama non trouvé ou arrêté"
    print_info "Vérification des containers arrêtés..."
    docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep ollama || print_error "Aucun container Ollama trouvé"
fi

# 2. Vérifier les logs Ollama
print_header "2. Derniers logs Ollama"
if docker ps | grep -q antislash-talk-ollama; then
    docker logs antislash-talk-ollama --tail 20 2>&1 || print_error "Impossible de lire les logs"
else
    print_warning "Container non actif, pas de logs disponibles"
fi

# 3. Test de connexion interne (depuis le container)
print_header "3. Test connexion interne (container -> Ollama)"
if docker ps | grep -q antislash-talk-ollama; then
    print_info "Test API Ollama interne..."
    if docker exec antislash-talk-ollama curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        print_success "API Ollama accessible en interne"
        docker exec antislash-talk-ollama curl -s http://localhost:11434/api/tags | jq '.models[] | .name' 2>/dev/null || echo "Pas de modèles installés"
    else
        print_error "API Ollama non accessible en interne"
    fi
fi

# 4. Test de connexion externe (port 11434)
print_header "4. Test connexion externe (host -> port 11434)"
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    print_success "Ollama accessible sur localhost:11434"
    echo "Modèles disponibles :"
    curl -s http://localhost:11434/api/tags | jq -r '.models[] | .name' 2>/dev/null || echo "Aucun modèle"
else
    print_error "Ollama non accessible sur localhost:11434"
fi

# 5. Test de connexion HTTPS via Nginx (port 8445)
print_header "5. Test connexion HTTPS via Nginx (port 8445)"
VPS_IP=$(hostname -I | awk '{print $1}')
if curl -sk https://localhost:8445/api/tags >/dev/null 2>&1; then
    print_success "Ollama accessible via HTTPS sur localhost:8445"
else
    print_error "Ollama non accessible via HTTPS sur localhost:8445"
fi

# 6. Vérifier la configuration Nginx
print_header "6. Configuration Nginx pour Ollama"
if sudo grep -A10 "listen 8445" /etc/nginx/sites-enabled/* 2>/dev/null; then
    print_success "Configuration Nginx trouvée pour le port 8445"
else
    print_error "Pas de configuration Nginx pour le port 8445"
fi

# 7. Test CORS headers
print_header "7. Test CORS pour l'accès frontend"
print_info "Test des headers CORS..."
CORS_TEST=$(curl -sI -X OPTIONS https://localhost:8445/api/tags \
    -H "Origin: https://${VPS_IP}" \
    -H "Access-Control-Request-Method: POST" \
    -k 2>/dev/null | grep -i "access-control")

if [ -n "$CORS_TEST" ]; then
    print_success "Headers CORS présents :"
    echo "$CORS_TEST"
else
    print_warning "Pas de headers CORS configurés"
    print_info "Cela peut empêcher le frontend d'accéder à Ollama"
fi

# 8. Vérifier les variables d'environnement
print_header "8. Variables d'environnement"
if [ -f .env.monorepo ]; then
    print_info "Variables Ollama dans .env.monorepo :"
    grep -i ollama .env.monorepo | grep -v PASSWORD || print_warning "Aucune variable Ollama trouvée"
fi

# 9. Test depuis un container web
print_header "9. Test de connexion depuis le container web"
if docker ps | grep -q antislash-talk-web; then
    print_info "Test depuis le container web vers Ollama..."
    # Test interne (réseau Docker)
    if docker exec antislash-talk-web wget -qO- http://ollama:11434/api/tags >/dev/null 2>&1; then
        print_success "Connexion interne OK (http://ollama:11434)"
    else
        print_error "Connexion interne échouée"
    fi
fi

# 10. Recommandations
print_header "RECOMMANDATIONS"

OLLAMA_OK=true

if ! docker ps | grep -q antislash-talk-ollama; then
    OLLAMA_OK=false
    echo -e "${YELLOW}1. Démarrer le container Ollama :${NC}"
    echo "   docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d ollama"
    echo ""
fi

if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    OLLAMA_OK=false
    echo -e "${YELLOW}2. Vérifier que Ollama écoute sur le bon port :${NC}"
    echo "   docker logs antislash-talk-ollama"
    echo ""
fi

if ! curl -sk https://localhost:8445/api/tags >/dev/null 2>&1; then
    OLLAMA_OK=false
    echo -e "${YELLOW}3. Vérifier la configuration Nginx :${NC}"
    echo "   sudo nginx -t"
    echo "   sudo systemctl reload nginx"
    echo ""
fi

# Test si aucun modèle n'est installé
MODELS_COUNT=$(curl -s http://localhost:11434/api/tags 2>/dev/null | jq '.models | length' 2>/dev/null || echo "0")
if [ "$MODELS_COUNT" = "0" ]; then
    echo -e "${YELLOW}4. Installer un modèle Ollama :${NC}"
    echo "   docker exec -it antislash-talk-ollama ollama pull llama3.2:3b"
    echo "   # ou"
    echo "   docker exec -it antislash-talk-ollama ollama pull mistral"
    echo ""
fi

if [ "$OLLAMA_OK" = true ]; then
    print_success "Ollama semble correctement configuré !"
    echo ""
    echo "URL pour le frontend : https://${VPS_IP}:8445"
    echo ""
    if [ "$MODELS_COUNT" = "0" ]; then
        print_warning "Mais aucun modèle n'est installé. Installez-en un avec :"
        echo "docker exec -it antislash-talk-ollama ollama pull llama3.2:3b"
    fi
fi
