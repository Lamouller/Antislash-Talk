#!/bin/bash

# Script pour continuer le déploiement après correction
set -e

# Couleurs
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

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

cd /home/debian/antislash-talk

print_header "REPRISE DU DÉPLOIEMENT"

# Charger les variables d'environnement
if [ ! -f .env.monorepo ]; then
    print_error "Fichier .env.monorepo introuvable !"
    print_info "Relancez plutôt ./deploy-vps-v3.sh"
    exit 1
fi

source .env.monorepo

# Vérifier si PostgreSQL est en cours d'exécution
if ! docker ps | grep -q antislash-talk-db; then
    print_info "PostgreSQL n'est pas démarré. Relance complète nécessaire."
    print_info "Exécutez : ./deploy-vps-v3.sh"
    exit 1
fi

print_success "PostgreSQL est en cours d'exécution"

# Vérifier l'état des migrations
print_info "Vérification des migrations..."
MIGRATIONS_COUNT=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")

if [ "$MIGRATIONS_COUNT" -lt "5" ]; then
    print_info "Application des migrations restantes..."
    
    # Appliquer les migrations
    for migration in packages/supabase/migrations/*.sql; do
        if [ -f "$migration" ]; then
            filename=$(basename "$migration")
            print_info "Application de $filename..."
            if docker exec -i antislash-talk-db psql -U postgres -d postgres < "$migration" 2>/dev/null; then
                print_success "$filename appliquée"
            else
                print_info "$filename déjà appliquée ou erreur mineure"
            fi
        fi
    done
fi

# Démarrer les autres services s'ils ne sont pas déjà en cours
print_header "Démarrage des services manquants"

# Liste des services à vérifier
SERVICES=("kong" "auth" "rest" "realtime" "storage" "meta" "studio" "web")

for service in "${SERVICES[@]}"; do
    if ! docker ps | grep -q "antislash-talk-$service"; then
        print_info "Démarrage de $service..."
        docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d $service
    else
        print_success "$service déjà en cours d'exécution"
    fi
done

# Attendre que tous les services soient prêts
print_info "Attente de la disponibilité des services..."
sleep 20

# Créer les données initiales si nécessaire
print_header "Vérification des données initiales"

# Vérifier si les tables existent
AUTH_USERS_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users');" | tr -d ' ')
STORAGE_BUCKETS_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets');" | tr -d ' ')

if [ "$AUTH_USERS_EXISTS" = "t" ] && [ "$STORAGE_BUCKETS_EXISTS" = "t" ]; then
    print_success "Les tables Auth et Storage existent"
    
    # Vérifier s'il y a déjà des données
    USER_COUNT=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT COUNT(*) FROM auth.users;" | tr -d ' ')
    BUCKET_COUNT=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT COUNT(*) FROM storage.buckets;" | tr -d ' ')
    
    if [ "$USER_COUNT" -eq "0" ]; then
        print_info "Création de l'utilisateur admin..."
        
        # Créer l'utilisateur avec les variables d'environnement
        docker exec antislash-talk-db psql -U postgres -d postgres << EOF
-- Créer l'utilisateur admin
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    instance_id,
    aud,
    role,
    raw_app_meta_data,
    raw_user_meta_data
) VALUES (
    gen_random_uuid(),
    '${APP_USER_EMAIL:-admin@antislash-talk.fr}',
    crypt('${APP_USER_PASSWORD:-Antislash2024!}', gen_salt('bf')),
    now(),
    now(),
    now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '{"provider": "email", "providers": ["email"]}',
    '{}'
) ON CONFLICT (email) DO NOTHING;
EOF
        print_success "Utilisateur admin créé"
    fi
    
    if [ "$BUCKET_COUNT" -eq "0" ]; then
        print_info "Création des buckets..."
        
        docker exec antislash-talk-db psql -U postgres -d postgres << EOF
-- Créer le bucket recordings
INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
VALUES ('recordings', 'recordings', false, now(), now())
ON CONFLICT (id) DO NOTHING;
EOF
        print_success "Bucket recordings créé"
    fi
else
    print_info "Les tables Auth/Storage n'existent pas encore"
    print_info "Elles seront créées au démarrage des services"
fi

# Afficher l'état final
print_header "État du déploiement"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep antislash

print_header "🎉 DÉPLOIEMENT REPRIS AVEC SUCCÈS !"
print_success "URL de l'application : http://${VPS_HOST}"
print_success "Supabase Studio : http://${VPS_HOST}:54323"
print_info "Utilisateur : ${STUDIO_USER:-antislash}"
print_info "Mot de passe : ${STUDIO_PASSWORD}"

echo ""
print_info "Email admin : ${APP_USER_EMAIL:-admin@antislash-talk.fr}"
print_info "Mot de passe : ${APP_USER_PASSWORD:-Antislash2024!}"
