#!/bin/bash
# Script pour corriger l'auth Studio avec volume read-only

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

print_info "Correction de l'authentification Studio (volume read-only)..."

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

print_info "Solution : Placer .htpasswd dans /tmp qui est toujours writable..."

# Générer le hash du mot de passe
STUDIO_PASSWORD_HASH=$(docker run --rm httpd:alpine htpasswd -nbB antislash "$STUDIO_PASSWORD" | cut -d: -f2)

# Créer le fichier dans /tmp du container
docker exec antislash-talk-studio-proxy sh -c "echo 'antislash:$STUDIO_PASSWORD_HASH' > /tmp/.htpasswd"
docker exec antislash-talk-studio-proxy sh -c "chmod 644 /tmp/.htpasswd"

# Vérifier que le fichier est créé
if docker exec antislash-talk-studio-proxy test -f /tmp/.htpasswd; then
    print_success "Fichier .htpasswd créé dans /tmp"
else
    print_error "Impossible de créer le fichier .htpasswd"
    exit 1
fi

# Modifier la configuration nginx pour pointer vers /tmp/.htpasswd
print_info "Modification de la configuration nginx..."

# Créer une nouvelle config nginx
docker exec antislash-talk-studio-proxy sh -c "cat > /tmp/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    server {
        listen 80;
        server_name _;

        # Auth basique avec fichier dans /tmp
        auth_basic \"Restricted Access\";
        auth_basic_user_file /tmp/.htpasswd;

        location / {
            proxy_pass http://studio:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_cache_bypass \$http_upgrade;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOF"

# Vérifier si on peut écrire dans /etc/nginx/
if docker exec antislash-talk-studio-proxy sh -c "cp /tmp/nginx.conf /etc/nginx/nginx.conf" 2>/dev/null; then
    print_success "Configuration nginx mise à jour"
    docker exec antislash-talk-studio-proxy nginx -s reload
else
    print_warning "Impossible de modifier /etc/nginx/nginx.conf"
    print_info "Essai de lancement avec la config depuis /tmp..."
    
    # Arrêter nginx et le relancer avec la nouvelle config
    docker exec antislash-talk-studio-proxy sh -c "nginx -s stop" 2>/dev/null || true
    sleep 1
    
    # Lancer nginx avec la config dans /tmp
    if docker exec antislash-talk-studio-proxy sh -c "nginx -c /tmp/nginx.conf"; then
        print_success "Nginx lancé avec la configuration depuis /tmp"
    else
        print_error "Impossible de lancer nginx avec la nouvelle config"
        
        # Solution finale : désactiver l'auth
        print_warning "Désactivation de l'authentification..."
        docker exec antislash-talk-studio-proxy sh -c "sed -i 's/auth_basic/#auth_basic/g' /tmp/nginx.conf"
        docker exec antislash-talk-studio-proxy sh -c "nginx -c /tmp/nginx.conf"
        
        print_warning "⚠️  L'authentification a été DÉSACTIVÉE car impossible de configurer"
    fi
fi

print_success "Processus terminé !"
echo ""
echo "Accès Studio :"
echo "URL : https://$(hostname -I | awk '{print $1}'):8444"
if docker exec antislash-talk-studio-proxy grep -q "^[^#]*auth_basic" /tmp/nginx.conf 2>/dev/null; then
    echo "User : antislash"
    echo "Pass : $STUDIO_PASSWORD"
else
    echo "⚠️  ATTENTION : Authentification désactivée !"
fi
