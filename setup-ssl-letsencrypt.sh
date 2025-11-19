#!/bin/bash

# =========================================================
# Script d'installation SSL Let's Encrypt pour Antislash Talk
# =========================================================

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}    $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Vérifier sudo
if [ "$EUID" -ne 0 ]; then
    print_error "Ce script doit être exécuté avec sudo"
    exit 1
fi

print_header "🔒 INSTALLATION SSL LET'S ENCRYPT"

# Configuration
DOMAIN="riquelme-talk.antislash.studio"
EMAIL="admin@antislash.studio"  # Modifier si nécessaire

print_info "Domaine: $DOMAIN"
read -p "Email pour Let's Encrypt [$EMAIL] : " USER_EMAIL
EMAIL=${USER_EMAIL:-$EMAIL}

print_header "1️⃣  Installation de Certbot"

# Détecter l'OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    print_error "Impossible de détecter l'OS"
    exit 1
fi

case $OS in
    ubuntu|debian)
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
        ;;
    fedora|centos|rhel|rocky|almalinux)
        dnf install -y certbot python3-certbot-nginx
        ;;
    *)
        print_error "OS non supporté: $OS"
        exit 1
        ;;
esac

print_success "Certbot installé"

print_header "2️⃣  Création du dossier pour validation"

mkdir -p /var/www/certbot
chown -R www-data:www-data /var/www/certbot 2>/dev/null || chown -R nginx:nginx /var/www/certbot

print_success "Dossier créé"

print_header "3️⃣  Vérification DNS"

print_info "Vérification que $DOMAIN pointe vers ce serveur..."
SERVER_IP=$(curl -s ifconfig.me)
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)

print_info "IP du serveur: $SERVER_IP"
print_info "IP du domaine: $DOMAIN_IP"

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    print_warning "Le DNS ne pointe pas encore vers ce serveur"
    print_warning "Configurez votre DNS pour pointer vers $SERVER_IP"
    read -p "Voulez-vous continuer quand même ? (oui/non) [non] : " CONTINUE
    if [ "$CONTINUE" != "oui" ] && [ "$CONTINUE" != "o" ]; then
        print_error "Installation annulée"
        exit 1
    fi
fi

print_header "4️⃣  Sauvegarde de la configuration actuelle"

if [ -f /etc/nginx/sites-available/antislash-talk-ssl ]; then
    cp /etc/nginx/sites-available/antislash-talk-ssl /etc/nginx/sites-available/antislash-talk-ssl.backup-$(date +%Y%m%d-%H%M%S)
    print_success "Sauvegarde créée"
fi

print_header "5️⃣  Arrêt temporaire de Nginx"

systemctl stop nginx
print_success "Nginx arrêté"

print_header "6️⃣  Obtention du certificat SSL"

print_info "Demande du certificat pour $DOMAIN..."
print_warning "Cela peut prendre quelques minutes..."

certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --domains "$DOMAIN" \
    --rsa-key-size 4096 \
    --preferred-challenges http

if [ $? -eq 0 ]; then
    print_success "Certificat SSL obtenu avec succès !"
else
    print_error "Échec de l'obtention du certificat"
    systemctl start nginx
    exit 1
fi

print_header "7️⃣  Installation de la configuration sécurisée"

# Télécharger la nouvelle config
cd ~/antislash-talk
if [ -f nginx-secure-ssl.conf ]; then
    print_info "Utilisation de la config locale..."
    cp nginx-secure-ssl.conf /etc/nginx/sites-available/antislash-talk-ssl
else
    print_info "Téléchargement de la config sécurisée..."
    curl -sSL "https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/nginx-secure-ssl.conf" \
        -o /etc/nginx/sites-available/antislash-talk-ssl
fi

print_success "Configuration installée"

print_header "8️⃣  Ajout des zones de rate limiting"

# Ajouter les zones de rate limiting dans nginx.conf si pas déjà présent
if ! grep -q "limit_req_zone" /etc/nginx/nginx.conf; then
    print_info "Ajout des zones de rate limiting..."
    
    # Trouver le bloc http et ajouter les zones
    sed -i '/http {/a \
    # Rate Limiting Zones\
    limit_req_zone $binary_remote_addr zone=web_limit:10m rate=30r/s;\
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=20r/s;\
    limit_req_zone $binary_remote_addr zone=studio_limit:10m rate=10r/s;\
    limit_conn_zone $binary_remote_addr zone=conn_limit:10m;\
' /etc/nginx/nginx.conf
    
    print_success "Zones de rate limiting ajoutées"
else
    print_info "Zones de rate limiting déjà configurées"
fi

print_header "9️⃣  Validation de la configuration Nginx"

nginx -t

if [ $? -eq 0 ]; then
    print_success "Configuration Nginx valide"
else
    print_error "Configuration Nginx invalide"
    print_warning "Restauration de la sauvegarde..."
    cp /etc/nginx/sites-available/antislash-talk-ssl.backup-* /etc/nginx/sites-available/antislash-talk-ssl 2>/dev/null
    systemctl start nginx
    exit 1
fi

print_header "🔟 Démarrage de Nginx"

systemctl start nginx
systemctl reload nginx

print_success "Nginx redémarré"

print_header "1️⃣1️⃣ Configuration du renouvellement automatique"

# Tester le renouvellement
print_info "Test du renouvellement automatique..."
certbot renew --dry-run

if [ $? -eq 0 ]; then
    print_success "Renouvellement automatique configuré"
    print_info "Les certificats seront renouvelés automatiquement tous les 60 jours"
else
    print_warning "Problème avec le renouvellement automatique"
fi

print_header "1️⃣2️⃣ Tests de connectivité"

sleep 3

print_info "Test HTTPS Web App (443)..."
if curl -Iks "https://$DOMAIN/" | head -1 | grep -q "200\|301\|302"; then
    print_success "✅ Web App accessible"
else
    print_warning "⚠️  Web App non accessible"
fi

print_info "Test HTTPS API (8443)..."
if curl -Iks "https://$DOMAIN:8443/auth/v1/health" | head -1 | grep -q "200"; then
    print_success "✅ API accessible"
else
    print_warning "⚠️  API non accessible"
fi

print_info "Test HTTPS Studio (8444)..."
if curl -Iks "https://$DOMAIN:8444/" | head -1 | grep -q "200\|401"; then
    print_success "✅ Studio accessible"
else
    print_warning "⚠️  Studio non accessible"
fi

print_header "✅ INSTALLATION TERMINÉE"

echo ""
print_success "🎉 SSL Let's Encrypt configuré avec succès !"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 INFORMATIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔹 Domaine: $DOMAIN"
echo "🔹 Certificat: /etc/letsencrypt/live/$DOMAIN/"
echo "🔹 Renouvellement: Automatique tous les 60 jours"
echo ""
echo "🔹 URLs sécurisées:"
echo "   - Web App:  https://$DOMAIN/"
echo "   - API:      https://$DOMAIN:8443/"
echo "   - Studio:   https://$DOMAIN:8444/"
echo "   - Ollama:   https://$DOMAIN:8445/"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_info "Commandes utiles:"
echo "  sudo certbot renew                 # Renouveler manuellement"
echo "  sudo certbot certificates          # Voir les certificats"
echo "  sudo nginx -t                      # Tester la config"
echo "  sudo systemctl reload nginx        # Recharger Nginx"
echo ""
print_warning "⚠️  Testez votre site sur: https://www.ssllabs.com/ssltest/"
echo ""
print_success "Installation terminée ! 🚀"

