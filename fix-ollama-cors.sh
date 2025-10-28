#!/bin/bash
# Script pour corriger les problèmes CORS entre le frontend et Ollama

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_info "Configuration CORS pour Ollama..."

# 1. Vérifier si Ollama tourne
if ! docker ps | grep -q antislash-talk-ollama; then
    print_error "Container Ollama non trouvé. Démarrage..."
    docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d ollama
    sleep 10
fi

# 2. Mettre à jour la configuration Nginx pour ajouter les headers CORS
print_info "Mise à jour de la configuration Nginx pour Ollama..."

# Créer une nouvelle configuration avec CORS
sudo tee /tmp/nginx-ollama-cors.conf > /dev/null << 'NGINXCONF'
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
        # Headers CORS permissifs pour permettre l'accès depuis le frontend
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        # Headers CORS pour toutes les requêtes
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

        # Désactiver la mise en buffer pour le streaming
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
NGINXCONF

# 3. Mettre à jour la configuration Nginx principale
if [ -f "/etc/nginx/sites-available/antislash-talk-ssl" ]; then
    # Sauvegarder l'ancienne config
    sudo cp /etc/nginx/sites-available/antislash-talk-ssl /etc/nginx/sites-available/antislash-talk-ssl.backup
    
    # Remplacer la section Ollama dans la config
    sudo sed -i '/# Ollama API/,/^}$/d' /etc/nginx/sites-available/antislash-talk-ssl
    
    # Ajouter la nouvelle config
    sudo cat /tmp/nginx-ollama-cors.conf >> /etc/nginx/sites-available/antislash-talk-ssl
    
    print_success "Configuration Nginx mise à jour avec CORS"
else
    print_error "Configuration Nginx non trouvée. Création d'une nouvelle..."
    sudo cp /tmp/nginx-ollama-cors.conf /etc/nginx/sites-available/ollama-cors
    sudo ln -sf /etc/nginx/sites-available/ollama-cors /etc/nginx/sites-enabled/
fi

# 4. Tester et recharger Nginx
print_info "Test de la configuration Nginx..."
if sudo nginx -t; then
    print_success "Configuration Nginx valide"
    sudo systemctl reload nginx
    print_success "Nginx rechargé"
else
    print_error "Erreur dans la configuration Nginx"
    exit 1
fi

# 5. Installer un modèle par défaut si aucun n'est installé
print_info "Vérification des modèles Ollama..."
MODELS_COUNT=$(docker exec antislash-talk-ollama ollama list 2>/dev/null | grep -c "^[a-zA-Z]" || echo "0")

if [ "$MODELS_COUNT" -eq "0" ]; then
    print_info "Aucun modèle trouvé. Installation de llama3.2:3b (modèle léger)..."
    docker exec -it antislash-talk-ollama ollama pull llama3.2:3b
    print_success "Modèle installé"
else
    print_success "$MODELS_COUNT modèle(s) déjà installé(s)"
    docker exec antislash-talk-ollama ollama list
fi

# 6. Test final
print_info "Test de l'API Ollama..."
VPS_IP=$(hostname -I | awk '{print $1}')

# Test HTTP direct
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    print_success "✓ API Ollama accessible en HTTP (port 11434)"
else
    print_error "✗ API Ollama non accessible en HTTP"
fi

# Test HTTPS via Nginx
if curl -sk https://localhost:8445/api/tags >/dev/null 2>&1; then
    print_success "✓ API Ollama accessible en HTTPS (port 8445)"
else
    print_error "✗ API Ollama non accessible en HTTPS"
fi

# Test CORS
CORS_HEADERS=$(curl -sI -X OPTIONS https://localhost:8445/api/tags -k 2>/dev/null | grep -i "access-control-allow-origin" || true)
if [ -n "$CORS_HEADERS" ]; then
    print_success "✓ Headers CORS configurés"
    echo "  $CORS_HEADERS"
else
    print_error "✗ Headers CORS manquants"
fi

print_success "Configuration terminée !"
echo ""
echo "URLs Ollama :"
echo "- Interne (Docker) : http://ollama:11434"
echo "- Local (HTTP)     : http://localhost:11434"
echo "- Public (HTTPS)   : https://${VPS_IP}:8445"
echo ""
echo "Le frontend devrait maintenant pouvoir accéder à Ollama via : https://${VPS_IP}:8445"
