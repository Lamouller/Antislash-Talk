# 🚀 Instructions de Déploiement - Corrections PyTorch & Services

## 📋 Résumé des Corrections

J'ai corrigé plusieurs problèmes critiques :

### ✅ Corrections Effectuées

1. **PyTorch Service Support**
   - Ajout de `VITE_PYTORCH_SERVICE_URL` dans toute la stack
   - Ajout de la route Nginx `/pytorch/` (proxy vers `localhost:8001`)
   - Configuration dans `Dockerfile.web`, `docker-compose.monorepo.yml`, et `deploy-vps-final.sh`

2. **Variables d'Environnement**
   - Suppression des domaines hardcodés dans `docker-compose.monorepo.yml`
   - Toutes les URLs utilisent maintenant les variables du `.env.monorepo`
   - Ajout de `VITE_PYTORCH_SERVICE_URL` partout

3. **Configuration Nginx**
   - Route `/whisperx/` → `localhost:8082` ✅
   - Route `/pytorch/` → `localhost:8001` ✅ NOUVEAU
   - Sous-domaine `ollama.domain.com` → `localhost:11434` ✅

4. **Scripts de Diagnostic**
   - Nouveau script `fix-services-complete.sh` pour diagnostiquer les problèmes

---

## 🔧 À Faire sur le VPS

### Étape 1 : Pull les Derniers Changements

```bash
ssh debian@37.59.118.101
cd ~/antislash-talk
git pull origin main
```

### Étape 2 : Appliquer la Nouvelle Configuration Nginx

```bash
cd ~/antislash-talk
./apply-nginx-subdomains.sh
```

Cela va :
- ✅ Créer un backup de l'ancienne config
- ✅ Appliquer la nouvelle config avec la route `/pytorch/`
- ✅ Recharger Nginx

### Étape 3 : Reconstruire et Redémarrer les Services

```bash
cd ~/antislash-talk

# Option A : Redéploiement complet (RECOMMANDÉ pour être sûr)
./deploy-vps-final.sh

# Option B : Redéploiement rapide (sans toucher à Nginx/SSL)
./redeploy-containers.sh
```

**Important** : Quand le script demande si vous voulez activer PyTorch, répondez **OUI** si vous l'utilisez.

### Étape 4 : Vérifier les Services

```bash
# Vérifier que tous les services tournent
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Vérifier les logs
docker logs antislash-talk-web --tail 50
docker logs antislash-talk-functions --tail 50
docker logs antislash-talk-realtime --tail 50
```

### Étape 5 : Vérifier les Variables d'Environnement

```bash
cd ~/antislash-talk
grep -E "VITE_PYTORCH|VITE_OLLAMA|VITE_WHISPERX" .env.monorepo
```

Vous devriez voir quelque chose comme :
```
VITE_OLLAMA_URL=https://ollama.riquelme-talk.antislash.studio
VITE_WHISPERX_URL=https://app.riquelme-talk.antislash.studio/whisperx
VITE_PYTORCH_SERVICE_URL=https://app.riquelme-talk.antislash.studio/pytorch
```

---

## 🐛 Diagnostic des Problèmes

### Problème 1 : PyTorch/Ollama "Failed to fetch"

**Cause** : Le service n'est pas démarré ou la route Nginx n'existe pas

**Solution** :
```bash
# Vérifier si le service tourne
docker ps | grep -E "pytorch|ollama"

# Si absent, démarrer avec le bon profile
cd ~/antislash-talk
docker compose -f docker-compose.monorepo.yml --profile pytorch up -d
docker compose -f docker-compose.monorepo.yml --profile ollama up -d
```

### Problème 2 : Edge Functions 500 Error

**Symptôme** : `POST /functions/v1/start-transcription` retourne 500

**Causes Possibles** :
1. Variable `NETLIFY_WEBHOOK_URL` manquante
2. Service `functions` en erreur
3. Base de données inaccessible

**Diagnostic** :
```bash
# Vérifier les logs de l'edge function
docker logs antislash-talk-functions --tail 100

# Vérifier les variables d'environnement
docker exec antislash-talk-functions sh -c 'env | grep -E "SUPABASE_URL|WEBHOOK|ANON_KEY"'

# Redémarrer si nécessaire
docker compose -f docker-compose.monorepo.yml restart functions
```

### Problème 3 : WebSocket Realtime Failed

**Symptôme** : `WebSocket connection to 'wss://api.domain.com/realtime/v1/websocket' failed`

**Causes Possibles** :
1. Nginx ne proxy pas correctement les WebSockets
2. Service `realtime` en erreur

**Solution** :
```bash
# Vérifier la config Nginx pour les WebSockets
grep -A 10 "location.*realtime" /etc/nginx/sites-enabled/antislash-talk-ssl

# Redémarrer realtime
docker compose -f docker-compose.monorepo.yml restart realtime

# Vérifier les logs
docker logs antislash-talk-realtime --tail 50
```

---

## 🔍 Script de Diagnostic Automatique

J'ai créé un script qui fait tout ça automatiquement :

```bash
cd ~/antislash-talk
./fix-services-complete.sh
```

Ce script va :
- ✅ Vérifier tous les conteneurs Docker
- ✅ Afficher les dernières erreurs dans les logs
- ✅ Tester tous les endpoints (API, Functions, etc.)
- ✅ Vérifier les variables d'environnement
- ✅ Proposer de redémarrer les services défaillants

---

## 📝 Variables d'Environnement Attendues

Dans `.env.monorepo`, vous devez avoir :

### Configuration avec Sous-domaines (RECOMMANDÉ)
```bash
VPS_HOST=riquelme-talk.antislash.studio
API_EXTERNAL_URL=https://api.riquelme-talk.antislash.studio
VITE_SUPABASE_URL=https://api.riquelme-talk.antislash.studio
VITE_OLLAMA_URL=https://ollama.riquelme-talk.antislash.studio
VITE_WHISPERX_URL=https://app.riquelme-talk.antislash.studio/whisperx
VITE_PYTORCH_SERVICE_URL=https://app.riquelme-talk.antislash.studio/pytorch
```

### Configuration avec Ports (Alternative)
```bash
VPS_HOST=riquelme-talk.antislash.studio
API_EXTERNAL_URL=https://riquelme-talk.antislash.studio:8443
VITE_SUPABASE_URL=https://riquelme-talk.antislash.studio:8443
VITE_OLLAMA_URL=https://riquelme-talk.antislash.studio:8445
VITE_WHISPERX_URL=https://riquelme-talk.antislash.studio/whisperx
VITE_PYTORCH_SERVICE_URL=https://riquelme-talk.antislash.studio/pytorch
```

---

## 🎯 Tests Post-Déploiement

### 1. Test WhisperX
```bash
curl -I https://app.riquelme-talk.antislash.studio/whisperx/health
# Devrait retourner : 200 OK
```

### 2. Test PyTorch
```bash
curl -I https://app.riquelme-talk.antislash.studio/pytorch/health
# Devrait retourner : 200 OK
```

### 3. Test Ollama
```bash
curl -I https://ollama.riquelme-talk.antislash.studio/api/tags
# Devrait retourner : 200 OK
```

### 4. Test API Supabase
```bash
curl -I https://api.riquelme-talk.antislash.studio/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"
# Devrait retourner : 200 OK
```

### 5. Test Edge Functions
```bash
curl -X POST https://api.riquelme-talk.antislash.studio/functions/v1/start-transcription \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"meeting_id":"test"}'
# Devrait retourner : 400 ou 401 (pas 500)
```

---

## ❓ FAQ

### Q: Comment activer PyTorch si je l'ai oublié au déploiement ?
```bash
docker compose -f docker-compose.monorepo.yml --profile pytorch up -d
```

### Q: Comment vérifier quels services sont actifs ?
```bash
docker compose -f docker-compose.monorepo.yml ps
```

### Q: Les sous-domaines ne résolvent pas, que faire ?
Vérifiez vos DNS chez votre hébergeur. Vous devez avoir :
```
A    riquelme-talk.antislash.studio    37.59.118.101
A    app.riquelme-talk.antislash.studio    37.59.118.101
A    api.riquelme-talk.antislash.studio    37.59.118.101
A    ollama.riquelme-talk.antislash.studio    37.59.118.101
A    studio.riquelme-talk.antislash.studio    37.59.118.101
```

Ou un wildcard :
```
A    *.riquelme-talk.antislash.studio    37.59.118.101
```

### Q: L'Edge Function retourne toujours 500, que faire ?
1. Vérifier les logs : `docker logs antislash-talk-functions --tail 100`
2. Vérifier que la variable `NETLIFY_WEBHOOK_URL` est définie (ou retirer le check dans le code)
3. Redémarrer : `docker compose -f docker-compose.monorepo.yml restart functions`

---

## 📞 En Cas de Problème

Si les problèmes persistent après avoir suivi ces étapes :

1. **Faire un diagnostic complet** :
   ```bash
   ./fix-services-complete.sh > diagnostic.log 2>&1
   ```

2. **Vérifier les logs de tous les services** :
   ```bash
   docker compose -f docker-compose.monorepo.yml logs --tail=100 > all-logs.txt
   ```

3. **Envoyer les fichiers** :
   - `diagnostic.log`
   - `all-logs.txt`
   - `.env.monorepo` (sans les clés sensibles)

---

## ✅ Checklist Finale

- [ ] Git pull effectué
- [ ] Nginx config mise à jour (`apply-nginx-subdomains.sh`)
- [ ] Services redéployés (`deploy-vps-final.sh` ou `redeploy-containers.sh`)
- [ ] PyTorch/Ollama activés si nécessaire
- [ ] Variables d'environnement vérifiées
- [ ] Tests des endpoints passés
- [ ] WebSocket realtime fonctionne
- [ ] Edge Functions retournent 200/400/401 (pas 500)
- [ ] Application web accessible

---

**Bon déploiement ! 🚀**

