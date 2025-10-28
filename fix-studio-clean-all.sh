#!/bin/bash
# Script de nettoyage complet et correction Studio

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

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info "Nettoyage complet et correction de Studio..."

# 1. Nettoyer le fichier/répertoire local
if [ -e "studio.htpasswd" ]; then
    print_info "Suppression de studio.htpasswd existant..."
    rm -rf studio.htpasswd
fi

# 2. Vérifier si on a le mot de passe
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

# 3. Arrêter le container studio-proxy
print_info "Arrêt du container studio-proxy..."
docker stop antislash-talk-studio-proxy 2>/dev/null || true
docker rm antislash-talk-studio-proxy 2>/dev/null || true

# 4. Créer le FICHIER studio.htpasswd correctement
print_info "Création du fichier studio.htpasswd..."
STUDIO_PASSWORD_HASH=$(docker run --rm httpd:alpine htpasswd -nbB antislash "$STUDIO_PASSWORD" | cut -d: -f2)

# S'assurer qu'on écrit dans un fichier
echo "antislash:$STUDIO_PASSWORD_HASH" > ./studio.htpasswd

# Vérifier que c'est bien un fichier
if [ -f "./studio.htpasswd" ]; then
    print_success "Fichier studio.htpasswd créé correctement"
    ls -la studio.htpasswd
else
    print_error "Erreur lors de la création du fichier"
    exit 1
fi

# 5. Modifier temporairement docker-compose pour enlever :ro
print_info "Modification du docker-compose..."
cp docker-compose.monorepo.yml docker-compose.monorepo.yml.backup

# Option 1: Enlever complètement la ligne du volume .htpasswd
print_info "Suppression du montage de volume .htpasswd..."
sed -i '/\.htpasswd:/d' docker-compose.monorepo.yml

# 6. Démarrer le container
print_info "Démarrage du container studio-proxy..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d studio-proxy

# Attendre que le container démarre
sleep 5

# 7. Copier le fichier dans le container
print_info "Copie du fichier .htpasswd dans le container..."
docker cp ./studio.htpasswd antislash-talk-studio-proxy:/etc/nginx/.htpasswd
docker exec antislash-talk-studio-proxy chmod 644 /etc/nginx/.htpasswd

# 8. Recharger nginx
print_info "Rechargement de nginx..."
docker exec antislash-talk-studio-proxy nginx -s reload

# 9. Vérifier
if docker exec antislash-talk-studio-proxy test -f /etc/nginx/.htpasswd; then
    print_success "✓ Fichier .htpasswd présent dans le container"
    
    # Test de connexion
    print_info "Test de connexion..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -u "antislash:$STUDIO_PASSWORD" http://localhost:54327 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
        print_success "✓ Authentification fonctionne correctement"
    else
        print_warning "Code HTTP: $HTTP_CODE - Vérifiez manuellement"
    fi
else
    print_error "✗ Fichier .htpasswd non trouvé dans le container"
fi

# 10. Restaurer docker-compose
print_info "Restauration du docker-compose original..."
mv docker-compose.monorepo.yml.backup docker-compose.monorepo.yml

print_success "Nettoyage et correction terminés !"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Accès Studio :"
echo "URL : https://$(hostname -I | awk '{print $1}'):8444"
echo "User : antislash"
echo "Pass : $STUDIO_PASSWORD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_info "Note : Le fichier .htpasswd est maintenant dans le container"
print_info "Il survivra aux redémarrages mais pas aux recreate du container"
