# 🔧 Session de dépannage - 19 Novembre 2025

Documentation complète des problèmes rencontrés et des solutions apportées lors du déploiement.

## 📋 Table des matières

1. [Problème 1 : Variables VITE non compilées](#problème-1--variables-vite-non-compilées)
2. [Problème 2 : Certificats SSL auto-signés](#problème-2--certificats-ssl-auto-signés)
3. [Problème 3 : Ollama CORS dupliqués](#problème-3--ollama-cors-dupliqués)
4. [Problème 4 : Kong placeholders non remplacés](#problème-4--kong-placeholders-non-remplacés)
5. [Problème 5 : Incohérence --env-file](#problème-5--incohérence---env-file)
6. [Vérifications pré-déploiement](#vérifications-pré-déploiement)
7. [Commandes de diagnostic](#commandes-de-diagnostic)

---

## Problème 1 : Variables VITE non compilées

### 🔴 Symptôme
- L'application web ne pouvait pas communiquer avec Ollama, PyTorch ou WhisperX
- Dans la console navigateur : "Failed to fetch" pour les services
- `docker exec antislash-talk-web env | grep VITE` retournait vide

### 🔍 Cause racine
1. Docker Compose cherche `.env` par défaut, pas `.env.monorepo`
2. `docker-compose.monorepo.yml` utilisait `${API_EXTERNAL_URL}` au lieu de `${VITE_SUPABASE_URL}` (ligne 304)
3. Le lien symbolique `.env` n'était pas créé avant le build

### ✅ Solutions appliquées

**Fichier : `deploy-vps-final.sh`**
```bash
# Ligne 731 - Créer le lien symbolique AVANT le build
ln -sf .env.monorepo .env
print_success "Lien symbolique créé"
```

**Fichier : `docker-compose.monorepo.yml`**
```yaml
# Ligne 304 - Utiliser la bonne variable
VITE_SUPABASE_URL: ${VITE_SUPABASE_URL:-${API_EXTERNAL_URL}}
VITE_OLLAMA_URL: ${VITE_OLLAMA_URL:-https://ollama.localhost}
VITE_WHISPERX_URL: ${VITE_WHISPERX_URL:-https://localhost/whisperx}
VITE_PYTORCH_SERVICE_URL: ${VITE_PYTORCH_SERVICE_URL:-https://localhost/pytorch}
```

**Fichier : `deploy-vps-final.sh`**
```bash
# Lignes 747-754 - Logs pour vérifier les variables
print_info "📋 Variables VITE à compiler dans le build :"
echo "   VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}"
echo "   VITE_OLLAMA_URL: ${VITE_OLLAMA_URL}"
echo "   VITE_WHISPERX_URL: ${VITE_WHISPERX_URL}"
echo "   VITE_PYTORCH_SERVICE_URL: ${VITE_PYTORCH_SERVICE_URL}"
```

### 🎯 Comment vérifier
```bash
# Après déploiement, vérifier que les variables sont dans le JS compilé
docker exec antislash-talk-web sh -c "grep -o 'ollama.*antislash.studio' /usr/share/nginx/html/assets/*.js | head -1"
# Devrait afficher : ollama.riquelme-talk.antislash.studio
```

---

## Problème 2 : Certificats SSL auto-signés

### 🔴 Symptôme
- Erreur navigateur : `ERR_CERT_AUTHORITY_INVALID`
- Message : "Votre connexion n'est pas privée"
- Même après avoir configuré Let's Encrypt

### 🔍 Cause racine
1. Le script générait la config nginx AVANT d'obtenir les certificats Let's Encrypt
2. Nginx utilisait `/etc/nginx/ssl/selfsigned.crt` par défaut
3. Même quand `USE_LETSENCRYPT=true`, les chemins n'étaient pas remplacés

### ✅ Solutions appliquées

**Fichier : `deploy-vps-final.sh`**
```bash
# Lignes 1180-1182 - Auto-détection Let's Encrypt
if [ -f "/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem" ]; then
    USE_LETSENCRYPT=true
    print_success "✅ Certificats Let's Encrypt détectés et seront utilisés automatiquement"
```

```bash
# Lignes 1598-1604 - Forçage APRÈS génération nginx
if [ "$USE_LETSENCRYPT" = true ] && [ -f "/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem" ]; then
    print_info "🔧 Forçage des certificats Let's Encrypt dans la config Nginx..."
    sudo sed -i "s|/etc/nginx/ssl/selfsigned.crt|/etc/letsencrypt/live/${VPS_HOST}/fullchain.pem|g" /etc/nginx/sites-enabled/antislash-talk-ssl
    sudo sed -i "s|/etc/nginx/ssl/selfsigned.key|/etc/letsencrypt/live/${VPS_HOST}/privkey.pem|g" /etc/nginx/sites-enabled/antislash-talk-ssl
    print_success "✅ Certificats Let's Encrypt forcés dans la config"
fi
```

### 🎯 Comment vérifier
```bash
# Vérifier que Nginx utilise Let's Encrypt
sudo grep "ssl_certificate " /etc/nginx/sites-enabled/antislash-talk-ssl | head -3 | grep letsencrypt
# Devrait afficher 3 lignes avec /etc/letsencrypt/

# Tester le certificat
curl -I https://app.riquelme-talk.antislash.studio 2>&1 | grep "issuer.*Let's Encrypt"
```

### ⚠️ Si ça ne marche pas lors du déploiement
```bash
# Correction manuelle immédiate
sudo sed -i 's|/etc/nginx/ssl/selfsigned.crt|/etc/letsencrypt/live/riquelme-talk.antislash.studio/fullchain.pem|g' /etc/nginx/sites-enabled/antislash-talk-ssl
sudo sed -i 's|/etc/nginx/ssl/selfsigned.key|/etc/letsencrypt/live/riquelme-talk.antislash.studio/privkey.pem|g' /etc/nginx/sites-enabled/antislash-talk-ssl
sudo nginx -t && sudo systemctl reload nginx
```

---

## Problème 3 : Ollama CORS dupliqués

### 🔴 Symptôme
- Ollama accessible via `curl` mais pas depuis le navigateur
- Console navigateur : "Failed to fetch" 
- Network tab : Status 200 mais Response vide
- Headers : 2x `access-control-allow-origin` (invalide !)

### 🔍 Cause racine
1. Ollama envoie ses propres headers CORS nativement
2. Nginx ajoutait AUSSI des headers CORS
3. Le navigateur rejette les réponses avec headers CORS dupliqués (spec HTTP)

### ✅ Solutions appliquées

**Fichier : `nginx-subdomains-ssl.conf`**
```nginx
# Lignes 270-276 - Bloc Ollama location /
location / {
    # Supprimer les headers CORS d'Ollama (il les envoie nativement)
    proxy_hide_header Access-Control-Allow-Origin;
    proxy_hide_header Access-Control-Allow-Methods;
    proxy_hide_header Access-Control-Allow-Headers;
    proxy_hide_header Access-Control-Expose-Headers;
    
    # Ajouter UN SEUL header CORS de Nginx
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    
    # Proxy settings
    proxy_pass http://localhost:11434;
    ...
}
```

### 🎯 Comment vérifier
```bash
# DOIT afficher exactement 1
curl -I https://ollama.riquelme-talk.antislash.studio/api/tags \
  -H "Origin: https://app.riquelme-talk.antislash.studio" 2>&1 | \
  grep -c "access-control-allow-origin"
```

### ⚠️ Si ça ne marche pas lors du déploiement
```bash
# Utiliser le script de fix
cd ~/antislash-talk
./fix-ollama-cors.sh

# OU correction manuelle (supprimer les add_header CORS dans le bloc Ollama)
```

---

## Problème 4 : Kong placeholders non remplacés

### 🔴 Symptôme
- Erreur 401 ou 403 sur toutes les requêtes API
- Auth service retournait "Invalid authentication credentials"
- `docker exec antislash-talk-kong cat /etc/kong/kong.yml` montrait :
  ```yaml
  keyauth_credentials:
    - key: ANON_KEY_PLACEHOLDER
    - key: SERVICE_ROLE_KEY_PLACEHOLDER
  ```

### 🔍 Cause racine
Les placeholders dans `packages/supabase/kong.yml` n'étaient pas remplacés par les vraies clés

### ✅ Solutions appliquées

**Fichier : `deploy-vps-final.sh`**
```bash
# Lignes 1122-1123 - Remplacement des placeholders
sed -i "s/ANON_KEY_PLACEHOLDER/${ANON_KEY}/g" packages/supabase/kong.yml
sed -i "s/SERVICE_ROLE_KEY_PLACEHOLDER/${SERVICE_ROLE_KEY}/g" packages/supabase/kong.yml
```

### 🎯 Comment vérifier
```bash
# Vérifier que les clés sont bien remplacées dans kong.yml
grep "key:" packages/supabase/kong.yml | head -3
# NE DOIT PAS contenir "PLACEHOLDER"

# Vérifier que Kong les a chargées
docker exec antislash-talk-kong cat /etc/kong/kong.yml | grep "key:" | head -3
# Doit montrer les vraies clés JWT
```

### ⚠️ Si ça ne marche pas lors du déploiement
```bash
# Correction immédiate
cd ~/antislash-talk
source .env.monorepo
sed -i "s/ANON_KEY_PLACEHOLDER/${ANON_KEY}/g" packages/supabase/kong.yml
sed -i "s/SERVICE_ROLE_KEY_PLACEHOLDER/${SERVICE_ROLE_KEY}/g" packages/supabase/kong.yml
docker compose -f docker-compose.monorepo.yml restart kong
```

---

## Problème 5 : Incohérence --env-file

### 🔴 Symptôme
- `OLLAMA_ORIGINS` non lu par le conteneur Ollama
- Erreurs 403 Forbidden même avec variable dans `.env.monorepo`
- `docker exec antislash-talk-ollama env | grep OLLAMA_ORIGINS` retournait la valeur par défaut

### 🔍 Cause racine
- Script créait `.env` → `.env.monorepo` (ligne 731)
- MAIS utilisait `--env-file .env.monorepo` dans les commandes
- Docker Compose ne lisait donc pas le lien symbolique

### ✅ Solutions appliquées

**Fichier : `deploy-vps-final.sh`**

Changements aux lignes 774, 948, 1015, 1079 :
```bash
# AVANT
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d

# APRÈS
docker compose -f docker-compose.monorepo.yml --env-file .env up -d
```

**Fichier : `deploy-vps-final.sh`**
```bash
# Ligne 613 - OLLAMA_ORIGINS ajouté au .env.monorepo
OLLAMA_ORIGINS=${APP_URL},${VITE_OLLAMA_URL},https://${VPS_HOST}
```

**Fichier : `docker-compose.monorepo.yml`**
```yaml
# Ligne 337 - Variable passée au conteneur
ollama:
  environment:
    OLLAMA_ORIGINS: ${OLLAMA_ORIGINS:-http://localhost,https://localhost}
```

### 🎯 Comment vérifier
```bash
# Vérifier que le lien symbolique existe
ls -la .env

# Vérifier que OLLAMA_ORIGINS est dans le conteneur
docker exec antislash-talk-ollama env | grep OLLAMA_ORIGINS
# Doit montrer : OLLAMA_ORIGINS=https://app.domain,https://ollama.domain,...
```

---

## Vérifications pré-déploiement

### ✅ Checklist avant de lancer `./deploy-vps-final.sh`

```bash
cd ~/antislash-talk
git pull

echo "=== 1. Template nginx contient proxy_hide_header ? ==="
grep -c "proxy_hide_header" nginx-subdomains-ssl.conf
# Devrait afficher : 4

echo ""
echo "=== 2. Script crée le lien .env ? ==="
grep -n "ln -sf .env.monorepo .env" deploy-vps-final.sh
# Devrait afficher : 731:ln -sf .env.monorepo .env

echo ""
echo "=== 3. Pas d'utilisation de .env.monorepo dans docker compose ? ==="
grep "docker compose" deploy-vps-final.sh | grep -v "^#" | grep -c "\-\-env-file .env.monorepo"
# Devrait afficher : 0

echo ""
echo "=== 4. Placeholders Kong remplacés ? ==="
grep "ANON_KEY_PLACEHOLDER" deploy-vps-final.sh
# Devrait afficher les lignes sed qui remplacent les placeholders

echo ""
echo "=== 5. OLLAMA_ORIGINS et VITE_PYTORCH dans .env.monorepo ? ==="
grep -E "OLLAMA_ORIGINS=|VITE_PYTORCH_SERVICE_URL=" deploy-vps-final.sh | head -2
# Devrait afficher les 2 lignes
```

**Si TOUTES ces vérifications sont OK** → Le déploiement devrait fonctionner !

---

## Vérifications post-déploiement

### ✅ Checklist après que `./deploy-vps-final.sh` a terminé

#### 1. SSL Let's Encrypt

```bash
# Vérifier que Nginx utilise Let's Encrypt
sudo grep "ssl_certificate " /etc/nginx/sites-enabled/antislash-talk-ssl | head -3
# DOIT contenir : /etc/letsencrypt/live/

# Tester le certificat depuis l'extérieur
curl -I https://app.riquelme-talk.antislash.studio 2>&1 | grep "issuer.*Let's Encrypt"
```

**⚠️ Si auto-signé encore présent :**
```bash
sudo sed -i 's|/etc/nginx/ssl/selfsigned.crt|/etc/letsencrypt/live/riquelme-talk.antislash.studio/fullchain.pem|g' /etc/nginx/sites-enabled/antislash-talk-ssl
sudo sed -i 's|/etc/nginx/ssl/selfsigned.key|/etc/letsencrypt/live/riquelme-talk.antislash.studio/privkey.pem|g' /etc/nginx/sites-enabled/antislash-talk-ssl
sudo nginx -t && sudo systemctl reload nginx
```

#### 2. Variables VITE compilées

```bash
# Vérifier dans le JS
docker exec antislash-talk-web sh -c "grep -o 'ollama.*antislash.studio' /usr/share/nginx/html/assets/*.js | head -1"
# Devrait afficher : ollama.riquelme-talk.antislash.studio
```

**⚠️ Si vide (variables non compilées) :**
```bash
# Rebuild le web
cd ~/antislash-talk
ln -sf .env.monorepo .env
source .env
docker compose --env-file .env -f docker-compose.monorepo.yml build --no-cache web
docker compose --env-file .env -f docker-compose.monorepo.yml up -d --no-deps web
```

#### 3. Kong avec bonnes clés

```bash
# Vérifier que les placeholders sont remplacés
grep "key:" packages/supabase/kong.yml | head -3
# NE DOIT PAS contenir "PLACEHOLDER"

# Tester l'API auth
source .env.monorepo
curl -H "apikey: $ANON_KEY" http://localhost:54321/auth/v1/health
# Devrait retourner : {"version":"vunspecified","name":"GoTrue",...}
```

**⚠️ Si placeholders encore présents :**
```bash
source .env.monorepo
sed -i "s/ANON_KEY_PLACEHOLDER/${ANON_KEY}/g" packages/supabase/kong.yml
sed -i "s/SERVICE_ROLE_KEY_PLACEHOLDER/${SERVICE_ROLE_KEY}/g" packages/supabase/kong.yml
docker compose -f docker-compose.monorepo.yml restart kong
```

#### 4. Ollama CORS unique

```bash
# Vérifier qu'il n'y a QU'UN SEUL header
curl -I https://ollama.riquelme-talk.antislash.studio/api/tags \
  -H "Origin: https://app.riquelme-talk.antislash.studio" 2>&1 | \
  grep -c "access-control-allow-origin"
# DOIT afficher : 1 (pas 2!)
```

**⚠️ Si 2 headers :**
```bash
cd ~/antislash-talk
./fix-ollama-cors.sh
```

#### 5. Ollama avec modèle

```bash
# Vérifier qu'Ollama a un modèle installé
curl -s http://localhost:11434/api/tags | jq '.models | length'
# Si 0, installer un modèle :
docker exec antislash-talk-ollama ollama pull mistral
```

#### 6. OLLAMA_ORIGINS dans le conteneur

```bash
# Vérifier que le conteneur a la variable
docker exec antislash-talk-ollama env | grep OLLAMA_ORIGINS
# Devrait afficher : OLLAMA_ORIGINS=https://app.riquelme-talk.antislash.studio,...
```

**⚠️ Si valeur par défaut (localhost) :**
```bash
# Le lien .env n'existe pas ou docker-compose utilise .env.monorepo
ln -sf .env.monorepo .env
docker compose --env-file .env -f docker-compose.monorepo.yml up -d --force-recreate ollama
```

---

## Commandes de diagnostic

### État des services

```bash
cd ~/antislash-talk

# Voir tous les conteneurs
docker ps --format "table {{.Names}}\t{{.Status}}" | grep antislash-talk

# Services critiques
docker ps | grep -E "web|kong|auth|ollama|db"
```

### Logs rapides

```bash
# Auth (login, tokens)
docker logs antislash-talk-auth --tail 30

# Kong (gateway, clés API)
docker logs antislash-talk-kong --tail 30

# Web (nginx, requêtes)
docker logs antislash-talk-web --tail 30

# Ollama (LLM)
docker logs antislash-talk-ollama --tail 30
```

### Tests rapides

```bash
# Test SSL Let's Encrypt
curl -I https://app.riquelme-talk.antislash.studio 2>&1 | grep -E "HTTP|issuer"

# Test auth API
source .env.monorepo
curl -H "apikey: $ANON_KEY" http://localhost:54321/auth/v1/health

# Test Ollama local
curl -s http://localhost:11434/api/tags | jq .

# Test Ollama externe
curl -s https://ollama.riquelme-talk.antislash.studio/api/tags | jq .

# Test CORS Ollama (doit être 1, pas 2)
curl -I https://ollama.riquelme-talk.antislash.studio/api/tags \
  -H "Origin: https://app.riquelme-talk.antislash.studio" 2>&1 | \
  grep -c "access-control-allow-origin"
```

---

## Problèmes connus (non critiques)

### Healthchecks "unhealthy"

Certains services peuvent être marqués `unhealthy` même s'ils fonctionnent :
- `antislash-talk-ollama` : Le healthcheck peut échouer pendant le téléchargement de modèles
- `antislash-talk-studio` : Peut être unhealthy mais accessible via proxy
- `antislash-talk-transcription` : Normal pendant l'initialisation des modèles

**Ces états n'empêchent PAS les services de fonctionner** si Nginx les route correctement.

### Warnings Nginx

```
[warn] the "listen ... http2" directive is deprecated
[warn] conflicting server name "..." ignored
[warn] "ssl_stapling" ignored, no OCSP responder URL
```

Ces warnings sont **normaux** et n'affectent pas le fonctionnement.

### Erreurs PyAnnote dans la console

```
GET http://localhost:8082/pyannote-models net::ERR_CONNECTION_REFUSED
```

C'est normal - ce sont des fonctionnalités de transcription locale optionnelles qui nécessitent WhisperX avec PyAnnote installé.

---

## Ordre des opérations lors du déploiement

Le script `deploy-vps-final.sh` suit cet ordre (important !) :

1. ✅ Génération des clés JWT
2. ✅ **Création du fichier `.env.monorepo`** (avec OLLAMA_ORIGINS, VITE_PYTORCH, etc.)
3. ✅ **Création du lien `.env` → `.env.monorepo`**
4. ✅ **Remplacement des placeholders Kong** (AVANT le démarrage)
5. ✅ Build de l'image web (avec `--env-file .env`)
6. ✅ Démarrage de PostgreSQL
7. ✅ Démarrage de tous les services Supabase
8. ✅ Configuration Nginx (template avec proxy_hide_header)
9. ✅ **Forçage Let's Encrypt** si certificats détectés
10. ✅ Démarrage WhisperX/PyTorch si activés
11. ✅ Mise à jour Kong avec les nouvelles clés
12. ✅ Création utilisateur initial
13. ✅ Affichage des credentials

**Cet ordre est CRITIQUE** - ne pas le modifier !

---

## Scripts utiles créés

### `fix-ollama-cors.sh`
Corrige les headers CORS dupliqués d'Ollama sans redéployer

```bash
cd ~/antislash-talk
./fix-ollama-cors.sh
```

### `fix-ssl-certificates.sh`
Force l'utilisation des certificats Let's Encrypt

```bash
cd ~/antislash-talk
./fix-ssl-certificates.sh
```

### `redeploy-containers.sh`
Redéploie les conteneurs sans toucher Nginx/SSL

```bash
cd ~/antislash-talk
./redeploy-containers.sh
```

---

## Récapitulatif des fichiers modifiés

### Configuration

- ✅ `docker-compose.monorepo.yml` : Variables VITE corrigées, OLLAMA_ORIGINS ajouté
- ✅ `nginx-subdomains-ssl.conf` : proxy_hide_header pour Ollama, port PyTorch corrigé
- ✅ `deploy-vps-final.sh` : Lien .env, logs détaillés, forçage SSL, cohérence --env-file

### Scripts de fix

- ✅ `fix-ollama-cors.sh` : Nouveau script pour corriger CORS Ollama
- ✅ `fix-ssl-certificates.sh` : Script existant pour forcer Let's Encrypt

### Documentation

- ✅ `TROUBLESHOOTING_SESSION_20251119.md` : Ce document

---

## Commande de déploiement finale

```bash
# Sur le VPS
cd ~/antislash-talk

# Arrêter proprement (sans supprimer les volumes)
docker compose -f docker-compose.monorepo.yml down

# Supprimer tous les conteneurs restants
docker ps -a | grep antislash-talk | awk '{print $1}' | xargs -r docker rm -f

# Lancer le déploiement
./deploy-vps-final.sh
```

**Réponses aux prompts :**
- Mode ? → `FRESH`
- Let's Encrypt ? → Détecté automatiquement (dire OUI si demandé)
- Sous-domaines ? → `oui`
- WhisperX ? → `oui`
- PyTorch ? → Automatique (ou `oui`)
- Ollama ? → Automatique (ou `oui`)

**Durée estimée :** 10-15 minutes

---

## Ce qui fonctionne maintenant

### ✅ Services opérationnels

- **Application Web** : Login, meetings, transcription
- **Supabase Auth** : Authentification, tokens JWT
- **Supabase DB** : PostgreSQL avec RLS
- **Supabase Storage** : Upload de fichiers
- **Kong Gateway** : Routing API avec clés correctes
- **Ollama** : Mistral 7B avec CORS propre
- **WhisperX** : Transcription avec diarization (si activé)
- **PyTorch** : Transcription alternative (si activé)

### ✅ Fonctionnalités testées

- Login/Logout
- Détection des services (Ollama, WhisperX, PyTorch)
- SSL Let's Encrypt sur tous les sous-domaines
- CORS fonctionnel entre sous-domaines
- Intégration Ollama dans les paramètres

---

## Prochaines étapes

### Installation de N8N et NocoDB (optionnel)

Après un déploiement réussi d'Antislash Talk :

```bash
# Supprimer les anciens conteneurs N8N/NocoDB s'ils existent
docker stop n8n nocodb n8n-db nocodb-db 2>/dev/null || true
docker rm n8n nocodb n8n-db nocodb-db 2>/dev/null || true
docker volume rm $(docker volume ls -q | grep -E "n8n|nocodb") 2>/dev/null || true
rm -rf ~/tools

# Installer proprement
cd ~/antislash-talk/tools-setup
./setup.sh
```

---

## Points d'attention critiques

### 🚨 À NE JAMAIS FAIRE

1. ❌ **NE PAS** modifier manuellement `.env.monorepo` après déploiement sans recréer `.env`
2. ❌ **NE PAS** utiliser `docker compose build` sans `--env-file`
3. ❌ **NE PAS** éditer `/etc/nginx/sites-enabled/antislash-talk-ssl` sans backup
4. ❌ **NE PAS** supprimer les volumes Docker si vous voulez garder vos données

### ⚠️ Vigilance requise sur

1. **Cache navigateur** : Toujours vider le cache après un rebuild web
2. **Token JWT invalide** : Si vous voyez "token signature is invalid", nettoyez localStorage
3. **Headers CORS dupliqués** : Vérifier systématiquement avec `grep -c access-control-allow-origin`
4. **Variables VITE** : Toujours rebuild web si vous changez une variable VITE_*

---

## Logs de débogage avancé

### Si l'app ne charge pas

```bash
# 1. Vérifier le conteneur web
docker ps | grep web
docker logs antislash-talk-web --tail 50

# 2. Vérifier Nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log

# 3. Vérifier le JS compilé
docker exec antislash-talk-web ls -lh /usr/share/nginx/html/assets/
```

### Si Ollama ne fonctionne pas

```bash
# 1. Vérifier le conteneur
docker ps | grep ollama

# 2. Vérifier les variables
docker exec antislash-talk-ollama env | grep OLLAMA

# 3. Vérifier les modèles
curl -s http://localhost:11434/api/tags | jq .

# 4. Vérifier CORS
curl -I https://ollama.riquelme-talk.antislash.studio/api/tags \
  -H "Origin: https://app.riquelme-talk.antislash.studio" 2>&1 | \
  grep "access-control-allow-origin"
# DOIT afficher 1 ligne UNIQUE

# 5. Logs
docker logs antislash-talk-ollama --tail 50
```

### Si l'auth échoue (401/403)

```bash
# 1. Vérifier que Kong a les bonnes clés
docker exec antislash-talk-kong cat /etc/kong/kong.yml | grep "key:" | head -3
# Doit montrer de vraies clés JWT, pas "PLACEHOLDER"

# 2. Vérifier que les clés correspondent
source .env.monorepo
echo "ANON_KEY dans .env : $ANON_KEY"
docker exec antislash-talk-kong env | grep SUPABASE_ANON_KEY

# 3. Tester l'API
curl -H "apikey: $ANON_KEY" http://localhost:54321/auth/v1/health
```

---

## Contacts et ressources

- **Repository** : https://github.com/Lamouller/Antislash-Talk
- **Issues** : https://github.com/Lamouller/Antislash-Talk/issues
- **Documentation Supabase** : https://supabase.com/docs
- **Documentation Ollama** : https://ollama.ai/docs

---

**Document créé le : 19 Novembre 2025**  
**Dernière mise à jour : 19 Novembre 2025**  
**Version du script : deploy-vps-final.sh (commit 6f7e28f)**

---

🎯 **En cas de doute, suivez cette règle d'or :**

> Si un déploiement from scratch plante :
> 1. Vérifier les 5 points de la checklist pré-déploiement
> 2. Lancer les 6 vérifications post-déploiement
> 3. Appliquer les corrections spécifiques si nécessaire
> 4. NE PAS rebuilder partiellement - attendre le prochain déploiement complet

**Bonne chance pour vos prochains déploiements ! 🚀**

