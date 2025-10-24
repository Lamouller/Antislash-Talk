#!/bin/bash
# Script pour créer un utilisateur admin qui fonctionne vraiment

echo "🔧 Création d'un utilisateur admin fonctionnel..."
echo ""

# Variables
EMAIL="admin@antislash-talk.local"
PASSWORD="Admin123456!"
NAME="Admin Test"

# Supprimer l'ancien utilisateur s'il existe
docker exec antislash-talk-db psql -U postgres -d postgres -c "DELETE FROM auth.users WHERE email = '$EMAIL';" > /dev/null 2>&1

echo "📝 Création de l'utilisateur avec GoTrue (autoconfirm activé)..."

# Créer via l'API de signup (l'autoconfirm est activé dans le docker-compose)
RESPONSE=$(docker exec antislash-talk-kong curl -s -X POST "http://auth:9999/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo "❌ Échec de la création via l'API"
  echo "Réponse: $RESPONSE"
  echo ""
  echo "Essai de la méthode alternative (directe dans la DB)..."
  
  # Méthode alternative: créer directement avec tous les champs requis
  USER_ID=$(docker exec antislash-talk-db psql -U postgres -d postgres -tAc "
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    '$EMAIL',
    extensions.crypt('$PASSWORD', extensions.gen_salt('bf')),
    NOW(),
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    NULL,
    NULL,
    '{\"provider\":\"email\",\"providers\":[\"email\"]}',
    '{\"full_name\":\"$NAME\"}',
    FALSE,
    NOW(),
    NOW(),
    NULL,
    NULL,
    '',
    '',
    NULL,
    '',
    0,
    NULL,
    '',
    NULL,
    FALSE,
    NULL
  )
  RETURNING id;
  ")
  
  if [ -z "$USER_ID" ]; then
    echo "❌ Échec total de la création"
    exit 1
  fi
fi

echo "✅ Utilisateur créé avec ID: $USER_ID"

# Créer l'identité
echo "🔑 Création de l'identité..."
docker exec antislash-talk-db psql -U postgres -d postgres -c "
INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES (
  '$USER_ID',
  '$USER_ID',
  '{\"sub\":\"$USER_ID\",\"email\":\"$EMAIL\",\"email_verified\":true,\"phone_verified\":false}',
  'email',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (provider_id, provider) DO NOTHING;
" > /dev/null 2>&1

# Attendre que le profil soit créé par le trigger
sleep 2

# Mettre à jour le profil pour le rendre admin
echo "👤 Configuration du profil admin..."
docker exec antislash-talk-db psql -U postgres -d postgres -c "
UPDATE public.profiles 
SET role = 'admin', full_name = '$NAME'
WHERE id = '$USER_ID'::uuid;
" > /dev/null 2>&1

echo ""
echo "✅ ✅ ✅ Utilisateur admin créé avec succès ! ✅ ✅ ✅"
echo ""
echo "🔐 Identifiants:"
echo "   📧 Email:    $EMAIL"
echo "   🔑 Password: $PASSWORD"
echo "   👤 Rôle:     admin"
echo "   🆔 ID:       $USER_ID"
echo ""
echo "🌐 Connectez-vous sur: http://localhost:3000"
echo "🎨 Supabase Studio:    http://localhost:54323"
echo ""


