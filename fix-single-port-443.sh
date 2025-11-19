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

# Vérifier qu'on est root
if [ "$EUID" -ne 0 ]; then
    print_error "Ce script doit être exécuté avec sudo"
    exit 1
fi

cd /home/debian/antislash-talk 2>/dev/null || cd /root/antislash-talk || exit 1

print_header "🔧 CONFIGURATION TOUT SUR PORT 443"

print_warning "Cette solution met TOUT sur le port 443 avec des chemins différents:"
echo "  - https://domain.com/          → Web App"
echo "  - https://domain.com/api/      → Supabase API"
echo "  - https://domain.com/studio/   → Supabase Studio"
echo "  - https://domain.com/ollama/   → Ollama API"
echo ""

# Charger les variables
if [ -f .env.monorepo ]; then
    source .env.monorepo
    print_success "Variables chargées"
else
    print_error "Fichier .env.monorepo introuvable"
    exit 1
fi

# Extraire le domaine
DOMAIN=$(echo "$VITE_SUPABASE_URL" | sed 's|https://||' | sed 's|:8443||')
print_info "Domaine: $DOMAIN"

print_header "1️⃣  Sauvegarde"

cp /etc/nginx/sites-enabled/antislash-talk-ssl /etc/nginx/sites-enabled/antislash-talk-ssl.backup-$(date +%Y%m%d-%H%M%S)
print_success "Sauvegarde créée"

print_header "2️⃣  Nouvelle configuration Nginx (tout sur 443)"

cat > /etc/nginx/sites-available/antislash-talk-ssl << NGINXEOF
# Redirection HTTP vers HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

# TOUT sur le port 443 avec différents chemins
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};
    
    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    client_max_body_size 500M;
    
    # Logs
    access_log /var/log/nginx/antislash-access.log;
    error_log /var/log/nginx/antislash-error.log;
    
    # Supabase Studio
    location /studio/ {
        proxy_pass http://localhost:54327/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Supabase API (Auth, Storage, Rest, etc.)
    location /api/ {
        proxy_pass http://localhost:54321/;
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
    
    # Ollama API
    location /ollama/ {
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
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
        
        proxy_pass http://localhost:11434/;
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
        proxy_read_timeout 600s;
        proxy_connect_timeout 600s;
    }
    
    # Application Web (par défaut)
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
NGINXEOF

print_success "Configuration créée"

print_header "3️⃣  Mise à jour du .env.monorepo"

print_info "Anciennes URLs:"
echo "  VITE_SUPABASE_URL=${VITE_SUPABASE_URL}"
echo "  API_EXTERNAL_URL=${API_EXTERNAL_URL}"
echo "  VITE_OLLAMA_URL=${VITE_OLLAMA_URL}"

# Nouvelles URLs (tout sur 443 avec chemins)
NEW_SUPABASE_URL="https://${DOMAIN}/api"
NEW_API_URL="https://${DOMAIN}/api"
NEW_OLLAMA_URL="https://${DOMAIN}/ollama"
NEW_STUDIO_URL="https://${DOMAIN}/studio"

# Mise à jour du .env.monorepo
sed -i "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=${NEW_SUPABASE_URL}|g" .env.monorepo
sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=${NEW_API_URL}|g" .env.monorepo
sed -i "s|VITE_OLLAMA_URL=.*|VITE_OLLAMA_URL=${NEW_OLLAMA_URL}|g" .env.monorepo

# Ajouter SUPABASE_PUBLIC_URL si absent
if ! grep -q "^SUPABASE_PUBLIC_URL=" .env.monorepo; then
    echo "SUPABASE_PUBLIC_URL=${NEW_API_URL}" >> .env.monorepo
else
    sed -i "s|SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=${NEW_API_URL}|g" .env.monorepo
fi

print_success "URLs mises à jour"

print_info "Nouvelles URLs:"
echo "  VITE_SUPABASE_URL=${NEW_SUPABASE_URL}"
echo "  API_EXTERNAL_URL=${NEW_API_URL}"
echo "  VITE_OLLAMA_URL=${NEW_OLLAMA_URL}"
echo "  Studio: ${NEW_STUDIO_URL}"

print_header "4️⃣  Test et activation Nginx"

if nginx -t; then
    print_success "Configuration valide"
    systemctl reload nginx
    print_success "Nginx rechargé"
else
    print_error "Configuration invalide"
    exit 1
fi

print_header "5️⃣  Rebuild de l'application web"

print_warning "Rebuild avec les nouvelles URLs (peut prendre 3-5 min)..."

# Charger les nouvelles variables
source .env.monorepo

# Export explicite
export API_EXTERNAL_URL="${API_EXTERNAL_URL}"
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL}"
export VITE_SUPABASE_ANON_KEY="${ANON_KEY}"
export VITE_HIDE_MARKETING_PAGES="${VITE_HIDE_MARKETING_PAGES:-false}"
export VITE_OLLAMA_URL="${VITE_OLLAMA_URL}"

# Rebuild
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo build --no-cache \
  --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL}" \
  --build-arg VITE_SUPABASE_ANON_KEY="${ANON_KEY}" \
  --build-arg VITE_HIDE_MARKETING_PAGES="${VITE_HIDE_MARKETING_PAGES}" \
  --build-arg VITE_OLLAMA_URL="${VITE_OLLAMA_URL}" \
  web

print_success "Build terminé"

print_header "6️⃣  Redémarrage des services"

docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d

print_success "Services redémarrés"

sleep 5

print_header "7️⃣  Tests"

print_info "Test de l'application web..."
if curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/ | grep -q "200"; then
    print_success "Application web accessible"
else
    print_warning "Application web non accessible"
fi

print_info "Test de l'API Auth..."
if curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/api/auth/v1/health | grep -q "200"; then
    print_success "API Auth accessible"
else
    print_warning "API Auth non accessible"
fi

print_info "Test du Studio..."
if curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}/studio/ | grep -q "200\|301\|302"; then
    print_success "Studio accessible"
else
    print_warning "Studio non accessible"
fi

print_header "✅ TERMINÉ"

echo ""
print_success "Nouvelle configuration:"
echo "  🌐 App:    https://${DOMAIN}/"
echo "  🔌 API:    https://${DOMAIN}/api/"
echo "  🎨 Studio: https://${DOMAIN}/studio/"
echo "  🤖 Ollama: https://${DOMAIN}/ollama/"
echo ""
print_info "Tous les services sont maintenant sur le port 443 uniquement !"
print_warning "Testez l'authentification dans l'app web maintenant"

