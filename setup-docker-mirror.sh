#!/bin/bash

# Script pour configurer un miroir Docker et contourner la limite de taux

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Créer la configuration Docker avec miroir
print_info "Configuration du miroir Docker..."

# Backup de la config existante si elle existe
if [ -f /etc/docker/daemon.json ]; then
    sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.backup
    print_info "Sauvegarde de la configuration existante"
fi

# Créer la nouvelle configuration avec des miroirs publics
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "registry-mirrors": [
    "https://mirror.gcr.io",
    "https://daocloud.io",
    "https://c.163.com",
    "https://registry.docker-cn.com"
  ]
}
EOF

print_success "Configuration du miroir créée"

# Redémarrer Docker
print_info "Redémarrage de Docker..."
sudo systemctl restart docker

# Attendre que Docker soit prêt
sleep 5

# Vérifier que Docker fonctionne
if docker info > /dev/null 2>&1; then
    print_success "Docker redémarré avec succès"
    print_info "Les miroirs Docker sont maintenant configurés"
else
    print_warning "Problème avec Docker, vérifiez avec: sudo systemctl status docker"
fi

echo ""
print_info "Vous pouvez maintenant relancer le déploiement avec:"
print_info "./deploy-vps-v3.sh"
