# 🚀 Scripts de Déploiement Automatique - Antislash Talk

## Vue d'ensemble

Trois scripts sont disponibles pour faciliter le déploiement sur VPS :

| Script | Usage | Temps | Difficulté |
|--------|-------|-------|------------|
| `quick-deploy.sh` | Démarrage rapide | 2 min | ⭐ |
| `deploy-vps.sh` | Déploiement complet | 10 min | ⭐⭐ |
| `deploy-from-scratch.sh` | Installation complète | 15 min | ⭐⭐⭐ |

---

## 🏃 Quick Deploy (Démarrage Rapide)

### Usage
```bash
bash quick-deploy.sh
```

### Ce que fait le script
- ✅ Vérifie/installe Docker
- ✅ Génère automatiquement les mots de passe
- ✅ Configure le minimum vital
- ✅ Lance tous les services

### Idéal pour
- Tests rapides
- Démos
- Développement local
- Première découverte

### Exemple
```bash
$ bash quick-deploy.sh
🎙️ Antislash Talk - Déploiement Rapide

Configuration rapide :
IP du serveur ou domaine : 192.168.1.100
Génération des mots de passe sécurisés...
✅ Configuration créée
Démarrage des services...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Déploiement terminé !
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Application : http://192.168.1.100:3000
API Supabase : http://192.168.1.100:54321
Studio : http://192.168.1.100:54324
```

---

## 🛠️ Deploy VPS (Déploiement Complet)

### Usage
```bash
bash deploy-vps.sh
```

### Ce que fait le script
- ✅ Vérifie tous les prérequis
- ✅ Configuration interactive complète
- ✅ Génère des secrets cryptographiquement sûrs
- ✅ Génère les vraies clés JWT Supabase
- ✅ Option PyTorch (modèles IA lourds)
- ✅ Configuration Nginx optionnelle
- ✅ SSL/HTTPS avec Let's Encrypt
- ✅ Configuration du firewall
- ✅ Tests de santé automatiques
- ✅ Sauvegarde des infos de connexion

### Idéal pour
- Production
- Déploiement professionnel
- Configuration personnalisée
- Multi-utilisateurs

### Options interactives
1. **Domaine/IP** : Votre domaine ou IP publique
2. **SSL** : Configuration HTTPS automatique
3. **Mode** : Léger (4GB RAM) ou Complet avec PyTorch (8GB+ RAM)
4. **Port** : Port de l'application (défaut: 3000)
5. **Nginx** : Reverse proxy professionnel
6. **Firewall** : Configuration UFW automatique

### Exemple de session
```bash
$ bash deploy-vps.sh

═══════════════════════════════════════════════════════════
    Vérification des prérequis
═══════════════════════════════════════════════════════════

✅ Docker installé : Docker version 24.0.7
✅ Docker Compose installé : Docker Compose version v2.23.0
✅ Git installé : git version 2.34.1
✅ OpenSSL installé

═══════════════════════════════════════════════════════════
    Configuration du déploiement
═══════════════════════════════════════════════════════════

Entrez votre domaine ou l'IP du VPS
(ex: talk.mondomaine.com ou 185.123.45.67)
URL/IP : talk.monsite.com

Voulez-vous configurer HTTPS/SSL ? (recommandé)
Configurer SSL [O/n] : O

Mode de déploiement :
1) Léger (sans PyTorch) - Recommandé pour débuter
2) Complet (avec PyTorch) - Pour modèles IA lourds
Votre choix [1/2] : 1
✅ Mode léger sélectionné - 4GB RAM suffisants

Port de l'application web (défaut: 3000) :
Port [3000] : 

═══════════════════════════════════════════════════════════
    Génération des secrets sécurisés
═══════════════════════════════════════════════════════════

✅ Mot de passe PostgreSQL généré
✅ JWT Secret généré
⚠️  Génération des clés Supabase...
✅ Clés Supabase générées avec le JWT_SECRET

═══════════════════════════════════════════════════════════
    Récapitulatif de la configuration
═══════════════════════════════════════════════════════════

Domaine/IP : talk.monsite.com
Protocole : https
Port Web : 3000
Mode : Léger sans PyTorch
Site URL : https://talk.monsite.com:3000
API URL : https://talk.monsite.com:54321
Les mots de passe ont été générés automatiquement

Confirmer et continuer ? [O/n]
Continuer : O
```

### Fichiers générés
- `.env.monorepo` : Configuration complète
- `deployment-info.txt` : Informations sensibles (mots de passe, etc.)

---

## 🏗️ Deploy From Scratch (Installation Complète)

### Usage
```bash
bash deploy-from-scratch.sh
```

### Ce que fait le script
Tout ce que fait `deploy-vps.sh` PLUS :
- ✅ Configuration système complète
- ✅ Optimisation performances
- ✅ Monitoring (Prometheus/Grafana)
- ✅ Backup automatique
- ✅ Cron jobs
- ✅ Logrotate
- ✅ Sécurité renforcée

### Idéal pour
- Environnement de production critique
- Déploiement entreprise
- Infrastructure complète

---

## 📋 Comparaison des Scripts

| Fonctionnalité | quick-deploy | deploy-vps | deploy-from-scratch |
|----------------|--------------|------------|---------------------|
| Temps d'exécution | 2 min | 10 min | 15 min |
| Docker install | ✅ | ✅ | ✅ |
| Génération mots de passe | ✅ | ✅ | ✅ |
| Clés JWT réelles | ❌ | ✅ | ✅ |
| Configuration interactive | ❌ | ✅ | ✅ |
| Support PyTorch | ❌ | ✅ | ✅ |
| Nginx | ❌ | ✅ | ✅ |
| SSL/HTTPS | ❌ | ✅ | ✅ |
| Firewall | ❌ | ✅ | ✅ |
| Monitoring | ❌ | ❌ | ✅ |
| Backup auto | ❌ | ❌ | ✅ |

---

## 🔒 Sécurité

### Mots de passe générés
- **PostgreSQL** : 32 caractères aléatoires
- **JWT Secret** : 45 caractères aléatoires
- **Méthode** : OpenSSL cryptographiquement sûr

### Clés Supabase
- Générées avec `generate-supabase-keys.js`
- Signées avec le JWT_SECRET
- Expiration : 1 an

### Sauvegarde des credentials
```bash
# deploy-vps.sh crée automatiquement :
~/antislash-talk/deployment-info.txt

# Contient :
- PostgreSQL Password
- JWT Secret
- URLs d'accès
- Commandes utiles
```

⚠️ **IMPORTANT** : Conservez `deployment-info.txt` en lieu sûr !

---

## 🚨 Troubleshooting

### Docker non installé
```bash
# Le script l'installe automatiquement
# Si erreur, installez manuellement :
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Reconnectez-vous
```

### Port déjà utilisé
```bash
# Vérifier quel process utilise le port
sudo lsof -i :3000
# Ou choisir un autre port dans le script
```

### Mémoire insuffisante
```bash
# Vérifier la RAM disponible
free -h
# Mode léger nécessite 4GB minimum
# Mode PyTorch nécessite 8GB minimum
```

### Services ne démarrent pas
```bash
# Voir les logs
docker compose -f docker-compose.monorepo.yml logs

# Redémarrer proprement
docker compose -f docker-compose.monorepo.yml down
docker compose -f docker-compose.monorepo.yml up -d
```

---

## 📝 Commandes Utiles Post-Déploiement

### Monitoring
```bash
# État des services
docker compose -f docker-compose.monorepo.yml ps

# Logs en temps réel
docker compose -f docker-compose.monorepo.yml logs -f

# Utilisation ressources
docker stats
```

### Maintenance
```bash
# Redémarrer un service
docker compose -f docker-compose.monorepo.yml restart web

# Mise à jour
git pull origin main
docker compose -f docker-compose.monorepo.yml up -d --build

# Backup base de données
docker exec antislash-talk-db pg_dump -U postgres postgres > backup.sql
```

### Activer PyTorch (après coup)
```bash
# Si déployé en mode léger
docker compose -f docker-compose.monorepo.yml --profile pytorch up -d
```

---

## 💡 Recommandations

### Pour débuter
1. Utilisez `quick-deploy.sh` pour tester
2. Familiarisez-vous avec l'interface
3. Passez à `deploy-vps.sh` pour la production

### Pour la production
1. Utilisez `deploy-vps.sh` avec SSL
2. Configurez des backups réguliers
3. Surveillez les logs
4. Mettez à jour régulièrement

### Ressources VPS
- **Minimum** : 4GB RAM, 2 vCPU, 50GB SSD
- **Recommandé** : 8GB RAM, 4 vCPU, 100GB SSD
- **PyTorch** : 16GB RAM, 8 vCPU, GPU optionnel

---

## 🎯 Résumé

- **Test rapide** → `quick-deploy.sh`
- **Production** → `deploy-vps.sh`
- **Infrastructure complète** → `deploy-from-scratch.sh`

Tous les scripts sont **100% automatisés** et génèrent des configurations **sécurisées par défaut**.

