#!/bin/bash

# Script de déploiement par étapes pour éviter la limite Docker Hub
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

cd /home/debian/antislash-talk

print_warning "Déploiement par étapes pour contourner la limite Docker Hub"
print_info "Ce script télécharge les images une par une avec des pauses"

# Charger les variables d'environnement
if [ -f .env.monorepo ]; then
    source .env.monorepo
fi

# Étape 1 : PostgreSQL seul
print_info "Étape 1/5 : Téléchargement PostgreSQL..."
docker pull supabase/postgres:15.1.1.78
sleep 30

# Étape 2 : Services Auth/Storage
print_info "Étape 2/5 : Téléchargement Auth et Storage..."
docker pull supabase/gotrue:v2.151.0
sleep 30
docker pull supabase/storage-api:v0.48.2
sleep 30

# Étape 3 : Kong et Meta
print_info "Étape 3/5 : Téléchargement Kong et Meta..."
docker pull kong:2.8.1
sleep 30
docker pull supabase/postgres-meta:v0.80.0
sleep 30

# Étape 4 : Studio et autres
print_info "Étape 4/5 : Téléchargement Studio et services restants..."
docker pull supabase/studio:20241014-2feab62
sleep 30
docker pull supabase/postgrest:v12.0.3
sleep 30
docker pull supabase/realtime:v2.30.1
sleep 30

# Étape 5 : Lancer le déploiement normal
print_info "Étape 5/5 : Images téléchargées, lancement du déploiement..."
print_success "Toutes les images sont maintenant en cache local"
print_info "Lancement du script de déploiement principal..."

./deploy-vps-v3.sh
