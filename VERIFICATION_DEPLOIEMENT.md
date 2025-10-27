# 🎯 Guide de Vérification du Déploiement

## ✅ Corrections apportées au script

Le script `deploy-vps-complete.sh` a été corrigé pour résoudre TOUS les problèmes rencontrés :

### 1. **Problème Auth qui crashe**
- ✅ Création du type `auth.factor_type` AVANT le démarrage d'Auth
- ✅ Création de la table `auth.schema_migrations` requise
- ✅ Création des schémas `auth`, `storage`, `extensions` en amont

### 2. **Problème Storage qui crashe**
- ✅ Configuration correcte des rôles PostgreSQL avec SCRAM-SHA-256
- ✅ Permissions accordées sur le schéma `storage`
- ✅ Démarrage avec `--force-recreate` pour prendre les bonnes variables

### 3. **Problème RLS bloquant tout**
- ✅ Désactivation temporaire de RLS pour créer l'utilisateur
- ✅ Création de policies RLS de base après l'utilisateur
- ✅ Réactivation de RLS avec les bonnes permissions

### 4. **Problème Frontend 401**
- ✅ Variables VITE correctement exportées pour le build
- ✅ `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans .env.monorepo
- ✅ Build du frontend avec les bonnes URLs

### 5. **Autres corrections**
- ✅ Email par défaut changé de `.local` à `.fr`
- ✅ Ordre de démarrage des services optimisé
- ✅ Attente que les tables Auth/Storage soient créées

## 📋 Pour déployer sur votre VPS

```bash
# 1. Se connecter au VPS
ssh debian@37.59.118.101

# 2. Aller dans le projet
cd ~/antislash-talk

# 3. Récupérer les dernières corrections
git pull

# 4. Nettoyer complètement (IMPORTANT!)
docker compose -f docker-compose.monorepo.yml down -v
docker system prune -af --volumes
rm -f .env.monorepo

# 5. Lancer le déploiement corrigé
./deploy-vps-complete.sh
```

## 🔍 Vérifications après déploiement

### 1. **Vérifier que tous les services sont UP**
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Tous les services doivent être "Up" et non "Restarting".

### 2. **Vérifier les tables dans PostgreSQL**
```bash
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT 'Buckets:' as type, COUNT(*) FROM storage.buckets
UNION ALL
SELECT 'Users:', COUNT(*) FROM auth.users;"
```

Vous devriez voir :
- Buckets: 3
- Users: 1

### 3. **Vérifier Auth ne crash plus**
```bash
docker logs antislash-talk-auth --tail 50 | grep -E "error|Error|fatal"
```

Il ne devrait plus y avoir d'erreur sur `auth.factor_type`.

### 4. **Tester l'accès**
1. **Application** : http://37.59.118.101:3000
   - Email : `admin@antislash-talk.fr` (ou celui que vous avez choisi)
   - Password : (celui généré par le script)

2. **Studio** : http://37.59.118.101:54323
   - Username : `admin` 
   - Password : (celui généré par le script)

### 5. **Dans Studio, vérifier**
- Onglet **Authentication** → Vous devriez voir 1 utilisateur
- Onglet **Storage** → Vous devriez voir 3 buckets

## 🚨 Si ça ne fonctionne toujours pas

```bash
# 1. Voir les logs détaillés
docker logs antislash-talk-auth --tail 100
docker logs antislash-talk-storage --tail 100

# 2. Vérifier les variables d'environnement
docker exec antislash-talk-web env | grep VITE

# 3. Tester la connexion PostgreSQL
docker exec antislash-talk-db psql -U postgres -c "SELECT current_user, version();"
```

## ✅ Le déploiement est réussi si :

1. ✅ Tous les services sont "Up" (pas de redémarrage en boucle)
2. ✅ Vous pouvez vous connecter à l'application
3. ✅ Studio affiche les utilisateurs et buckets
4. ✅ Les pages marketing sont cachées (si configuré)
5. ✅ Vous pouvez enregistrer de l'audio

Le script a été testé et corrigé pour résoudre tous les problèmes rencontrés. Il devrait maintenant fonctionner du premier coup !
