#!/bin/bash

# Script de nettoyage complet et redéploiement
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

# Vérifier qu'on est sur le VPS
if [ ! -f "/home/debian/antislash-talk/.env.monorepo" ]; then
    print_error "Ce script doit être exécuté sur le VPS dans le répertoire du projet"
    exit 1
fi

cd /home/debian/antislash-talk

print_header "NETTOYAGE COMPLET ET REDÉPLOIEMENT"

# Confirmation
print_warning "⚠️  CE SCRIPT VA SUPPRIMER TOUTES LES DONNÉES DOCKER !"
print_warning "Cela inclut : containers, volumes, images, réseaux"
read -p "Êtes-vous sûr de vouloir continuer ? (oui/non) : " confirm

if [ "$confirm" != "oui" ]; then
    print_info "Annulation..."
    exit 0
fi

# 1. Arrêter tous les containers
print_header "Étape 1/6 : Arrêt de tous les services"
docker compose -f docker-compose.monorepo.yml down -v || true
docker stop $(docker ps -aq) 2>/dev/null || true

# 2. Supprimer tous les containers
print_info "Suppression des containers..."
docker rm -f $(docker ps -aq) 2>/dev/null || true

# 3. Supprimer tous les volumes
print_info "Suppression des volumes..."
docker volume rm $(docker volume ls -q | grep antislash) 2>/dev/null || true
docker volume prune -f

# 4. Supprimer les réseaux
print_info "Suppression des réseaux..."
docker network rm $(docker network ls -q | grep antislash) 2>/dev/null || true

# 5. Nettoyer le système Docker
print_info "Nettoyage du système Docker..."
docker system prune -af --volumes

print_success "Nettoyage terminé"

# 6. Sauvegarder l'ancien .env.monorepo
print_header "Étape 2/6 : Sauvegarde de la configuration"
if [ -f .env.monorepo ]; then
    cp .env.monorepo .env.monorepo.backup.$(date +%Y%m%d_%H%M%S)
    print_success "Configuration sauvegardée"
fi

# 7. Lancer le script de déploiement v3
print_header "Étape 3/6 : Lancement du déploiement propre"
print_info "Le script de déploiement va maintenant démarrer..."
print_info "Assurez-vous d'avoir :"
print_info "  - L'IP ou domaine du VPS"
print_info "  - Un mot de passe pour Supabase Studio"
print_info "  - Une adresse email pour l'utilisateur admin"
print_info "  - Le token HuggingFace (optionnel)"
echo ""
sleep 3

# Lancer le script de déploiement
./deploy-vps-v3.sh
