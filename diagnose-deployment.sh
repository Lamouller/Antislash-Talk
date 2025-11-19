#!/bin/bash
# 🔍 Script de diagnostic complet pour Antislash Talk
# Vérifie tous les aspects du déploiement

set +e  # Continue même en cas d'erreur

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

ISSUES_FOUND=0

print_header "🔍 DIAGNOSTIC COMPLET DU DÉPLOIEMENT"

# Vérifier le répertoire du projet
PROJECT_DIR="$HOME/antislash-talk"
if [ ! -d "$PROJECT_DIR" ]; then
    print_error "Répertoire $PROJECT_DIR introuvable"
    echo "Veuillez spécifier le répertoire du projet :"
    read -p "Chemin : " PROJECT_DIR
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "Répertoire toujours introuvable. Abandon."
        exit 1
    fi
fi

cd "$PROJECT_DIR"
print_success "Projet trouvé dans $PROJECT_DIR"

# ========================================
# 1. VÉRIFICATION DOCKER
# ========================================
print_header "1️⃣  Vérification Docker"

if ! command -v docker &> /dev/null; then
    print_error "Docker n'est pas installé"
    ((ISSUES_FOUND++))
else
    print_success "Docker installé"
    docker --version
fi

if ! docker ps &> /dev/null; then
    print_error "Docker n'est pas démarré ou permissions insuffisantes"
    ((ISSUES_FOUND++))
else
    print_success "Docker fonctionne"
fi

# ========================================
# 2. VÉRIFICATION DES CONTAINERS
# ========================================
print_header "2️⃣  Vérification des Containers"

if [ -f "docker-compose.monorepo.yml" ]; then
    echo ""
    docker compose -f docker-compose.monorepo.yml ps
    echo ""
    
    # Vérifier les containers critiques
    CONTAINERS=("antislash-talk-web" "antislash-talk-db" "antislash-talk-kong" "antislash-talk-auth")
    
    for container in "${CONTAINERS[@]}"; do
        if docker ps | grep -q "$container"; then
            STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null)
            if [ "$STATUS" = "running" ]; then
                print_success "$container : Running"
            else
                print_error "$container : $STATUS"
                ((ISSUES_FOUND++))
            fi
        else
            print_error "$container : Container non trouvé"
            ((ISSUES_FOUND++))
        fi
    done
else
    print_error "docker-compose.monorepo.yml introuvable"
    ((ISSUES_FOUND++))
fi

# ========================================
# 3. VÉRIFICATION DES LOGS
# ========================================
print_header "3️⃣  Dernières erreurs dans les logs"

echo ""
print_info "Logs Web (5 dernières lignes) :"
docker compose -f docker-compose.monorepo.yml logs --tail=5 web 2>/dev/null || print_warning "Impossible de lire les logs web"

echo ""
print_info "Erreurs récentes Docker :"
docker compose -f docker-compose.monorepo.yml logs --tail=20 2>&1 | grep -i "error\|failed\|fatal" | head -10 || print_success "Aucune erreur récente"

# ========================================
# 4. VÉRIFICATION NGINX
# ========================================
print_header "4️⃣  Vérification Nginx"

if ! command -v nginx &> /dev/null; then
    print_error "Nginx n'est pas installé"
    ((ISSUES_FOUND++))
else
    print_success "Nginx installé"
    nginx -v 2>&1
fi

# Test de la configuration
if sudo nginx -t 2>&1 | grep -q "successful"; then
    print_success "Configuration Nginx valide"
else
    print_error "Configuration Nginx invalide"
    sudo nginx -t
    ((ISSUES_FOUND++))
fi

# Vérifier le statut
if sudo systemctl is-active --quiet nginx; then
    print_success "Nginx actif"
else
    print_error "Nginx inactif"
    sudo systemctl status nginx --no-pager -l
    ((ISSUES_FOUND++))
fi

# Vérifier les fichiers de config
if [ -f "/etc/nginx/sites-available/antislash-talk-ssl" ]; then
    print_success "Configuration SSL trouvée"
    echo ""
    print_info "Domaines configurés :"
    grep "server_name" /etc/nginx/sites-available/antislash-talk-ssl | head -5
else
    print_error "Configuration SSL introuvable"
    ((ISSUES_FOUND++))
fi

# ========================================
# 5. VÉRIFICATION DES PORTS
# ========================================
print_header "5️⃣  Vérification des Ports"

PORTS=("80" "443" "3000" "8443" "8444" "8445" "54321")

for port in "${PORTS[@]}"; do
    if sudo netstat -tuln 2>/dev/null | grep -q ":$port " || sudo ss -tuln 2>/dev/null | grep -q ":$port "; then
        PROCESS=$(sudo lsof -i :$port -sTCP:LISTEN -t 2>/dev/null | head -1)
        if [ -n "$PROCESS" ]; then
            PROCESS_NAME=$(ps -p $PROCESS -o comm= 2>/dev/null)
            print_success "Port $port : Ouvert ($PROCESS_NAME)"
        else
            print_success "Port $port : Ouvert"
        fi
    else
        print_error "Port $port : Fermé"
        ((ISSUES_FOUND++))
    fi
done

# ========================================
# 6. VÉRIFICATION DNS/DOMAINE
# ========================================
print_header "6️⃣  Vérification DNS"

# Extraire le domaine de la config
DOMAIN=$(grep "server_name" /etc/nginx/sites-available/antislash-talk-ssl 2>/dev/null | grep -v "_" | head -1 | awk '{print $2}' | tr -d ';')

if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "_" ]; then
    print_info "Domaine configuré : $DOMAIN"
    
    # Vérifier la résolution DNS
    if host "$DOMAIN" &> /dev/null; then
        DNS_IP=$(host "$DOMAIN" | grep "has address" | head -1 | awk '{print $4}')
        print_success "DNS résout vers : $DNS_IP"
        
        # Vérifier l'IP du serveur
        SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null)
        if [ -n "$SERVER_IP" ]; then
            print_info "IP du serveur : $SERVER_IP"
            if [ "$DNS_IP" = "$SERVER_IP" ]; then
                print_success "DNS correctement configuré !"
            else
                print_warning "DNS pointe vers $DNS_IP mais serveur est $SERVER_IP"
                print_info "Attendez la propagation DNS ou mettez à jour vos enregistrements"
            fi
        fi
    else
        print_error "Impossible de résoudre $DOMAIN"
        print_info "Vérifiez vos enregistrements DNS"
        ((ISSUES_FOUND++))
    fi
else
    print_warning "Aucun domaine configuré (utilise server_name _)"
fi

# ========================================
# 7. TESTS DE CONNECTIVITÉ
# ========================================
print_header "7️⃣  Tests de Connectivité"

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null)
print_info "IP du serveur : $SERVER_IP"

test_url() {
    local url=$1
    local name=$2
    local expected_code=${3:-200}
    
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null)
    
    if [ "$HTTP_CODE" = "$expected_code" ] || [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
        print_success "$name : ✓ Accessible (HTTP $HTTP_CODE)"
    else
        print_error "$name : ✗ Non accessible (HTTP $HTTP_CODE)"
        ((ISSUES_FOUND++))
    fi
}

echo ""
print_info "Test des services locaux (localhost) :"
test_url "http://localhost:3000" "Application Web (local)"
test_url "http://localhost:54321" "API Supabase (local)"
test_url "http://localhost:54327" "Studio Supabase (local)"
test_url "http://localhost:11434" "Ollama (local)"

echo ""
print_info "Test des services via Nginx (HTTPS) :"
test_url "https://localhost" "Application Web (HTTPS)"
test_url "https://localhost:8443" "API Supabase (HTTPS)"
test_url "https://localhost:8444" "Studio Supabase (HTTPS)"
test_url "https://localhost:8445" "Ollama (HTTPS)"

if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "_" ]; then
    echo ""
    print_info "Test via le domaine $DOMAIN :"
    test_url "https://$DOMAIN" "Application ($DOMAIN)"
    test_url "https://$DOMAIN:8443" "API ($DOMAIN)"
fi

# ========================================
# 8. VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT
# ========================================
print_header "8️⃣  Variables d'Environnement"

if [ -f ".env.monorepo" ]; then
    print_success "Fichier .env.monorepo trouvé"
    echo ""
    print_info "Configuration actuelle :"
    grep -E "VITE_SUPABASE_URL|API_EXTERNAL_URL|VITE_OLLAMA_URL|SITE_URL" .env.monorepo 2>/dev/null | head -10
else
    print_error "Fichier .env.monorepo introuvable"
    ((ISSUES_FOUND++))
fi

if [ -f "apps/web/.env" ]; then
    print_success "Fichier apps/web/.env trouvé"
else
    print_warning "Fichier apps/web/.env introuvable"
fi

# ========================================
# 9. VÉRIFICATION SSL
# ========================================
print_header "9️⃣  Certificats SSL"

if [ -f "/etc/nginx/ssl/selfsigned.crt" ]; then
    print_success "Certificat auto-signé trouvé"
    EXPIRY=$(sudo openssl x509 -enddate -noout -in /etc/nginx/ssl/selfsigned.crt 2>/dev/null | cut -d= -f2)
    print_info "Expire le : $EXPIRY"
else
    print_warning "Certificat auto-signé introuvable"
fi

if command -v certbot &> /dev/null; then
    print_success "Certbot installé"
    CERTS=$(sudo certbot certificates 2>/dev/null | grep "Certificate Name" | wc -l)
    if [ "$CERTS" -gt 0 ]; then
        print_success "Let's Encrypt : $CERTS certificat(s) trouvé(s)"
        sudo certbot certificates 2>/dev/null | grep -E "Certificate Name|Expiry Date|Domains" | head -10
    else
        print_info "Aucun certificat Let's Encrypt configuré"
    fi
else
    print_info "Certbot non installé (certificats auto-signés uniquement)"
fi

# ========================================
# 10. VÉRIFICATION FIREWALL
# ========================================
print_header "🔟 Vérification Firewall"

if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "Status: active"; then
        print_success "UFW actif"
        echo ""
        print_info "Règles actives :"
        sudo ufw status | grep -E "443|8443|8444|8445|80"
        
        # Vérifier les ports requis
        REQUIRED_PORTS=("443" "8443" "8444" "8445")
        for port in "${REQUIRED_PORTS[@]}"; do
            if sudo ufw status | grep -q "$port"; then
                print_success "Port $port autorisé"
            else
                print_warning "Port $port non autorisé dans UFW"
                print_info "Exécutez : sudo ufw allow $port/tcp"
            fi
        done
    else
        print_info "UFW inactif"
    fi
else
    print_info "UFW non installé"
fi

# ========================================
# 11. ESPACE DISQUE
# ========================================
print_header "1️⃣1️⃣  Espace Disque"

df -h / | tail -1 | awk '{
    used=$5+0;
    if (used > 90) {
        print "\033[0;31m❌ Espace disque critique : " $5 " utilisé\033[0m"
    } else if (used > 80) {
        print "\033[1;33m⚠️  Espace disque élevé : " $5 " utilisé\033[0m"
    } else {
        print "\033[0;32m✅ Espace disque OK : " $5 " utilisé\033[0m"
    }
}'

echo ""
print_info "Top 5 des répertoires volumineux :"
sudo du -h "$PROJECT_DIR" 2>/dev/null | sort -rh | head -5 || print_warning "Impossible de lire l'usage disque"

# ========================================
# 12. RÉSUMÉ ET RECOMMANDATIONS
# ========================================
print_header "📊 RÉSUMÉ DU DIAGNOSTIC"

echo ""
if [ $ISSUES_FOUND -eq 0 ]; then
    print_success "Aucun problème détecté ! 🎉"
    echo ""
    print_info "Votre application devrait être accessible."
    if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "_" ]; then
        echo ""
        echo "URLs d'accès :"
        echo "  🌐 Application : https://$DOMAIN/"
        echo "  🔌 API        : https://$DOMAIN:8443/"
        echo "  🎛️  Studio     : https://$DOMAIN:8444/"
        echo "  🤖 Ollama     : https://$DOMAIN:8445/"
    fi
else
    print_warning "$ISSUES_FOUND problème(s) détecté(s)"
    echo ""
    print_header "🔧 ACTIONS RECOMMANDÉES"
    echo ""
    
    print_info "1. Vérifiez les logs détaillés :"
    echo "   docker compose -f docker-compose.monorepo.yml logs -f web"
    echo ""
    
    print_info "2. Redémarrez les services si nécessaire :"
    echo "   docker compose -f docker-compose.monorepo.yml restart"
    echo "   sudo systemctl restart nginx"
    echo ""
    
    print_info "3. Vérifiez les erreurs Nginx :"
    echo "   sudo tail -f /var/log/nginx/error.log"
    echo ""
    
    print_info "4. Testez la configuration Nginx :"
    echo "   sudo nginx -t"
    echo ""
fi

print_header "📝 Logs et Débogage"
echo ""
echo "Commandes utiles pour déboguer :"
echo ""
echo "# Voir les logs en temps réel"
echo "docker compose -f docker-compose.monorepo.yml logs -f"
echo ""
echo "# Logs Nginx"
echo "sudo tail -f /var/log/nginx/error.log"
echo "sudo tail -f /var/log/nginx/access.log"
echo ""
echo "# Redémarrer tout"
echo "docker compose -f docker-compose.monorepo.yml restart"
echo "sudo systemctl restart nginx"
echo ""
echo "# Vérifier un service spécifique"
echo "docker compose -f docker-compose.monorepo.yml logs web"
echo "docker exec -it antislash-talk-web sh"
echo ""

print_header "✅ DIAGNOSTIC TERMINÉ"
echo ""

