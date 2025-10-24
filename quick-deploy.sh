#!/bin/bash

# 🎙️ Antislash Talk - Déploiement Rapide
# Script simplifié pour démarrage immédiat

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🎙️ Antislash Talk - Déploiement Rapide${NC}\n"

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo "Installation de Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo -e "${YELLOW}⚠️  Docker installé. Reconnectez-vous et relancez le script.${NC}"
    exit 1
fi

# Configuration basique
echo -e "${YELLOW}Configuration rapide :${NC}"
read -p "IP du serveur ou domaine : " SERVER_IP
SERVER_IP=${SERVER_IP:-localhost}

# Générer les secrets
echo "Génération des mots de passe sécurisés..."
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
JWT_SECRET=$(openssl rand -base64 45 | tr -d "=+/" | cut -c1-45)

# Créer le .env.monorepo
cat > .env.monorepo << EOF
# Configuration générée automatiquement
POSTGRES_DB=postgres
POSTGRES_PORT=5432
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=3600

# Clés temporaires (seront régénérées)
ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjc5MDg2OTIwLCJleHAiOjE5OTQ2NjI5MjB9.VWXx6e0Gi-rHC0Gv7O2M38LAoIrBYsGLtC0TBvuRx6k
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NzkwODY5MjAsImV4cCI6MTk5NDY2MjkyMH0.mFqWJEQz3pR2AyhqJqXVvNqlRVGVPLhV2J0W-7LGvpw

# URLs
SITE_URL=http://${SERVER_IP}:3000
API_EXTERNAL_URL=http://${SERVER_IP}:54321
SUPABASE_PUBLIC_URL=http://${SERVER_IP}:54321

# Configuration minimale
WEB_PORT=3000
NODE_ENV=production
ENABLE_PYTORCH=false
EOF

echo -e "${GREEN}✅ Configuration créée${NC}"

# Générer les vraies clés JWT si Node.js est disponible
if command -v node &> /dev/null && [ -f "generate-supabase-keys.js" ]; then
    echo "Génération des clés Supabase..."
    eval $(node generate-supabase-keys.js "$JWT_SECRET" | grep "=" | sed 's/^/export /')
    
    # Mettre à jour le .env.monorepo avec les vraies clés
    sed -i "s|ANON_KEY=.*|ANON_KEY=${ANON_KEY}|" .env.monorepo
    sed -i "s|SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}|" .env.monorepo
fi

# Démarrer les services
echo -e "\n${GREEN}Démarrage des services...${NC}"
docker compose -f docker-compose.monorepo.yml up -d

# Afficher les infos
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Application : http://${SERVER_IP}:3000"
echo -e "API Supabase : http://${SERVER_IP}:54321"
echo -e "Studio : http://${SERVER_IP}:54324"
echo -e "\nPostgreSQL Password : ${POSTGRES_PASSWORD}"
echo -e "JWT Secret : ${JWT_SECRET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n${YELLOW}Logs :${NC} docker compose -f docker-compose.monorepo.yml logs -f"
