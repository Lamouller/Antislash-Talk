#!/bin/bash

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

# Fonction pour générer des mots de passe
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

print_header "🚀 INSTALLATION N8N + NOCODB"

# Vérifier qu'on est root ou sudo
if [ "$EUID" -ne 0 ] && ! sudo -v 2>/dev/null; then
    print_error "Ce script nécessite sudo"
    exit 1
fi

print_header "1️⃣  Configuration"

# Demander le domaine
print_info "Détection du domaine depuis Antislash Talk..."
if [ -f ~/antislash-talk/.env.monorepo ]; then
    DOMAIN=$(grep "^VITE_SUPABASE_URL=" ~/antislash-talk/.env.monorepo | cut -d'=' -f2 | sed 's|https://||' | sed 's|:8443||')
    print_success "Domaine détecté : $DOMAIN"
else
    print_warning "Impossible de détecter le domaine"
    read -p "Entrez votre domaine (ex: riquelme-talk.antislash.studio) : " DOMAIN
fi

# Demander l'email admin
read -p "Email admin pour NocoDB [$USER@$DOMAIN] : " NOCODB_EMAIL
NOCODB_EMAIL=${NOCODB_EMAIL:-$USER@$DOMAIN}

print_header "2️⃣  Création du dossier ~/tools"

TOOLS_DIR="$HOME/tools"
mkdir -p "$TOOLS_DIR"
cd "$TOOLS_DIR"
print_success "Dossier créé : $TOOLS_DIR"

print_header "3️⃣  Génération des mots de passe"

N8N_PASSWORD=$(generate_password)
N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
N8N_DB_PASSWORD=$(generate_password)
NOCODB_ADMIN_PASSWORD=$(generate_password)
NOCODB_JWT_SECRET=$(openssl rand -hex 32)
NOCODB_DB_PASSWORD=$(generate_password)

print_success "Mots de passe générés"

print_header "4️⃣  Création du fichier .env"

cat > .env << EOF
# ===========================================
# Configuration Générale
# ===========================================
DOMAIN=$DOMAIN
TIMEZONE=Europe/Paris

# ===========================================
# N8N Configuration
# ===========================================
N8N_HOST=0.0.0.0
N8N_USER=admin
N8N_PASSWORD=$N8N_PASSWORD
N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION_KEY

# N8N Database
N8N_DB_USER=n8n
N8N_DB_PASSWORD=$N8N_DB_PASSWORD
N8N_DB_NAME=n8n

# ===========================================
# NocoDB Configuration
# ===========================================
NOCODB_ADMIN_EMAIL=$NOCODB_EMAIL
NOCODB_ADMIN_PASSWORD=$NOCODB_ADMIN_PASSWORD
NOCODB_JWT_SECRET=$NOCODB_JWT_SECRET

# NocoDB Database
NOCODB_DB_USER=nocodb
NOCODB_DB_PASSWORD=$NOCODB_DB_PASSWORD
NOCODB_DB_NAME=nocodb
EOF

print_success "Fichier .env créé"

print_header "5️⃣  Téléchargement du docker-compose.yml"

curl -sSL "https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/tools-setup/docker-compose.yml" -o docker-compose.yml

if [ $? -eq 0 ]; then
    print_success "docker-compose.yml téléchargé"
else
    print_error "Échec du téléchargement"
    exit 1
fi

print_header "6️⃣  Configuration Nginx"

print_info "Téléchargement de la configuration Nginx..."
curl -sSL "https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/tools-setup/nginx-tools.conf" -o nginx-tools.conf

# Remplacer le placeholder du domaine
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx-tools.conf

# Ajouter à la configuration Nginx existante
print_info "Ajout des configurations N8N et NocoDB à Nginx..."

if [ -f /etc/nginx/sites-available/antislash-talk-ssl ]; then
    # Sauvegarder la config actuelle
    sudo cp /etc/nginx/sites-available/antislash-talk-ssl /etc/nginx/sites-available/antislash-talk-ssl.backup-tools

    # Ajouter la nouvelle config à la fin (avant le dernier })
    sudo bash -c "cat nginx-tools.conf >> /etc/nginx/sites-available/antislash-talk-ssl"
    
    print_success "Configuration Nginx mise à jour"
else
    print_error "Configuration Nginx Antislash Talk introuvable"
    print_warning "Vous devrez configurer Nginx manuellement"
    print_info "Utilisez le fichier: $TOOLS_DIR/nginx-tools.conf"
fi

# Tester Nginx
if sudo nginx -t 2>&1; then
    print_success "Configuration Nginx valide"
    sudo systemctl reload nginx
    print_success "Nginx rechargé"
else
    print_error "Erreur de configuration Nginx"
    print_warning "Restauration de la sauvegarde..."
    sudo cp /etc/nginx/sites-available/antislash-talk-ssl.backup-tools /etc/nginx/sites-available/antislash-talk-ssl
    sudo nginx -t
fi

print_header "7️⃣  Ouverture des ports firewall"

if command -v ufw &> /dev/null; then
    print_info "Configuration UFW..."
    sudo ufw allow 8446/tcp comment 'N8N'
    sudo ufw allow 8447/tcp comment 'NocoDB'
    print_success "Ports ouverts"
elif command -v firewall-cmd &> /dev/null; then
    print_info "Configuration firewalld..."
    sudo firewall-cmd --permanent --add-port=8446/tcp
    sudo firewall-cmd --permanent --add-port=8447/tcp
    sudo firewall-cmd --reload
    print_success "Ports ouverts"
else
    print_warning "Aucun firewall détecté, assurez-vous que les ports 8446 et 8447 sont ouverts"
fi

print_header "8️⃣  Démarrage des services"

docker compose up -d

print_success "Services démarrés"

print_header "9️⃣  Attente du démarrage (30s)"

for i in {30..1}; do
    echo -ne "\r⏳ Attente... $i secondes"
    sleep 1
done
echo ""

print_header "✅ INSTALLATION TERMINÉE"

echo ""
print_success "🎉 N8N et NocoDB sont maintenant installés !"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 INFORMATIONS DE CONNEXION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔹 N8N (Workflow Automation)"
echo "   URL:      https://$DOMAIN:8446/"
echo "   User:     admin"
echo "   Password: $N8N_PASSWORD"
echo ""
echo "🔹 NocoDB (No-Code Database)"
echo "   URL:      https://$DOMAIN:8447/"
echo "   Email:    $NOCODB_EMAIL"
echo "   Password: $NOCODB_ADMIN_PASSWORD"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_info "Toutes les informations sont sauvegardées dans:"
echo "  $TOOLS_DIR/.env"
echo ""
print_warning "⚠️  Sauvegardez ces mots de passe dans un endroit sûr !"
echo ""
print_info "Commandes utiles:"
echo "  cd $TOOLS_DIR"
echo "  docker compose ps              # Voir l'état"
echo "  docker compose logs -f         # Voir les logs"
echo "  docker compose restart         # Redémarrer"
echo "  docker compose down            # Arrêter"
echo ""
print_success "Bon workflow automation ! 🚀"

