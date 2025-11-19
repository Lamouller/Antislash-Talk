# 🚀 Modes de Déploiement Antislash Talk

Ce document explique les différents modes de déploiement disponibles et quand les utiliser.

---

## 📋 Modes Disponibles

### 1️⃣ **Mode UPDATE** (Recommandé pour les mises à jour) ✅

**Quand l'utiliser :**
- Mise à jour du code applicatif
- Rebuild des images Docker
- Ajout de nouvelles fonctionnalités
- **Tu as déjà une installation fonctionnelle**

**Ce qui est préservé :**
- ✅ Configuration nginx (avec routes WhisperX, Ollama, etc.)
- ✅ Certificats SSL (Let's Encrypt ou auto-signés)
- ✅ Services additionnels (NocoDB, n8n, etc.)
- ✅ Volumes Docker (bases de données, fichiers)
- ✅ Fichier `.env.monorepo` existant

**Ce qui est mis à jour :**
- 🔄 Images Docker (web, services)
- 🔄 Containers Antislash Talk uniquement
- 🔄 Code applicatif

**Commande :**
```bash
cd ~/antislash-talk
./deploy-vps-final.sh
# Choisir option "1" quand demandé
```

---

### 2️⃣ **Mode FRESH** (Installation complète) ⚠️

**Quand l'utiliser :**
- **Première installation** sur un nouveau serveur
- Problèmes majeurs nécessitant une réinstallation
- Changement de configuration (domaine, ports, etc.)

**⚠️ ATTENTION : Tout est réinitialisé !**
- ❌ Nginx reconfiguré from scratch
- ❌ SSL regénéré (certificats auto-signés)
- ❌ Tous les containers arrêtés (y compris NocoDB, n8n)
- ❌ Volumes supprimés (données perdues)

**Commande :**
```bash
cd ~/antislash-talk
./deploy-vps-final.sh
# Choisir option "2" quand demandé
```

---

### 3️⃣ **Mode RAPIDE** (Containers uniquement) ⚡

**Quand l'utiliser :**
- Mise à jour très rapide (2-3 minutes)
- Rebuild après changement de code
- **Nginx/SSL déjà parfaitement configurés**

**Ce qui est fait :**
- 🔄 Pull du code
- 🔄 Rebuild images Docker
- 🔄 Restart containers
- ✅ Nginx/SSL intacts

**Commande :**
```bash
cd ~/antislash-talk
./redeploy-containers.sh
```

---

## 🔍 Comment Choisir ?

### Scénario 1 : "J'ai pushé du nouveau code"
→ **Mode RAPIDE** (`redeploy-containers.sh`)

### Scénario 2 : "Je veux activer WhisperX/Ollama"
→ **Mode UPDATE** (`deploy-vps-final.sh` → option 1)

### Scénario 3 : "Mon nginx est cassé / je veux changer de domaine"
→ **Mode FRESH** (`deploy-vps-final.sh` → option 2)

### Scénario 4 : "Première installation"
→ **Mode FRESH** (`deploy-vps-final.sh` → auto-détecte et lance FRESH)

---

## 📦 Services Détectés et Préservés

Le script détecte automatiquement :

```bash
# Nginx configuré
/etc/nginx/sites-enabled/antislash-talk-ssl

# Containers Antislash
antislash-talk-web
antislash-talk-db
antislash-talk-kong
antislash-talk-auth
...

# Services additionnels
nocodb
n8n
(tout container avec ces noms)
```

---

## 🛡️ Mode UPDATE : Détails Techniques

### Détection Automatique

Le script vérifie :
1. Existence de `/etc/nginx/sites-enabled/antislash-talk-ssl`
2. Containers Docker existants
3. Services additionnels (NocoDB, n8n)

### Arrêt Sélectif

```bash
# Mode UPDATE : Arrêt seulement antislash-talk-*
docker stop antislash-talk-web
docker stop antislash-talk-db
# ... autres containers antislash

# NocoDB, n8n continuent de tourner ✅
```

### Préservation Nginx

```bash
# Détection Let's Encrypt
if grep -q "letsencrypt" /etc/nginx/sites-enabled/antislash-talk-ssl; then
    # Certificats valides préservés ✅
fi

# Détection route WhisperX
if grep -q "whisperx" /etc/nginx/sites-enabled/antislash-talk-ssl; then
    # Configuration WhisperX préservée ✅
fi
```

---

## 🎯 Configuration WhisperX

Automatiquement ajoutée dans tous les modes :

```bash
# Variables d'environnement
VITE_WHISPERX_URL=https://riquelme-talk.antislash.studio/whisperx

# Build Docker
--build-arg VITE_WHISPERX_URL="${VITE_WHISPERX_URL}"

# Nginx (si configuré manuellement)
location /whisperx/ {
    proxy_pass http://localhost:8082;
    ...
}
```

---

## 📊 Comparaison Rapide

| Fonctionnalité | UPDATE | FRESH | RAPIDE |
|---|---|---|---|
| Temps | ~8-10 min | ~15-20 min | ~2-3 min |
| Préserve nginx | ✅ | ❌ | ✅ |
| Préserve SSL | ✅ | ❌ | ✅ |
| Préserve NocoDB/n8n | ✅ | ❌ | ✅ |
| Rebuild images | ✅ | ✅ | ✅ |
| Reconfigure tout | ❌ | ✅ | ❌ |
| Questions interactives | Minimum | Beaucoup | Aucune |

---

## 🚨 Cas d'Urgence

### Rollback Rapide

```bash
# Si quelque chose ne va pas après UPDATE
cd ~/antislash-talk
git checkout HEAD~1  # Revenir au commit précédent
./redeploy-containers.sh
```

### Sauvegarde Nginx

```bash
# Avant modification manuelle
sudo cp /etc/nginx/sites-enabled/antislash-talk-ssl \
       /tmp/nginx-backup-$(date +%Y%m%d-%H%M%S).conf
```

### Logs en Temps Réel

```bash
# Tous les services
docker compose -f docker-compose.monorepo.yml logs -f

# Service spécifique
docker logs -f antislash-talk-web
docker logs -f antislash-talk-whisperx
```

---

## 📝 Notes Importantes

1. **Mode UPDATE** est **toujours plus sûr** pour les mises à jour
2. **Let's Encrypt** est préservé en mode UPDATE (pas besoin de refaire certbot)
3. **NocoDB/n8n** continuent de fonctionner pendant UPDATE
4. **WhisperX** est maintenant automatiquement configuré dans le build
5. Le script détecte automatiquement le meilleur mode à proposer

---

## 🆘 Support

En cas de problème :

```bash
# Vérifier l'état
docker compose -f docker-compose.monorepo.yml ps

# Vérifier nginx
sudo nginx -t
sudo systemctl status nginx

# Vérifier les logs
docker compose -f docker-compose.monorepo.yml logs --tail=50
```

---

**Dernière mise à jour** : 2024-11-19  
**Version** : 6.1.0

