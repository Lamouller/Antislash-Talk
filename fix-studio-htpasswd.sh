#!/bin/bash
# Script de correction pour le problème .htpasswd Studio

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

print_info "Correction du problème .htpasswd pour Studio..."

# Vérifier si on a le mot de passe dans .env.monorepo
if [ -f ".env.monorepo" ]; then
    STUDIO_PASSWORD=$(grep "^STUDIO_PASSWORD=" .env.monorepo | cut -d= -f2)
    if [ -z "$STUDIO_PASSWORD" ]; then
        print_error "Mot de passe Studio introuvable dans .env.monorepo"
        read -sp "Entrez le mot de passe Studio : " STUDIO_PASSWORD
        echo
    fi
else
    print_error "Fichier .env.monorepo introuvable"
    read -sp "Entrez le mot de passe Studio : " STUDIO_PASSWORD
    echo
fi

# Supprimer le répertoire .htpasswd s'il existe
print_info "Nettoyage de l'ancien .htpasswd..."
docker exec antislash-talk-studio-proxy sh -c "rm -rf /etc/nginx/.htpasswd"

# Générer le hash du mot de passe
print_info "Génération du nouveau fichier .htpasswd..."
STUDIO_PASSWORD_HASH=$(docker run --rm httpd:alpine htpasswd -nbB antislash "$STUDIO_PASSWORD" | cut -d: -f2)

# Créer directement le fichier dans le container
docker exec antislash-talk-studio-proxy sh -c "echo 'antislash:$STUDIO_PASSWORD_HASH' > /etc/nginx/.htpasswd"
docker exec antislash-talk-studio-proxy sh -c "chmod 644 /etc/nginx/.htpasswd"

# Vérifier que c'est bien un fichier
if docker exec antislash-talk-studio-proxy test -f /etc/nginx/.htpasswd; then
    print_success "Fichier .htpasswd créé correctement"
    
    # Afficher le contenu (sans le hash complet)
    print_info "Vérification du fichier :"
    docker exec antislash-talk-studio-proxy sh -c "ls -la /etc/nginx/.htpasswd"
    docker exec antislash-talk-studio-proxy sh -c "head -c 20 /etc/nginx/.htpasswd && echo '...'"
else
    print_error "Erreur: .htpasswd n'a pas été créé correctement"
    exit 1
fi

# Recharger nginx
print_info "Rechargement de nginx..."
docker exec antislash-talk-studio-proxy nginx -s reload || docker restart antislash-talk-studio-proxy

print_success "Correction terminée !"
echo ""
echo "Vous pouvez maintenant accéder à Studio :"
echo "URL : https://$(hostname -I | awk '{print $1}'):8444"
echo "User : antislash"
echo "Pass : $STUDIO_PASSWORD"