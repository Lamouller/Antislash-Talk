#!/bin/bash
# 🔐 Script de correction de l'authentification après changement de domaine
# Corrige les problèmes d'auth GoTrue/Supabase après ajout d'un domaine

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}    $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

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
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Détecter automatiquement le répertoire du projet
if [ -f "docker-compose.monorepo.yml" ] && [ -f ".env.monorepo" ]; then
    PROJECT_DIR=$(pwd)
    print_success "Projet détecté dans le répertoire courant : $PROJECT_DIR"
elif [ -d "$HOME/antislash-talk" ]; then
    PROJECT_DIR="$HOME/antislash-talk"
    cd "$PROJECT_DIR"
    print_success "Projet trouvé dans $PROJECT_DIR"
else
    print_warning "Impossible de trouver automatiquement le projet"
    read -p "Chemin du projet : " PROJECT_DIR
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "Répertoire introuvable : $PROJECT_DIR"
        exit 1
    fi
    cd "$PROJECT_DIR"
fi

print_header "🔐 DIAGNOSTIC ET CORRECTION DE L'AUTHENTIFICATION"

# ========================================
# 1. DÉTECTER LE DOMAINE ACTUEL
# ========================================
print_header "1️⃣  Détection de la configuration"

if [ -f ".env.monorepo" ]; then
    source .env.monorepo
    print_success "Configuration chargée"
else
    print_error "Fichier .env.monorepo introuvable"
    exit 1
fi

# Extraire les URLs actuelles
CURRENT_APP_URL="${SITE_URL:-}"
CURRENT_API_URL="${API_EXTERNAL_URL:-}"
CURRENT_SUPABASE_URL="${VITE_SUPABASE_URL:-}"

print_info "URLs actuelles détectées :"
echo "  App URL  : $CURRENT_APP_URL"
echo "  API URL  : $CURRENT_API_URL"
echo "  Supabase : $CURRENT_SUPABASE_URL"

# ========================================
# 2. VÉRIFIER LES VARIABLES D'ENVIRONNEMENT D'AUTH
# ========================================
print_header "2️⃣  Vérification des variables Auth"

echo ""
print_info "Variables GoTrue actuelles :"
grep -E "GOTRUE_SITE_URL|GOTRUE_URI_ALLOW_LIST|API_EXTERNAL_URL" .env.monorepo

ISSUES=()

# Vérifier GOTRUE_SITE_URL
if ! grep -q "GOTRUE_SITE_URL=$CURRENT_APP_URL" .env.monorepo; then
    print_warning "GOTRUE_SITE_URL ne correspond pas à SITE_URL"
    ISSUES+=("gotrue_site_url")
fi

# Vérifier GOTRUE_URI_ALLOW_LIST
if ! grep -q "GOTRUE_URI_ALLOW_LIST" .env.monorepo | grep -q "$CURRENT_APP_URL"; then
    print_warning "GOTRUE_URI_ALLOW_LIST pourrait être incomplet"
    ISSUES+=("gotrue_uri_allow")
fi

# ========================================
# 3. DEMANDER LE DOMAINE CORRECT
# ========================================
print_header "3️⃣  Configuration du domaine"

echo ""
print_info "Quel est votre domaine complet ?"
echo "Exemples :"
echo "  - https://riquelme-talk.antislash.studio"
echo "  - https://yourdomain.com"
echo "  - https://app.yourdomain.com"
echo ""
read -p "Domaine complet (avec https://) : " NEW_DOMAIN

# Nettoyer l'entrée
NEW_DOMAIN=$(echo "$NEW_DOMAIN" | sed 's:/*$::')

if [[ ! "$NEW_DOMAIN" =~ ^https?:// ]]; then
    NEW_DOMAIN="https://$NEW_DOMAIN"
fi

print_info "Domaine configuré : $NEW_DOMAIN"

# Détecter si on utilise des ports ou sous-domaines
if [[ "$CURRENT_SUPABASE_URL" == *":8443"* ]]; then
    USE_PORTS=true
    NEW_API_URL="${NEW_DOMAIN}:8443"
    NEW_APP_URL="$NEW_DOMAIN"
    print_info "Mode détecté : Ports (API sur :8443)"
else
    USE_PORTS=false
    # Extraire le sous-domaine API
    if [[ "$NEW_DOMAIN" == *"app."* ]]; then
        DOMAIN_BASE=$(echo "$NEW_DOMAIN" | sed 's|https://app\.||')
        NEW_API_URL="https://api.$DOMAIN_BASE"
        NEW_APP_URL="https://app.$DOMAIN_BASE"
        print_info "Mode détecté : Sous-domaines"
    else
        NEW_API_URL="$NEW_DOMAIN"
        NEW_APP_URL="$NEW_DOMAIN"
        print_info "Mode détecté : Domaine unique"
    fi
fi

# ========================================
# 4. SAUVEGARDER LA CONFIGURATION ACTUELLE
# ========================================
print_header "4️⃣  Sauvegarde de la configuration"

BACKUP_FILE=".env.monorepo.backup.$(date +%Y%m%d_%H%M%S)"
cp .env.monorepo "$BACKUP_FILE"
print_success "Sauvegarde créée : $BACKUP_FILE"

# ========================================
# 5. METTRE À JOUR LES VARIABLES D'ENVIRONNEMENT
# ========================================
print_header "5️⃣  Mise à jour des variables d'environnement"

print_info "Mise à jour de .env.monorepo..."

# Mettre à jour SITE_URL
sed -i.bak "s|SITE_URL=.*|SITE_URL=${NEW_APP_URL}|g" .env.monorepo

# Mettre à jour API_EXTERNAL_URL
sed -i.bak "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=${NEW_API_URL}|g" .env.monorepo

# Mettre à jour VITE_SUPABASE_URL
sed -i.bak "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=${NEW_API_URL}|g" .env.monorepo

# Mettre à jour GOTRUE_SITE_URL
sed -i.bak "s|GOTRUE_SITE_URL=.*|GOTRUE_SITE_URL=${NEW_APP_URL}|g" .env.monorepo

# Mettre à jour GOTRUE_URI_ALLOW_LIST
sed -i.bak "s|GOTRUE_URI_ALLOW_LIST=.*|GOTRUE_URI_ALLOW_LIST=${NEW_APP_URL}/*,${NEW_APP_URL}|g" .env.monorepo

# Mettre à jour les URLs de callback
sed -i.bak "s|GOTRUE_MAILER_URLPATHS_INVITE=.*|GOTRUE_MAILER_URLPATHS_INVITE=${NEW_APP_URL}/auth/callback|g" .env.monorepo
sed -i.bak "s|GOTRUE_MAILER_URLPATHS_CONFIRMATION=.*|GOTRUE_MAILER_URLPATHS_CONFIRMATION=${NEW_APP_URL}/auth/callback|g" .env.monorepo
sed -i.bak "s|GOTRUE_MAILER_URLPATHS_RECOVERY=.*|GOTRUE_MAILER_URLPATHS_RECOVERY=${NEW_APP_URL}/auth/reset|g" .env.monorepo
sed -i.bak "s|GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=.*|GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=${NEW_APP_URL}/auth/callback|g" .env.monorepo

print_success "Variables d'environnement mises à jour"

# Nettoyer les fichiers de backup de sed
rm -f .env.monorepo.bak

# Mettre à jour apps/web/.env si il existe
if [ -f "apps/web/.env" ]; then
    sed -i.bak "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=${NEW_API_URL}|g" apps/web/.env
    rm -f apps/web/.env.bak
    print_success "apps/web/.env mis à jour"
fi

# ========================================
# 6. AFFICHER LES NOUVELLES VALEURS
# ========================================
print_header "6️⃣  Nouvelle configuration"

echo ""
print_info "Nouvelles valeurs :"
grep -E "SITE_URL=|API_EXTERNAL_URL=|VITE_SUPABASE_URL=|GOTRUE_SITE_URL=|GOTRUE_URI_ALLOW_LIST=" .env.monorepo | grep -v "^#"

# ========================================
# 7. REDÉMARRER LES SERVICES D'AUTH
# ========================================
print_header "7️⃣  Redémarrage des services"

print_info "Arrêt des services d'authentification..."
docker compose -f docker-compose.monorepo.yml stop auth rest kong 2>/dev/null || true

print_info "Redémarrage avec la nouvelle configuration..."
docker compose -f docker-compose.monorepo.yml up -d auth rest kong

sleep 5

print_success "Services redémarrés"

# ========================================
# 8. REBUILD DE L'APPLICATION WEB
# ========================================
print_header "8️⃣  Rebuild de l'application Web"

print_warning "Ceci peut prendre quelques minutes..."

# Exporter les variables pour le build
export VITE_SUPABASE_URL="${NEW_API_URL}"
export API_EXTERNAL_URL="${NEW_API_URL}"

if docker compose -f docker-compose.monorepo.yml build \
  --build-arg VITE_SUPABASE_URL="${NEW_API_URL}" \
  --build-arg VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}" \
  web; then
    print_success "Build terminé"
else
    print_error "Erreur lors du build"
    exit 1
fi

print_info "Redémarrage de l'application..."
docker compose -f docker-compose.monorepo.yml up -d web

sleep 5
print_success "Application redémarrée"

# ========================================
# 9. TESTS DE L'AUTHENTIFICATION
# ========================================
print_header "9️⃣  Tests de connectivité"

sleep 3

test_auth_endpoint() {
    local url=$1
    local name=$2
    
    print_info "Test de $name..."
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$url" 2>/dev/null)
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
        print_success "$name : Accessible (HTTP $HTTP_CODE)"
        return 0
    else
        print_error "$name : Non accessible (HTTP $HTTP_CODE)"
        return 1
    fi
}

echo ""
test_auth_endpoint "${NEW_API_URL}/auth/v1/health" "API Auth Health"
test_auth_endpoint "${NEW_APP_URL}/" "Application Web"

# ========================================
# 10. VÉRIFIER LES LOGS D'AUTH
# ========================================
print_header "🔟 Vérification des logs d'authentification"

echo ""
print_info "Derniers logs du service auth (5 lignes) :"
docker compose -f docker-compose.monorepo.yml logs --tail=5 auth

echo ""
print_info "Recherche d'erreurs récentes :"
if docker compose -f docker-compose.monorepo.yml logs --tail=50 auth 2>&1 | grep -i "error\|fatal\|failed" | head -5; then
    print_warning "Erreurs trouvées ci-dessus"
else
    print_success "Aucune erreur récente détectée"
fi

# ========================================
# 11. RÉGÉNÉRATION DES CERTIFICATS SSL
# ========================================
print_header "🔐 Régénération des certificats SSL"

echo ""
print_info "Les certificats SSL auto-signés causent des erreurs dans le navigateur."
print_info "Voulez-vous installer des certificats Let's Encrypt valides ?"
echo ""
read -p "Installer Let's Encrypt maintenant ? [o/N] : " INSTALL_SSL

if [ "$INSTALL_SSL" = "o" ] || [ "$INSTALL_SSL" = "O" ] || [ "$INSTALL_SSL" = "oui" ]; then
    
    # Vérifier si certbot est installé
    if ! command -v certbot &> /dev/null; then
        print_info "Installation de Certbot..."
        
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y certbot python3-certbot-nginx
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y certbot python3-certbot-nginx
        elif command -v yum &> /dev/null; then
            sudo yum install -y certbot python3-certbot-nginx
        elif command -v pacman &> /dev/null; then
            sudo pacman -S --noconfirm certbot certbot-nginx
        else
            print_error "Impossible d'installer Certbot automatiquement"
            print_info "Installez-le manuellement puis relancez ce script"
            exit 1
        fi
        
        print_success "Certbot installé"
    else
        print_success "Certbot déjà installé"
    fi
    
    # Extraire le domaine sans protocole
    DOMAIN_ONLY=$(echo "$NEW_DOMAIN" | sed -e 's|^https\?://||' -e 's|/.*||')
    
    print_info "Configuration de Let's Encrypt pour : $DOMAIN_ONLY"
    
    # Déterminer les domaines à certifier selon le mode
    if [ "$USE_PORTS" = true ]; then
        # Mode ports : un seul domaine pour tous les services
        print_info "Mode ports détecté : certificat pour $DOMAIN_ONLY"
        
        # Arrêter Nginx temporairement pour certbot standalone
        print_info "Arrêt temporaire de Nginx..."
        sudo systemctl stop nginx
        
        # Obtenir le certificat
        if sudo certbot certonly --standalone \
            -d "$DOMAIN_ONLY" \
            --non-interactive \
            --agree-tos \
            --register-unsafely-without-email \
            --preferred-challenges http; then
            
            print_success "Certificat Let's Encrypt obtenu !"
            
            # Mettre à jour la configuration Nginx pour utiliser le nouveau certificat
            print_info "Mise à jour de la configuration Nginx..."
            sudo sed -i.bak \
                -e "s|ssl_certificate /etc/nginx/ssl/selfsigned.crt;|ssl_certificate /etc/letsencrypt/live/${DOMAIN_ONLY}/fullchain.pem;|g" \
                -e "s|ssl_certificate_key /etc/nginx/ssl/selfsigned.key;|ssl_certificate_key /etc/letsencrypt/live/${DOMAIN_ONLY}/privkey.pem;|g" \
                /etc/nginx/sites-available/antislash-talk-ssl
            
            print_success "Configuration Nginx mise à jour"
        else
            print_error "Échec de l'obtention du certificat"
            print_warning "Vérifiez que :"
            echo "  1. Le DNS pointe vers ce serveur"
            echo "  2. Les ports 80 et 443 sont ouverts"
            echo "  3. Aucun autre service n'utilise le port 80"
        fi
        
        # Redémarrer Nginx
        sudo systemctl start nginx
        
    else
        # Mode sous-domaines : certificats pour app, api, studio, ollama
        print_info "Mode sous-domaines détecté"
        
        # Extraire la base du domaine
        DOMAIN_BASE=$(echo "$DOMAIN_ONLY" | sed 's|^app\.||')
        
        print_info "Certificats pour :"
        echo "  - app.$DOMAIN_BASE"
        echo "  - api.$DOMAIN_BASE"
        echo "  - studio.$DOMAIN_BASE"
        echo "  - ollama.$DOMAIN_BASE"
        
        # Arrêter Nginx
        sudo systemctl stop nginx
        
        # Obtenir les certificats
        if sudo certbot certonly --standalone \
            -d "app.$DOMAIN_BASE" \
            -d "api.$DOMAIN_BASE" \
            -d "studio.$DOMAIN_BASE" \
            -d "ollama.$DOMAIN_BASE" \
            --non-interactive \
            --agree-tos \
            --register-unsafely-without-email \
            --preferred-challenges http; then
            
            print_success "Certificats Let's Encrypt obtenus !"
            
            # Mettre à jour Nginx pour chaque sous-domaine
            print_info "Mise à jour de la configuration Nginx..."
            sudo sed -i.bak \
                -e "s|ssl_certificate /etc/nginx/ssl/selfsigned.crt;|ssl_certificate /etc/letsencrypt/live/app.${DOMAIN_BASE}/fullchain.pem;|g" \
                -e "s|ssl_certificate_key /etc/nginx/ssl/selfsigned.key;|ssl_certificate_key /etc/letsencrypt/live/app.${DOMAIN_BASE}/privkey.pem;|g" \
                /etc/nginx/sites-available/antislash-talk-ssl
            
            print_success "Configuration Nginx mise à jour"
        else
            print_error "Échec de l'obtention des certificats"
            print_warning "Vérifiez que tous les sous-domaines DNS pointent vers ce serveur"
        fi
        
        # Redémarrer Nginx
        sudo systemctl start nginx
    fi
    
    # Tester la configuration Nginx
    if sudo nginx -t; then
        print_success "Configuration Nginx valide"
        sudo systemctl reload nginx
        print_success "Nginx rechargé avec les nouveaux certificats"
    else
        print_error "Erreur dans la configuration Nginx"
        print_warning "Restauration de la sauvegarde..."
        sudo cp /etc/nginx/sites-available/antislash-talk-ssl.bak /etc/nginx/sites-available/antislash-talk-ssl
        sudo systemctl start nginx
    fi
    
    # Configurer le renouvellement automatique
    print_info "Configuration du renouvellement automatique..."
    
    # Créer un hook de renouvellement pour recharger Nginx
    sudo mkdir -p /etc/letsencrypt/renewal-hooks/post
    sudo tee /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh > /dev/null << 'HOOK'
#!/bin/bash
systemctl reload nginx
HOOK
    sudo chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh
    
    # Tester le renouvellement
    print_info "Test du renouvellement automatique..."
    if sudo certbot renew --dry-run 2>&1 | grep -q "Congratulations"; then
        print_success "Renouvellement automatique configuré ✅"
        print_info "Les certificats seront renouvelés automatiquement avant expiration"
    else
        print_warning "Le test de renouvellement a rencontré des problèmes"
        print_info "Les certificats sont valides mais vérifiez manuellement avec :"
        echo "  sudo certbot renew --dry-run"
    fi
    
    # Afficher les informations des certificats
    echo ""
    print_info "Informations des certificats :"
    sudo certbot certificates 2>/dev/null | grep -E "Certificate Name|Expiry Date|Domains" || true
    
    echo ""
    print_success "Certificats SSL Let's Encrypt installés ! 🔐"
    print_info "Vos utilisateurs ne verront plus d'avertissement de sécurité"
    
else
    print_info "Installation SSL ignorée"
    print_warning "Vos utilisateurs verront des avertissements de sécurité avec les certificats auto-signés"
    echo ""
    print_info "Pour installer Let's Encrypt plus tard :"
    if [ "$USE_PORTS" = true ]; then
        DOMAIN_ONLY=$(echo "$NEW_DOMAIN" | sed -e 's|^https\?://||' -e 's|/.*||')
        echo "  sudo certbot --nginx -d $DOMAIN_ONLY"
    else
        DOMAIN_BASE=$(echo "$NEW_DOMAIN" | sed -e 's|^https\?://||' -e 's|/.*||' -e 's|^app\.||')
        echo "  sudo certbot --nginx -d app.$DOMAIN_BASE -d api.$DOMAIN_BASE -d studio.$DOMAIN_BASE -d ollama.$DOMAIN_BASE"
    fi
fi

# ========================================
# 12. INSTRUCTIONS FINALES
# ========================================
print_header "✅ CORRECTION TERMINÉE"

echo ""
print_success "Configuration mise à jour avec succès !"
echo ""
print_info "Étapes suivantes :"
echo ""
echo "1. 🧹 Videz le cache de votre navigateur :"
echo "   - Chrome/Edge : Ctrl+Shift+Delete"
echo "   - Firefox : Ctrl+Shift+Delete"
echo "   - Safari : Cmd+Option+E"
echo ""
echo "2. 🔄 Ou utilisez une fenêtre de navigation privée"
echo ""
echo "3. 🌐 Accédez à votre application :"
echo "   ${NEW_APP_URL}"
echo ""
echo "4. 🔐 Essayez de vous connecter"
echo ""

print_header "🔧 Commandes utiles pour déboguer"

echo ""
echo "# Voir les logs d'authentification en temps réel"
echo "docker compose -f docker-compose.monorepo.yml logs -f auth"
echo ""
echo "# Redémarrer tous les services"
echo "docker compose -f docker-compose.monorepo.yml restart"
echo ""
echo "# Vérifier que l'API Auth répond"
echo "curl -k ${NEW_API_URL}/auth/v1/health"
echo ""
echo "# Restaurer la configuration précédente si problème"
echo "cp $BACKUP_FILE .env.monorepo"
echo "docker compose -f docker-compose.monorepo.yml restart"
echo ""

print_header "📝 Informations de connexion"

echo ""
print_info "Si vous n'arrivez toujours pas à vous connecter :"
echo ""
echo "1. Vérifiez que l'utilisateur existe dans la base de données :"
echo "   docker exec -it antislash-talk-db psql -U supabase_admin postgres -c \"SELECT email FROM auth.users;\""
echo ""
echo "2. Réinitialisez le mot de passe d'un utilisateur existant via Studio :"
echo "   ${NEW_APP_URL}:8444"
echo ""
echo "3. Créez un nouvel utilisateur via l'interface d'inscription :"
echo "   ${NEW_APP_URL}/auth/register"
echo ""

# ========================================
# 12. PROBLÈMES COURANTS
# ========================================
print_header "🔧 Résolution des problèmes courants"

echo ""
echo "❌ Erreur 'Invalid login credentials' ?"
echo "   → Videz le cache du navigateur"
echo "   → Vérifiez que GOTRUE_SITE_URL est correct"
echo "   → Essayez en navigation privée"
echo ""
echo "❌ Redirection vers mauvaise URL ?"
echo "   → Vérifiez SITE_URL et GOTRUE_URI_ALLOW_LIST"
echo "   → Rebuild l'app : docker compose build web"
echo ""
echo "❌ CORS errors ?"
echo "   → Vérifiez que GOTRUE_URI_ALLOW_LIST contient votre domaine"
echo "   → Redémarrez auth : docker compose restart auth"
echo ""
echo "❌ Cookies non sauvegardés ?"
echo "   → Utilisez HTTPS (pas HTTP)"
echo "   → Vérifiez que le domaine DNS est correct"
echo ""

print_success "Script terminé ! Testez votre connexion maintenant 🎉"

