#!/bin/sh
# Entrypoint pour studio-proxy qui gère la création du .htpasswd

# Si STUDIO_PASSWORD_HASH est défini, créer le fichier .htpasswd
if [ -n "$STUDIO_PASSWORD_HASH" ]; then
    echo "Creating .htpasswd file..."
    echo "antislash:$STUDIO_PASSWORD_HASH" > /etc/nginx/.htpasswd
    chmod 644 /etc/nginx/.htpasswd
fi

# Lancer nginx
exec nginx -g 'daemon off;'
