# 📜 Documentation des Scripts Utiles

## 🚀 Scripts de Déploiement

### `deploy-vps-final.sh`
**Script principal de déploiement complet**
```bash
./deploy-vps-final.sh
```
- Déploie l'application complète avec Supabase, Ollama, etc.
- Support des domaines et sous-domaines
- Configuration HTTPS automatique
- Installation automatique d'un modèle Ollama

### `clean-and-deploy.sh`
**Nettoie tout et redéploie**
```bash
./clean-and-deploy.sh
```
- Arrête tous les services
- Nettoie Docker
- Lance `deploy-vps-final.sh`

## 🔍 Scripts de Diagnostic

### `diagnose-ollama.sh`
**Diagnostic complet d'Ollama**
```bash
./diagnose-ollama.sh
```
- Vérifie l'état du container
- Teste les connexions
- Vérifie les modèles installés

### `diagnose-studio-500.sh`
**Diagnostic erreur 500 Studio**
```bash
./diagnose-studio-500.sh
```
- Vérifie les logs du proxy
- Teste l'authentification
- Identifie les problèmes de configuration

### `check-services-status.sh`
**État de tous les services**
```bash
./check-services-status.sh
```
- Liste tous les containers
- Affiche leur état de santé
- Montre les ports utilisés

## 🛠️ Scripts de Correction

### `fix-ollama-cors.sh`
**Configure CORS pour Ollama**
```bash
./fix-ollama-cors.sh
```
- Configure Nginx avec les headers CORS
- Installe un modèle si nécessaire
- Teste la connectivité

### `fix-studio-clean-all.sh`
**Corrige les problèmes Studio**
```bash
./fix-studio-clean-all.sh
```
- Nettoie les fichiers problématiques
- Recrée l'authentification
- Redémarre le proxy

### `install-ollama-model.sh`
**Installe un modèle Ollama**
```bash
./install-ollama-model.sh
```
- Liste les modèles disponibles
- Guide interactif d'installation
- Teste le modèle installé

## 🐳 Scripts Docker

### `force-clean-docker.sh`
**Nettoyage forcé Docker**
```bash
./force-clean-docker.sh
```
- Arrête tous les containers
- Supprime les volumes
- Nettoie les images non utilisées

### `setup-docker-mirror.sh`
**Configure un miroir Docker**
```bash
./setup-docker-mirror.sh
```
- Configure un miroir Docker pour éviter les rate limits
- Utile pour les déploiements fréquents

## 🔑 Scripts de Génération

### `generate-jwt-keys.js`
**Génère les clés JWT**
```bash
node generate-jwt-keys.js
```
- Génère ANON_KEY et SERVICE_ROLE_KEY
- Nécessite JWT_SECRET en variable d'environnement

### `generate-supabase-keys.js`
**Génère toutes les clés Supabase**
```bash
node generate-supabase-keys.js <JWT_SECRET>
```
- Génère toutes les clés nécessaires
- Affiche les variables à ajouter dans .env

## 📁 Fichiers de Configuration

### Docker Compose
- `docker-compose.monorepo.yml` - Configuration principale
- `docker-compose.yml` - Configuration de base
- `docker-compose.full.yml` - Configuration complète avec tous les services

### Nginx
- `nginx.conf` - Configuration principale
- `nginx.studio.conf` - Configuration Studio
- `nginx.web.conf` - Configuration application web

### Environnement
- `env.monorepo.example` - Exemple de configuration monorepo
- `env.example` - Exemple de configuration simple

## 🗂️ Scripts Archivés

Les scripts obsolètes ont été déplacés dans `_archive_scripts/` pour référence historique.

## 💡 Conseils d'utilisation

1. **Pour un nouveau déploiement** : Utilisez `deploy-vps-final.sh`
2. **Pour diagnostiquer un problème** : Commencez par `check-services-status.sh`
3. **Pour Ollama** : `diagnose-ollama.sh` puis `fix-ollama-cors.sh` si nécessaire
4. **Pour Studio** : `diagnose-studio-500.sh` puis `fix-studio-clean-all.sh`
5. **Pour tout nettoyer** : `force-clean-docker.sh` ou `clean-and-deploy.sh`
