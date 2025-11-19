#!/bin/bash

# Script pour corriger les headers CORS dupliqués d'Ollama

echo "🔧 Correction des headers CORS Ollama..."

# Backup
sudo cp /etc/nginx/sites-enabled/antislash-talk-ssl /etc/nginx/sites-enabled/antislash-talk-ssl.backup-ollama-fix

# Créer le nouveau bloc location pour Ollama
cat > /tmp/ollama-location-fixed << 'EOF'
    location / {
        # Supprimer les headers CORS d'Ollama pour éviter les doublons
        proxy_hide_header Access-Control-Allow-Origin;
        proxy_hide_header Access-Control-Allow-Methods;
        proxy_hide_header Access-Control-Allow-Headers;
        proxy_hide_header Access-Control-Expose-Headers;
        
        # Ajouter un seul header CORS propre
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        
        # Proxy settings
        proxy_pass http://localhost:11434;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Désactiver buffering pour streaming
        proxy_buffering off;
        proxy_request_buffering off;
    }
EOF

# Extraire tout sauf le bloc Ollama location
sudo awk '
  /server_name ollama\.riquelme-talk\.antislash\.studio/ { in_ollama=1 }
  in_ollama && /^    location \/ \{/ { 
    in_location=1
    print
    while(getline && !/^    \}/) {}
    system("cat /tmp/ollama-location-fixed")
    next
  }
  { print }
' /etc/nginx/sites-enabled/antislash-talk-ssl > /tmp/nginx-fixed.conf

# Remplacer
sudo cp /tmp/nginx-fixed.conf /etc/nginx/sites-enabled/antislash-talk-ssl

# Tester
if sudo nginx -t; then
    echo "✅ Configuration valide"
    sudo systemctl reload nginx
    echo "✅ Nginx rechargé"
    
    # Vérifier
    echo ""
    echo "🔍 Vérification des headers CORS :"
    CORS_COUNT=$(curl -I https://ollama.riquelme-talk.antislash.studio/api/tags -H "Origin: https://app.riquelme-talk.antislash.studio" 2>&1 | grep -c "access-control-allow-origin")
    echo "   Nombre de headers access-control-allow-origin : $CORS_COUNT"
    
    if [ "$CORS_COUNT" -eq 1 ]; then
        echo "✅ SUCCÈS ! Un seul header CORS"
    else
        echo "❌ Toujours $CORS_COUNT headers"
    fi
else
    echo "❌ Erreur de configuration Nginx"
    echo "Restauration du backup..."
    sudo cp /etc/nginx/sites-enabled/antislash-talk-ssl.backup-ollama-fix /etc/nginx/sites-enabled/antislash-talk-ssl
fi

# Nettoyage
rm -f /tmp/ollama-location-fixed /tmp/nginx-fixed.conf
