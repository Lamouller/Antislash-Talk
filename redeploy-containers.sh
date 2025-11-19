#!/bin/bash
# ============================================
# Script de redéploiement RAPIDE
# Garde nginx/SSL, rebuild juste les containers
# ============================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

# ============================================
# ÉTAPE 1 : Vérifications
# ============================================
print_header "ÉTAPE 1/7 : Vérifications préliminaires"

if [ ! -f ".env.monorepo" ]; then
    print_error ".env.monorepo n'existe pas !"
    exit 1
fi

if [ ! -f "docker-compose.monorepo.yml" ]; then
    print_error "docker-compose.monorepo.yml n'existe pas !"
    exit 1
fi

print_success "Fichiers de configuration OK"

# ============================================
# ÉTAPE 2 : Sauvegarde nginx
# ============================================
print_header "ÉTAPE 2/7 : Sauvegarde de la configuration nginx"

if [ -f "/etc/nginx/sites-enabled/antislash-talk-ssl" ]; then
    sudo cp /etc/nginx/sites-enabled/antislash-talk-ssl /tmp/nginx-backup-$(date +%Y%m%d-%H%M%S).conf
    print_success "Config nginx sauvegardée dans /tmp/"
else
    print_warning "Pas de config nginx existante"
fi

# ============================================
# ÉTAPE 3 : Pull du code
# ============================================
print_header "ÉTAPE 3/7 : Mise à jour du code"

git fetch origin
git pull origin main
print_success "Code mis à jour"

# ============================================
# ÉTAPE 4 : Arrêt des containers
# ============================================
print_header "ÉTAPE 4/7 : Arrêt des containers"

print_info "Arrêt de tous les services..."
docker compose -f docker-compose.monorepo.yml --profile whisperx --profile pytorch down

print_success "Containers arrêtés"

# ============================================
# ÉTAPE 5 : Rebuild des images
# ============================================
print_header "ÉTAPE 5/7 : Rebuild des images Docker"

print_info "Build de l'image web..."
docker compose -f docker-compose.monorepo.yml build web

print_info "Build de WhisperX..."
docker compose -f docker-compose.monorepo.yml build whisperx

print_success "Images buildées"

# ============================================
# ÉTAPE 6 : Démarrage des services
# ============================================
print_header "ÉTAPE 6/7 : Démarrage des services"

# Vérifier si VITE_WHISPERX_URL est défini
if ! grep -q "^VITE_WHISPERX_URL=" .env.monorepo; then
    print_warning "VITE_WHISPERX_URL non défini, ajout..."
    echo "VITE_WHISPERX_URL=https://riquelme-talk.antislash.studio/whisperx" >> .env.monorepo
fi

if ! grep -q "^VITE_OLLAMA_URL=" .env.monorepo; then
    print_warning "VITE_OLLAMA_URL non défini, ajout..."
    echo "VITE_OLLAMA_URL=https://riquelme-talk.antislash.studio:8445" >> .env.monorepo
fi

print_info "Démarrage des services principaux..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d

print_info "Attente du démarrage (30 secondes)..."
sleep 30

# ============================================
# ÉTAPE 7 : Démarrage de WhisperX (optionnel)
# ============================================
print_header "ÉTAPE 7/7 : WhisperX (optionnel)"

echo ""
read -p "Voulez-vous activer WhisperX ? (o/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Oo]$ ]]; then
    print_info "Activation de WhisperX..."
    docker compose -f docker-compose.monorepo.yml --profile whisperx up -d
    
    print_info "Attente du démarrage WhisperX (30 secondes)..."
    sleep 30
    
    # Vérifier WhisperX
    if curl -s http://localhost:8082/health > /dev/null 2>&1; then
        print_success "WhisperX opérationnel !"
    else
        print_warning "WhisperX démarre encore..."
    fi
else
    print_info "WhisperX non activé"
fi

# ============================================
# VÉRIFICATIONS
# ============================================
print_header "Vérification des services"

echo ""
print_info "État des containers :"
docker compose -f docker-compose.monorepo.yml ps

echo ""
print_info "Vérification de la santé des services :"

# Web
if curl -Iks https://localhost:443 2>&1 | grep -q "200\|301\|302"; then
    print_success "Web : OK"
else
    print_warning "Web : En cours de démarrage..."
fi

# API
if curl -Iks http://localhost:54321/health 2>&1 | grep -q "200"; then
    print_success "API : OK"
else
    print_warning "API : En cours de démarrage..."
fi

# Studio
if curl -Iks http://localhost:54327 2>&1 | grep -q "200\|401"; then
    print_success "Studio : OK"
else
    print_warning "Studio : En cours de démarrage..."
fi

# ============================================
# RÉSUMÉ
# ============================================
print_header "🎉 REDÉPLOIEMENT TERMINÉ !"

echo ""
echo "Services disponibles :"
echo "  • Application : https://riquelme-talk.antislash.studio"
echo "  • API Supabase : https://riquelme-talk.antislash.studio:8443"
echo "  • Studio : https://riquelme-talk.antislash.studio:8444"
echo "  • Ollama : https://riquelme-talk.antislash.studio:8445"

if [[ $REPLY =~ ^[Oo]$ ]]; then
    echo "  • WhisperX : https://riquelme-talk.antislash.studio/whisperx"
fi

echo ""
print_info "Nginx et SSL ont été préservés !"
echo ""
print_info "Logs en temps réel :"
echo "  docker compose -f docker-compose.monorepo.yml logs -f"
echo ""
print_info "Activer WhisperX plus tard :"
echo "  docker compose -f docker-compose.monorepo.yml --profile whisperx up -d"
echo ""

