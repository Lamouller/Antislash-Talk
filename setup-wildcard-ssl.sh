#!/bin/bash
# ============================================
# Script pour configurer un certificat SSL wildcard
# ============================================

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Détecter le domaine
if [ -f ".env.monorepo" ]; then
    VPS_HOST=$(grep "^VPS_HOST=" .env.monorepo | cut -d= -f2)
    print_info "Domaine : $VPS_HOST"
else
    echo "Domaine (ex: riquelme-talk.antislash.studio) :"
    read VPS_HOST
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "  Configuration du certificat SSL wildcard"
echo "════════════════════════════════════════════════════"
echo ""
echo "Domaine principal : $VPS_HOST"
echo "Wildcard          : *.$VPS_HOST"
echo ""
print_warning "Cette méthode nécessite de modifier vos DNS temporairement"
echo ""

read -p "Continuer ? (o/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    exit 0
fi

# Option 1: Certificat avec sous-domaines explicites
echo ""
echo "Choisissez la méthode :"
echo "  1) Wildcard (*.domain) - Recommandé"
echo "  2) Sous-domaines explicites (app, api, studio, ollama)"
echo ""
read -p "Votre choix [1] : " METHOD
METHOD=${METHOD:-1}

if [ "$METHOD" = "1" ]; then
    print_info "Configuration d'un certificat wildcard..."
    echo ""
    print_warning "⚠️  IMPORTANT : Certbot va vous demander d'ajouter un enregistrement TXT DNS"
    echo ""
    echo "Chez votre provider DNS (OVH, Cloudflare, etc.), vous devrez ajouter :"
    echo "  Type : TXT"
    echo "  Nom  : _acme-challenge"
    echo "  Valeur : (fournie par Certbot)"
    echo ""
    read -p "Appuyez sur ENTER pour continuer..."
    
    sudo certbot certonly --manual --preferred-challenges dns \
      -d "$VPS_HOST" \
      -d "*.$VPS_HOST"
    
else
    print_info "Configuration avec sous-domaines explicites..."
    
    sudo certbot certonly --nginx \
      -d "$VPS_HOST" \
      -d "app.$VPS_HOST" \
      -d "api.$VPS_HOST" \
      -d "studio.$VPS_HOST" \
      -d "ollama.$VPS_HOST" \
      --expand
fi

# Vérifier que le certificat est bien créé
if [ -f "/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem" ]; then
    print_success "Certificat SSL créé avec succès !"
    
    echo ""
    print_info "Affichage du certificat :"
    sudo certbot certificates
    
    echo ""
    print_info "Application de la configuration nginx..."
    
    # Appliquer la config nginx avec sous-domaines
    if [ -f "apply-nginx-subdomains.sh" ]; then
        ./apply-nginx-subdomains.sh
        print_success "Configuration nginx appliquée !"
    else
        print_warning "Appliquez manuellement la config nginx avec les sous-domaines"
    fi
    
    echo ""
    echo "════════════════════════════════════════════════════"
    echo "  ✅ Configuration terminée !"
    echo "════════════════════════════════════════════════════"
    echo ""
    echo "Vos domaines sont maintenant sécurisés :"
    echo "  • https://$VPS_HOST"
    echo "  • https://app.$VPS_HOST"
    echo "  • https://api.$VPS_HOST"
    echo "  • https://studio.$VPS_HOST"
    echo "  • https://ollama.$VPS_HOST"
    echo ""
    echo "Renouvellement automatique configuré ✅"
    echo ""
else
    print_warning "Le certificat n'a pas pu être créé"
    echo "Vérifiez les erreurs ci-dessus"
fi

