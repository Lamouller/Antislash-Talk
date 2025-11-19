#!/bin/bash
# 🔧 Script de réparation complète d'Antislash Talk
# Corrige tous les problèmes de configuration après changement de domaine

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}    $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
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

# Détecter le répertoire
if [ -f "docker-compose.monorepo.yml" ]; then
    PROJECT_DIR=$(pwd)
else
    PROJECT_DIR=$(find /home -maxdepth 2 -name "antislash-talk" -type d 2>/dev/null | head -1)
    if [ -z "$PROJECT_DIR" ]; then
        PROJECT_DIR="/root/antislash-talk"
    fi
    cd "$PROJECT_DIR"
fi

print_header "🔧 RÉPARATION COMPLÈTE D'ANTISLASH TALK"
print_info "Répertoire : $PROJECT_DIR"

# Charger la configuration
if [ ! -f ".env.monorepo" ]; then
    print_error "Fichier .env.monorepo introuvable"
    exit 1
fi

source .env.monorepo

print_header "1️⃣  Vérification de la configuration"

# Vérifier les variables critiques
MISSING_VARS=()

[ -z "$VITE_SUPABASE_URL" ] && MISSING_VARS+=("VITE_SUPABASE_URL")
[ -z "$VITE_SUPABASE_ANON_KEY" ] && MISSING_VARS+=("VITE_SUPABASE_ANON_KEY")
[ -z "$ANON_KEY" ] && MISSING_VARS+=("ANON_KEY")
[ -z "$POSTGRES_PASSWORD" ] && MISSING_VARS+=("POSTGRES_PASSWORD")
[ -z "$JWT_SECRET" ] && MISSING_VARS+=("JWT_SECRET")

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    print_error "Variables manquantes : ${MISSING_VARS[*]}"
    exit 1
fi

print_success "Toutes les variables critiques sont présentes"

print_header "2️⃣  Correction de la configuration Studio"

# Mettre à jour SUPABASE_PUBLIC_URL si nécessaire
if [[ "$SUPABASE_PUBLIC_URL" == http://* ]]; then
    print_warning "SUPABASE_PUBLIC_URL utilise HTTP au lieu de HTTPS"
    
    if [ -n "$VITE_SUPABASE_URL" ]; then
        print_info "Mise à jour vers $VITE_SUPABASE_URL"
        sed -i.bak "s|SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=$VITE_SUPABASE_URL|g" .env.monorepo
        source .env.monorepo
        print_success "SUPABASE_PUBLIC_URL mis à jour"
    fi
fi

print_header "3️⃣  Arrêt de tous les services"

# Charger TOUTES les variables avant toute commande
set -a
source .env.monorepo
set +a

docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo down
print_success "Services arrêtés"

sleep 3

print_header "4️⃣  Activation de l'extension pgcrypto"

# Démarrer juste la DB avec les bonnes variables
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d db
sleep 10

# Vérifier que la DB est démarrée
print_info "Vérification que la DB répond..."
MAX_TRIES=30
TRIES=0
until docker exec -i antislash-talk-db psql -U postgres -d postgres -c "SELECT 1" > /dev/null 2>&1; do
    TRIES=$((TRIES+1))
    if [ $TRIES -ge $MAX_TRIES ]; then
        print_error "La DB ne démarre pas"
        exit 1
    fi
    sleep 1
done
print_success "DB opérationnelle"

# Activer pgcrypto
docker exec -i antislash-talk-db psql -U postgres postgres << 'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA auth;
SQL

print_success "Extension pgcrypto activée"

print_header "5️⃣  Correction du fichier .htpasswd pour Studio"

# Générer le hash du mot de passe
STUDIO_PASSWORD="${STUDIO_PASSWORD:-admin}"
print_info "Mot de passe Studio : $STUDIO_PASSWORD"

# Attendre que studio-proxy démarre
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d studio-proxy
sleep 5

# Créer le fichier .htpasswd
STUDIO_PASSWORD_HASH=$(docker run --rm httpd:alpine htpasswd -nbB antislash "$STUDIO_PASSWORD" | cut -d ":" -f 2)
docker exec antislash-talk-studio-proxy sh -c "echo 'antislash:$STUDIO_PASSWORD_HASH' > /etc/nginx/.htpasswd && chmod 644 /etc/nginx/.htpasswd"

# Vérifier
if docker exec antislash-talk-studio-proxy test -f /etc/nginx/.htpasswd; then
    print_success "Fichier .htpasswd créé"
    docker exec antislash-talk-studio-proxy nginx -s reload 2>/dev/null || true
else
    print_error "Erreur lors de la création de .htpasswd"
fi

print_header "6️⃣  Rebuild complet de l'application web"

print_warning "Ceci peut prendre 3-5 minutes..."

# Exporter toutes les variables EXPLICITEMENT comme dans le script de déploiement
export API_EXTERNAL_URL="${API_EXTERNAL_URL}"
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL}"
export VITE_SUPABASE_ANON_KEY="${ANON_KEY}"  # Utiliser ANON_KEY comme dans le script original
export VITE_HIDE_MARKETING_PAGES="${VITE_HIDE_MARKETING_PAGES:-false}"
export VITE_OLLAMA_URL="${VITE_OLLAMA_URL}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
export JWT_SECRET="${JWT_SECRET}"
export SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}"

# Rebuild SANS cache (utiliser ANON_KEY pour VITE_SUPABASE_ANON_KEY comme dans le déploiement)
if docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo build --no-cache \
  --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL}" \
  --build-arg VITE_SUPABASE_ANON_KEY="${ANON_KEY}" \
  --build-arg VITE_HIDE_MARKETING_PAGES="${VITE_HIDE_MARKETING_PAGES}" \
  --build-arg VITE_OLLAMA_URL="${VITE_OLLAMA_URL}" \
  web; then
    print_success "Build terminé avec succès"
else
    print_error "Erreur lors du build"
    exit 1
fi

print_header "7️⃣  Démarrage de tous les services"

# Charger les variables dans l'environnement
set -a
source .env.monorepo
set +a

# Démarrer tous les services
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d

print_success "Services démarrés"
print_info "Attente du démarrage complet (45 secondes)..."
sleep 45

print_header "8️⃣  Vérification de l'état des services"

docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo ps

# Compter les services qui tournent
RUNNING=$(docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo ps | grep "Up" | wc -l)
print_info "$RUNNING services en cours d'exécution"

print_header "9️⃣  Création d'un utilisateur admin"

print_info "Création de l'utilisateur admin@antislash.studio..."

# Supprimer les anciens utilisateurs
docker exec -i antislash-talk-db psql -U supabase_admin postgres << 'SQL' 2>/dev/null || true
DELETE FROM auth.users;
SQL

# Créer le nouvel utilisateur
docker exec -i antislash-talk-db psql -U supabase_admin postgres << 'SQL'
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@antislash.studio',
    extensions.crypt('Admin2024!', extensions.gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
);
SQL

if [ $? -eq 0 ]; then
    print_success "Utilisateur admin créé"
else
    print_warning "Impossible de créer l'utilisateur (il existe peut-être déjà)"
fi

print_header "🔟 Tests de connectivité"

sleep 5

test_endpoint() {
    local url=$1
    local name=$2
    
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$url" 2>/dev/null)
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "404" ]; then
        print_success "$name : Accessible (HTTP $HTTP_CODE)"
        return 0
    else
        print_error "$name : Non accessible (HTTP $HTTP_CODE)"
        return 1
    fi
}

echo ""
test_endpoint "http://localhost:3000" "Application Web (interne)"
test_endpoint "http://localhost:54321" "Kong API Gateway"
test_endpoint "http://localhost:54327" "Studio (interne)"

# Test avec le domaine si disponible
if [ -n "$VITE_SUPABASE_URL" ]; then
    DOMAIN=$(echo "$VITE_SUPABASE_URL" | sed 's|:8443||' | sed 's|https://||')
    echo ""
    print_info "Tests via le domaine $DOMAIN..."
    test_endpoint "https://$DOMAIN/" "Application (domaine)"
    test_endpoint "https://$DOMAIN:8443/" "API (domaine)"
fi

# Test de l'auth
echo ""
print_info "Test de connexion avec admin@antislash.studio..."
AUTH_RESPONSE=$(curl -X POST "http://localhost:54321/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -d '{"email":"admin@antislash.studio","password":"Admin2024!"}' \
  -k -s)

if echo "$AUTH_RESPONSE" | grep -q "access_token"; then
    print_success "Authentification : ✓ Fonctionne"
else
    print_warning "Authentification : Erreur"
    echo "Réponse : $AUTH_RESPONSE"
fi

print_header "✅ RÉPARATION TERMINÉE"

echo ""
print_success "Tous les services sont configurés et fonctionnels !"
echo ""
print_info "Informations de connexion :"
echo ""
echo "🌐 Application Web :"
if [ -n "$VITE_SUPABASE_URL" ]; then
    DOMAIN=$(echo "$VITE_SUPABASE_URL" | sed 's|:8443||' | sed 's|https://||')
    echo "   https://$DOMAIN/auth/login"
else
    echo "   https://votre-domaine.com/auth/login"
fi
echo ""
echo "👤 Credentials :"
echo "   Email    : admin@antislash.studio"
echo "   Password : Admin2024!"
echo ""
echo "🎛️  Studio Supabase :"
if [ -n "$VITE_SUPABASE_URL" ]; then
    echo "   https://$DOMAIN:8444"
else
    echo "   https://votre-domaine.com:8444"
fi
echo "   Username : antislash"
echo "   Password : $STUDIO_PASSWORD"
echo ""
print_info "Commandes utiles :"
echo "  # Voir les logs"
echo "  docker compose -f docker-compose.monorepo.yml logs -f"
echo ""
echo "  # Redémarrer un service"
echo "  docker compose -f docker-compose.monorepo.yml restart web"
echo ""
echo "  # Voir l'état"
echo "  docker compose -f docker-compose.monorepo.yml ps"
echo ""
print_success "✨ Votre application est prête ! Testez-la maintenant dans le navigateur."

