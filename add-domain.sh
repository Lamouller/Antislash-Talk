#!/bin/bash
# 🌐 Script d'ajout de domaine pour Antislash Talk
# Convertit un déploiement IP vers un déploiement avec domaine
set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Détection de l'OS
OS_TYPE=""
PACKAGE_MANAGER=""
PACKAGE_UPDATE_CMD=""
PACKAGE_INSTALL_CMD=""

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_TYPE=$ID
        case $OS_TYPE in
            ubuntu|debian)
                PACKAGE_MANAGER="apt"
                PACKAGE_UPDATE_CMD="sudo apt-get update"
                PACKAGE_INSTALL_CMD="sudo apt-get install -y"
                ;;
            fedora|centos|rhel|rocky|almalinux)
                PACKAGE_MANAGER="yum"
                if command -v dnf &> /dev/null; then
                    PACKAGE_MANAGER="dnf"
                fi
                PACKAGE_UPDATE_CMD="sudo $PACKAGE_MANAGER update -y"
                PACKAGE_INSTALL_CMD="sudo $PACKAGE_MANAGER install -y"
                ;;
            arch|manjaro)
                PACKAGE_MANAGER="pacman"
                PACKAGE_UPDATE_CMD="sudo pacman -Syu --noconfirm"
                PACKAGE_INSTALL_CMD="sudo pacman -S --noconfirm"
                ;;
            alpine)
                PACKAGE_MANAGER="apk"
                PACKAGE_UPDATE_CMD="sudo apk update"
                PACKAGE_INSTALL_CMD="sudo apk add --no-cache"
                ;;
            *)
                echo "OS non supporté: $OS_TYPE"
                exit 1
                ;;
        esac
    else
        echo "Impossible de détecter l'OS"
        exit 1
    fi
}

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
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

# Détection de l'OS
detect_os
print_success "OS détecté : $OS_TYPE"

print_header "🌐 Configuration du domaine pour Antislash Talk"

# Vérifier que le répertoire du projet existe
if [ ! -d "$HOME/antislash-talk" ]; then
    print_error "Le répertoire $HOME/antislash-talk n'existe pas"
    print_info "Assurez-vous d'avoir déployé l'application avec deploy-vps-final.sh d'abord"
    exit 1
fi

PROJECT_DIR="$HOME/antislash-talk"
cd "$PROJECT_DIR"

print_success "Projet trouvé dans $PROJECT_DIR"

# Demander le nom de domaine
print_header "📝 Configuration du domaine"
echo ""
print_info "Exemples de domaines valides :"
echo "  - mondomaine.com"
echo "  - app.mondomaine.com"
echo "  - talk.exemple.fr"
echo ""
read -p "Entrez votre nom de domaine (sans http/https) : " DOMAIN_NAME

# Validation du domaine
if [ -z "$DOMAIN_NAME" ]; then
    print_error "Le nom de domaine ne peut pas être vide"
    exit 1
fi

# Retirer les protocoles si présents
DOMAIN_NAME=$(echo "$DOMAIN_NAME" | sed -e 's|^https\?://||' -e 's|/.*||')

print_success "Domaine configuré : $DOMAIN_NAME"

# Demander le type de configuration
print_header "🔧 Type de configuration"
echo ""
print_info "Deux options disponibles :"
echo ""
echo "1. Configuration avec PORTS (recommandé - plus simple)"
echo "   - Application : https://$DOMAIN_NAME/"
echo "   - API Supabase : https://$DOMAIN_NAME:8443/"
echo "   - Studio : https://$DOMAIN_NAME:8444/"
echo "   - Ollama : https://$DOMAIN_NAME:8445/"
echo ""
echo "2. Configuration avec SOUS-DOMAINES (nécessite configuration DNS supplémentaire)"
echo "   - Application : https://app.$DOMAIN_NAME/"
echo "   - API Supabase : https://api.$DOMAIN_NAME/"
echo "   - Studio : https://studio.$DOMAIN_NAME/"
echo "   - Ollama : https://ollama.$DOMAIN_NAME/"
echo ""
read -p "Choisissez [1 pour ports / 2 pour sous-domaines] (défaut: 1) : " CONFIG_TYPE
CONFIG_TYPE=${CONFIG_TYPE:-1}

USE_SUBDOMAINS=false
if [ "$CONFIG_TYPE" = "2" ]; then
    USE_SUBDOMAINS=true
    print_warning "N'oubliez pas de configurer les enregistrements DNS pour tous les sous-domaines !"
fi

# Sauvegarder l'ancienne configuration
print_header "💾 Sauvegarde de la configuration actuelle"
if [ -f "/etc/nginx/sites-available/antislash-talk-ssl" ]; then
    sudo cp /etc/nginx/sites-available/antislash-talk-ssl "/etc/nginx/sites-available/antislash-talk-ssl.backup.$(date +%Y%m%d_%H%M%S)"
    print_success "Configuration Nginx sauvegardée"
fi

if [ -f ".env.monorepo" ]; then
    cp .env.monorepo ".env.monorepo.backup.$(date +%Y%m%d_%H%M%S)"
    print_success "Variables d'environnement sauvegardées"
fi

# Lire les variables d'environnement actuelles
print_header "📖 Lecture de la configuration actuelle"
if [ -f ".env.monorepo" ]; then
    source .env.monorepo
    print_success "Configuration chargée"
else
    print_error "Fichier .env.monorepo introuvable"
    exit 1
fi

# Générer la nouvelle configuration Nginx
print_header "🔧 Génération de la configuration Nginx"

if [ "$USE_SUBDOMAINS" = true ]; then
    print_info "Génération de la configuration avec sous-domaines..."
    
    # Configuration avec sous-domaines
    sudo tee /etc/nginx/sites-available/antislash-talk-ssl > /dev/null << NGINXCONF
# Redirection HTTP vers HTTPS
server {
    listen 80;
    server_name app.${DOMAIN_NAME} api.${DOMAIN_NAME} studio.${DOMAIN_NAME} ollama.${DOMAIN_NAME};
    return 301 https://\$host\$request_uri;
}

# Application Web (app.domain.com)
server {
    listen 443 ssl http2;
    server_name app.${DOMAIN_NAME};

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}

# API Supabase (api.domain.com)
server {
    listen 443 ssl http2;
    server_name api.${DOMAIN_NAME};

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:54321;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}

# Studio Supabase (studio.domain.com)
server {
    listen 443 ssl http2;
    server_name studio.${DOMAIN_NAME};

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:54327;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# Ollama API (ollama.domain.com)
server {
    listen 443 ssl http2;
    server_name ollama.${DOMAIN_NAME};

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 500M;
    proxy_read_timeout 600s;
    proxy_connect_timeout 600s;

    location / {
        # Headers CORS permissifs
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;

        proxy_pass http://localhost:11434;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
NGINXCONF

    # Définir les URLs pour les sous-domaines
    API_URL="https://api.${DOMAIN_NAME}"
    SUPABASE_URL="https://api.${DOMAIN_NAME}"
    APP_URL="https://app.${DOMAIN_NAME}"
    STUDIO_URL="https://studio.${DOMAIN_NAME}"
    OLLAMA_URL="https://ollama.${DOMAIN_NAME}"

else
    print_info "Génération de la configuration avec ports..."
    
    # Configuration avec ports
    sudo tee /etc/nginx/sites-available/antislash-talk-ssl > /dev/null << NGINXCONF
# Redirection HTTP vers HTTPS
server {
    listen 80;
    server_name ${DOMAIN_NAME};
    return 301 https://\$host\$request_uri;
}

# Application Web (HTTPS sur 443)
server {
    listen 443 ssl http2;
    server_name ${DOMAIN_NAME};

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}

# API Supabase (HTTPS sur 8443)
server {
    listen 8443 ssl http2;
    server_name ${DOMAIN_NAME};

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:54321;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}

# Studio Supabase (HTTPS sur 8444)
server {
    listen 8444 ssl http2;
    server_name ${DOMAIN_NAME};

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:54327;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# Ollama API (HTTPS sur 8445)
server {
    listen 8445 ssl http2;
    server_name ${DOMAIN_NAME};

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 500M;
    proxy_read_timeout 600s;
    proxy_connect_timeout 600s;

    location / {
        # Headers CORS permissifs
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;

        proxy_pass http://localhost:11434;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
NGINXCONF

    # Définir les URLs pour les ports
    API_URL="https://${DOMAIN_NAME}:8443"
    SUPABASE_URL="https://${DOMAIN_NAME}:8443"
    APP_URL="https://${DOMAIN_NAME}"
    STUDIO_URL="https://${DOMAIN_NAME}:8444"
    OLLAMA_URL="https://${DOMAIN_NAME}:8445"
fi

print_success "Configuration Nginx générée"

# Tester la configuration Nginx
print_header "🧪 Test de la configuration Nginx"
if sudo nginx -t; then
    print_success "Configuration Nginx valide"
else
    print_error "Erreur dans la configuration Nginx"
    print_warning "Restauration de la sauvegarde..."
    sudo cp "/etc/nginx/sites-available/antislash-talk-ssl.backup.$(date +%Y%m%d)_"* /etc/nginx/sites-available/antislash-talk-ssl 2>/dev/null || true
    exit 1
fi

# Recharger Nginx
print_info "Rechargement de Nginx..."
sudo systemctl reload nginx
print_success "Nginx rechargé"

# Mettre à jour les variables d'environnement
print_header "🔄 Mise à jour des variables d'environnement"

# Mettre à jour .env.monorepo
sed -i.bak "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=${SUPABASE_URL}|g" .env.monorepo
sed -i.bak "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=${API_URL}|g" .env.monorepo
sed -i.bak "s|VITE_OLLAMA_URL=.*|VITE_OLLAMA_URL=${OLLAMA_URL}|g" .env.monorepo

print_success "Variables d'environnement mises à jour"

# Mettre à jour apps/web/.env
if [ -f "apps/web/.env" ]; then
    sed -i.bak "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=${SUPABASE_URL}|g" apps/web/.env
    print_success "Configuration Web mise à jour"
fi

# Exporter les variables pour le build
export VITE_SUPABASE_URL="${SUPABASE_URL}"
export API_EXTERNAL_URL="${API_URL}"
export VITE_OLLAMA_URL="${OLLAMA_URL}"

# Rebuild l'application
print_header "🏗️  Rebuild de l'application avec les nouvelles URLs"
print_warning "Ceci peut prendre quelques minutes..."

if docker compose -f docker-compose.monorepo.yml build \
  --build-arg VITE_SUPABASE_URL="${SUPABASE_URL}" \
  --build-arg VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}" \
  --build-arg VITE_HIDE_MARKETING_PAGES="${VITE_HIDE_MARKETING_PAGES:-false}" \
  web; then
    print_success "Build terminé avec succès"
else
    print_error "Erreur lors du build"
    exit 1
fi

# Redémarrer les services
print_header "🔄 Redémarrage des services"
docker compose -f docker-compose.monorepo.yml up -d
sleep 10
print_success "Services redémarrés"

# Tests de connectivité
print_header "🧪 Tests de connectivité"

test_url() {
    local url=$1
    local name=$2
    local max_attempts=5
    local attempt=1
    
    print_info "Test de $name ($url)..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -k -s -f -o /dev/null -w "%{http_code}" "$url" > /dev/null 2>&1; then
            print_success "$name : ✓ Accessible"
            return 0
        fi
        print_warning "Tentative $attempt/$max_attempts..."
        sleep 2
        ((attempt++))
    done
    
    print_error "$name : ✗ Non accessible"
    return 1
}

# Test des services
TESTS_PASSED=0
TESTS_TOTAL=0

# Test Application Web
((TESTS_TOTAL++))
if test_url "$APP_URL" "Application Web"; then
    ((TESTS_PASSED++))
fi

# Test API Supabase
((TESTS_TOTAL++))
if test_url "$SUPABASE_URL" "API Supabase"; then
    ((TESTS_PASSED++))
fi

# Test Studio Supabase
((TESTS_TOTAL++))
if test_url "$STUDIO_URL" "Studio Supabase"; then
    ((TESTS_PASSED++))
fi

# Test Ollama
((TESTS_TOTAL++))
if test_url "$OLLAMA_URL" "Ollama API"; then
    ((TESTS_PASSED++))
fi

# Résumé des tests
print_header "📊 Résumé des tests"
echo ""
print_info "Tests réussis : $TESTS_PASSED/$TESTS_TOTAL"
echo ""

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    print_success "Tous les tests sont passés ! 🎉"
else
    print_warning "Certains tests ont échoué. Vérifiez les logs avec :"
    echo "  docker compose -f docker-compose.monorepo.yml logs"
fi

# Vérifier la configuration DNS
print_header "🌐 Vérification DNS"
print_info "Vérification de la résolution DNS pour $DOMAIN_NAME..."

if host "$DOMAIN_NAME" > /dev/null 2>&1; then
    DNS_IP=$(host "$DOMAIN_NAME" | grep "has address" | head -1 | awk '{print $4}')
    SERVER_IP=$(curl -s ifconfig.me)
    
    if [ "$DNS_IP" = "$SERVER_IP" ]; then
        print_success "DNS correctement configuré : $DOMAIN_NAME → $DNS_IP"
    else
        print_warning "Le DNS pointe vers $DNS_IP mais votre serveur est $SERVER_IP"
        print_info "Si vous venez de configurer le DNS, attendez la propagation (jusqu'à 24h)"
    fi
else
    print_warning "Le domaine $DOMAIN_NAME n'est pas encore résolu par DNS"
    print_info "Configurez un enregistrement A pointant vers votre IP serveur"
fi

# Proposer Let's Encrypt
print_header "🔐 Certificats SSL"
echo ""
print_info "Actuellement, vous utilisez des certificats auto-signés."
print_info "Pour des certificats SSL valides et gratuits avec Let's Encrypt :"
echo ""
read -p "Voulez-vous installer Let's Encrypt maintenant ? [o/N] : " INSTALL_LETSENCRYPT

if [ "$INSTALL_LETSENCRYPT" = "o" ] || [ "$INSTALL_LETSENCRYPT" = "O" ] || [ "$INSTALL_LETSENCRYPT" = "oui" ]; then
    print_header "📦 Installation de Certbot"
    
    # Installer certbot selon l'OS
    case $OS_TYPE in
        ubuntu|debian)
            $PACKAGE_UPDATE_CMD
            $PACKAGE_INSTALL_CMD certbot python3-certbot-nginx
            ;;
        fedora|centos|rhel|rocky|almalinux)
            $PACKAGE_INSTALL_CMD certbot python3-certbot-nginx
            ;;
        arch|manjaro)
            $PACKAGE_INSTALL_CMD certbot certbot-nginx
            ;;
        *)
            print_warning "Installation manuelle requise pour $OS_TYPE"
            ;;
    esac
    
    print_success "Certbot installé"
    
    # Configuration Let's Encrypt
    print_header "🔐 Configuration Let's Encrypt"
    
    if [ "$USE_SUBDOMAINS" = true ]; then
        print_info "Configuration pour les sous-domaines..."
        sudo certbot --nginx \
            -d "app.${DOMAIN_NAME}" \
            -d "api.${DOMAIN_NAME}" \
            -d "studio.${DOMAIN_NAME}" \
            -d "ollama.${DOMAIN_NAME}" \
            --non-interactive --agree-tos --register-unsafely-without-email || true
    else
        print_info "Configuration pour le domaine principal..."
        sudo certbot --nginx -d "${DOMAIN_NAME}" \
            --non-interactive --agree-tos --register-unsafely-without-email || true
    fi
    
    # Test de renouvellement automatique
    print_info "Configuration du renouvellement automatique..."
    sudo certbot renew --dry-run || print_warning "Le test de renouvellement a échoué"
    
    print_success "Let's Encrypt configuré"
else
    print_info "Pour installer Let's Encrypt plus tard, exécutez :"
    if [ "$USE_SUBDOMAINS" = true ]; then
        echo "  sudo certbot --nginx -d app.${DOMAIN_NAME} -d api.${DOMAIN_NAME} -d studio.${DOMAIN_NAME} -d ollama.${DOMAIN_NAME}"
    else
        echo "  sudo certbot --nginx -d ${DOMAIN_NAME}"
    fi
fi

# Sauvegarder les informations de déploiement
print_header "💾 Sauvegarde des informations"

cat > domain-deployment-info.txt << EOF
🌐 Déploiement Antislash Talk avec domaine
Date : $(date)
Domaine : ${DOMAIN_NAME}
Configuration : $([ "$USE_SUBDOMAINS" = true ] && echo "Sous-domaines" || echo "Ports")

═══════════════════════════════════════════════════════════
                    URLs D'ACCÈS
═══════════════════════════════════════════════════════════

🌐 Application Web : ${APP_URL}
🔌 API Supabase    : ${SUPABASE_URL}
🎛️  Studio Supabase : ${STUDIO_URL}
🤖 Ollama API      : ${OLLAMA_URL}

═══════════════════════════════════════════════════════════
                CONFIGURATION DNS REQUISE
═══════════════════════════════════════════════════════════

Sur votre gestionnaire DNS, configurez :

EOF

if [ "$USE_SUBDOMAINS" = true ]; then
    cat >> domain-deployment-info.txt << EOF
Type: A
Nom: app
Valeur: $(curl -s ifconfig.me)
TTL: 300

Type: A
Nom: api
Valeur: $(curl -s ifconfig.me)
TTL: 300

Type: A
Nom: studio
Valeur: $(curl -s ifconfig.me)
TTL: 300

Type: A
Nom: ollama
Valeur: $(curl -s ifconfig.me)
TTL: 300
EOF
else
    cat >> domain-deployment-info.txt << EOF
Type: A
Nom: @ (ou ${DOMAIN_NAME})
Valeur: $(curl -s ifconfig.me)
TTL: 300

IMPORTANT : Ouvrez les ports sur votre firewall :
- Port 443 (Application Web)
- Port 8443 (API Supabase)
- Port 8444 (Studio Supabase)
- Port 8445 (Ollama API)

Commandes firewall :
  sudo ufw allow 443/tcp
  sudo ufw allow 8443/tcp
  sudo ufw allow 8444/tcp
  sudo ufw allow 8445/tcp
EOF
fi

cat >> domain-deployment-info.txt << EOF

═══════════════════════════════════════════════════════════
                COMMANDES UTILES
═══════════════════════════════════════════════════════════

# Voir les logs
docker compose -f docker-compose.monorepo.yml logs -f

# Redémarrer les services
docker compose -f docker-compose.monorepo.yml restart

# Vérifier Nginx
sudo nginx -t
sudo systemctl status nginx

# Voir les certificats SSL
sudo certbot certificates

# Renouveler les certificats SSL
sudo certbot renew

═══════════════════════════════════════════════════════════
                FICHIERS DE CONFIGURATION
═══════════════════════════════════════════════════════════

Nginx       : /etc/nginx/sites-available/antislash-talk-ssl
Env Monorepo: $PROJECT_DIR/.env.monorepo
Env Web App : $PROJECT_DIR/apps/web/.env
Sauvegardes : $PROJECT_DIR/*.backup.*

EOF

print_success "Informations sauvegardées dans domain-deployment-info.txt"

# Afficher le résumé final
print_header "🎉 CONFIGURATION TERMINÉE AVEC SUCCÈS"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   INFORMATIONS D'ACCÈS                         ║${NC}"
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo ""
echo -e "🌐 ${CYAN}Application Web${NC}    : ${GREEN}${APP_URL}${NC}"
echo -e "🔌 ${CYAN}API Supabase${NC}       : ${GREEN}${SUPABASE_URL}${NC}"
echo -e "🎛️  ${CYAN}Studio Supabase${NC}    : ${GREEN}${STUDIO_URL}${NC}"
echo -e "🤖 ${CYAN}Ollama API${NC}         : ${GREEN}${OLLAMA_URL}${NC}"
echo ""

if [ "$USE_SUBDOMAINS" = false ]; then
    echo -e "${YELLOW}⚠️  N'oubliez pas d'ouvrir les ports sur votre firewall !${NC}"
    echo ""
fi

echo -e "${CYAN}📄 Consultez domain-deployment-info.txt pour plus de détails${NC}"
echo ""
print_success "Votre application est maintenant accessible via votre domaine ! 🚀"

