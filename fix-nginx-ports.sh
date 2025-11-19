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

print_header "🔧 CORRECTION CONFIGURATION NGINX"

# Charger les variables
if [ -f .env.monorepo ]; then
    source .env.monorepo
    print_success "Variables chargées depuis .env.monorepo"
else
    print_error "Fichier .env.monorepo introuvable"
    exit 1
fi

# Extraire le domaine
DOMAIN=$(echo "$VITE_SUPABASE_URL" | sed 's|https://||' | sed 's|:8443||')
print_info "Domaine détecté: $DOMAIN"

print_header "1️⃣  Sauvegarde de la config actuelle"

if [ -f /etc/nginx/sites-enabled/antislash-talk-ssl ]; then
    cp /etc/nginx/sites-enabled/antislash-talk-ssl /etc/nginx/sites-enabled/antislash-talk-ssl.bak
    print_success "Sauvegarde créée"
fi

print_header "2️⃣  Création de la nouvelle configuration Nginx"

cat > /etc/nginx/sites-available/antislash-talk-ssl << 'NGINXCONF'
# Redirection HTTP vers HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$host$request_uri;
}

# Application Web (HTTPS sur 443)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    
    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Logs
    access_log /var/log/nginx/antislash-web-access.log;
    error_log /var/log/nginx/antislash-web-error.log;
    
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
    listen [::]:8443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    
    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    client_max_body_size 100M;
    
    # Logs
    access_log /var/log/nginx/antislash-api-access.log;
    error_log /var/log/nginx/antislash-api-error.log;
    
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
    listen [::]:8444 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    
    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Logs
    access_log /var/log/nginx/antislash-studio-access.log;
    error_log /var/log/nginx/antislash-studio-error.log;
    
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
    listen [::]:8445 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    
    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    client_max_body_size 500M;
    proxy_read_timeout 600s;
    proxy_connect_timeout 600s;
    
    # Logs
    access_log /var/log/nginx/antislash-ollama-access.log;
    error_log /var/log/nginx/antislash-ollama-error.log;
    
    location / {
        # Headers CORS
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
        
        # Streaming
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
NGINXCONF

# Remplacer le placeholder par le vrai domaine
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/antislash-talk-ssl

print_success "Configuration créée"

print_header "3️⃣  Activation de la configuration"

ln -sf /etc/nginx/sites-available/antislash-talk-ssl /etc/nginx/sites-enabled/antislash-talk-ssl

print_header "4️⃣  Test de la configuration Nginx"

if nginx -t; then
    print_success "Configuration Nginx valide"
else
    print_error "Configuration Nginx invalide"
    print_info "Restauration de la sauvegarde..."
    if [ -f /etc/nginx/sites-enabled/antislash-talk-ssl.bak ]; then
        mv /etc/nginx/sites-enabled/antislash-talk-ssl.bak /etc/nginx/sites-enabled/antislash-talk-ssl
    fi
    exit 1
fi

print_header "5️⃣  Redémarrage de Nginx"

systemctl reload nginx
print_success "Nginx rechargé"

print_header "6️⃣  Vérification des ports"

print_info "Ports en écoute:"
netstat -tlnp | grep -E ':(443|8443|8444|8445) ' | grep nginx

print_header "7️⃣  Configuration du firewall"

print_info "Ouverture des ports nécessaires..."
ufw allow 80/tcp 2>/dev/null
ufw allow 443/tcp 2>/dev/null
ufw allow 8443/tcp 2>/dev/null
ufw allow 8444/tcp 2>/dev/null
ufw allow 8445/tcp 2>/dev/null

print_success "Ports configurés"

print_header "8️⃣  Test de connectivité"

sleep 2

print_info "Test du port 443..."
if curl -k -s -o /dev/null -w "%{http_code}" https://$DOMAIN | grep -q "200\|301\|302"; then
    print_success "Port 443 accessible"
else
    print_warning "Port 443 non accessible"
fi

print_info "Test du port 8443 (API)..."
if timeout 5 bash -c "echo > /dev/tcp/$DOMAIN/8443" 2>/dev/null; then
    print_success "Port 8443 accessible"
else
    print_error "Port 8443 NON accessible"
    print_info "Vérifiez votre firewall/hébergeur"
fi

print_header "✅ Configuration terminée"

echo ""
print_info "Testez maintenant avec:"
echo "  curl -k https://$DOMAIN:8443/auth/v1/health"
echo ""
print_warning "Note: Si le port 8443 n'est toujours pas accessible,"
print_warning "vérifiez le firewall de votre hébergeur (OVH, etc.)"

