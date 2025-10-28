#!/bin/bash
# Script pour corriger le problème de volume read-only dans docker-compose

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_info "Correction du problème de volume read-only pour Studio..."

# Solution 1 : Modifier temporairement docker-compose pour enlever :ro
print_info "Modification temporaire de docker-compose.monorepo.yml..."
cp docker-compose.monorepo.yml docker-compose.monorepo.yml.backup

# Enlever :ro de la ligne .htpasswd
sed -i 's|./studio.htpasswd:/etc/nginx/.htpasswd:ro|./studio.htpasswd:/etc/nginx/.htpasswd|' docker-compose.monorepo.yml

# Vérifier si on a le mot de passe
if [ -f ".env.monorepo" ]; then
    STUDIO_PASSWORD=$(grep "^STUDIO_PASSWORD=" .env.monorepo | cut -d= -f2)
else
    print_error "Fichier .env.monorepo introuvable"
    read -sp "Entrez le mot de passe Studio : " STUDIO_PASSWORD
    echo
fi

# Créer le fichier studio.htpasswd localement
print_info "Création du fichier studio.htpasswd..."
STUDIO_PASSWORD_HASH=$(docker run --rm httpd:alpine htpasswd -nbB antislash "$STUDIO_PASSWORD" | cut -d: -f2)
echo "antislash:$STUDIO_PASSWORD_HASH" > studio.htpasswd

# Redémarrer le container studio-proxy
print_info "Redémarrage du container studio-proxy..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d studio-proxy

# Attendre un peu
sleep 3

# Vérifier que ça fonctionne
if docker exec antislash-talk-studio-proxy test -f /etc/nginx/.htpasswd; then
    print_success "Fichier .htpasswd correctement monté"
    
    # Vérifier que c'est un fichier et non un répertoire
    if docker exec antislash-talk-studio-proxy test -d /etc/nginx/.htpasswd; then
        print_error "ERREUR : .htpasswd est un répertoire !"
        
        # Forcer la correction
        docker exec antislash-talk-studio-proxy sh -c "rm -rf /etc/nginx/.htpasswd"
        docker cp studio.htpasswd antislash-talk-studio-proxy:/etc/nginx/.htpasswd
        docker exec antislash-talk-studio-proxy nginx -s reload
    fi
else
    print_error "Le fichier .htpasswd n'existe pas dans le container"
fi

# Restaurer le docker-compose original
print_info "Restauration du docker-compose.monorepo.yml original..."
mv docker-compose.monorepo.yml.backup docker-compose.monorepo.yml

print_success "Correction terminée !"
echo ""
echo "Accès Studio :"
echo "URL : https://$(hostname -I | awk '{print $1}'):8444"
echo "User : antislash"
echo "Pass : $STUDIO_PASSWORD"
echo ""
print_warning "Note : Le docker-compose a été restauré à sa version originale."
print_warning "Pour un fix permanent, éditez docker-compose.monorepo.yml et enlevez ':ro' de la ligne studio.htpasswd"
