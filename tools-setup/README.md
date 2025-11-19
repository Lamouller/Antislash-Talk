# 🛠️ N8N + NocoDB Installation

Configuration séparée pour ajouter **N8N** (workflow automation) et **NocoDB** (no-code database) à votre déploiement Antislash Talk.

## 📋 Ce qui est inclus

- **N8N** : Workflow automation (alternative à Zapier/Make)
- **NocoDB** : No-code database (alternative à Airtable)
- PostgreSQL pour chaque service (bases isolées)
- Configuration Nginx automatique
- Gestion complète des secrets

## 🎯 Architecture

```
~/tools/
├── docker-compose.yml    # Services N8N + NocoDB
├── .env                  # Configuration (généré automatiquement)
└── nginx-tools.conf      # Configuration Nginx

Ports utilisés :
- 8446 : N8N (https://votre-domaine.com:8446/)
- 8447 : NocoDB (https://votre-domaine.com:8447/)
```

**Les services sont complètement indépendants d'Antislash Talk** et peuvent être arrêtés/démarrés séparément.

## 🚀 Installation en une commande

```bash
curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/tools-setup/setup.sh | bash
```

**Ce script va :**
1. ✅ Créer le dossier `~/tools`
2. ✅ Générer tous les mots de passe aléatoires
3. ✅ Télécharger le `docker-compose.yml`
4. ✅ Configurer Nginx (ajoute les routes sur ports 8446 et 8447)
5. ✅ Ouvrir les ports firewall
6. ✅ Démarrer N8N et NocoDB
7. ✅ Afficher les informations de connexion

**Durée** : ~2 minutes

---

## 📖 Installation manuelle

Si vous préférez installer manuellement :

### 1. Créer le dossier

```bash
mkdir -p ~/tools
cd ~/tools
```

### 2. Télécharger les fichiers

```bash
curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/tools-setup/docker-compose.yml -o docker-compose.yml
curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/tools-setup/env.template -o .env
```

### 3. Configurer les variables

Éditez le fichier `.env` et remplacez tous les `changeme-*` par vos valeurs :

```bash
nano .env
```

**Important** : Changez au minimum :
- `DOMAIN` : Votre domaine
- Tous les mots de passe (`*_PASSWORD`)
- Les clés de sécurité (`*_KEY`, `*_SECRET`)

### 4. Configurer Nginx

```bash
# Télécharger la config
curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/tools-setup/nginx-tools.conf -o nginx-tools.conf

# Remplacer le domaine
sed -i "s/DOMAIN_PLACEHOLDER/votre-domaine.com/g" nginx-tools.conf

# Ajouter à la config Nginx existante
sudo cat nginx-tools.conf >> /etc/nginx/sites-available/antislash-talk-ssl

# Tester et recharger
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Ouvrir les ports firewall

```bash
sudo ufw allow 8446/tcp
sudo ufw allow 8447/tcp
```

### 6. Démarrer les services

```bash
docker compose up -d
```

---

## 🔧 Gestion des services

### Voir l'état

```bash
cd ~/tools
docker compose ps
```

### Voir les logs

```bash
# Tous les services
docker compose logs -f

# Seulement N8N
docker compose logs -f n8n

# Seulement NocoDB
docker compose logs -f nocodb
```

### Redémarrer

```bash
docker compose restart
```

### Arrêter

```bash
docker compose down
```

### Mettre à jour

```bash
docker compose pull
docker compose up -d
```

---

## 🔗 Intégration avec Supabase

### Depuis N8N

Pour appeler l'API Supabase depuis N8N :

1. Dans N8N, créez un nouveau workflow
2. Ajoutez un noeud **HTTP Request**
3. Configurez :
   - **URL** : `https://votre-domaine.com:8443/rest/v1/votre-table`
   - **Headers** :
     - `apikey` : Votre `ANON_KEY` (dans `~/antislash-talk/.env.monorepo`)
     - `Authorization` : `Bearer VOTRE_ANON_KEY`
     - `Content-Type` : `application/json`

**Exemple complet** :

```
GET https://riquelme-talk.antislash.studio:8443/rest/v1/meetings

Headers:
- apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
- Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Depuis NocoDB

NocoDB a sa propre base de données PostgreSQL. Pour connecter NocoDB à Supabase :

1. Dans NocoDB, allez dans **Settings** > **Data Sources**
2. Ajoutez une nouvelle source **PostgreSQL**
3. Configurez :
   - **Host** : IP de votre serveur
   - **Port** : `5432`
   - **Database** : `postgres`
   - **Username** : `postgres`
   - **Password** : Le `POSTGRES_PASSWORD` de votre `.env.monorepo`

---

## 🔐 Sécurité

### Mots de passe

Tous les mots de passe sont dans `~/tools/.env`. **Sauvegardez ce fichier** dans un endroit sûr !

```bash
# Backup
cp ~/tools/.env ~/tools/.env.backup
```

### SSL/TLS

Par défaut, les certificats sont auto-signés. Pour installer Let's Encrypt :

```bash
sudo certbot certonly --nginx -d votre-domaine.com

# Puis mettez à jour les certificats dans la config Nginx
sudo nano /etc/nginx/sites-available/antislash-talk-ssl

# Remplacez :
ssl_certificate /etc/nginx/ssl/selfsigned.crt;
ssl_certificate_key /etc/nginx/ssl/selfsigned.key;

# Par :
ssl_certificate /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;
```

### Authentification

- **N8N** : Basic Auth activé par défaut
- **NocoDB** : Authentification par email/password

---

## ❓ Dépannage

### Les services ne démarrent pas

```bash
cd ~/tools
docker compose logs
```

### Nginx renvoie 502 Bad Gateway

Vérifiez que les services sont bien démarrés :

```bash
docker compose ps
```

Si un service est `unhealthy`, regardez les logs :

```bash
docker compose logs [nom-du-service]
```

### Impossible de se connecter

Vérifiez que les ports sont ouverts :

```bash
sudo ufw status
sudo ss -tlnp | grep -E "8446|8447"
```

### Erreur de certificat SSL

C'est normal avec les certificats auto-signés. Dans votre navigateur :
- Chrome : Tapez `thisisunsafe`
- Firefox : Cliquez sur "Avancé" puis "Accepter le risque"

---

## 📚 Documentation

- [N8N Documentation](https://docs.n8n.io/)
- [NocoDB Documentation](https://docs.nocodb.com/)
- [Supabase REST API](https://supabase.com/docs/guides/api)

---

## 🗑️ Désinstallation

```bash
cd ~/tools

# Arrêter et supprimer les containers
docker compose down -v

# Supprimer le dossier
cd ~
rm -rf tools

# Retirer la config Nginx
sudo nano /etc/nginx/sites-available/antislash-talk-ssl
# (Supprimer les blocs N8N et NocoDB)

sudo nginx -t && sudo systemctl reload nginx
```

---

**Built with ❤️ for Antislash Studio**

