#!/bin/bash
# Script de diagnostic et correction automatique des erreurs

cd ~/antislash-talk

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    🔍 DIAGNOSTIC ET CORRECTION AUTOMATIQUE                ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Fonction pour afficher le statut
print_check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# ============================================================
# 1. VÉRIFICATION DES SERVICES DOCKER
# ============================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1️⃣  VÉRIFICATION DES SERVICES DOCKER${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

SERVICES=("db" "kong" "auth" "rest" "realtime" "storage" "meta" "studio" "web" "ollama")
MISSING_SERVICES=()

for service in "${SERVICES[@]}"; do
    if docker ps | grep -q "antislash-talk-$service"; then
        print_check 0 "$service est actif"
    else
        print_check 1 "$service n'est PAS actif"
        MISSING_SERVICES+=("$service")
    fi
done

if [ ${#MISSING_SERVICES[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Services manquants: ${MISSING_SERVICES[*]}${NC}"
    read -p "Voulez-vous redémarrer les services manquants ? (o/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        echo -e "${BLUE}🔄 Redémarrage des services...${NC}"
        docker compose -f docker-compose.monorepo.yml up -d
        sleep 5
        echo -e "${GREEN}✅ Services redémarrés${NC}"
    fi
fi

# ============================================================
# 2. VÉRIFICATION NGINX HTTPS
# ============================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2️⃣  VÉRIFICATION NGINX HTTPS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Vérifier si Nginx écoute sur les bons ports
PORTS=(443 8443 8444 8445)
MISSING_PORTS=()

for port in "${PORTS[@]}"; do
    if sudo ss -tulpn | grep -q ":$port"; then
        print_check 0 "Nginx écoute sur le port $port"
    else
        print_check 1 "Nginx N'écoute PAS sur le port $port"
        MISSING_PORTS+=("$port")
    fi
done

if [ ${#MISSING_PORTS[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Ports manquants: ${MISSING_PORTS[*]}${NC}"
    
    if [ ! -f "add-ollama-to-nginx.sh" ]; then
        echo -e "${RED}❌ Script add-ollama-to-nginx.sh introuvable${NC}"
        echo -e "${YELLOW}Faites: git pull origin main${NC}"
    else
        read -p "Voulez-vous configurer Nginx HTTPS (avec Ollama sur 8445) ? (o/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Oo]$ ]]; then
            chmod +x add-ollama-to-nginx.sh
            sudo ./add-ollama-to-nginx.sh
        fi
    fi
fi

# ============================================================
# 3. VÉRIFICATION DES PROFILS UTILISATEURS
# ============================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3️⃣  VÉRIFICATION DES PROFILS UTILISATEURS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

USERS_COUNT=$(docker exec antislash-talk-db psql -U postgres -d postgres -t -c "SELECT count(*) FROM auth.users;" 2>/dev/null | tr -d ' ')
PROFILES_COUNT=$(docker exec antislash-talk-db psql -U postgres -d postgres -t -c "SELECT count(*) FROM public.profiles;" 2>/dev/null | tr -d ' ')

echo "👥 Utilisateurs dans auth.users: $USERS_COUNT"
echo "📋 Profils dans public.profiles: $PROFILES_COUNT"

if [ "$USERS_COUNT" -gt "$PROFILES_COUNT" ]; then
    echo -e "${YELLOW}⚠️  Il y a plus d'utilisateurs que de profils !${NC}"
    read -p "Voulez-vous créer les profils manquants ? (o/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        echo -e "${BLUE}🔄 Création des profils manquants...${NC}"
        docker exec antislash-talk-db psql -U postgres -d postgres << 'EOF'
INSERT INTO public.profiles (id, email, full_name, role)
SELECT u.id, u.email, u.email, 'user'
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
EOF
        echo -e "${GREEN}✅ Profils créés${NC}"
    fi
fi

# ============================================================
# 4. VÉRIFICATION REALTIME WEBSOCKET
# ============================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4️⃣  VÉRIFICATION REALTIME WEBSOCKET${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if docker ps | grep -q "antislash-talk-realtime"; then
    print_check 0 "Service Realtime actif"
    
    # Vérifier les logs pour des erreurs
    REALTIME_ERRORS=$(docker logs antislash-talk-realtime --tail 20 2>&1 | grep -i "error" | wc -l)
    if [ "$REALTIME_ERRORS" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $REALTIME_ERRORS erreur(s) dans les logs Realtime${NC}"
        read -p "Voulez-vous redémarrer Realtime ? (o/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Oo]$ ]]; then
            docker compose -f docker-compose.monorepo.yml restart realtime
            echo -e "${GREEN}✅ Realtime redémarré${NC}"
        fi
    fi
else
    print_check 1 "Service Realtime NON actif"
    read -p "Voulez-vous démarrer Realtime ? (o/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        docker compose -f docker-compose.monorepo.yml up -d realtime
        echo -e "${GREEN}✅ Realtime démarré${NC}"
    fi
fi

# ============================================================
# 5. VÉRIFICATION OLLAMA
# ============================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}5️⃣  VÉRIFICATION OLLAMA${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if docker ps | grep -q "antislash-talk-ollama"; then
    print_check 0 "Container Ollama actif"
    
    # Test API
    if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
        print_check 0 "API Ollama accessible (HTTP)"
    else
        print_check 1 "API Ollama NON accessible (HTTP)"
    fi
    
    # Test HTTPS via Nginx
    if curl -sfk https://localhost:8445/api/tags > /dev/null 2>&1; then
        print_check 0 "API Ollama accessible (HTTPS via Nginx)"
    else
        print_check 1 "API Ollama NON accessible (HTTPS via Nginx)"
        echo -e "${YELLOW}💡 Configurez Nginx HTTPS avec: sudo ./add-ollama-to-nginx.sh${NC}"
    fi
    
    # Vérifier les modèles
    MODELS_COUNT=$(curl -sf http://localhost:11434/api/tags 2>/dev/null | grep -o '"models":\[' | wc -l)
    if [ "$MODELS_COUNT" -gt 0 ]; then
        echo -e "${GREEN}📦 Modèles Ollama installés${NC}"
        docker exec antislash-talk-ollama ollama list
    else
        echo -e "${YELLOW}⚠️  Aucun modèle Ollama installé${NC}"
        read -p "Voulez-vous installer un modèle ? (recommandé: llama3.2:3b) (o/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Oo]$ ]]; then
            echo -e "${BLUE}📥 Téléchargement de llama3.2:3b (peut prendre plusieurs minutes)...${NC}"
            docker exec antislash-talk-ollama ollama pull llama3.2:3b
            echo -e "${GREEN}✅ Modèle installé${NC}"
        fi
    fi
else
    print_check 1 "Container Ollama NON actif"
fi

# ============================================================
# 6. TEST DE CONNECTIVITÉ GLOBALE
# ============================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}6️⃣  TEST DE CONNECTIVITÉ GLOBALE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

VPS_IP=$(curl -4 -s ifconfig.me 2>/dev/null || echo "37.59.118.101")

echo "🌐 Test des endpoints publics..."

# Test Web App
if curl -sfk "https://$VPS_IP" -o /dev/null 2>&1; then
    print_check 0 "Web App (HTTPS)"
else
    print_check 1 "Web App (HTTPS)"
fi

# Test API
if curl -sfk "https://$VPS_IP:8443/rest/v1/" -o /dev/null 2>&1; then
    print_check 0 "API Supabase (HTTPS:8443)"
else
    print_check 1 "API Supabase (HTTPS:8443)"
fi

# Test Studio
if curl -sfk "https://$VPS_IP:8444" -o /dev/null 2>&1; then
    print_check 0 "Studio (HTTPS:8444)"
else
    print_check 1 "Studio (HTTPS:8444)"
fi

# Test Ollama
if curl -sfk "https://$VPS_IP:8445/api/tags" -o /dev/null 2>&1; then
    print_check 0 "Ollama API (HTTPS:8445)"
else
    print_check 1 "Ollama API (HTTPS:8445)"
fi

# ============================================================
# 7. RÉSUMÉ ET RECOMMANDATIONS
# ============================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}7️⃣  RÉSUMÉ ET RECOMMANDATIONS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo -e "${GREEN}✅ Diagnostic terminé !${NC}"
echo ""
echo -e "${YELLOW}📋 Actions recommandées :${NC}"
echo ""

if [ ${#MISSING_SERVICES[@]} -gt 0 ]; then
    echo "  1. Redémarrer les services manquants:"
    echo "     docker compose -f ~/antislash-talk/docker-compose.monorepo.yml up -d"
    echo ""
fi

if [ ${#MISSING_PORTS[@]} -gt 0 ]; then
    echo "  2. Configurer Nginx HTTPS complet:"
    echo "     cd ~/antislash-talk && sudo ./add-ollama-to-nginx.sh"
    echo ""
fi

if [ "$USERS_COUNT" -gt "$PROFILES_COUNT" ]; then
    echo "  3. Créer les profils manquants (déjà proposé ci-dessus)"
    echo ""
fi

echo "  4. Vérifier les logs des services en erreur:"
echo "     docker logs antislash-talk-realtime --tail 50"
echo "     docker logs antislash-talk-auth --tail 50"
echo ""

echo "  5. Rebuilder le frontend si les variables d'env ont changé:"
echo "     cd ~/antislash-talk && ./rebuild-web.sh"
echo ""

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    📍 URLS D'ACCÈS                                        ║${NC}"
echo -e "${BLUE}╠═══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  🌐 App      : https://$VPS_IP                      ${NC}"
echo -e "${GREEN}║  🔧 Studio   : https://$VPS_IP:8444                 ${NC}"
echo -e "${GREEN}║  🔌 API      : https://$VPS_IP:8443                 ${NC}"
echo -e "${GREEN}║  🤖 Ollama   : https://$VPS_IP:8445                 ${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

