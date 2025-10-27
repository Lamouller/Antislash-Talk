#!/bin/bash

# Script de nettoyage FORCÉ de Docker
set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Vérifier qu'on est sur le VPS
if [ ! -f "/home/debian/antislash-talk/.env.monorepo" ]; then
    print_error "Ce script doit être exécuté sur le VPS dans le répertoire du projet"
    exit 1
fi

cd /home/debian/antislash-talk

print_warning "NETTOYAGE FORCÉ DE DOCKER - SUPPRESSION TOTALE"
print_warning "Ce script va TOUT supprimer de Docker"
read -p "Êtes-vous VRAIMENT sûr ? (tapez 'SUPPRIMER TOUT' pour confirmer) : " confirm

if [ "$confirm" != "SUPPRIMER TOUT" ]; then
    print_info "Annulation..."
    exit 0
fi

# 1. Arrêter TOUT
print_info "Arrêt de tous les containers..."
docker compose -f docker-compose.monorepo.yml down -v --remove-orphans || true
docker kill $(docker ps -q) 2>/dev/null || true
docker stop $(docker ps -aq) 2>/dev/null || true

# 2. Supprimer TOUS les containers
print_info "Suppression de tous les containers..."
docker rm -f $(docker ps -aq) 2>/dev/null || true

# 3. Supprimer TOUS les volumes (spécifiquement ceux d'Antislash)
print_info "Suppression de tous les volumes Antislash..."
docker volume ls -q | grep -E "(antislash|db-data)" | xargs -r docker volume rm -f 2>/dev/null || true

# 4. Supprimer VRAIMENT tous les volumes
print_info "Suppression de TOUS les volumes Docker..."
docker volume rm -f $(docker volume ls -q) 2>/dev/null || true
docker volume prune -f --all

# 5. Supprimer les réseaux
print_info "Suppression des réseaux..."
docker network rm $(docker network ls -q | grep -v bridge | grep -v host | grep -v none) 2>/dev/null || true

# 6. Supprimer les images Antislash
print_info "Suppression des images Antislash..."
docker rmi -f $(docker images -q | grep antislash) 2>/dev/null || true

# 7. Nettoyage système complet
print_info "Nettoyage système complet..."
docker system prune -af --volumes

# 8. Vérifier qu'il ne reste rien
print_info "Vérification..."
echo "Containers restants:"
docker ps -a | grep -E "(antislash|supabase)" || echo "  Aucun"

echo ""
echo "Volumes restants:"
docker volume ls | grep -E "(antislash|db-data)" || echo "  Aucun"

echo ""
echo "Réseaux restants:"
docker network ls | grep antislash || echo "  Aucun"

# 9. Nettoyer aussi les fichiers temporaires
print_info "Nettoyage des fichiers temporaires..."
rm -rf /tmp/antislash* 2>/dev/null || true
rm -rf /var/lib/docker/volumes/antislash* 2>/dev/null || true

print_success "Nettoyage FORCÉ terminé !"
print_info "Vous pouvez maintenant lancer ./deploy-vps-v3.sh"
