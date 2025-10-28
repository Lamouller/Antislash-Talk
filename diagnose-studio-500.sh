#!/bin/bash
# Script de diagnostic pour l'erreur 500 de Studio

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

print_header "DIAGNOSTIC ERREUR 500 STUDIO"

# 1. Vérifier l'état des containers
print_header "1. État des containers"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(studio|proxy|kong|db)"

# 2. Logs du proxy Studio
print_header "2. Logs du proxy Studio (nginx)"
echo "Dernières entrées du log :"
docker logs antislash-talk-studio-proxy --tail 20 2>&1 || print_error "Impossible de lire les logs du proxy"

# 3. Vérifier la configuration du proxy
print_header "3. Configuration nginx du proxy"
docker exec antislash-talk-studio-proxy cat /etc/nginx/nginx.conf 2>/dev/null | grep -A10 "location /" || print_error "Impossible de lire la config nginx"

# 4. Vérifier l'authentification
print_header "4. Vérification de l'authentification"
if docker exec antislash-talk-studio-proxy test -f /etc/nginx/.htpasswd; then
    print_success "Fichier .htpasswd présent"
    echo "Contenu (hash) :"
    docker exec antislash-talk-studio-proxy cat /etc/nginx/.htpasswd | cut -d: -f1
else
    print_error "Fichier .htpasswd manquant !"
fi

# 5. Tester la connexion Studio -> Kong
print_header "5. Test connexion Studio -> Kong"
docker exec antislash-talk-studio wget -O- -q --timeout=5 http://kong:8000 2>&1 | head -5 || print_warning "Kong non accessible depuis Studio"

# 6. Vérifier les variables d'environnement Studio
print_header "6. Variables d'environnement Studio"
docker exec antislash-talk-studio printenv | grep -E "(SUPABASE|STUDIO|NEXT_|DATABASE_URL)" | sort

# 7. Vérifier la base de données
print_header "7. État de la base de données"
docker exec antislash-talk-db psql -U postgres -c "SELECT current_database(), current_user, version();" 2>&1 || print_error "Impossible de se connecter à la DB"

# 8. Vérifier les connexions réseau
print_header "8. Connexions réseau actives"
docker exec antislash-talk-studio-proxy netstat -an 2>/dev/null | grep -E "(LISTEN|ESTABLISHED)" | grep -E "(3000|3001)" || print_info "Pas de connexions actives trouvées"

# 9. Tester l'accès direct au Studio (sans proxy)
print_header "9. Test accès direct Studio"
curl -s -o /dev/null -w "HTTP Code: %{http_code}\n" http://localhost:3001 || print_warning "Studio non accessible en direct"

# 10. Vérifier Kong
print_header "10. État de Kong"
docker logs antislash-talk-kong --tail 20 2>&1 | grep -E "(error|ERROR|warn|WARN)" || print_info "Pas d'erreurs récentes dans Kong"

# 11. Vérifier les permissions des fichiers
print_header "11. Permissions dans le container Studio"
docker exec antislash-talk-studio ls -la /app 2>&1 | head -10 || print_warning "Impossible de lister /app"

# 12. Résumé et recommandations
print_header "RÉSUMÉ ET RECOMMANDATIONS"

echo -e "\n${YELLOW}Si l'erreur 500 persiste, essayez :${NC}"
echo "1. Redémarrer le proxy Studio :"
echo "   docker restart antislash-talk-studio-proxy"
echo ""
echo "2. Reconfigurer l'authentification :"
echo "   ./fix-studio-htpasswd.sh"
echo ""
echo "3. Vérifier les logs en temps réel :"
echo "   docker logs -f antislash-talk-studio-proxy"
echo ""
echo "4. Tester sans authentification (temporairement) :"
echo "   docker exec antislash-talk-studio-proxy mv /etc/nginx/.htpasswd /etc/nginx/.htpasswd.bak"
echo "   docker exec antislash-talk-studio-proxy nginx -s reload"
echo ""
echo "5. Vérifier la connexion à la base de données depuis Studio :"
echo "   docker exec antislash-talk-studio node -e \"console.log(process.env.DATABASE_URL)\""
echo ""

# Bonus : afficher les erreurs spécifiques si trouvées
if docker logs antislash-talk-studio 2>&1 | grep -q "Error\|error\|ERROR"; then
    print_header "⚠️ ERREURS TROUVÉES DANS STUDIO"
    docker logs antislash-talk-studio 2>&1 | grep -E "(Error|error|ERROR)" | tail -10
fi
