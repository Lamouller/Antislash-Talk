#!/bin/bash
# Script simple pour créer un utilisateur admin via signup + mise à jour du profil
set -e

echo "👤 Création d'un utilisateur admin de test..."

# Variables
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@antislash-talk.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123456!}"
ADMIN_NAME="${ADMIN_NAME:-Admin Test}"

echo "📧 Email: $ADMIN_EMAIL"
echo "🔐 Mot de passe: $ADMIN_PASSWORD"

# Créer l'utilisateur directement dans la base de données
echo "📝 Insertion de l'utilisateur dans la base de données..."

USER_ID=$(docker exec antislash-talk-db psql -U postgres -d postgres -tAc "
-- Générer un UUID pour l'utilisateur
WITH new_user AS (
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
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    '$ADMIN_EMAIL',
    extensions.crypt('$ADMIN_PASSWORD', extensions.gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{\"provider\": \"email\", \"providers\": [\"email\"]}',
    '{\"full_name\": \"$ADMIN_NAME\"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id
)
SELECT id FROM new_user;
")

if [ -z "$USER_ID" ]; then
  echo "❌ Erreur lors de la création de l'utilisateur"
  exit 1
fi

echo "✅ Utilisateur créé avec ID: $USER_ID"

# Créer l'identité
docker exec antislash-talk-db psql -U postgres -d postgres -c "
INSERT INTO auth.identities (
  id,
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
  '{\"sub\": \"$USER_ID\", \"email\": \"$ADMIN_EMAIL\"}',
  'email',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;
" > /dev/null 2>&1

# Le profil est créé automatiquement par le trigger, mettons juste à jour le rôle
docker exec antislash-talk-db psql -U postgres -d postgres -c "
-- Attendre que le profil soit créé par le trigger
DO \$\$
BEGIN
  FOR i IN 1..5 LOOP
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = '$USER_ID'::uuid) THEN
      UPDATE public.profiles
      SET role = 'admin', full_name = '$ADMIN_NAME'
      WHERE id = '$USER_ID'::uuid;
      EXIT;
    END IF;
    PERFORM pg_sleep(0.5);
  END LOOP;
END \$\$;
" > /dev/null 2>&1

echo ""
echo "✅ Utilisateur admin créé avec succès !"
echo ""
echo "🔐 Identifiants de connexion:"
echo "   Email:    $ADMIN_EMAIL"
echo "   Password: $ADMIN_PASSWORD"
echo ""
echo "🌐 Connectez-vous sur: http://localhost:3000"
echo ""

