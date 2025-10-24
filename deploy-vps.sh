#!/bin/bash

# 🎙️ Antislash Talk - Script de Déploiement VPS Automatisé
# Ce script configure et déploie automatiquement l'application sur un VPS

set -e  # Arrêter en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions utilitaires
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}    $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Générer un mot de passe sécurisé
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Générer un JWT secret
generate_jwt_secret() {
    openssl rand -base64 45 | tr -d "=+/" | cut -c1-45
}

# Vérifier les prérequis
check_prerequisites() {
    print_header "Vérification des prérequis"
    
    # Docker
    if command -v docker &> /dev/null; then
        print_success "Docker installé : $(docker --version)"
    else
        print_error "Docker n'est pas installé"
        echo "Installation de Docker..."
        curl -fsSL https://get.docker.com | sudo sh
        sudo usermod -aG docker $USER
        print_warning "Docker installé. Veuillez vous reconnecter pour appliquer les permissions."
    fi
    
    # Docker Compose
    if docker compose version &> /dev/null; then
        print_success "Docker Compose installé : $(docker compose version)"
    else
        print_error "Docker Compose n'est pas installé"
        echo "Installation de Docker Compose..."
        sudo apt-get update
        sudo apt-get install -y docker-compose-plugin
    fi
    
    # Git
    if command -v git &> /dev/null; then
        print_success "Git installé : $(git --version)"
    else
        print_error "Git n'est pas installé"
        sudo apt-get update
        sudo apt-get install -y git
    fi
    
    # OpenSSL (pour générer les secrets)
    if command -v openssl &> /dev/null; then
        print_success "OpenSSL installé"
    else
        print_error "OpenSSL n'est pas installé"
        sudo apt-get update
        sudo apt-get install -y openssl
    fi
}

# Configuration interactive
configure_deployment() {
    print_header "Configuration du déploiement"
    
    # Demander le domaine ou IP
    echo -e "${YELLOW}Entrez votre domaine ou l'IP du VPS${NC}"
    echo -e "${YELLOW}(ex: talk.mondomaine.com ou 185.123.45.67)${NC}"
    read -p "URL/IP : " DOMAIN_OR_IP
    
    if [ -z "$DOMAIN_OR_IP" ]; then
        print_error "URL/IP requise"
        exit 1
    fi
    
    # Déterminer le protocole
    if [[ $DOMAIN_OR_IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        # C'est une IP
        PROTOCOL="http"
        print_warning "IP détectée - utilisation de HTTP (pas de SSL)"
    else
        # C'est un domaine
        echo -e "\n${YELLOW}Voulez-vous configurer HTTPS/SSL ? (recommandé)${NC}"
        read -p "Configurer SSL [O/n] : " CONFIGURE_SSL
        if [[ "$CONFIGURE_SSL" =~ ^[Nn]$ ]]; then
            PROTOCOL="http"
        else
            PROTOCOL="https"
        fi
    fi
    
    # Choix du mode de déploiement
    echo -e "\n${YELLOW}Mode de déploiement :${NC}"
    echo "1) Léger (sans PyTorch) - Recommandé pour débuter"
    echo "2) Complet (avec PyTorch) - Pour modèles IA lourds"
    read -p "Votre choix [1/2] : " DEPLOY_MODE
    
    if [ "$DEPLOY_MODE" == "2" ]; then
        WITH_PYTORCH=true
        print_warning "Mode complet sélectionné - Nécessite 8GB+ RAM"
    else
        WITH_PYTORCH=false
        print_success "Mode léger sélectionné - 4GB RAM suffisants"
    fi
    
    # Port de l'application
    echo -e "\n${YELLOW}Port de l'application web (défaut: 3000) :${NC}"
    read -p "Port [3000] : " WEB_PORT
    WEB_PORT=${WEB_PORT:-3000}
    
    # Générer les secrets
    print_header "Génération des secrets sécurisés"
    
    POSTGRES_PASSWORD=$(generate_password)
    print_success "Mot de passe PostgreSQL généré"
    
    JWT_SECRET=$(generate_jwt_secret)
    print_success "JWT Secret généré"
    
    # Générer les clés Supabase
    print_warning "Génération des clés Supabase..."
    
    # Vérifier si Node.js est installé
    if ! command -v node &> /dev/null; then
        print_warning "Node.js n'est pas installé. Installation..."
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Générer les clés temporairement (seront régénérées après le clone du projet)
    ANON_KEY="temp_key"
    SERVICE_ROLE_KEY="temp_key"
    
    # URLs
    SITE_URL="${PROTOCOL}://${DOMAIN_OR_IP}:${WEB_PORT}"
    API_EXTERNAL_URL="${PROTOCOL}://${DOMAIN_OR_IP}:54321"
    
    # Afficher le récapitulatif
    print_header "Récapitulatif de la configuration"
    echo -e "${GREEN}Domaine/IP :${NC} $DOMAIN_OR_IP"
    echo -e "${GREEN}Protocole :${NC} $PROTOCOL"
    echo -e "${GREEN}Port Web :${NC} $WEB_PORT"
    echo -e "${GREEN}Mode :${NC} $([ "$WITH_PYTORCH" == true ] && echo "Complet avec PyTorch" || echo "Léger sans PyTorch")"
    echo -e "${GREEN}Site URL :${NC} $SITE_URL"
    echo -e "${GREEN}API URL :${NC} $API_EXTERNAL_URL"
    echo -e "\n${YELLOW}Les mots de passe ont été générés automatiquement${NC}"
    
    echo -e "\n${YELLOW}Confirmer et continuer ? [O/n]${NC}"
    read -p "Continuer : " CONFIRM
    if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
        print_error "Déploiement annulé"
        exit 1
    fi
}

# Cloner ou mettre à jour le projet
setup_project() {
    print_header "Installation du projet"
    
    PROJECT_DIR="$HOME/antislash-talk"
    
    if [ -d "$PROJECT_DIR" ]; then
        print_warning "Le projet existe déjà dans $PROJECT_DIR"
        echo "Mettre à jour depuis GitHub ?"
        read -p "Mettre à jour [O/n] : " UPDATE
        if [[ ! "$UPDATE" =~ ^[Nn]$ ]]; then
            cd "$PROJECT_DIR"
            git pull origin main
            print_success "Projet mis à jour"
        fi
    else
        print_success "Clonage du projet..."
        git clone https://github.com/Lamouller/Antislash-Talk.git "$PROJECT_DIR"
        cd "$PROJECT_DIR"
        print_success "Projet cloné dans $PROJECT_DIR"
    fi
}

# Créer le fichier .env.monorepo
create_env_file() {
    print_header "Création du fichier de configuration"
    
    cd "$PROJECT_DIR"
    
    # Régénérer les clés Supabase avec le script du projet
    if [ -f "generate-supabase-keys.js" ]; then
        print_success "Génération des clés Supabase avec le JWT_SECRET..."
        KEYS_OUTPUT=$(node generate-supabase-keys.js "$JWT_SECRET" | grep "=")
        ANON_KEY=$(echo "$KEYS_OUTPUT" | grep "ANON_KEY=" | cut -d'=' -f2)
        SERVICE_ROLE_KEY=$(echo "$KEYS_OUTPUT" | grep "SERVICE_ROLE_KEY=" | cut -d'=' -f2)
        print_success "Clés Supabase générées correctement"
    fi
    
    # Backup si existe déjà
    if [ -f ".env.monorepo" ]; then
        cp .env.monorepo .env.monorepo.backup.$(date +%Y%m%d_%H%M%S)
        print_warning "Sauvegarde de l'ancien .env.monorepo créée"
    fi
    
    # Créer le nouveau fichier
    cat > .env.monorepo << EOF
# 🎙️ Antislash Talk Monorepo - Configuration Automatique
# Généré le $(date)

# Database
POSTGRES_DB=postgres
POSTGRES_PORT=5432
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=3600

# API Keys (générées automatiquement)
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

# URLs
SITE_URL=${SITE_URL}
API_EXTERNAL_URL=${API_EXTERNAL_URL}
SUPABASE_PUBLIC_URL=${API_EXTERNAL_URL}

# Services URLs
KONG_URL=http://localhost:54321
META_URL=http://localhost:54323
STUDIO_URL=http://localhost:54324
INBUCKET_URL=http://localhost:54325
JUPYTER_URL=http://localhost:54326
POSTGRES_URL=postgresql://postgres:${POSTGRES_PASSWORD}@localhost:5432/postgres

# Email (local testing)
SMTP_HOST=localhost
SMTP_PORT=54325
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=Antislash Talk

# App Configuration
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_ANONYMOUS_SIGN_INS=false
ADDITIONAL_REDIRECT_URLS=
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL=${API_EXTERNAL_URL}
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

# Storage
STORAGE_BACKEND=file
STORAGE_FILE_BACKEND_PATH=/var/lib/storage
ENABLE_IMAGE_TRANSFORMATION=true
IMGPROXY_URL=http://imgproxy:5001

# Ports Configuration
POSTGRES_PORT=5432
KONG_HTTP_PORT=54321
KONG_HTTPS_PORT=54322
META_PORT=54323
STUDIO_PORT=54324
INBUCKET_PORT=54325
JUPYTER_PORT=54326

# Web Application
WEB_PORT=${WEB_PORT}
NODE_ENV=production

# PyTorch Service (optionnel)
PYTORCH_PORT=8000
WHISPERX_PORT=8001
OLLAMA_PORT=11434

# Feature Flags
ENABLE_PYTORCH=$([ "$WITH_PYTORCH" == true ] && echo "true" || echo "false")
ENABLE_WHISPERX=false
ENABLE_OLLAMA=false

# Monitoring
LOGFLARE_API_KEY=your-logflare-key
LOGFLARE_URL=https://api.logflare.io
EOF

    print_success "Fichier .env.monorepo créé"
    
    # Créer aussi un fichier avec les infos importantes
    cat > deployment-info.txt << EOF
🎙️ INFORMATIONS DE DÉPLOIEMENT - ANTISLASH TALK
================================================

Date : $(date)
Serveur : ${DOMAIN_OR_IP}

URLS D'ACCÈS :
--------------
Application Web : ${SITE_URL}
API Supabase : ${API_EXTERNAL_URL}
Studio Supabase : ${PROTOCOL}://${DOMAIN_OR_IP}:54324

CREDENTIALS :
-------------
PostgreSQL Password : ${POSTGRES_PASSWORD}
JWT Secret : ${JWT_SECRET}

CONNEXION BASE DE DONNÉES :
--------------------------
Host : localhost
Port : 5432
Database : postgres
User : postgres
Password : ${POSTGRES_PASSWORD}

COMMANDES UTILES :
-----------------
Voir les logs : docker compose -f docker-compose.monorepo.yml logs -f
Redémarrer : docker compose -f docker-compose.monorepo.yml restart
Arrêter : docker compose -f docker-compose.monorepo.yml down
Stats : docker stats

⚠️  IMPORTANT : Conservez ce fichier en lieu sûr !
EOF

    chmod 600 deployment-info.txt
    print_success "Informations de déploiement sauvegardées dans deployment-info.txt"
}

# Démarrer les services Docker
start_services() {
    print_header "Démarrage des services Docker"
    
    cd "$PROJECT_DIR"
    
    # Arrêter les services existants
    if docker compose -f docker-compose.monorepo.yml ps -q 2>/dev/null; then
        print_warning "Arrêt des services existants..."
        docker compose -f docker-compose.monorepo.yml down
    fi
    
    # Nettoyer les volumes si demandé
    echo -e "\n${YELLOW}Voulez-vous réinitialiser la base de données ? [o/N]${NC}"
    read -p "Réinitialiser : " RESET_DB
    if [[ "$RESET_DB" =~ ^[Oo]$ ]]; then
        docker compose -f docker-compose.monorepo.yml down -v
        print_warning "Volumes supprimés"
    fi
    
    # Build les images
    print_success "Construction des images Docker..."
    if [ "$WITH_PYTORCH" == true ]; then
        docker compose -f docker-compose.monorepo.yml --profile pytorch build
    else
        docker compose -f docker-compose.monorepo.yml build
    fi
    
    # Démarrer les services
    print_success "Démarrage des services..."
    if [ "$WITH_PYTORCH" == true ]; then
        docker compose -f docker-compose.monorepo.yml --profile pytorch up -d
    else
        docker compose -f docker-compose.monorepo.yml up -d
    fi
    
    # Attendre que les services soient prêts
    print_success "Attente du démarrage des services..."
    sleep 30
    
    # Vérifier l'état
    docker compose -f docker-compose.monorepo.yml ps
}

# Configuration du firewall
setup_firewall() {
    print_header "Configuration du firewall"
    
    if command -v ufw &> /dev/null; then
        print_success "Configuration UFW..."
        sudo ufw allow 22/tcp comment 'SSH'
        sudo ufw allow ${WEB_PORT}/tcp comment 'Antislash Talk Web'
        sudo ufw allow 54321/tcp comment 'Supabase API'
        sudo ufw allow 54324/tcp comment 'Supabase Studio'
        
        if [ "$PROTOCOL" == "https" ]; then
            sudo ufw allow 80/tcp comment 'HTTP'
            sudo ufw allow 443/tcp comment 'HTTPS'
        fi
        
        echo -e "\n${YELLOW}Activer le firewall UFW ? [o/N]${NC}"
        read -p "Activer UFW : " ENABLE_UFW
        if [[ "$ENABLE_UFW" =~ ^[Oo]$ ]]; then
            sudo ufw --force enable
            print_success "Firewall UFW activé"
        fi
    else
        print_warning "UFW non installé - Configuration manuelle du firewall requise"
    fi
}

# Configuration Nginx (optionnel)
setup_nginx() {
    if [ "$PROTOCOL" == "https" ] || [[ ! $DOMAIN_OR_IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_header "Configuration Nginx (optionnel)"
        
        echo -e "${YELLOW}Voulez-vous configurer Nginx comme reverse proxy ? [o/N]${NC}"
        read -p "Configurer Nginx : " SETUP_NGINX
        
        if [[ "$SETUP_NGINX" =~ ^[Oo]$ ]]; then
            # Installer Nginx si nécessaire
            if ! command -v nginx &> /dev/null; then
                sudo apt-get update
                sudo apt-get install -y nginx
            fi
            
            # Créer la configuration
            sudo tee /etc/nginx/sites-available/antislash-talk > /dev/null << EOF
server {
    listen 80;
    server_name ${DOMAIN_OR_IP};

    # Application Web
    location / {
        proxy_pass http://localhost:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # API Supabase
    location /rest/ {
        proxy_pass http://localhost:54321/rest/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
    }

    # Realtime Supabase
    location /realtime/ {
        proxy_pass http://localhost:54321/realtime/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
    }

    # Storage Supabase
    location /storage/ {
        proxy_pass http://localhost:54321/storage/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        client_max_body_size 100M;
    }

    # Auth Supabase
    location /auth/ {
        proxy_pass http://localhost:54321/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
EOF
            
            # Activer le site
            sudo ln -sf /etc/nginx/sites-available/antislash-talk /etc/nginx/sites-enabled/
            sudo nginx -t
            sudo systemctl reload nginx
            print_success "Nginx configuré"
            
            # SSL avec Certbot
            if [ "$PROTOCOL" == "https" ]; then
                echo -e "\n${YELLOW}Configurer SSL avec Let's Encrypt ? [o/N]${NC}"
                read -p "Configurer SSL : " SETUP_SSL
                
                if [[ "$SETUP_SSL" =~ ^[Oo]$ ]]; then
                    sudo apt-get update
                    sudo apt-get install -y certbot python3-certbot-nginx
                    sudo certbot --nginx -d ${DOMAIN_OR_IP} --non-interactive --agree-tos --email admin@${DOMAIN_OR_IP}
                    print_success "SSL configuré avec Let's Encrypt"
                fi
            fi
        fi
    fi
}

# Tests de santé
health_checks() {
    print_header "Vérification de l'installation"
    
    cd "$PROJECT_DIR"
    
    # Test des conteneurs
    print_success "État des conteneurs :"
    docker compose -f docker-compose.monorepo.yml ps
    
    echo -e "\n${YELLOW}Tests de connectivité :${NC}"
    
    # Test de l'application web
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:${WEB_PORT} | grep -q "200"; then
        print_success "Application Web : OK (http://localhost:${WEB_PORT})"
    else
        print_error "Application Web : ERREUR"
    fi
    
    # Test de l'API Supabase
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:54321/rest/v1/ | grep -q "200\|404"; then
        print_success "API Supabase : OK (http://localhost:54321)"
    else
        print_error "API Supabase : ERREUR"
    fi
    
    # Test PyTorch si activé
    if [ "$WITH_PYTORCH" == true ]; then
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health | grep -q "200"; then
            print_success "Service PyTorch : OK (http://localhost:8000)"
        else
            print_warning "Service PyTorch : En cours de démarrage..."
        fi
    fi
}

# Afficher les instructions finales
show_final_instructions() {
    print_header "✅ Déploiement terminé !"
    
    echo -e "${GREEN}L'application est maintenant accessible :${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Application Web :${NC} ${SITE_URL}"
    echo -e "${GREEN}API Supabase :${NC} ${API_EXTERNAL_URL}"
    echo -e "${GREEN}Studio Supabase :${NC} ${PROTOCOL}://${DOMAIN_OR_IP}:54324"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo -e "\n${YELLOW}Commandes utiles :${NC}"
    echo "cd $PROJECT_DIR"
    echo "docker compose -f docker-compose.monorepo.yml logs -f    # Voir les logs"
    echo "docker compose -f docker-compose.monorepo.yml ps        # État des services"
    echo "docker compose -f docker-compose.monorepo.yml restart   # Redémarrer"
    echo "docker stats                                             # Utilisation ressources"
    
    echo -e "\n${YELLOW}⚠️  IMPORTANT :${NC}"
    echo "Les informations de connexion sont sauvegardées dans :"
    echo -e "${GREEN}$PROJECT_DIR/deployment-info.txt${NC}"
    echo "Conservez ce fichier en lieu sûr !"
    
    if [ "$WITH_PYTORCH" == false ]; then
        echo -e "\n${YELLOW}💡 Note :${NC}"
        echo "Vous avez choisi le mode léger (sans PyTorch)."
        echo "Pour activer PyTorch plus tard, exécutez :"
        echo "docker compose -f docker-compose.monorepo.yml --profile pytorch up -d"
    fi
}

# Script principal
main() {
    clear
    echo -e "${BLUE}"
    echo "    _          _   _     _           _       _____     _ _    "
    echo "   / \   _ __ | |_(_)___| | __ _ ___| |__   |_   _|_ _| | | __"
    echo "  / _ \ | '_ \| __| / __| |/ _\` / __| '_ \    | |/ _\` | | |/ /"
    echo " / ___ \| | | | |_| \__ \ | (_| \__ \ | | |   | | (_| | |   < "
    echo "/_/   \_\_| |_|\__|_|___/_|\__,_|___/_| |_|   |_|\__,_|_|_|\_\\"
    echo -e "${NC}"
    echo -e "${GREEN}Script de Déploiement Automatique v1.0${NC}\n"
    
    # Vérifier si on est root
    if [ "$EUID" -eq 0 ]; then 
        print_error "Ne pas exécuter ce script en tant que root"
        echo "Utilisez : bash deploy-vps.sh"
        exit 1
    fi
    
    # Étapes du déploiement
    check_prerequisites
    configure_deployment
    setup_project
    create_env_file
    start_services
    setup_firewall
    setup_nginx
    health_checks
    show_final_instructions
    
    print_success "\n🎉 Déploiement terminé avec succès !"
}

# Gestion des erreurs
trap 'print_error "Une erreur est survenue. Arrêt du script."; exit 1' ERR

# Lancer le script
main "$@"
