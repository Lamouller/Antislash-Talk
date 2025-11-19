#!/bin/bash

# ============================================
# Script d'activation WhisperX
# Utiliser APRÈS le déploiement si vous n'avez pas activé WhisperX
# ============================================

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

print_header "🚀 ACTIVATION WHISPERX"

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "docker-compose.monorepo.yml" ]; then
    print_error "Fichier docker-compose.monorepo.yml introuvable"
    print_info "Exécutez ce script depuis le répertoire antislash-talk"
    exit 1
fi

# Vérifier si WhisperX est déjà en cours
if docker ps | grep -q "antislash-talk-whisperx"; then
    print_warning "WhisperX est déjà en cours d'exécution"
    
    # Afficher les infos
    print_info "État de WhisperX:"
    docker ps | grep whisperx
    
    echo ""
    read -p "Voulez-vous redémarrer WhisperX ? (oui/non) [non] : " RESTART
    
    if [ "$RESTART" != "oui" ] && [ "$RESTART" != "o" ] && [ "$RESTART" != "yes" ] && [ "$RESTART" != "y" ]; then
        print_info "Aucune action effectuée"
        exit 0
    fi
    
    print_info "Arrêt de WhisperX..."
    docker compose -f docker-compose.monorepo.yml --profile whisperx down
    sleep 2
fi

print_header "1️⃣  Build de l'image WhisperX"

print_info "Construction de l'image (5-10 minutes)..."
if ! docker compose -f docker-compose.monorepo.yml build whisperx; then
    print_error "Échec du build de WhisperX"
    exit 1
fi

print_success "Image construite avec succès"

print_header "2️⃣  Démarrage du service"

print_info "Démarrage de WhisperX..."
if ! docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo --profile whisperx up -d; then
    print_error "Échec du démarrage de WhisperX"
    exit 1
fi

print_success "Service démarré"

print_header "3️⃣  Vérification de l'état"

print_info "Attente du démarrage complet (jusqu'à 60s)..."
WHISPERX_READY=false

for i in {1..30}; do
    if docker exec antislash-talk-whisperx curl -f http://localhost:8082/health 2>/dev/null | grep -q "ok"; then
        WHISPERX_READY=true
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

if [ "$WHISPERX_READY" = true ]; then
    print_success "✅ WhisperX est opérationnel !"
    
    # Tester l'API
    print_info "Test de l'API..."
    RESPONSE=$(curl -s http://localhost:8082/health)
    echo "  Réponse: $RESPONSE"
    
else
    print_warning "⚠️  WhisperX ne répond pas encore"
    print_info "Le service peut prendre plus de temps au premier démarrage"
    print_info "Vérifiez les logs : docker compose -f docker-compose.monorepo.yml logs whisperx -f"
fi

print_header "✅ TERMINÉ"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 INFORMATIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔹 Service       : WhisperX Transcription"
echo "🔹 Container     : antislash-talk-whisperx"
echo "🔹 Port          : 8082"
echo "🔹 Health URL    : http://localhost:8082/health"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

print_info "Commandes utiles:"
echo "  docker compose -f docker-compose.monorepo.yml logs whisperx -f    # Voir les logs"
echo "  docker compose -f docker-compose.monorepo.yml restart whisperx     # Redémarrer"
echo "  docker compose -f docker-compose.monorepo.yml --profile whisperx down # Arrêter"
echo ""

print_success "WhisperX est prêt ! 🎉"

