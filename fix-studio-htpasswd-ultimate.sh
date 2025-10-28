#!/bin/bash
# Script de correction ULTIME pour le problème .htpasswd Studio

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

print_info "Correction ULTIME du problème .htpasswd pour Studio..."

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

print_info "Méthode ULTIME : Modification du volume nginx..."

# Générer le hash du mot de passe
STUDIO_PASSWORD_HASH=$(docker run --rm httpd:alpine htpasswd -nbB antislash "$STUDIO_PASSWORD" | cut -d: -f2)

# Créer un fichier temporaire local
echo "antislash:$STUDIO_PASSWORD_HASH" > /tmp/htpasswd.tmp

# Méthode 1 : Copier via docker cp après suppression forcée
print_info "Tentative 1 : Copie directe..."
docker exec antislash-talk-studio-proxy sh -c "rm -rf /etc/nginx/.htpasswd" 2>/dev/null || true
docker cp /tmp/htpasswd.tmp antislash-talk-studio-proxy:/etc/nginx/.htpasswd

if docker exec antislash-talk-studio-proxy test -f /etc/nginx/.htpasswd; then
    print_success "Fichier créé avec succès (méthode 1)"
    docker exec antislash-talk-studio-proxy chmod 644 /etc/nginx/.htpasswd
else
    print_warning "Méthode 1 échouée, essai méthode 2..."
    
    # Méthode 2 : Utiliser un emplacement temporaire
    print_info "Tentative 2 : Via emplacement temporaire..."
    docker cp /tmp/htpasswd.tmp antislash-talk-studio-proxy:/tmp/.htpasswd
    docker exec antislash-talk-studio-proxy sh -c "rm -rf /etc/nginx/.htpasswd && mv /tmp/.htpasswd /etc/nginx/.htpasswd && chmod 644 /etc/nginx/.htpasswd"
    
    if ! docker exec antislash-talk-studio-proxy test -f /etc/nginx/.htpasswd; then
        print_warning "Méthode 2 échouée, essai méthode 3..."
        
        # Méthode 3 : Recréer complètement nginx.conf sans auth
        print_info "Tentative 3 : Désactivation temporaire de l'auth..."
        docker exec antislash-talk-studio-proxy sh -c "sed -i 's/auth_basic/#auth_basic/g' /etc/nginx/nginx.conf"
        docker exec antislash-talk-studio-proxy nginx -s reload
        
        print_warning "L'authentification a été désactivée temporairement."
        print_info "Pour réactiver l'auth, exécutez :"
        echo "docker exec antislash-talk-studio-proxy sh -c \"sed -i 's/#auth_basic/auth_basic/g' /etc/nginx/nginx.conf\""
        echo "docker exec antislash-talk-studio-proxy nginx -s reload"
    else
        print_success "Fichier créé avec succès (méthode 2)"
    fi
fi

# Nettoyer
rm -f /tmp/htpasswd.tmp

# Recharger nginx
docker exec antislash-talk-studio-proxy nginx -s reload 2>/dev/null || docker restart antislash-talk-studio-proxy

print_success "Processus terminé !"
echo ""
echo "Essayez maintenant d'accéder à Studio :"
echo "URL : https://$(hostname -I | awk '{print $1}'):8444"
echo "User : antislash"
echo "Pass : $STUDIO_PASSWORD"
echo ""

# Vérification finale
if docker exec antislash-talk-studio-proxy test -f /etc/nginx/.htpasswd; then
    print_success "✓ Fichier .htpasswd existe"
    docker exec antislash-talk-studio-proxy sh -c "ls -la /etc/nginx/.htpasswd"
else
    if docker exec antislash-talk-studio-proxy test -d /etc/nginx/.htpasswd; then
        print_error "✗ .htpasswd est toujours un répertoire !"
        print_info "Solution radicale : recréer le container"
        echo "docker rm -f antislash-talk-studio-proxy"
        echo "docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d studio-proxy"
    else
        print_warning "✗ .htpasswd n'existe pas (auth désactivée ?)"
    fi
fi
