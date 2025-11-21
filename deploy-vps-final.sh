#!/bin/bash
# Script de déploiement VPS COMPLET - Compatible multi-OS
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
                echo "OS supportés: Ubuntu, Debian, Fedora, CentOS, RHEL, Rocky Linux, AlmaLinux, Arch, Manjaro, Alpine"
                exit 1
                ;;
        esac
    else
        echo "Impossible de détecter l'OS"
        exit 1
    fi
}

# Configuration - sera définie par l'utilisateur
PROJECT_DIR=""
REQUIRED_TOOLS=("docker" "git" "openssl" "curl" "jq" "envsubst")

# Détecter la commande docker compose (v2) ou docker-compose (v1)
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose version &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "❌ Docker Compose non trouvé"
    exit 1
fi

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
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Fonction pour générer des mots de passe sécurisés
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Détection de l'OS
detect_os
print_success "OS détecté : $OS_TYPE (Package Manager: $PACKAGE_MANAGER)"

# Demander le répertoire d'installation
print_header "Configuration du répertoire d'installation"

echo ""
echo "Choisissez un répertoire pour installer Antislash Talk :"
echo ""
echo "Options recommandées :"
echo "  1) $HOME/antislash-talk (recommandé - pas de sudo requis)"
echo "  2) /opt/antislash-talk (système - nécessite sudo)"
echo "  3) Autre chemin personnalisé"
echo ""

read -p "Votre choix [1/2/3] : " DIR_CHOICE

case $DIR_CHOICE in
    1|"")
        PROJECT_DIR="$HOME/antislash-talk"
        print_info "✅ Installation dans votre home : $PROJECT_DIR"
        NEEDS_SUDO=false
        ;;
    2)
        PROJECT_DIR="/opt/antislash-talk"
        print_info "✅ Installation système : $PROJECT_DIR"
        print_warning "Permissions sudo seront requises"
        NEEDS_SUDO=true
        ;;
    3)
        read -p "Entrez le chemin complet : " CUSTOM_DIR
        PROJECT_DIR="$CUSTOM_DIR"
        # Détecter si sudo nécessaire
        PARENT_DIR=$(dirname "$PROJECT_DIR")
        if [ ! -w "$PARENT_DIR" ] 2>/dev/null; then
            print_warning "Ce répertoire nécessite des permissions sudo"
            NEEDS_SUDO=true
        else
            NEEDS_SUDO=false
        fi
        ;;
    *)
        print_error "Choix invalide, utilisation du répertoire par défaut"
        PROJECT_DIR="$HOME/antislash-talk"
        NEEDS_SUDO=false
        ;;
esac

print_info "📁 Répertoire d'installation : $PROJECT_DIR"

# Créer le répertoire s'il n'existe pas
if [ ! -d "$PROJECT_DIR" ]; then
    print_info "Création du répertoire $PROJECT_DIR..."
    
    if [ "$NEEDS_SUDO" = true ]; then
        sudo mkdir -p "$PROJECT_DIR"
        sudo chown $USER:$USER "$PROJECT_DIR"
        print_success "Répertoire créé avec sudo et propriétaire changé vers $USER"
    else
        mkdir -p "$PROJECT_DIR" || {
            print_error "Impossible de créer $PROJECT_DIR"
            print_info "Essayez avec sudo ou choisissez un autre répertoire"
            exit 1
        }
        print_success "Répertoire créé"
    fi
    
    # Cloner le repository si nécessaire
    if [ ! -f "$PROJECT_DIR/docker-compose.monorepo.yml" ]; then
        print_info "Clonage du repository..."
        git clone https://github.com/Lamouller/Antislash-Talk.git "$PROJECT_DIR"
    fi
fi

# Vérifier qu'on a bien le projet
if [ ! -f "$PROJECT_DIR/docker-compose.monorepo.yml" ]; then
    print_error "Impossible de trouver docker-compose.monorepo.yml dans $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR" || {
    print_error "Impossible d'accéder à $PROJECT_DIR"
    exit 1
}

print_success "Répertoire de travail : $PROJECT_DIR"

# Test d'écriture
if ! touch .test_write 2>/dev/null; then
    print_error "Pas de permission d'écriture dans $PROJECT_DIR"
    
    if [ "$NEEDS_SUDO" = true ] || [ "$EUID" -eq 0 ]; then
        print_info "Tentative de correction des permissions..."
        sudo chown -R $USER:$USER "$PROJECT_DIR" 2>/dev/null || true
        
        # Re-test
        if ! touch .test_write 2>/dev/null; then
            print_error "Impossible de corriger les permissions"
            print_warning "Lancez le script avec : sudo $0"
            exit 1
        fi
    else
        print_warning "Essayez : sudo $0"
        print_info "Ou choisissez un répertoire dans votre home (~/) lors du prochain lancement"
        exit 1
    fi
fi

rm -f .test_write
print_success "✅ Permissions d'écriture OK"

# ASCII Art
echo -e "${CYAN}"
cat << "EOF"
    _          _   _     _           _       _____     _ _   
   / \   _ __ | |_(_)___| | __ _ ___| |__   |_   _|_ _| | | __
  / _ \ | '_ \| __| / __| |/ _` / __| '_ \    | |/ _` | | |/ /
 / ___ \| | | | |_| \__ \ | (_| \__ \ | | |   | | (_| | |   < 
/_/   \_\_| |_|\__|_|___/_|\__,_|___/_| |_|   |_|\__,_|_|_|\_\

EOF
echo -e "${NC}"
echo -e "${PURPLE}Script de Déploiement v6.0 - Multi-OS + HTTPS + Storage RLS${NC}"
echo -e "${BLUE}Compatible avec : Ubuntu, Debian, Fedora, CentOS, RHEL, Rocky Linux, AlmaLinux, Arch, Manjaro, Alpine${NC}"

# Vérifier les permissions Docker
# Installation des outils si nécessaires
print_header "Installation des prérequis"

# Installation de Docker si nécessaire
if ! command -v docker &> /dev/null; then
    print_info "Installation de Docker..."
    
    case $OS_TYPE in
        ubuntu|debian)
            # Installation Docker officielle
            $PACKAGE_UPDATE_CMD
            $PACKAGE_INSTALL_CMD ca-certificates curl gnupg
            sudo install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS_TYPE/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            sudo chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS_TYPE $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
            $PACKAGE_UPDATE_CMD
            $PACKAGE_INSTALL_CMD docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        fedora|centos|rhel|rocky|almalinux)
            $PACKAGE_INSTALL_CMD yum-utils
            sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            $PACKAGE_INSTALL_CMD docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            sudo systemctl start docker
            sudo systemctl enable docker
            ;;
        arch|manjaro)
            $PACKAGE_INSTALL_CMD docker docker-compose
            sudo systemctl start docker
            sudo systemctl enable docker
            ;;
        alpine)
            $PACKAGE_INSTALL_CMD docker docker-compose
            rc-service docker start
            rc-update add docker boot
            ;;
    esac
    
    # Ajouter l'utilisateur au groupe docker
    sudo usermod -aG docker $USER
    print_success "Docker installé"
fi

# Vérifier les autres outils
print_info "Vérification des outils nécessaires..."
for tool in "${REQUIRED_TOOLS[@]}"; do
    if [ "$tool" = "docker" ]; then
        continue  # Déjà vérifié
    fi
    
    if ! command -v $tool &> /dev/null; then
        print_warning "Installation de $tool..."
        
        case $tool in
            jq)
                $PACKAGE_INSTALL_CMD jq
                ;;
            envsubst)
                case $OS_TYPE in
                    ubuntu|debian)
                        $PACKAGE_INSTALL_CMD gettext-base
                        ;;
                    *)
                        $PACKAGE_INSTALL_CMD gettext
                        ;;
                esac
                ;;
            git|openssl|curl)
                $PACKAGE_INSTALL_CMD $tool
                ;;
            *)
                print_error "Outil $tool non géré automatiquement"
                exit 1
                ;;
        esac
    else
        print_success "$tool ✓"
    fi
done

# Vérifier les permissions Docker
if ! docker ps >/dev/null 2>&1; then
    print_error "Permissions Docker manquantes"
    print_info "Ajout au groupe docker..."
    sudo usermod -aG docker $USER
    print_warning "Veuillez vous déconnecter/reconnecter et relancer le script"
    exit 1
fi

print_header "ÉTAPE 1/13 : Configuration initiale"

# ============================================
# DÉTECTION D'INSTALLATION EXISTANTE
# ============================================
EXISTING_INSTALL=false
KEEP_NGINX=false
PRESERVE_EXTRA_SERVICES=false

# Détecter nginx configuré
if [ -f "/etc/nginx/sites-enabled/antislash-talk-ssl" ]; then
    EXISTING_INSTALL=true
    print_warning "Installation nginx existante détectée !"
fi

# Détecter containers existants
EXISTING_CONTAINERS=$(docker ps -a --format '{{.Names}}' | grep -E "antislash|nocodb|n8n" || true)
if [ -n "$EXISTING_CONTAINERS" ]; then
    EXISTING_INSTALL=true
    print_warning "Containers existants détectés :"
    echo "$EXISTING_CONTAINERS" | sed 's/^/  • /'
fi

# Si installation existante, proposer le mode UPDATE
if [ "$EXISTING_INSTALL" = "true" ]; then
    echo ""
    print_header "🔄 MODE DE DÉPLOIEMENT"
    echo ""
    echo "Une installation existante a été détectée."
    echo ""
    echo "Options disponibles :"
    echo "  1) UPDATE  - Mise à jour (préserve nginx, SSL, services additionnels)"
    echo "  2) FRESH   - Installation complète (⚠️  ÉCRASE TOUT)"
    echo ""
    read -p "Votre choix [1] : " DEPLOY_MODE
    DEPLOY_MODE=${DEPLOY_MODE:-1}
    
    if [ "$DEPLOY_MODE" = "1" ]; then
        print_success "Mode UPDATE sélectionné"
        KEEP_NGINX=true
        PRESERVE_EXTRA_SERVICES=true
        print_info "✅ Nginx/SSL sera préservé"
        print_info "✅ Services additionnels (NocoDB, n8n) seront préservés"
        
        # Détecter les services additionnels
        EXTRA_SERVICES=""
        if docker ps -a --format '{{.Names}}' | grep -q "nocodb"; then
            EXTRA_SERVICES="$EXTRA_SERVICES nocodb"
            print_info "  → NocoDB détecté"
        fi
        if docker ps -a --format '{{.Names}}' | grep -q "n8n"; then
            EXTRA_SERVICES="$EXTRA_SERVICES n8n"
            print_info "  → n8n détecté"
        fi
    else
        print_warning "Mode FRESH sélectionné - Tout sera réinstallé"
        KEEP_NGINX=false
        PRESERVE_EXTRA_SERVICES=false
    fi
fi

# Vérifier si un .env.monorepo existe déjà
if [ -f ".env.monorepo" ]; then
    print_warning "Un fichier .env.monorepo existe déjà"
    echo ""
    read -p "Voulez-vous le conserver et sauter la configuration ? (oui/non) [non] : " KEEP_ENV
    if [ "${KEEP_ENV}" = "oui" ] || [ "${KEEP_ENV}" = "o" ] || [ "${KEEP_ENV}" = "yes" ] || [ "${KEEP_ENV}" = "y" ]; then
        print_success "Conservation de .env.monorepo existant"
        print_info "Passage directement au déploiement..."
        
        # Charger les variables existantes
        source .env.monorepo
        
        # Passer à l'étape de déploiement (ligne après génération des clés)
        SKIP_CONFIG=true
    else
        print_info "Suppression de l'ancien .env.monorepo"
        rm -f .env.monorepo
        SKIP_CONFIG=false
    fi
else
    SKIP_CONFIG=false
fi

# Si on garde la config existante, sauter la configuration
if [ "$SKIP_CONFIG" = "true" ]; then
    print_info "Saut de la configuration interactive"
    # S'assurer que VPS_HOST est défini
    if [ -z "$VPS_HOST" ]; then
        VPS_HOST=$(grep "^VPS_HOST=" .env.monorepo | cut -d= -f2 || echo "")
    fi
    # Extraire les variables nécessaires
    STUDIO_PASSWORD=$(grep "^STUDIO_PASSWORD=" .env.monorepo | cut -d= -f2 || generate_password)
    APP_USER_EMAIL=$(grep "^APP_USER_EMAIL=" .env.monorepo | cut -d= -f2 || echo "admin@antislash-talk.fr")
    APP_USER_PASSWORD=$(grep "^APP_USER_PASSWORD=" .env.monorepo | cut -d= -f2 || generate_password)
    
    print_success "Configuration chargée depuis .env.monorepo"
    
    # Passer directement à l'étape 4 (build)
    GOTO_BUILD=true
else
    GOTO_BUILD=false
fi

# Détecter l'IP automatiquement
if [ "$GOTO_BUILD" != "true" ]; then
    print_info "Détection de l'IP du VPS..."
    DETECTED_IP=""

    # Méthode 1: curl ifconfig.me (forcer IPv4)
    if [ -z "$DETECTED_IP" ]; then
        DETECTED_IP=$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' || true)
    fi

# Méthode 2: curl ipinfo.io (forcer IPv4)
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(curl -4 -s --max-time 5 ipinfo.io/ip 2>/dev/null | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' || true)
fi

# Méthode 3: curl checkip.amazonaws.com (forcer IPv4)
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(curl -4 -s --max-time 5 checkip.amazonaws.com 2>/dev/null | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' || true)
fi

# Méthode 3bis: curl spécifique IPv4
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(curl -4 -s --max-time 5 ipv4.icanhazip.com 2>/dev/null | tr -d '\n' || true)
fi

# Méthode 4: ip addr show (IPv4 seulement)
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(ip addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | grep -v '^172\.' | grep -v '^10\.' | grep -v '^192\.168\.' | head -1 || true)
fi

# Méthode 5: hostname -I (IPv4 seulement)
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(hostname -I | tr ' ' '\n' | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' | grep -v '^127\.' | grep -v '^172\.' | grep -v '^10\.' | grep -v '^192\.168\.' | head -1 || true)
fi

# Méthode 6: wget -qO- (en cas d'échec des autres)
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(wget -qO- --timeout=5 http://ipv4.icanhazip.com 2>/dev/null | tr -d '\n' || true)
fi

# Valider que c'est bien une IPv4
if [ -n "$DETECTED_IP" ]; then
    # Vérifier le format IPv4
    if echo "$DETECTED_IP" | grep -qE '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
        print_success "IPv4 détectée : $DETECTED_IP"
        read -p "IP ou domaine du VPS [$DETECTED_IP] : " VPS_HOST
        VPS_HOST=${VPS_HOST:-$DETECTED_IP}
    else
        print_warning "IP détectée non valide (IPv6?) : $DETECTED_IP"
        print_info "Tentative de détection IPv4 forcée..."
        
        # Dernière tentative avec curl spécifique IPv4
        DETECTED_IP=$(curl -4 -s --max-time 5 api.ipify.org 2>/dev/null || true)
        
        if [ -n "$DETECTED_IP" ] && echo "$DETECTED_IP" | grep -qE '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
            print_success "IPv4 trouvée : $DETECTED_IP"
            read -p "IP ou domaine du VPS [$DETECTED_IP] : " VPS_HOST
            VPS_HOST=${VPS_HOST:-$DETECTED_IP}
        else
            VPS_HOST=""
            while [ -z "$VPS_HOST" ]; do
                read -p "IP ou domaine du VPS (entrez votre IPv4) : " VPS_HOST
            done
        fi
    fi
else
    print_warning "Impossible de détecter l'IP automatiquement"
    VPS_HOST=""
    while [ -z "$VPS_HOST" ]; do
        read -p "IP ou domaine du VPS : " VPS_HOST
    done
fi

# Détecter si c'est un domaine ou une IP
IS_DOMAIN=false
if echo "$VPS_HOST" | grep -qE '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
    # Configuration IP (par défaut)
    print_info "Configuration avec IP : $VPS_HOST"
    APP_URL="https://${VPS_HOST}"
    API_URL="https://${VPS_HOST}:8443"
    STUDIO_URL="https://${VPS_HOST}:8444"
    OLLAMA_URL="https://${VPS_HOST}:8445"
    
    API_EXTERNAL_URL="https://${VPS_HOST}:8443"
    VITE_SUPABASE_URL="https://${VPS_HOST}:8443"
    VITE_OLLAMA_URL="https://${VPS_HOST}:8445"
    VITE_WHISPERX_URL="https://${VPS_HOST}/whisperx"
    VITE_PYTORCH_SERVICE_URL="https://${VPS_HOST}/pytorch"
else
    IS_DOMAIN=true
    print_info "Configuration avec domaine : $VPS_HOST"
    
    # Demander si on veut utiliser des sous-domaines
    read -p "Voulez-vous utiliser des sous-domaines ? (ex: app.$VPS_HOST, api.$VPS_HOST) [non] : " USE_SUBDOMAINS
    
    if [ "${USE_SUBDOMAINS}" = "oui" ] || [ "${USE_SUBDOMAINS}" = "o" ] || [ "${USE_SUBDOMAINS}" = "yes" ] || [ "${USE_SUBDOMAINS}" = "y" ]; then
        print_info "Configuration avec sous-domaines"
        APP_URL="https://app.${VPS_HOST}"
        API_URL="https://api.${VPS_HOST}"
        STUDIO_URL="https://studio.${VPS_HOST}"
        OLLAMA_URL="https://ollama.${VPS_HOST}"
        
        # Variables internes restent avec ports pour la configuration
        API_EXTERNAL_URL="https://api.${VPS_HOST}"
        VITE_SUPABASE_URL="https://api.${VPS_HOST}"
        VITE_OLLAMA_URL="https://ollama.${VPS_HOST}"
        VITE_WHISPERX_URL="https://app.${VPS_HOST}/whisperx"
        VITE_PYTORCH_SERVICE_URL="https://app.${VPS_HOST}/pytorch"
    else
        print_info "Configuration avec domaine unique et ports"
        APP_URL="https://${VPS_HOST}"
        API_URL="https://${VPS_HOST}:8443"
        STUDIO_URL="https://${VPS_HOST}:8444"
        OLLAMA_URL="https://${VPS_HOST}:8445"
        
        API_EXTERNAL_URL="https://${VPS_HOST}:8443"
        VITE_SUPABASE_URL="https://${VPS_HOST}:8443"
        VITE_OLLAMA_URL="https://${VPS_HOST}:8445"
        VITE_WHISPERX_URL="https://${VPS_HOST}/whisperx"
        VITE_PYTORCH_SERVICE_URL="https://${VPS_HOST}/pytorch"
    fi
fi

# Studio password
print_info "Génération d'un mot de passe sécurisé pour Studio..."
GENERATED_STUDIO_PASSWORD=$(generate_password)
print_success "Mot de passe généré : $GENERATED_STUDIO_PASSWORD"

read -sp "Mot de passe pour Supabase Studio [$GENERATED_STUDIO_PASSWORD] : " STUDIO_PASSWORD
echo
STUDIO_PASSWORD=${STUDIO_PASSWORD:-$GENERATED_STUDIO_PASSWORD}

# Email admin
read -p "Email de l'utilisateur admin [admin@antislash-talk.fr] : " APP_USER_EMAIL
APP_USER_EMAIL=${APP_USER_EMAIL:-admin@antislash-talk.fr}

# Mot de passe admin
print_info "Génération d'un mot de passe sécurisé pour l'utilisateur admin..."
GENERATED_ADMIN_PASSWORD=$(generate_password)
print_success "Mot de passe généré : $GENERATED_ADMIN_PASSWORD"

read -sp "Mot de passe pour l'utilisateur admin [$GENERATED_ADMIN_PASSWORD] : " APP_USER_PASSWORD
echo
APP_USER_PASSWORD=${APP_USER_PASSWORD:-$GENERATED_ADMIN_PASSWORD}

# Hide marketing pages
read -p "Masquer les pages marketing ? (oui/non) [oui] : " HIDE_MARKETING
VITE_HIDE_MARKETING_PAGES=$([ "${HIDE_MARKETING:-oui}" = "oui" ] && echo "true" || echo "false")

# HuggingFace token
read -p "Token HuggingFace (optionnel, Entrée pour ignorer) : " HUGGINGFACE_TOKEN

fi # Fin du if [ "$GOTO_BUILD" != "true" ]

print_header "ÉTAPE 2/13 : Génération des clés et mots de passe"

# Si on saute la config, charger les clés depuis .env.monorepo
if [ "$GOTO_BUILD" = "true" ]; then
    print_info "Chargement des clés depuis .env.monorepo..."
    POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.monorepo | cut -d= -f2)
    JWT_SECRET=$(grep "^JWT_SECRET=" .env.monorepo | cut -d= -f2)
    ANON_KEY=$(grep "^ANON_KEY=" .env.monorepo | cut -d= -f2)
    SERVICE_ROLE_KEY=$(grep "^SERVICE_ROLE_KEY=" .env.monorepo | cut -d= -f2)
    print_success "Clés chargées"
else

# Générer toutes les clés nécessaires
POSTGRES_PASSWORD=$(generate_password)
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
ANON_KEY=""
SERVICE_ROLE_KEY=""

# Générer les clés JWT avec le script Node.js
print_info "Génération des clés JWT..."
cat > generate-jwt-keys.mjs << 'EOF'
import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET;
const expiresIn = '10y';

const anonPayload = {
  role: 'anon',
  iss: 'supabase',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60)
};

const serviceRolePayload = {
  role: 'service_role',
  iss: 'supabase',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60)
};

const anonKey = jwt.sign(anonPayload, jwtSecret);
const serviceRoleKey = jwt.sign(serviceRolePayload, jwtSecret);

console.log(`ANON_KEY=${anonKey}`);
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}`);
EOF

# Installer jsonwebtoken temporairement et générer les clés
print_info "Installation temporaire de jsonwebtoken..."
# Sauvegarder l'ancien package.json s'il existe
if [ -f "package.json" ]; then
    cp package.json package.json.backup
fi

# Créer un package.json propre pour l'installation
cat > package.json << 'PKGJSON'
{
  "type": "module",
  "dependencies": {
    "jsonwebtoken": "^9.0.0"
  }
}
PKGJSON

# Installer pour de vrai
npm install >/dev/null 2>&1

# Exécuter le script pour obtenir les clés
JWT_OUTPUT=$(JWT_SECRET="$JWT_SECRET" node generate-jwt-keys.mjs 2>&1)
JWT_EXIT_CODE=$?

# Vérifier que ça a fonctionné
if [ $JWT_EXIT_CODE -ne 0 ] || [ -z "$JWT_OUTPUT" ] || echo "$JWT_OUTPUT" | grep -q "Error"; then
    print_error "Erreur lors de la génération des clés JWT"
    echo "$JWT_OUTPUT"
    exit 1
fi

ANON_KEY=$(echo "$JWT_OUTPUT" | grep "ANON_KEY=" | cut -d'=' -f2-)
SERVICE_ROLE_KEY=$(echo "$JWT_OUTPUT" | grep "SERVICE_ROLE_KEY=" | cut -d'=' -f2-)

# Vérifier que les clés ont bien été générées
if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    print_error "Les clés JWT n'ont pas pu être extraites"
    echo "JWT_OUTPUT:"
    echo "$JWT_OUTPUT"
    exit 1
fi

# Nettoyer
rm -f generate-jwt-keys.mjs
rm -rf node_modules package-lock.json

# Restaurer l'ancien package.json s'il existait
if [ -f "package.json.backup" ]; then
    mv package.json.backup package.json
else
    rm -f package.json
fi

print_success "Clés générées avec succès"

fi # Fin du else (génération des clés)

print_header "ÉTAPE 3/13 : Création du fichier .env.monorepo"

# Si on a gardé la config, skip cette étape aussi
if [ "$GOTO_BUILD" = "true" ]; then
    print_info "Fichier .env.monorepo déjà existant, étape ignorée"
else

# Créer le fichier .env.monorepo avec toutes les variables
cat > .env.monorepo << EOF
# Configuration de base
NODE_ENV=production
VPS_HOST=${VPS_HOST}
API_EXTERNAL_URL=${API_EXTERNAL_URL}
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${ANON_KEY}
VITE_HIDE_MARKETING_PAGES=${VITE_HIDE_MARKETING_PAGES}
VITE_OLLAMA_URL=${VITE_OLLAMA_URL}
VITE_WHISPERX_URL=${VITE_WHISPERX_URL}
VITE_PYTORCH_SERVICE_URL=${VITE_PYTORCH_SERVICE_URL}

# Ollama CORS origins
OLLAMA_ORIGINS=${APP_URL},${VITE_OLLAMA_URL},https://${VPS_HOST}

# PostgreSQL
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres

# JWT
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

# URLs des services
SUPABASE_URL=http://${VPS_HOST}:54321
PUBLIC_REST_URL=http://${VPS_HOST}:54321/rest/v1/
PGRST_JWT_SECRET=${JWT_SECRET}

# Auth Service (GoTrue)
GOTRUE_SITE_URL=http://${VPS_HOST}
GOTRUE_URI_ALLOW_LIST=http://${VPS_HOST}:*,http://${VPS_HOST}
GOTRUE_JWT_SECRET=${JWT_SECRET}
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_DB_DRIVER=postgres
DATABASE_URL=postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/postgres

# Studio
STUDIO_DEFAULT_ORGANIZATION="Antislash Talk"
STUDIO_DEFAULT_PROJECT=Production
STUDIO_PORT=3000
STUDIO_PROXY_PORT=54327
SUPABASE_PUBLIC_URL=http://${VPS_HOST}:54321
NEXT_PUBLIC_ENABLE_LOGS=true
NEXT_ANALYTICS_BACKEND_PROVIDER=postgres

# Storage
STORAGE_BACKEND=file
STORAGE_FILE_BACKEND_PATH=/var/lib/storage
STORAGE_S3_BUCKET=
STORAGE_S3_ENDPOINT=
STORAGE_S3_FORCE_PATH_STYLE=
STORAGE_S3_PROTOCOL=
STORAGE_S3_REGION=

# Email (Local)
GOTRUE_SMTP_HOST=inbucket
GOTRUE_SMTP_PORT=2500
GOTRUE_SMTP_USER=
GOTRUE_SMTP_PASS=
GOTRUE_SMTP_SENDER_NAME="Antislash Talk"

# Configuration utilisateur
APP_USER_EMAIL=${APP_USER_EMAIL}
APP_USER_PASSWORD=${APP_USER_PASSWORD}

# Kong
KONG_HTTP2_MAX_FIELD_SIZE=16384
KONG_HTTP2_MAX_HEADER_SIZE=16384

# Dashboard
DASHBOARD_USERNAME=antislash
DASHBOARD_PASSWORD=${STUDIO_PASSWORD}

# Studio Auth
STUDIO_USER=antislash
STUDIO_PASSWORD=${STUDIO_PASSWORD}

# AI Services
HUGGINGFACE_TOKEN=${HUGGINGFACE_TOKEN}
OLLAMA_BASE_URL=http://ollama:11434
VITE_OLLAMA_BASE_URL=http://${VPS_HOST}:11434

# Imgproxy
IMGPROXY_ENABLE_WEBP_DETECTION=true
EOF

print_success "Configuration créée"

fi # Fin du else (création de .env.monorepo)

print_header "ÉTAPE 4/13 : Arrêt des services existants"

# Arrêter et nettoyer les services existants
if [ "$PRESERVE_EXTRA_SERVICES" = "true" ]; then
    print_info "Mode UPDATE : Arrêt sélectif des containers Antislash uniquement"
    
    # Arrêter uniquement les containers antislash-talk-*
    ANTISLASH_CONTAINERS=$(docker ps -a --format '{{.Names}}' | grep "^antislash-talk-" || true)
    if [ -n "$ANTISLASH_CONTAINERS" ]; then
        echo "$ANTISLASH_CONTAINERS" | while read container; do
            print_info "Arrêt de $container"
            docker stop "$container" 2>/dev/null || true
            docker rm "$container" 2>/dev/null || true
        done
    fi
    
    # NE PAS faire down -v pour préserver les volumes et services additionnels
    print_success "Services Antislash arrêtés, services additionnels préservés"
    
    # Liste des services préservés
    PRESERVED=$(docker ps --format '{{.Names}}' | grep -E "nocodb|n8n" || true)
    if [ -n "$PRESERVED" ]; then
        print_info "Services additionnels toujours actifs :"
        echo "$PRESERVED" | sed 's/^/  ✅ /'
    fi
else
    print_info "Arrêt complet de tous les services"
    $DOCKER_COMPOSE -f docker-compose.monorepo.yml down -v --remove-orphans || true
fi

# Nettoyage Docker léger
docker system prune -f

print_header "ÉTAPE 5/13 : Construction de l'image web"

# Créer le lien symbolique .env -> .env.monorepo (CRUCIAL pour docker compose)
print_info "Création du lien symbolique .env -> .env.monorepo..."
ln -sf .env.monorepo .env
print_success "Lien symbolique créé"

print_info "Création du fichier apps/web/.env pour le build..."
cat > apps/web/.env << EOF
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${ANON_KEY}
VITE_HIDE_MARKETING_PAGES=${VITE_HIDE_MARKETING_PAGES}
VITE_OLLAMA_URL=${VITE_OLLAMA_URL}
VITE_WHISPERX_URL=${VITE_WHISPERX_URL}
VITE_PYTORCH_SERVICE_URL=${VITE_PYTORCH_SERVICE_URL}
EOF

print_info "Export des variables pour le build..."
export API_EXTERNAL_URL="${API_EXTERNAL_URL}"
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL}"
export VITE_SUPABASE_ANON_KEY="$ANON_KEY"
export VITE_HIDE_MARKETING_PAGES="$VITE_HIDE_MARKETING_PAGES"
export VITE_OLLAMA_URL="${VITE_OLLAMA_URL}"
export VITE_WHISPERX_URL="${VITE_WHISPERX_URL}"
export VITE_PYTORCH_SERVICE_URL="${VITE_PYTORCH_SERVICE_URL}"

print_info "📋 Variables VITE à compiler dans le build :"
echo "   VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}"
echo "   VITE_OLLAMA_URL: ${VITE_OLLAMA_URL}"
echo "   VITE_WHISPERX_URL: ${VITE_WHISPERX_URL}"
echo "   VITE_PYTORCH_SERVICE_URL: ${VITE_PYTORCH_SERVICE_URL}"

print_info "Construction de l'image web..."
$DOCKER_COMPOSE -f docker-compose.monorepo.yml --env-file .env build \
  --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL}" \
  --build-arg VITE_SUPABASE_ANON_KEY="${ANON_KEY}" \
  --build-arg VITE_HIDE_MARKETING_PAGES="${VITE_HIDE_MARKETING_PAGES}" \
  --build-arg VITE_OLLAMA_URL="${VITE_OLLAMA_URL}" \
  --build-arg VITE_WHISPERX_URL="${VITE_WHISPERX_URL}" \
  --build-arg VITE_PYTORCH_SERVICE_URL="${VITE_PYTORCH_SERVICE_URL}" \
  web

print_success "✅ Image web construite avec les variables VITE"

print_header "ÉTAPE 6/13 : Démarrage de PostgreSQL"

print_info "Démarrage de PostgreSQL seul..."
$DOCKER_COMPOSE -f docker-compose.monorepo.yml --env-file .env up -d db

# Attendre que PostgreSQL soit prêt
print_info "Attente de PostgreSQL..."
POSTGRES_READY=false
for i in {1..30}; do
    if docker exec antislash-talk-db pg_isready -U postgres > /dev/null 2>&1; then
        POSTGRES_READY=true
        break
    fi
    sleep 2
done

if [ "$POSTGRES_READY" = false ]; then
    print_error "PostgreSQL n'a pas démarré"
    exit 1
fi

print_success "PostgreSQL prêt"
sleep 5

print_header "ÉTAPE 7/13 : Configuration de PostgreSQL"

print_info "Configuration complète de PostgreSQL..."
docker exec -i antislash-talk-db psql -U postgres << EOF
-- Configuration
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
SELECT pg_reload_conf();

-- Création des schémas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS public;

-- Extensions (avec gestion d'erreur)
DO \$\$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions CASCADE;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Extension uuid-ossp: %', SQLERRM;
END \$\$;

DO \$\$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions CASCADE;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Extension pgcrypto: %', SQLERRM;
END \$\$;

-- Types ENUM pour GoTrue MFA (DOIVENT être dans public, pas auth !)
DO \$\$ 
BEGIN
    -- factor_type dans public
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE factor_type AS ENUM ('totp', 'webauthn', 'phone');
    END IF;
    
    -- factor_status dans public
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE factor_status AS ENUM ('unverified', 'verified');
    END IF;
    
    -- aal_level dans public
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'aal_level' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE aal_level AS ENUM ('aal1', 'aal2', 'aal3');
    END IF;
END \$\$;

-- Table auth.schema_migrations
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version text NOT NULL PRIMARY KEY
);

-- Création et configuration des rôles avec EXECUTE format pour éviter les erreurs de syntaxe
DO \$\$
DECLARE
    db_password text := '${POSTGRES_PASSWORD}';
BEGIN
    -- postgres
    EXECUTE format('ALTER ROLE postgres PASSWORD %L', db_password);
    
    -- supabase_auth_admin (SUPERUSER pour éviter les problèmes de permissions)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin;
    END IF;
    EXECUTE format('ALTER ROLE supabase_auth_admin WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD %L', db_password);
    
    -- supabase_storage_admin (SUPERUSER aussi)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin;
    END IF;
    EXECUTE format('ALTER ROLE supabase_storage_admin WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD %L', db_password);
    
    -- authenticator
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator;
    END IF;
    EXECUTE format('ALTER ROLE authenticator WITH LOGIN PASSWORD %L', db_password);
    
    -- service_role
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
    END IF;
    ALTER ROLE service_role WITH NOLOGIN;
    
    -- anon
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
    ALTER ROLE anon WITH NOLOGIN;
    
    -- supabase_admin
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin;
    END IF;
    EXECUTE format('ALTER ROLE supabase_admin WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD %L', db_password);
END \$\$;

-- Permissions et ownership
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
ALTER SCHEMA storage OWNER TO supabase_storage_admin;
ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

-- CRITIQUE: Configurer le search_path pour supabase_auth_admin
ALTER ROLE supabase_auth_admin SET search_path TO auth, public, extensions;

GRANT ALL PRIVILEGES ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres, supabase_admin;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_admin, supabase_auth_admin, supabase_storage_admin;
GRANT USAGE ON SCHEMA auth TO authenticator;
GRANT USAGE ON SCHEMA storage TO authenticator;
GRANT USAGE ON SCHEMA public TO authenticator, anon, service_role;
GRANT USAGE ON SCHEMA extensions TO postgres, supabase_admin, supabase_auth_admin, supabase_storage_admin;
GRANT anon TO authenticator;
GRANT service_role TO authenticator;

SELECT 'PostgreSQL configuré' as status;
EOF

# Configurer pg_hba.conf
print_info "Configuration de pg_hba.conf..."
docker exec antislash-talk-db bash -c "cat > /var/lib/postgresql/data/pg_hba.conf << 'EOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    all             all             0.0.0.0/0               scram-sha-256
host    all             all             ::/0                    scram-sha-256
EOF"

docker exec antislash-talk-db psql -U postgres -c "SELECT pg_reload_conf();"
print_success "PostgreSQL configuré"

print_header "ÉTAPE 8/13 : Application des migrations et démarrage des services"

# Appliquer les migrations
print_info "Application des migrations..."
for migration in packages/supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        filename=$(basename "$migration")
        if docker exec -i antislash-talk-db psql -U postgres -d postgres < "$migration" 2>/dev/null; then
            print_success "Migration appliquée : $filename"
        else
            print_info "Migration déjà appliquée ou non nécessaire : $filename"
        fi
    fi
done

# Démarrer tous les services
print_info "Démarrage de tous les services..."
$DOCKER_COMPOSE -f docker-compose.monorepo.yml --env-file .env up -d

# Attendre que les services critiques soient prêts
print_info "Attente du démarrage des services..."

# Vérifier que Auth est prêt
print_info "Vérification du service Auth..."
AUTH_READY=false
for i in {1..30}; do
    if docker exec antislash-talk-auth curl -f http://localhost:9999/health 2>/dev/null | grep -q "ok"; then
        AUTH_READY=true
        print_success "Service Auth prêt"
        break
    fi
    sleep 2
done

if [ "$AUTH_READY" = false ]; then
    print_warning "Service Auth pas encore prêt après 60s, on continue quand même..."
fi

# Vérifier que Storage est prêt
print_info "Vérification du service Storage..."
STORAGE_READY=false
for i in {1..30}; do
    if docker exec antislash-talk-storage curl -f http://localhost:5000/status 2>/dev/null | grep -q "ok"; then
        STORAGE_READY=true
        print_success "Service Storage prêt"
        break
    fi
    sleep 2
done

if [ "$STORAGE_READY" = false ]; then
    print_warning "Service Storage pas encore prêt après 60s, on continue quand même..."
fi

# Attendre encore un peu pour la stabilisation
print_info "Attente de stabilisation (15s)..."
sleep 15

# ============================================
# OPTIONAL: WhisperX Service
# ============================================
print_header "Service Optionnel : WhisperX"

echo ""
echo "WhisperX est un service de transcription ultra-rapide avec diarization (identification des locuteurs)."
echo "  ⚡ Performances : 6x plus rapide que PyTorch"
echo "  🎭 Diarization : Identification native des locuteurs"
echo "  💾 Ressources  : ~3GB RAM, CPU intensif"
echo ""
echo "Note : L'application fonctionne sans WhisperX (fallback sur PyTorch ou Gemini)"
echo ""

read -p "Voulez-vous activer WhisperX ? (oui/non) [non] : " ENABLE_WHISPERX
ENABLE_WHISPERX=${ENABLE_WHISPERX:-non}

WHISPERX_ENABLED=false

if [ "$ENABLE_WHISPERX" = "oui" ] || [ "$ENABLE_WHISPERX" = "o" ] || [ "$ENABLE_WHISPERX" = "yes" ] || [ "$ENABLE_WHISPERX" = "y" ]; then
    print_info "🏗️  Build de l'image WhisperX (cela peut prendre 5-10 minutes)..."
    
    if $DOCKER_COMPOSE -f docker-compose.monorepo.yml build whisperx; then
        print_success "Image WhisperX construite avec succès"
        
        print_info "🚀 Démarrage du service WhisperX..."
        if $DOCKER_COMPOSE -f docker-compose.monorepo.yml --env-file .env --profile whisperx up -d; then
            print_success "Service WhisperX démarré"
            
            # Vérifier que WhisperX est prêt
            print_info "Vérification du service WhisperX (jusqu'à 60s)..."
            WHISPERX_READY=false
            for i in {1..30}; do
                if docker exec antislash-talk-whisperx curl -f http://localhost:8082/health 2>/dev/null | grep -q "ok"; then
                    WHISPERX_READY=true
                    WHISPERX_ENABLED=true
                    print_success "✅ Service WhisperX opérationnel !"
                    break
                fi
                sleep 2
            done
            
            if [ "$WHISPERX_READY" = false ]; then
                print_warning "⚠️  WhisperX n'est pas encore prêt (peut prendre plus de temps au premier démarrage)"
                print_info "Vérifiez les logs : $DOCKER_COMPOSE -f docker-compose.monorepo.yml logs whisperx"
                WHISPERX_ENABLED=true  # On le marque quand même comme activé
            fi
        else
            print_error "❌ Échec du démarrage de WhisperX"
            print_warning "L'application fonctionnera quand même sans WhisperX"
        fi
    else
        print_error "❌ Échec du build de WhisperX"
        print_warning "L'application fonctionnera quand même sans WhisperX"
    fi
else
    print_info "WhisperX non activé (peut être activé plus tard)"
    print_info "Commande : $DOCKER_COMPOSE -f docker-compose.monorepo.yml --profile whisperx up -d"
fi

# ============================================
# OPTIONAL: PyTorch Service
# ============================================
print_header "Service Optionnel : PyTorch Transcription"

echo ""
echo "PyTorch Transcription est un service avec Whisper V3 + Diarization (pyannote.audio)."
echo "  🎙️  Modèle : OpenAI Whisper V3 (très précis)"
echo "  🎭 Diarization : pyannote.audio (identification des locuteurs)"
echo "  💾 Ressources  : ~2GB RAM, CPU/GPU"
echo ""
echo "Comparaison :"
echo "  • WhisperX : Plus rapide (6x), diarization intégrée"
echo "  • PyTorch  : Plus précis, modèles officiels OpenAI"
echo ""
echo "Note : L'application fonctionne sans PyTorch (fallback sur Gemini ou WhisperX si activé)"
echo ""

read -p "Voulez-vous activer PyTorch Transcription ? (oui/non) [non] : " ENABLE_PYTORCH
ENABLE_PYTORCH=${ENABLE_PYTORCH:-non}

PYTORCH_ENABLED=false

if [ "$ENABLE_PYTORCH" = "oui" ] || [ "$ENABLE_PYTORCH" = "o" ] || [ "$ENABLE_PYTORCH" = "yes" ] || [ "$ENABLE_PYTORCH" = "y" ]; then
    print_info "🏗️  Build de l'image PyTorch (cela peut prendre 5-10 minutes)..."
    
    if $DOCKER_COMPOSE -f docker-compose.monorepo.yml build transcription-pytorch; then
        print_success "Image PyTorch construite avec succès"
        
        print_info "🚀 Démarrage du service PyTorch..."
        if $DOCKER_COMPOSE -f docker-compose.monorepo.yml --env-file .env --profile pytorch up -d; then
            print_success "Service PyTorch démarré"
            
            # Vérifier que PyTorch est prêt
            print_info "Vérification du service PyTorch (jusqu'à 60s)..."
            PYTORCH_READY=false
            for i in {1..30}; do
                if docker exec antislash-talk-transcription curl -f http://localhost:8000/health 2>/dev/null | grep -q "ok"; then
                    PYTORCH_READY=true
                    PYTORCH_ENABLED=true
                    print_success "✅ Service PyTorch opérationnel !"
                    break
                fi
                sleep 2
            done
            
            if [ "$PYTORCH_READY" = false ]; then
                print_warning "⚠️  PyTorch n'est pas encore prêt (peut prendre plus de temps au premier démarrage)"
                print_info "Le service télécharge les modèles Whisper (~1.5GB au premier lancement)"
                print_info "Vérifiez les logs : $DOCKER_COMPOSE -f docker-compose.monorepo.yml logs transcription-pytorch"
                PYTORCH_ENABLED=true  # On le marque quand même comme activé
            fi
        else
            print_error "❌ Échec du démarrage de PyTorch"
            print_warning "L'application fonctionnera quand même sans PyTorch"
        fi
    else
        print_error "❌ Échec du build de PyTorch"
        print_warning "L'application fonctionnera quand même sans PyTorch"
    fi
else
    print_info "PyTorch non activé (peut être activé plus tard)"
    print_info "Commande : $DOCKER_COMPOSE -f docker-compose.monorepo.yml --profile pytorch up -d"
fi

# CRITIQUE: Mettre à jour Kong avec les bonnes clés
print_info "Mise à jour de Kong avec les clés JWT..."

# Arrêter Kong temporairement
docker stop antislash-talk-kong

# Créer le nouveau fichier kong.yml avec les bonnes clés
cp packages/supabase/kong.yml packages/supabase/kong.yml.backup
sed -i "s/ANON_KEY_PLACEHOLDER/${ANON_KEY}/g" packages/supabase/kong.yml
sed -i "s/SERVICE_ROLE_KEY_PLACEHOLDER/${SERVICE_ROLE_KEY}/g" packages/supabase/kong.yml

# Redémarrer Kong qui va charger le nouveau fichier
docker start antislash-talk-kong

# Attendre que Kong soit prêt
sleep 5
print_success "Kong mis à jour avec les nouvelles clés"

# Restaurer le template pour les prochains déploiements
mv packages/supabase/kong.yml.backup packages/supabase/kong.yml 2>/dev/null || true

print_header "ÉTAPE 9/13 : Configuration Nginx HTTPS"

# Si mode UPDATE et nginx existe, on skip cette étape
if [ "$KEEP_NGINX" = "true" ] && [ -f "/etc/nginx/sites-enabled/antislash-talk-ssl" ]; then
    print_success "Configuration Nginx existante préservée ✅"
    print_info "Fichier : /etc/nginx/sites-enabled/antislash-talk-ssl"
    
    # Vérifier si Let's Encrypt est configuré
    if grep -q "letsencrypt" /etc/nginx/sites-enabled/antislash-talk-ssl; then
        print_success "Certificats Let's Encrypt détectés ✅"
    elif [ -f "/etc/nginx/ssl/selfsigned.crt" ]; then
        print_info "Certificats auto-signés utilisés"
    fi
    
    # Vérifier si WhisperX est dans la config
    if grep -q "whisperx" /etc/nginx/sites-enabled/antislash-talk-ssl; then
        print_success "Route WhisperX détectée dans nginx ✅"
    else
        print_warning "Route WhisperX non trouvée dans nginx"
        print_info "Pour l'ajouter, consulter: nginx-secure-ssl.conf"
    fi
    
    # Recharger nginx pour être sûr (si installé)
    if command -v nginx &>/dev/null; then
        print_info "Rechargement de nginx..."
        sudo nginx -t && sudo systemctl reload nginx
    fi
    
    SKIP_NGINX_CONFIG=true
    INSTALL_NGINX=true  # En mode UPDATE, on suppose que nginx existe
else
    SKIP_NGINX_CONFIG=false
    INSTALL_NGINX=true  # Par défaut, on installe Nginx
    
    # Demander si on veut Nginx (surtout pour déploiement local/IP)
    if [ "$IS_DOMAIN" = false ]; then
        echo ""
        print_header "Configuration Nginx (optionnel pour IP/localhost)"
        echo ""
        echo "Nginx permet d'accéder aux services via HTTPS avec un seul port (443)"
        echo "Sans Nginx, vous accéderez aux services directement sur leurs ports :"
        echo "  - Application : http://${VPS_HOST}:3000"
        echo "  - API : http://${VPS_HOST}:54321"
        echo "  - Studio : http://${VPS_HOST}:54327"
        echo ""
        read -p "Installer et configurer Nginx ? (recommandé pour production) [O/n] : " NGINX_CHOICE
        
        if [[ $NGINX_CHOICE =~ ^[Nn]$ ]]; then
            INSTALL_NGINX=false
            SKIP_NGINX_CONFIG=true
            print_info "Nginx non installé - services accessibles directement sur leurs ports"
        fi
    fi
    
    if [ "$INSTALL_NGINX" = true ]; then
        print_info "Installation de Nginx si nécessaire..."
        if ! command -v nginx &> /dev/null; then
            $PACKAGE_UPDATE_CMD
        
        # Installation selon l'OS
        case $OS_TYPE in
            ubuntu|debian)
                $PACKAGE_INSTALL_CMD nginx
                ;;
            fedora|centos|rhel|rocky|almalinux)
                $PACKAGE_INSTALL_CMD nginx
                sudo systemctl enable nginx
                ;;
            arch|manjaro)
                $PACKAGE_INSTALL_CMD nginx
                sudo systemctl enable nginx
                ;;
            alpine)
                $PACKAGE_INSTALL_CMD nginx
                rc-update add nginx default
                ;;
        esac
    fi
    
    # Demander explicitement si l'utilisateur veut utiliser Let's Encrypt
    echo ""
    print_header "Configuration SSL/TLS"
    
    # Auto-détecter Let's Encrypt
    if [ -f "/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem" ]; then
        USE_LETSENCRYPT=true
        print_success "✅ Certificats Let's Encrypt détectés et seront utilisés automatiquement"
        sudo certbot certificates 2>/dev/null | grep -A 5 "Certificate Name: ${VPS_HOST}" || true
        echo ""
    else
        USE_LETSENCRYPT=false
        print_warning "Aucun certificat Let's Encrypt trouvé pour ${VPS_HOST}"
        echo ""
        echo "Voulez-vous utiliser Let's Encrypt pour les certificats SSL ?"
        echo "  - Let's Encrypt : Certificats GRATUITS, valides, reconnus par tous les navigateurs"
        echo "  - Auto-signés : Certificats locaux, erreur 'connexion non privée' dans le navigateur"
        echo ""
        read -p "Utiliser Let's Encrypt ? (recommandé) [Y/n] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            USE_LETSENCRYPT=true
            print_info "Installation des certificats Let's Encrypt..."
            
            # Vérifier que certbot est installé
            if ! command -v certbot &> /dev/null; then
                print_info "Installation de Certbot..."
                sudo apt-get update
                sudo apt-get install -y certbot python3-certbot-nginx
            fi
            
            # Proposer wildcard ou sous-domaines individuels
            echo ""
            echo "Type de certificat Let's Encrypt :"
            echo "  1) Wildcard (*.${VPS_HOST}) - couvre automatiquement tous les sous-domaines"
            echo "  2) Sous-domaines individuels (app, api, studio, ollama) - plus simple mais moins flexible"
            echo ""
            read -p "Votre choix [1/2] : " -n 1 -r CERT_TYPE
            echo
            
            if [[ $CERT_TYPE == "1" ]]; then
                print_info "Configuration d'un certificat wildcard..."
                print_warning "Pour un certificat wildcard, vous devez valider par DNS (ajout d'un TXT record)"
                echo ""
                echo "Commande à exécuter (après ce script) :"
                echo "  sudo certbot certonly --manual --preferred-challenges dns -d ${VPS_HOST} -d *.${VPS_HOST}"
                echo ""
                read -p "Appuyez sur Entrée pour continuer (vous configurerez Let's Encrypt après le déploiement)..."
                USE_LETSENCRYPT=false  # On utilisera auto-signés temporairement
            else
                print_info "Configuration des certificats pour sous-domaines individuels..."
                
                # Installer nginx temporairement si pas déjà fait
                if ! systemctl is-active --quiet nginx; then
                    print_info "Installation temporaire de Nginx pour la validation Let's Encrypt..."
                    sudo apt-get install -y nginx
                    sudo systemctl start nginx
                fi
                
                # Obtenir les certificats
                print_info "Obtention des certificats Let's Encrypt..."
                print_warning "Cette étape peut prendre quelques minutes..."
                
                DOMAINS="${VPS_HOST},app.${VPS_HOST},api.${VPS_HOST},studio.${VPS_HOST},ollama.${VPS_HOST}"
                
                if sudo certbot certonly --nginx --non-interactive --agree-tos \
                    --email admin@${VPS_HOST} \
                    -d ${DOMAINS} 2>&1 | tee /tmp/certbot.log; then
                    
                    print_success "Certificats Let's Encrypt obtenus avec succès !"
                    USE_LETSENCRYPT=true
                else
                    print_error "Échec de l'obtention des certificats Let's Encrypt"
                    cat /tmp/certbot.log
                    print_warning "Les certificats auto-signés seront utilisés temporairement"
                    USE_LETSENCRYPT=false
                fi
            fi
        fi
    fi
    
    # Générer les certificats auto-signés si nécessaire
    if [ "$USE_LETSENCRYPT" = false ]; then
        print_info "Génération des certificats SSL auto-signés..."
        sudo mkdir -p /etc/nginx/ssl
        if [ ! -f /etc/nginx/ssl/selfsigned.crt ]; then
            sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout /etc/nginx/ssl/selfsigned.key \
                -out /etc/nginx/ssl/selfsigned.crt \
                -subj "/C=FR/ST=France/L=Paris/O=Antislash/CN=${VPS_HOST}"
            print_success "Certificats SSL auto-signés générés"
            print_warning "⚠️  Les navigateurs afficheront une erreur de sécurité"
            print_info "💡 Utilisez ./setup-wildcard-ssl.sh pour configurer Let's Encrypt après le déploiement"
        else
            print_info "Certificats SSL auto-signés déjà existants"
        fi
    fi
    
    print_info "Configuration de Nginx pour HTTPS..."
    fi  # Fin du if INSTALL_NGINX
fi  # Fin du else (SKIP_NGINX_CONFIG = false)

# Skip écriture config si mode UPDATE
if [ "$SKIP_NGINX_CONFIG" = "true" ]; then
    print_info "Configuration nginx non modifiée (mode UPDATE)"
else
    # Configuration différente selon domaine ou IP
    if [ "$IS_DOMAIN" = "true" ] && ([ "${USE_SUBDOMAINS}" = "oui" ] || [ "${USE_SUBDOMAINS}" = "o" ] || [ "${USE_SUBDOMAINS}" = "yes" ] || [ "${USE_SUBDOMAINS}" = "y" ]); then
        print_info "Configuration Nginx avec sous-domaines..."
        
        # Utiliser le template avec sous-domaines
        if [ -f "nginx-subdomains-ssl.conf" ]; then
            print_info "Utilisation du template nginx-subdomains-ssl.conf"
            
            # Déterminer les certificats SSL à utiliser (basé sur USE_LETSENCRYPT)
            if [ "$USE_LETSENCRYPT" = true ] && [ -f "/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem" ]; then
                SSL_CERT="/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem"
                SSL_KEY="/etc/letsencrypt/live/${VPS_HOST}/privkey.pem"
                SSL_TRUSTED="/etc/letsencrypt/live/${VPS_HOST}/chain.pem"
                print_success "✅ Configuration avec certificats Let's Encrypt"
            else
                SSL_CERT="/etc/nginx/ssl/selfsigned.crt"
                SSL_KEY="/etc/nginx/ssl/selfsigned.key"
                SSL_TRUSTED="/etc/nginx/ssl/selfsigned.crt"
                print_warning "⚠️  Configuration avec certificats auto-signés"
            fi
            
            # Copier et adapter le template
            sed -e "s|riquelme-talk.antislash.studio|${VPS_HOST}|g" \
                -e "s|/etc/letsencrypt/live/riquelme-talk.antislash.studio/fullchain.pem|${SSL_CERT}|g" \
                -e "s|/etc/letsencrypt/live/riquelme-talk.antislash.studio/privkey.pem|${SSL_KEY}|g" \
                -e "s|/etc/letsencrypt/live/riquelme-talk.antislash.studio/chain.pem|${SSL_TRUSTED}|g" \
                nginx-subdomains-ssl.conf | sudo tee /etc/nginx/sites-available/antislash-talk-ssl > /dev/null
            
            print_success "Configuration nginx avec sous-domaines appliquée"
        else
            print_warning "Template nginx-subdomains-ssl.conf non trouvé, génération basique"
            
    # Configuration avec sous-domaines (app, api, studio, ollama) - FALLBACK
    sudo tee /etc/nginx/sites-available/antislash-talk-ssl > /dev/null << NGINXCONF
# Redirection HTTP vers HTTPS
server {
    listen 80;
    server_name app.${VPS_HOST} api.${VPS_HOST} studio.${VPS_HOST} ollama.${VPS_HOST};
    return 301 https://\$host\$request_uri;
}

# Application Web (app.domain.com)
server {
    listen 443 ssl http2;
    server_name app.${VPS_HOST};

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

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
    }
}

# API Supabase (api.domain.com)
server {
    listen 443 ssl http2;
    server_name api.${VPS_HOST};

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
    server_name studio.${VPS_HOST};

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
    server_name ollama.${VPS_HOST};

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 500M;
    proxy_read_timeout 600s;
    proxy_connect_timeout 600s;

    location / {
        # Headers CORS
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

        proxy_pass http://localhost:11434;
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
NGINXCONF
        fi  # Fin du if template nginx-subdomains-ssl.conf
        
    else
        print_info "Configuration Nginx standard (avec ports)..."
        
        # Utiliser le template avec ports si disponible
        if [ -f "nginx-secure-ssl.conf" ]; then
            print_info "Utilisation du template nginx-secure-ssl.conf"
            
            # Déterminer les certificats SSL à utiliser (basé sur USE_LETSENCRYPT)
            if [ "$USE_LETSENCRYPT" = true ] && [ -f "/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem" ]; then
                SSL_CERT="/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem"
                SSL_KEY="/etc/letsencrypt/live/${VPS_HOST}/privkey.pem"
                SSL_TRUSTED="/etc/letsencrypt/live/${VPS_HOST}/chain.pem"
                print_success "✅ Configuration avec certificats Let's Encrypt"
            else
                SSL_CERT="/etc/nginx/ssl/selfsigned.crt"
                SSL_KEY="/etc/nginx/ssl/selfsigned.key"
                SSL_TRUSTED="/etc/nginx/ssl/selfsigned.crt"
                print_warning "⚠️  Configuration avec certificats auto-signés"
            fi
            
            # Copier et adapter le template
            sed -e "s|riquelme-talk.antislash.studio|${VPS_HOST}|g" \
                -e "s|/etc/letsencrypt/live/riquelme-talk.antislash.studio/fullchain.pem|${SSL_CERT}|g" \
                -e "s|/etc/letsencrypt/live/riquelme-talk.antislash.studio/privkey.pem|${SSL_KEY}|g" \
                -e "s|/etc/letsencrypt/live/riquelme-talk.antislash.studio/chain.pem|${SSL_TRUSTED}|g" \
                nginx-secure-ssl.conf | sudo tee /etc/nginx/sites-available/antislash-talk-ssl > /dev/null
            
            print_success "Configuration nginx avec ports appliquée"
        else
            print_warning "Template nginx-secure-ssl.conf non trouvé, génération basique"
            
    sudo tee /etc/nginx/sites-available/antislash-talk-ssl > /dev/null << 'NGINXCONF'
# Redirection HTTP vers HTTPS
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

# Application Web (HTTPS sur 443)
server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API Supabase (HTTPS sur 8443)
server {
    listen 8443 ssl http2;
    server_name _;

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:54321;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}

# Studio Supabase (HTTPS sur 8444)
server {
    listen 8444 ssl http2;
    server_name _;

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:54327;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Ollama API (HTTPS sur 8445)
server {
    listen 8445 ssl http2;
    server_name _;

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 500M;
    proxy_read_timeout 600s;
    proxy_connect_timeout 600s;

    location / {
        proxy_pass http://localhost:11434;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXCONF
        fi  # Fin du if template nginx-secure-ssl.conf
    fi  # Fin du if sous-domaines vs ports

    # Activer le site
    sudo ln -sf /etc/nginx/sites-available/antislash-talk-ssl /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Si Let's Encrypt existe, forcer son utilisation (au cas où le template aurait mis auto-signé)
    if [ "$USE_LETSENCRYPT" = true ] && [ -f "/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem" ]; then
        print_info "🔧 Forçage des certificats Let's Encrypt dans la config Nginx..."
        sudo sed -i "s|/etc/nginx/ssl/selfsigned.crt|/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem|g" /etc/nginx/sites-enabled/antislash-talk-ssl
        sudo sed -i "s|/etc/nginx/ssl/selfsigned.key|/etc/letsencrypt/live/${VPS_HOST}/privkey.pem|g" /etc/nginx/sites-enabled/antislash-talk-ssl
        print_success "✅ Certificats Let's Encrypt forcés dans la config"
    fi
    
    # Tester et recharger Nginx (seulement si installé)
    if [ "$INSTALL_NGINX" = true ] || command -v nginx &>/dev/null; then
        print_info "Test de la configuration Nginx..."
        if sudo nginx -t; then
            print_success "Configuration Nginx valide"
            sudo systemctl reload nginx
            print_success "Nginx rechargé avec HTTPS"
        else
            print_error "Erreur dans la configuration Nginx"
            exit 1
        fi
    else
        print_info "Nginx non installé - skipping configuration"
    fi
fi # Fin du bloc SKIP_NGINX_CONFIG

print_header "ÉTAPE 10/13 : Création des données initiales"

# Attendre que les tables existent (créées par les migrations)
print_info "Attente de la création des tables par les migrations..."
TABLES_READY=false
for i in {1..30}; do
    AUTH_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users');" | tr -d ' ')
    STORAGE_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets');" | tr -d ' ')
    PROFILES_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles');" | tr -d ' ')
    
    if [ "$AUTH_EXISTS" = "t" ] && [ "$STORAGE_EXISTS" = "t" ] && [ "$PROFILES_EXISTS" = "t" ]; then
        TABLES_READY=true
        print_success "Toutes les tables nécessaires sont créées (auth.users, storage.buckets, public.profiles)"
        break
    fi
    sleep 2
done

if [ "$TABLES_READY" = true ]; then
    print_success "Tables créées, ajout des données initiales..."
    
    docker exec -i antislash-talk-db psql -U postgres << EOF
-- Désactiver temporairement RLS
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth.identities DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Créer l'utilisateur admin (seulement s'il n'existe pas déjà)
DO \$\$
DECLARE
    v_user_id uuid;
    v_user_email text := '${APP_USER_EMAIL}';
BEGIN
    -- Vérifier si l'utilisateur existe déjà
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_user_email;
    
    IF v_user_id IS NULL THEN
        -- Créer l'utilisateur
        INSERT INTO auth.users (
            id,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            instance_id,
            aud,
            role,
            raw_app_meta_data,
            raw_user_meta_data
        ) VALUES (
            extensions.gen_random_uuid(),
            v_user_email,
            extensions.crypt('${APP_USER_PASSWORD}', extensions.gen_salt('bf', 6)),
            now(),
            now(),
            now(),
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            '{"provider": "email", "providers": ["email"]}',
            '{}'
        ) RETURNING id INTO v_user_id;
        
        -- Créer l'identité
        INSERT INTO auth.identities (
            id,
            user_id,
            provider_id,
            provider,
            identity_data,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            extensions.gen_random_uuid(),
            v_user_id,
            v_user_id::text,
            'email',
            json_build_object('sub', v_user_id::text, 'email', v_user_email)::jsonb,
            now(),
            now(),
            now()
        );
        
        RAISE NOTICE 'Utilisateur créé: %', v_user_email;
    ELSE
        RAISE NOTICE 'Utilisateur existe déjà: %', v_user_email;
    END IF;
END \$\$;

-- Créer le profil pour l'utilisateur admin
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, email, 'admin'
FROM auth.users
WHERE email = '${APP_USER_EMAIL}'
ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    role = 'admin',
    updated_at = now();

-- CRITIQUE: Corriger les colonnes NULL en auth.users (GoTrue attend des strings vides, pas NULL)
UPDATE auth.users SET 
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, '')
WHERE email_change IS NULL 
   OR email_change_token_new IS NULL 
   OR email_change_token_current IS NULL
   OR confirmation_token IS NULL
   OR recovery_token IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL;

-- Définir DEFAULT '' pour éviter les NULL futurs
ALTER TABLE auth.users ALTER COLUMN email_change SET DEFAULT '';
ALTER TABLE auth.users ALTER COLUMN email_change_token_new SET DEFAULT '';
ALTER TABLE auth.users ALTER COLUMN email_change_token_current SET DEFAULT '';
ALTER TABLE auth.users ALTER COLUMN confirmation_token SET DEFAULT '';
ALTER TABLE auth.users ALTER COLUMN recovery_token SET DEFAULT '';
ALTER TABLE auth.users ALTER COLUMN phone_change SET DEFAULT '';
ALTER TABLE auth.users ALTER COLUMN phone_change_token SET DEFAULT '';

-- Note: Les tables (profiles, meetings, api_keys, user_api_keys, etc.) sont créées par les migrations
-- Ne pas les créer manuellement ici pour éviter les conflits

-- Créer tous les buckets nécessaires (selon base locale réelle)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES 
  ('avatars', 'avatars', true, NULL, NULL, now(), now()),
  ('meeting-audio', 'meeting-audio', true, NULL, NULL, now(), now()),
  ('meetingrecordings', 'meetingrecordings', true, NULL, NULL, now(), now()),
  ('reports', 'reports', false, NULL, NULL, now(), now()),
  ('transcriptions', 'transcriptions', false, NULL, NULL, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Configurer les permissions Storage pour que tous les services puissent accéder
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role, supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, service_role, supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres, service_role, supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated, supabase_storage_admin;

-- Réactiver RLS avec FORCE pour s'assurer que les policies s'appliquent
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY;

-- Créer les policies RLS
DO \$\$
BEGIN
    -- Policies pour auth.users
    DROP POLICY IF EXISTS "Users can view own profile" ON auth.users;
    CREATE POLICY "Users can view own profile" 
    ON auth.users FOR SELECT 
    USING (auth.uid() = id);
    
    -- Policies pour public.profiles
    DROP POLICY IF EXISTS "Service role bypass profiles" ON public.profiles;
    CREATE POLICY "Service role bypass profiles"
    ON public.profiles FOR ALL
    TO service_role, postgres
    USING (true)
    WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
    
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
    
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
    CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);
    
    -- Policies pour api_keys
    DROP POLICY IF EXISTS "Service role bypass api keys" ON public.api_keys;
    CREATE POLICY "Service role bypass api keys"
    ON public.api_keys FOR ALL
    TO service_role, postgres
    USING (true)
    WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Users can manage own api keys" ON public.api_keys;
    CREATE POLICY "Users can manage own api keys"
    ON public.api_keys FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
    
    -- Policies pour user_api_keys
    DROP POLICY IF EXISTS "Service role bypass user api keys" ON public.user_api_keys;
    CREATE POLICY "Service role bypass user api keys"
    ON public.user_api_keys FOR ALL
    TO service_role, postgres
    USING (true)
    WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Users can manage own user api keys" ON public.user_api_keys;
    CREATE POLICY "Users can manage own user api keys"
    ON public.user_api_keys FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
    
    -- Policies pour meetings
    DROP POLICY IF EXISTS "Service role bypass meetings" ON public.meetings;
    CREATE POLICY "Service role bypass meetings"
    ON public.meetings FOR ALL
    TO service_role, postgres
    USING (true)
    WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Users can manage own meetings" ON public.meetings;
    CREATE POLICY "Users can manage own meetings"
    ON public.meetings FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
    
    -- Policies pour storage.buckets
    DROP POLICY IF EXISTS "Service role bypass" ON storage.buckets;
    CREATE POLICY "Service role bypass" 
    ON storage.buckets FOR ALL 
    TO service_role, postgres
    USING (true)
    WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Authenticated users can view buckets" ON storage.buckets;
    CREATE POLICY "Authenticated users can view buckets" 
    ON storage.buckets FOR SELECT 
    TO authenticated
    USING (true);
    
    -- Policies pour storage.objects
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        -- Service role bypass pour tous les objets (CRITIQUE pour Storage service)
        DROP POLICY IF EXISTS "Service role bypass" ON storage.objects;
        DROP POLICY IF EXISTS "service_role_all" ON storage.objects;
        CREATE POLICY "service_role_all" 
        ON storage.objects FOR ALL 
        TO service_role, postgres, supabase_storage_admin
        USING (true)
        WITH CHECK (true);
        
        -- Nettoyer les anciennes policies
        DROP POLICY IF EXISTS "Users can upload to recordings" ON storage.objects;
        DROP POLICY IF EXISTS "Users can view own recordings" ON storage.objects;
        DROP POLICY IF EXISTS "Users can delete own recordings" ON storage.objects;
        DROP POLICY IF EXISTS "Public buckets are viewable" ON storage.objects;
        DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
        DROP POLICY IF EXISTS "Authenticated users can select" ON storage.objects;
        DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
        DROP POLICY IF EXISTS "authenticated_insert_all" ON storage.objects;
        DROP POLICY IF EXISTS "authenticated_select_all" ON storage.objects;
        DROP POLICY IF EXISTS "authenticated_update_all" ON storage.objects;
        DROP POLICY IF EXISTS "authenticated_delete_all" ON storage.objects;
        DROP POLICY IF EXISTS "anon_select_public" ON storage.objects;
        
        -- Policies ULTRA-PERMISSIVES pour authenticated (pas de vérification de bucket ou UUID)
        CREATE POLICY "authenticated_insert_all" 
        ON storage.objects FOR INSERT 
        TO authenticated
        WITH CHECK (true);

        CREATE POLICY "authenticated_select_all" 
        ON storage.objects FOR SELECT 
        TO authenticated
        USING (true);

        CREATE POLICY "authenticated_update_all" 
        ON storage.objects FOR UPDATE 
        TO authenticated
        USING (true)
        WITH CHECK (true);

        CREATE POLICY "authenticated_delete_all" 
        ON storage.objects FOR DELETE 
        TO authenticated
        USING (true);
        
        -- Public buckets viewable by anon
        CREATE POLICY "anon_select_public"
        ON storage.objects FOR SELECT
        TO anon
        USING (bucket_id IN (SELECT id FROM storage.buckets WHERE public = TRUE));
    END IF;
END \$\$;

SELECT 'Données initiales créées' as status;
EOF
else
    print_warning "Les tables n'ont pas été créées automatiquement"
fi

print_header "ÉTAPE 11/13 : Vérification du déploiement"

# Vérifier l'état des services
print_info "État des services :"
$DOCKER_COMPOSE -f docker-compose.monorepo.yml ps

# Vérifier les données créées avec diagnostic
print_info "Vérification des données créées..."

USERS_COUNT=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT count(*) FROM auth.users;" 2>/dev/null | tr -d ' ')
PROFILES_COUNT=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT count(*) FROM public.profiles;" 2>/dev/null | tr -d ' ')
BUCKETS_COUNT=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT count(*) FROM storage.buckets;" 2>/dev/null | tr -d ' ')

echo ""
echo "📊 Résultats de la vérification :"
echo "  - Utilisateurs (auth.users) : ${USERS_COUNT:-0}"
echo "  - Profils (public.profiles) : ${PROFILES_COUNT:-0}"
echo "  - Buckets (storage.buckets) : ${BUCKETS_COUNT:-0}"
echo ""

# Vérifier si tout est OK
DEPLOYMENT_OK=true

if [ "${USERS_COUNT:-0}" -eq 0 ]; then
    print_error "❌ PROBLÈME : Aucun utilisateur créé dans auth.users"
    DEPLOYMENT_OK=false
    echo "   → Diagnostic :"
    docker logs antislash-talk-auth --tail 20 2>&1 | grep -i error || echo "     Pas d'erreur évidente dans les logs Auth"
fi

if [ "${PROFILES_COUNT:-0}" -eq 0 ]; then
    print_error "❌ PROBLÈME : Aucun profil créé dans public.profiles"
    DEPLOYMENT_OK=false
    echo "   → Vérification : La table profiles existe-t-elle ?"
    docker exec antislash-talk-db psql -U postgres -t -c "\d public.profiles" 2>&1 | head -5
fi

if [ "${BUCKETS_COUNT:-0}" -eq 0 ]; then
    print_error "❌ PROBLÈME : Aucun bucket créé dans storage.buckets"
    DEPLOYMENT_OK=false
    echo "   → Diagnostic :"
    docker logs antislash-talk-storage --tail 20 2>&1 | grep -i error || echo "     Pas d'erreur évidente dans les logs Storage"
fi

# Afficher les détails si tout est OK
if [ "$DEPLOYMENT_OK" = true ]; then
    print_success "✅ Toutes les vérifications sont OK !"
    echo ""
    print_info "Détails des données créées :"
    docker exec antislash-talk-db psql -U postgres -c "
SELECT 'Utilisateurs' as type, count(*) as count, string_agg(email, ', ') as details FROM auth.users
UNION ALL
SELECT 'Buckets' as type, count(*) as count, string_agg(name, ', ') as details FROM storage.buckets;"
fi

# Configuration Nginx pour Studio
print_info "Configuration de l'authentification Studio..."

# Nettoyer le fichier local s'il existe comme répertoire
if [ -d "studio.htpasswd" ]; then
    rm -rf studio.htpasswd
fi

# Générer le hash du mot de passe
STUDIO_PASSWORD_HASH=$(docker run --rm httpd:alpine htpasswd -nbB antislash "$STUDIO_PASSWORD" | cut -d: -f2)

# Créer le fichier .htpasswd directement dans le container (pas de montage de volume)
docker exec antislash-talk-studio-proxy sh -c "echo 'antislash:$STUDIO_PASSWORD_HASH' > /etc/nginx/.htpasswd && chmod 644 /etc/nginx/.htpasswd"

# Vérifier que c'est bien un fichier
if docker exec antislash-talk-studio-proxy test -f /etc/nginx/.htpasswd; then
    print_success "Fichier .htpasswd créé correctement dans le container"
    # Recharger nginx
    docker exec antislash-talk-studio-proxy nginx -s reload
else
    print_error "Erreur: .htpasswd n'a pas été créé correctement"
    # Essayer de redémarrer le container
    docker restart antislash-talk-studio-proxy
fi

# Afficher les informations finales
print_header "ÉTAPE 12/13 : Configuration Ollama"

print_info "Attente du démarrage d'Ollama (30s)..."
sleep 30

# Vérifier si Ollama est accessible
if docker exec antislash-talk-ollama curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    print_success "Ollama est accessible"
    
    # Vérifier si des modèles sont installés
    MODELS_COUNT=$(docker exec antislash-talk-ollama ollama list 2>/dev/null | grep -c "^[a-zA-Z]" || echo "0")
    
    if [ "$MODELS_COUNT" -eq "0" ]; then
        print_info "Aucun modèle Ollama trouvé. Installation de llama3.2:3b..."
        if docker exec -it antislash-talk-ollama ollama pull llama3.2:3b; then
            print_success "Modèle llama3.2:3b installé"
        else
            print_warning "Impossible d'installer le modèle automatiquement"
            print_info "Vous pourrez l'installer plus tard avec : ./install-ollama-model.sh"
        fi
    else
        print_success "$MODELS_COUNT modèle(s) Ollama déjà installé(s)"
    fi
else
    print_warning "Ollama n'est pas encore prêt"
    print_info "Vous pourrez installer un modèle plus tard avec : ./install-ollama-model.sh"
fi

print_header "ÉTAPE 13/13 : Configuration CORS pour Ollama"

print_info "Configuration des headers CORS pour Ollama..."

# Créer la configuration Nginx avec CORS pour Ollama
cat > /tmp/nginx-ollama-cors.conf << 'NGINXCORS'
# Ollama API (HTTPS sur 8445)
server {
    listen 8445 ssl http2;
    server_name _;

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 500M;
    proxy_read_timeout 600s;
    proxy_connect_timeout 600s;

    location / {
        # Headers CORS permissifs
        if ($request_method = 'OPTIONS') {
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
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
NGINXCORS

# Remplacer la configuration Ollama dans Nginx (seulement si Nginx est installé)
if [ "$INSTALL_NGINX" != false ] && [ -f "/etc/nginx/sites-available/antislash-talk-ssl" ] && command -v nginx &>/dev/null; then
    sudo cp /etc/nginx/sites-available/antislash-talk-ssl /etc/nginx/sites-available/antislash-talk-ssl.backup
    sudo sed -i '/# Ollama API/,/^}$/d' /etc/nginx/sites-available/antislash-talk-ssl
    cat /tmp/nginx-ollama-cors.conf | sudo tee -a /etc/nginx/sites-available/antislash-talk-ssl > /dev/null
    print_success "Configuration Nginx mise à jour avec CORS pour Ollama"
    sudo systemctl reload nginx
else
    print_info "Nginx non installé - Configuration Ollama skippée"
fi

rm -f /tmp/nginx-ollama-cors.conf

print_header "🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !"

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                     INFORMATIONS D'ACCÈS                       ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC} Application Web    : ${CYAN}${APP_URL}${NC}"
echo -e "${GREEN}║${NC} Supabase Studio    : ${CYAN}${STUDIO_URL}${NC}"
echo -e "${GREEN}║${NC}   Utilisateur      : ${YELLOW}antislash${NC}"
echo -e "${GREEN}║${NC}   Mot de passe     : ${YELLOW}${STUDIO_PASSWORD}${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} API Supabase       : ${CYAN}${API_URL}${NC}"
echo -e "${GREEN}║${NC} Ollama API         : ${CYAN}${OLLAMA_URL}${NC}"

# Services optionnels de transcription
if [ "$WHISPERX_ENABLED" = true ]; then
    WHISPERX_PORT="8082"
    if [ "$IS_DOMAIN" = "true" ]; then
        WHISPERX_URL="http://${VPS_HOST}:${WHISPERX_PORT}"
    else
        WHISPERX_URL="http://${VPS_HOST}:${WHISPERX_PORT}"
    fi
    echo -e "${GREEN}║${NC} WhisperX API       : ${CYAN}${WHISPERX_URL} ⚡${NC}"
fi

if [ "$PYTORCH_ENABLED" = true ]; then
    PYTORCH_PORT="8000"
    if [ "$IS_DOMAIN" = "true" ]; then
        PYTORCH_URL="http://${VPS_HOST}:${PYTORCH_PORT}"
    else
        PYTORCH_URL="http://${VPS_HOST}:${PYTORCH_PORT}"
    fi
    echo -e "${GREEN}║${NC} PyTorch API        : ${CYAN}${PYTORCH_URL} 🎙️${NC}"
fi

echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} Compte Admin App   :"
echo -e "${GREEN}║${NC}   Email            : ${YELLOW}${APP_USER_EMAIL}${NC}"
echo -e "${GREEN}║${NC}   Mot de passe     : ${YELLOW}${APP_USER_PASSWORD}${NC}"
if [ -n "$HUGGINGFACE_TOKEN" ]; then
echo -e "${GREEN}║${NC} HuggingFace Token  : ${YELLOW}${HUGGINGFACE_TOKEN:0:10}...${NC}"
fi
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"

print_info "Toutes les informations ont été sauvegardées dans deployment-info.txt"

# Afficher une note sur le DNS si on utilise des sous-domaines
if [ "$IS_DOMAIN" = "true" ] && ([ "${USE_SUBDOMAINS}" = "oui" ] || [ "${USE_SUBDOMAINS}" = "o" ] || [ "${USE_SUBDOMAINS}" = "yes" ] || [ "${USE_SUBDOMAINS}" = "y" ]); then
    echo ""
    print_warning "IMPORTANT : Configuration DNS requise !"
    echo ""
    echo "Vous devez configurer les enregistrements DNS suivants :"
    echo "  - app.${VPS_HOST}    → ${DETECTED_IP:-VOTRE_IP}"
    echo "  - api.${VPS_HOST}    → ${DETECTED_IP:-VOTRE_IP}"
    echo "  - studio.${VPS_HOST} → ${DETECTED_IP:-VOTRE_IP}"
    echo "  - ollama.${VPS_HOST} → ${DETECTED_IP:-VOTRE_IP}"
    echo ""
    echo "Pour Let's Encrypt (certificats SSL valides), exécutez après configuration DNS :"
    echo "  sudo certbot --nginx -d app.${VPS_HOST} -d api.${VPS_HOST} -d studio.${VPS_HOST} -d ollama.${VPS_HOST}"
fi

# Sauvegarder les informations
cat > deployment-info.txt << EOF
Déploiement Antislash Talk - $(date)
=====================================

URLs d'accès :
- Application : ${APP_URL}
- Studio : ${STUDIO_URL} (user: antislash, pass: ${STUDIO_PASSWORD})
- API : ${API_URL}
- Ollama : ${OLLAMA_URL}
EOF

if [ "$WHISPERX_ENABLED" = true ]; then
    echo "- WhisperX : ${WHISPERX_URL}" >> deployment-info.txt
fi

if [ "$PYTORCH_ENABLED" = true ]; then
    echo "- PyTorch : ${PYTORCH_URL}" >> deployment-info.txt
fi

cat >> deployment-info.txt << EOF

Compte admin :
- Email : ${APP_USER_EMAIL}
- Mot de passe : ${APP_USER_PASSWORD}

Variables d'environnement :
- JWT_SECRET : ${JWT_SECRET:0:20}...
- ANON_KEY : ${ANON_KEY:0:20}...
- SERVICE_ROLE_KEY : ${SERVICE_ROLE_KEY:0:20}...
- POSTGRES_PASSWORD : ${POSTGRES_PASSWORD}
EOF

if [ -n "$HUGGINGFACE_TOKEN" ]; then
    echo "- HUGGINGFACE_TOKEN : ${HUGGINGFACE_TOKEN:0:10}..." >> deployment-info.txt
fi

# Afficher le résultat final
echo ""
echo "=========================================="
if [ "$DEPLOYMENT_OK" = true ]; then
    print_success "🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !"
    echo ""
    echo "✅ Tous les services sont opérationnels"
    echo "✅ ${USERS_COUNT} utilisateur(s) créé(s)"
    echo "✅ ${PROFILES_COUNT} profil(s) créé(s)"
    echo "✅ ${BUCKETS_COUNT} bucket(s) créé(s)"
else
    print_error "⚠️  DÉPLOIEMENT TERMINÉ AVEC DES PROBLÈMES"
    echo ""
    echo "Des erreurs ont été détectées. Solutions possibles :"
    echo ""
    echo "1. Relancer le script de correction manuelle :"
    echo "   ./fix-complete-deployment.sh"
    echo ""
    echo "2. Vérifier les logs des services problématiques :"
    echo "   docker logs antislash-talk-auth --tail 50"
    echo "   docker logs antislash-talk-storage --tail 50"
    echo ""
    echo "3. Redéployer complètement depuis zéro :"
    echo "   ./clean-and-deploy.sh"
    echo ""
    echo "4. Diagnostic détaillé de la base de données :"
    echo "   docker exec -it antislash-talk-db psql -U postgres -d postgres"
    echo "   Puis exécuter : \\dt auth.*"
    echo "                   \\dt storage.*"
    echo "                   \\dt public.*"
    echo ""
fi
echo "=========================================="
echo ""

exit $([ "$DEPLOYMENT_OK" = true ] && echo 0 || echo 1)
