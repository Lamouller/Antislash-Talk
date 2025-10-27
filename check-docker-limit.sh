#!/bin/bash

# Script pour vérifier la limite de taux Docker Hub

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
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

# Vérifier si jq est installé
if ! command -v jq &> /dev/null; then
    print_warning "jq n'est pas installé. Installation..."
    sudo apt-get update -qq
    sudo apt-get install -y jq
fi

print_info "Vérification de votre limite Docker Hub..."

# Obtenir le token
TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:ratelimitpreview/test:pull" | jq -r .token)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    print_error "Impossible d'obtenir le token Docker Hub"
    exit 1
fi

# Faire une requête pour obtenir les headers de limite
RESPONSE=$(curl -s -I -H "Authorization: Bearer $TOKEN" https://registry-1.docker.io/v2/ratelimitpreview/test/manifests/latest)

# Extraire les limites
LIMIT=$(echo "$RESPONSE" | grep -i "ratelimit-limit" | awk '{print $2}' | tr -d '\r')
REMAINING=$(echo "$RESPONSE" | grep -i "ratelimit-remaining" | awk '{print $2}' | tr -d '\r')

if [ -n "$LIMIT" ] && [ -n "$REMAINING" ]; then
    print_info "Limite Docker Hub : $REMAINING / $LIMIT pulls restants"
    
    # Calculer le pourcentage utilisé
    if [ "$LIMIT" -gt 0 ]; then
        USED=$((LIMIT - REMAINING))
        PERCENT=$((USED * 100 / LIMIT))
        
        if [ "$REMAINING" -eq 0 ]; then
            print_error "Limite atteinte ! Vous devez attendre ou vous connecter à Docker Hub"
            print_info "La limite se réinitialise toutes les 6 heures"
        elif [ "$REMAINING" -lt 20 ]; then
            print_warning "Attention : Il ne reste que $REMAINING pulls !"
        else
            print_success "Vous avez encore $REMAINING pulls disponibles"
        fi
        
        # Afficher une barre de progression
        echo -n "Utilisation : ["
        for i in $(seq 1 20); do
            if [ $((i * 5)) -le "$PERCENT" ]; then
                echo -n "█"
            else
                echo -n "░"
            fi
        done
        echo "] $PERCENT%"
    fi
else
    print_warning "Impossible de récupérer les informations de limite"
    print_info "Vous êtes peut-être déjà connecté à Docker Hub"
fi

# Vérifier si l'utilisateur est connecté
if docker info 2>/dev/null | grep -q "Username"; then
    USERNAME=$(docker info 2>/dev/null | grep "Username" | awk '{print $2}')
    print_success "Vous êtes connecté en tant que : $USERNAME"
    print_info "Limite augmentée à 200 pulls par 6 heures"
else
    print_info "Vous n'êtes pas connecté à Docker Hub"
    print_info "Limite : 100 pulls par 6 heures (IP : $(curl -s ifconfig.me))"
fi
