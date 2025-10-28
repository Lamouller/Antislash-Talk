#!/bin/bash
# Script de nettoyage et redéploiement complet

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info "Nettoyage et redéploiement complet..."

# 1. Arrêter tous les services
print_info "Arrêt des services..."
docker compose -f docker-compose.monorepo.yml down -v --remove-orphans || true

# 2. Nettoyer les fichiers problématiques
print_info "Nettoyage des fichiers..."
rm -rf studio.htpasswd 2>/dev/null || true
rm -f apps/web/.env 2>/dev/null || true

# 3. Nettoyer Docker
print_info "Nettoyage Docker..."
docker system prune -f

# 4. Vérifier si on a une config existante
if [ -f ".env.monorepo" ]; then
    print_success "Configuration .env.monorepo trouvée"
    print_info "Lancement du déploiement complet..."
    
    # Lancer le script de déploiement principal
    ./deploy-vps-final.sh
else
    print_warning "Pas de configuration .env.monorepo trouvée"
    print_info "Lancement du déploiement initial..."
    
    # Lancer le script de déploiement principal
    ./deploy-vps-final.sh
fi