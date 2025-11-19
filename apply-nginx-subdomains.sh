#!/bin/bash
# ============================================
# Script pour appliquer la config nginx avec sous-domaines
# ============================================

set -e

# Couleurs
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

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Détecter le domaine depuis .env.monorepo
if [ -f ".env.monorepo" ]; then
    VPS_HOST=$(grep "^VPS_HOST=" .env.monorepo | cut -d= -f2)
    print_info "Domaine détecté : $VPS_HOST"
else
    print_error ".env.monorepo non trouvé"
    exit 1
fi

print_info "Application de la configuration nginx avec sous-domaines..."

# Backup de l'ancienne config
if [ -f "/etc/nginx/sites-enabled/antislash-talk-ssl" ]; then
    sudo cp /etc/nginx/sites-enabled/antislash-talk-ssl \
         /etc/nginx/sites-enabled/antislash-talk-ssl.backup.$(date +%Y%m%d-%H%M%S)
    print_success "Backup de l'ancienne config créé"
fi

# Déterminer les certificats SSL à utiliser
if [ -f "/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem" ]; then
    SSL_CERT="/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem"
    SSL_KEY="/etc/letsencrypt/live/${VPS_HOST}/privkey.pem"
    SSL_TRUSTED="/etc/letsencrypt/live/${VPS_HOST}/chain.pem"
    print_success "Certificats Let's Encrypt détectés"
else
    SSL_CERT="/etc/nginx/ssl/selfsigned.crt"
    SSL_KEY="/etc/nginx/ssl/selfsigned.key"
    SSL_TRUSTED="/etc/nginx/ssl/selfsigned.crt"
    print_warning "Utilisation des certificats auto-signés"
fi

# Appliquer le template
if [ ! -f "nginx-subdomains-ssl.conf" ]; then
    print_error "Template nginx-subdomains-ssl.conf non trouvé"
    exit 1
fi

print_info "Génération de la configuration nginx..."
sed -e "s|riquelme-talk.antislash.studio|${VPS_HOST}|g" \
    -e "s|/etc/letsencrypt/live/riquelme-talk.antislash.studio/fullchain.pem|${SSL_CERT}|g" \
    -e "s|/etc/letsencrypt/live/riquelme-talk.antislash.studio/privkey.pem|${SSL_KEY}|g" \
    -e "s|/etc/letsencrypt/live/riquelme-talk.antislash.studio/chain.pem|${SSL_TRUSTED}|g" \
    nginx-subdomains-ssl.conf | sudo tee /etc/nginx/sites-available/antislash-talk-ssl > /dev/null

print_success "Configuration générée"

# Activer le site
sudo ln -sf /etc/nginx/sites-available/antislash-talk-ssl /etc/nginx/sites-enabled/

# Tester la configuration
print_info "Test de la configuration nginx..."
if sudo nginx -t; then
    print_success "Configuration nginx valide ✅"
    
    # Recharger nginx
    print_info "Rechargement de nginx..."
    sudo systemctl reload nginx
    print_success "Nginx rechargé ✅"
    
    echo ""
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo -e "${GREEN}   ✅ Configuration appliquée avec succès !${NC}"
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo ""
    echo "Services disponibles :"
    echo "  • Application : https://${VPS_HOST}"
    echo "  • Application : https://app.${VPS_HOST}"
    echo "  • API Supabase : https://api.${VPS_HOST}"
    echo "  • Studio : https://studio.${VPS_HOST}"
    echo "  • Ollama : https://ollama.${VPS_HOST}"
    echo ""
    echo "Tests rapides :"
    echo "  curl -I https://api.${VPS_HOST}"
    echo "  curl -I https://app.${VPS_HOST}"
    echo ""
else
    print_error "Configuration nginx invalide ❌"
    print_warning "Restauration de l'ancienne config..."
    
    BACKUP=$(ls -t /etc/nginx/sites-enabled/antislash-talk-ssl.backup.* 2>/dev/null | head -1)
    if [ -n "$BACKUP" ]; then
        sudo cp "$BACKUP" /etc/nginx/sites-enabled/antislash-talk-ssl
        print_info "Ancienne config restaurée"
    fi
    
    exit 1
fi

