#!/bin/bash
# Script pour créer un utilisateur admin de test via l'API GoTrue
set -e

echo "👤 Création d'un utilisateur admin de test..."

# Variables
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@antislash-talk.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123456}"
ADMIN_NAME="${ADMIN_NAME:-Admin Test}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NzkwODY5MjAsImV4cCI6MTk5NDY2MjkyMH0.mFqWJEQz3pR2AyhqJqXVvNqlRVGVPLhV2J0W-7LGvpw}"

echo "📧 Email: $ADMIN_EMAIL"
echo "🔐 Mot de passe: $ADMIN_PASSWORD"

# Créer l'utilisateur via l'API GoTrue (directement via docker)
RESPONSE=$(docker exec antislash-talk-auth wget -qO- \
  --header="Authorization: Bearer $SERVICE_ROLE_KEY" \
  --header="Content-Type: application/json" \
  --post-data="{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"$ADMIN_NAME\"}}" \
  "http://localhost:9999/admin/users" 2>&1 || echo "{}")

# Extraire l'ID utilisateur
USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo "❌ Erreur lors de la création de l'utilisateur"
  echo "Réponse de l'API: $RESPONSE"
  exit 1
fi

echo "✅ Utilisateur créé avec ID: $USER_ID"

# Mettre à jour le profil pour le rendre admin
UPDATE_RESULT=$(docker exec antislash-talk-db psql -U postgres -d postgres -tAc "
UPDATE public.profiles
SET role = 'admin', full_name = '$ADMIN_NAME'
WHERE id = '$USER_ID'::uuid;
SELECT 'SUCCESS';
")

if [ "$UPDATE_RESULT" = "SUCCESS" ]; then
  echo ""
  echo "✅ Utilisateur admin créé avec succès !"
  echo ""
  echo "🔐 Identifiants de connexion:"
  echo "   Email:    $ADMIN_EMAIL"
  echo "   Password: $ADMIN_PASSWORD"
  echo ""
  echo "🌐 Connectez-vous sur: http://localhost:3000"
else
  echo "❌ Erreur lors de la création de l'utilisateur"
  exit 1
fi

