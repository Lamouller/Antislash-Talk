# Solutions pour la limite de taux Docker Hub

Vous avez atteint la limite de pulls Docker Hub (100 pulls par 6 heures pour les utilisateurs anonymes).

## 🚀 Solutions disponibles (dans l'ordre de préférence)

### 1. Se connecter à Docker Hub (RECOMMANDÉ) 
La limite passe à 200 pulls/6h une fois connecté.

```bash
# Créer un compte gratuit sur https://hub.docker.com si nécessaire
docker login
# Username: votre_nom_utilisateur
# Password: votre_mot_de_passe

# Vérifier la connexion
docker info | grep Username

# Relancer le déploiement
./deploy-vps-v3.sh
```

### 2. Configurer un miroir Docker
Utilise des miroirs publics pour contourner la limite.

```bash
cd ~/antislash-talk
git pull
./setup-docker-mirror.sh
./deploy-vps-v3.sh
```

### 3. Déploiement par étapes
Télécharge les images une par une avec des pauses.

```bash
cd ~/antislash-talk
git pull
./deploy-vps-staged.sh
```

### 4. Attendre le reset
La limite se réinitialise toutes les 6 heures.

```bash
# Vérifier votre limite actuelle
cd ~/antislash-talk
git pull
./check-docker-limit.sh

# Si limite atteinte, attendre ~6h puis relancer
./deploy-vps-v3.sh
```

## 📊 Vérifier votre limite

```bash
# Script pour voir combien de pulls restent
./check-docker-limit.sh
```

## ⚡ Solution rapide

Si vous êtes pressé, utilisez cette commande pour vous connecter et déployer :

```bash
docker login && cd ~/antislash-talk && ./deploy-vps-v3.sh
```

## 🔧 Dépannage

Si Docker login échoue :
1. Vérifiez votre nom d'utilisateur/mot de passe
2. Créez un compte sur https://hub.docker.com si nécessaire
3. Utilisez un Personal Access Token au lieu du mot de passe

Si le miroir ne fonctionne pas :
1. Vérifiez la configuration : `cat /etc/docker/daemon.json`
2. Redémarrez Docker : `sudo systemctl restart docker`
3. Testez : `docker pull hello-world`

## 📝 Notes

- La limite est par IP, pas par compte
- Les comptes payants Docker Hub n'ont pas de limite
- Les miroirs peuvent être plus lents mais contournent la limite
- Une fois les images téléchargées, elles sont en cache local
