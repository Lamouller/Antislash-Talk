#!/bin/bash
# Script pour réappliquer les mots de passe depuis .env.monorepo dans PostgreSQL

cd ~/antislash-talk

echo "🔐 Réinitialisation des mots de passe depuis .env.monorepo..."
echo ""

# Extraire les mots de passe
APP_USER_EMAIL=$(grep "^APP_USER_EMAIL=" .env.monorepo | cut -d= -f2)
APP_USER_PASSWORD=$(grep "^APP_USER_PASSWORD=" .env.monorepo | cut -d= -f2)
STUDIO_PASSWORD=$(grep "^STUDIO_PASSWORD=" .env.monorepo | cut -d= -f2)

if [ -z "$APP_USER_EMAIL" ] || [ -z "$APP_USER_PASSWORD" ]; then
    echo "❌ Impossible de trouver les mots de passe dans .env.monorepo"
    exit 1
fi

echo "📧 Email admin trouvé: $APP_USER_EMAIL"
echo "🔑 Mot de passe admin: $APP_USER_PASSWORD"
echo "🎨 Mot de passe Studio: $STUDIO_PASSWORD"
echo ""

# Réinitialiser le mot de passe admin dans PostgreSQL
echo "🔄 Mise à jour du mot de passe admin dans PostgreSQL..."
docker exec antislash-talk-db psql -U postgres -d postgres << EOF
UPDATE auth.users 
SET encrypted_password = extensions.crypt('${APP_USER_PASSWORD}', extensions.gen_salt('bf', 6))
WHERE email = '${APP_USER_EMAIL}';
EOF

if [ $? -eq 0 ]; then
    echo "✅ Mot de passe admin mis à jour dans PostgreSQL"
else
    echo "❌ Erreur lors de la mise à jour du mot de passe admin"
fi

# Réinitialiser le mot de passe Studio
if [ -n "$STUDIO_PASSWORD" ]; then
    echo ""
    echo "🔄 Mise à jour du mot de passe Studio..."
    
    # Générer le hash htpasswd
    STUDIO_PASSWORD_HASH=$(docker run --rm httpd:alpine htpasswd -nbB antislash "$STUDIO_PASSWORD" | cut -d: -f2)
    
    # Créer le fichier htpasswd temporaire
    cat > studio.htpasswd << HTPASSWD
antislash:$STUDIO_PASSWORD_HASH
HTPASSWD
    
    # Copier dans le container
    docker cp studio.htpasswd antislash-talk-studio-proxy:/tmp/.htpasswd.new
    docker exec antislash-talk-studio-proxy sh -c "mv /tmp/.htpasswd.new /etc/nginx/.htpasswd && chmod 644 /etc/nginx/.htpasswd"
    docker exec antislash-talk-studio-proxy nginx -s reload 2>/dev/null || docker restart antislash-talk-studio-proxy
    
    rm -f studio.htpasswd
    
    echo "✅ Mot de passe Studio mis à jour"
fi

echo ""
echo "✅ TERMINÉ !"
echo ""
echo "📋 Récapitulatif des identifiants :"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Application Web:"
echo "  Email    : $APP_USER_EMAIL"
echo "  Password : $APP_USER_PASSWORD"
echo ""
echo "Supabase Studio (https://37.59.118.101:8444):"
echo "  User     : antislash"
echo "  Password : $STUDIO_PASSWORD"
echo ""
echo "🎯 Tu peux maintenant te connecter avec ces identifiants !"

