#!/bin/bash

# =========================================================
# Script pour Forcer l'Utilisation des Certificats Let's Encrypt
# =========================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Charger les variables d'environnement
if [ -f .env.monorepo ]; then
    source .env.monorepo
else
    print_error ".env.monorepo non trouvé"
    exit 1
fi

DOMAIN=${VPS_HOST}
LETSENCRYPT_PATH="/etc/letsencrypt/live/${DOMAIN}"

print_info "Domaine : ${DOMAIN}"
print_info "Chemin Let's Encrypt : ${LETSENCRYPT_PATH}"

# Vérifier que Let's Encrypt existe
if [ ! -f "${LETSENCRYPT_PATH}/fullchain.pem" ]; then
    print_error "Certificats Let's Encrypt non trouvés !"
    print_info "Chemin vérifié : ${LETSENCRYPT_PATH}/fullchain.pem"
    print_info "Listez les certificats disponibles avec : sudo certbot certificates"
    exit 1
fi

print_success "Certificats Let's Encrypt trouvés !"

# Vérifier la config Nginx actuelle
print_info "Vérification de la configuration Nginx actuelle..."
if grep -q "selfsigned.crt" /etc/nginx/sites-enabled/antislash-talk-ssl; then
    print_warning "Certificats auto-signés détectés dans la config Nginx"
    print_info "Remplacement en cours..."
    
    # Remplacer tous les certificats auto-signés
    sudo sed -i "s|/etc/nginx/ssl/selfsigned.crt|${LETSENCRYPT_PATH}/fullchain.pem|g" /etc/nginx/sites-enabled/antislash-talk-ssl
    sudo sed -i "s|/etc/nginx/ssl/selfsigned.key|${LETSENCRYPT_PATH}/privkey.pem|g" /etc/nginx/sites-enabled/antislash-talk-ssl
    
    print_success "Certificats remplacés !"
else
    print_success "Les certificats Let's Encrypt sont déjà configurés"
fi

# Vérifier le résultat
print_info "Vérification post-remplacement..."
CERT_COUNT=$(grep -c "letsencrypt" /etc/nginx/sites-enabled/antislash-talk-ssl || true)
print_info "Nombre de références Let's Encrypt : ${CERT_COUNT}"

if [ "$CERT_COUNT" -gt 0 ]; then
    print_success "Configuration correcte !"
else
    print_error "Problème : Let's Encrypt n'est toujours pas configuré"
    exit 1
fi

# Test de la configuration Nginx
print_info "Test de la configuration Nginx..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
    print_success "Configuration Nginx valide"
else
    print_error "Configuration Nginx invalide !"
    sudo nginx -t
    exit 1
fi

# Recharger Nginx
print_info "Rechargement de Nginx..."
sudo systemctl reload nginx
print_success "Nginx rechargé !"

echo ""
print_success "═══════════════════════════════════════"
print_success "✅ Certificats SSL correctement configurés !"
print_success "═══════════════════════════════════════"
echo ""
print_info "Testez vos URLs :"
echo "  • https://app.${DOMAIN}"
echo "  • https://api.${DOMAIN}"
echo "  • https://studio.${DOMAIN}"
echo "  • https://ollama.${DOMAIN}"
echo ""
print_info "N'oubliez pas de vider le cache de votre navigateur !"

