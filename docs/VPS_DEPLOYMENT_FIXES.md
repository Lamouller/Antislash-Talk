# Corrections complètes du déploiement VPS

**Date:** 27 octobre 2025  
**Statut:** ✅ Toutes les corrections intégrées dans `deploy-vps-final.sh`

## 🎯 Résumé

Ce document liste **toutes** les corrections critiques découvertes lors du déploiement VPS et intégrées dans le script de déploiement final.

---

## 📋 Liste des corrections

### 1. ✅ Search Path pour `supabase_auth_admin`

**Problème:** Auth ne trouvait pas la table `auth.users` et cherchait `public.users`

**Solution:**
```sql
ALTER ROLE supabase_auth_admin SET search_path TO auth, public, extensions;
```

**Effet:** Auth peut maintenant trouver ses tables sans préfixer avec le schéma

---

### 2. ✅ Colonnes NULL dans `auth.users`

**Problème:** GoTrue s'attendait à des chaînes vides mais trouvait des `NULL`, causant l'erreur:
```
Scan error on column index 8, name "email_change": converting NULL to string is unsupported
```

**Solution:**
```sql
-- Corriger les NULL existants
UPDATE auth.users SET 
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, '')
WHERE <colonnes NULL>;

-- Définir DEFAULT '' pour éviter les NULL futurs
ALTER TABLE auth.users ALTER COLUMN email_change SET DEFAULT '';
-- ... (pour toutes les colonnes)
```

**Effet:** Les utilisateurs peuvent se connecter sans erreur de scan

---

### 3. ✅ Création de l'identité dans `auth.identities`

**Problème:** L'utilisateur était créé dans `auth.users` mais pas dans `auth.identities`, empêchant la connexion

**Solution:**
```sql
WITH new_user AS (
    INSERT INTO auth.users (...) VALUES (...) RETURNING id, email
)
INSERT INTO auth.identities (
    id, user_id, provider_id, provider,
    identity_data, last_sign_in_at, created_at, updated_at
)
SELECT
    extensions.gen_random_uuid(),
    new_user.id,
    new_user.id::text,
    'email',
    json_build_object('sub', new_user.id::text, 'email', new_user.email)::jsonb,
    now(), now(), now()
FROM new_user
ON CONFLICT (provider, provider_id) DO NOTHING;
```

**Effet:** L'utilisateur a maintenant une identité valide et peut se connecter

---

### 4. ✅ Création de tous les buckets Storage

**Problème:** Seul le bucket `recordings` était créé, les autres (`avatars`, `public`, `private`) manquaient

**Solution:**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES 
  ('recordings', 'recordings', false, 104857600, ARRAY['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg']::text[], now(), now()),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[], now(), now()),
  ('public', 'public', true, 10485760, NULL, now(), now()),
  ('private', 'private', false, 104857600, NULL, now(), now())
ON CONFLICT (id) DO NOTHING;
```

**Effet:** Tous les buckets nécessaires sont créés avec des limites de taille et types MIME appropriés

---

### 5. ✅ Permissions Storage complètes

**Problème:** Storage et Studio ne pouvaient pas accéder aux tables `storage.buckets` et `storage.objects`

**Solution:**
```sql
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role, supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, service_role, supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres, service_role, supabase_storage_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA storage TO anon, authenticated;
```

**Effet:** Storage et Studio peuvent maintenant lire et écrire dans les tables storage

---

### 6. ✅ Policies RLS de bypass pour `service_role`

**Problème:** RLS bloquait les opérations de Storage même pour le `service_role`

**Solution:**
```sql
-- FORCE RLS pour s'assurer que les policies s'appliquent
ALTER TABLE storage.buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY;

-- Policies de bypass pour service_role et postgres
CREATE POLICY "Service role bypass" 
ON storage.buckets FOR ALL 
TO service_role, postgres
USING (true) WITH CHECK (true);

CREATE POLICY "Service role bypass" 
ON storage.objects FOR ALL 
TO service_role, postgres
USING (true) WITH CHECK (true);
```

**Effet:** Le service Storage peut gérer les buckets et objets sans restriction RLS

---

### 7. ✅ Policies pour les buckets publics

**Problème:** Les buckets `public` et `avatars` ne pouvaient pas être lus par les utilisateurs anonymes

**Solution:**
```sql
CREATE POLICY "Public buckets are viewable"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id IN ('public', 'avatars'));
```

**Effet:** Les avatars et fichiers publics sont accessibles sans authentification

---

### 8. ✅ Mise à jour de Kong avec les JWT keys

**Problème:** Kong utilisait des clés JWT obsolètes, causant `Invalid authentication credentials`

**Solution:**
```bash
# Dans le script de déploiement
cp packages/supabase/kong.yml /tmp/kong.yml.template
sed -i "s/ANON_KEY_PLACEHOLDER/${ANON_KEY}/g" /tmp/kong.yml.template
sed -i "s/SERVICE_ROLE_KEY_PLACEHOLDER/${SERVICE_ROLE_KEY}/g" /tmp/kong.yml.template
docker cp /tmp/kong.yml.template antislash-talk-kong:/var/lib/kong/kong.yml
docker exec antislash-talk-kong kong reload
```

**Et dans `packages/supabase/kong.yml`:**
```yaml
consumers:
  - username: anon
    keyauth_credentials:
      - key: ANON_KEY_PLACEHOLDER
      - key: SERVICE_ROLE_KEY_PLACEHOLDER
```

**Effet:** Kong accepte maintenant les requêtes avec les clés JWT actuelles

---

### 9. ✅ Correction du htpasswd pour Studio

**Problème:** Le fichier `.htpasswd` était "busy" et ne pouvait pas être remplacé avec `rm -f`

**Solution:**
```bash
# Utiliser mv au lieu de rm
docker cp studio.htpasswd antislash-talk-studio-proxy:/tmp/.htpasswd.new
docker exec antislash-talk-studio-proxy sh -c "mv /tmp/.htpasswd.new /etc/nginx/.htpasswd && chmod 644 /etc/nginx/.htpasswd && nginx -s reload 2>/dev/null || exit 0"
```

**Effet:** Le mot de passe Studio est correctement mis à jour

---

### 10. ✅ Détection IPv4 uniquement

**Problème:** Le script détectait parfois des adresses IPv6

**Solution:**
```bash
detect_ipv4() {
    for method in \
        "curl -4 -s --connect-timeout 3 https://ipv4.icanhazip.com" \
        "curl -4 -s --connect-timeout 3 https://api.ipify.org" \
        "curl -4 -s --connect-timeout 3 https://ifconfig.me/ip" \
        "wget -4 -qO- --timeout=3 https://ipv4.icanhazip.com" \
        "wget -4 -qO- --timeout=3 https://api.ipify.org"
    do
        IP=$($method 2>/dev/null | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' | grep -v '^10\.' | grep -v '^172\.(1[6-9]|2[0-9]|3[0-1])\.' | grep -v '^192\.168\.' | head -n1)
        if [ -n "$IP" ]; then
            echo "$IP"
            return 0
        fi
    done
    return 1
}
```

**Effet:** Le script détecte maintenant uniquement des IPv4 publiques

---

## 🚀 Scripts disponibles

### Script de déploiement complet
```bash
cd ~/antislash-talk
git pull origin main
chmod +x deploy-vps-final.sh
./deploy-vps-final.sh
```

### Script de correction des buckets (si déjà déployé)
```bash
cd ~/antislash-talk
git pull origin main
chmod +x fix-buckets-complete.sh
./fix-buckets-complete.sh
```

---

## ✅ Checklist de vérification post-déploiement

Après le déploiement, vérifier que :

1. **Services démarrés:**
   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}"
   ```
   Tous les services doivent être `Up` (sauf `antislash-talk-studio` qui peut être `unhealthy` au début)

2. **Utilisateur créé:**
   ```bash
   docker exec antislash-talk-db psql -U postgres -c "SELECT email, email_confirmed_at FROM auth.users;"
   ```
   L'utilisateur doit exister avec `email_confirmed_at` non NULL

3. **Buckets créés:**
   ```bash
   docker exec antislash-talk-db psql -U postgres -c "SELECT id, name, public FROM storage.buckets ORDER BY name;"
   ```
   Doit afficher 4 buckets: `avatars`, `private`, `public`, `recordings`

4. **Kong répond correctement:**
   ```bash
   curl -s http://localhost:54321/auth/v1/health
   ```
   Doit retourner un JSON avec le statut de GoTrue

5. **Connexion web fonctionne:**
   - Ouvrir `http://VPS_IP:3000`
   - Se connecter avec les credentials affichés par le script
   - Vérifier qu'on arrive sur le dashboard

6. **Studio accessible:**
   - Ouvrir `http://VPS_IP:54327`
   - Se connecter avec `username: antislash` et le mot de passe affiché
   - Vérifier que les utilisateurs et buckets sont visibles

---

## 🔧 Troubleshooting

### Les buckets ne sont pas visibles dans Studio

1. Vérifier les permissions:
   ```bash
   docker exec antislash-talk-db psql -U postgres -c "\dp storage.buckets"
   ```

2. Vérifier RLS:
   ```bash
   docker exec antislash-talk-db psql -U postgres -c "SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'storage';"
   ```

3. Redémarrer Storage:
   ```bash
   docker compose -f docker-compose.monorepo.yml restart storage
   ```

### Auth ne démarre pas

1. Vérifier le `search_path`:
   ```bash
   docker exec antislash-talk-db psql -U postgres -c "SELECT rolname, rolconfig FROM pg_roles WHERE rolname = 'supabase_auth_admin';"
   ```
   Doit afficher: `{search_path=auth,public,extensions}`

2. Vérifier les logs Auth:
   ```bash
   docker logs antislash-talk-auth --tail 50
   ```

### 401 Unauthorized

1. Vérifier Kong:
   ```bash
   docker exec antislash-talk-kong cat /var/lib/kong/kong.yml | grep -A2 "keyauth_credentials"
   ```
   Les clés doivent correspondre à `.env.monorepo`

2. Recharger Kong:
   ```bash
   docker exec antislash-talk-kong kong reload
   ```

---

## 📝 Notes importantes

1. **Ordre d'exécution critique:**
   - PostgreSQL setup
   - Migrations
   - Services startup
   - Kong key update
   - Data creation

2. **Ne jamais modifier manuellement:**
   - `kong.yml` (utiliser les placeholders)
   - `.env.monorepo` après génération (sauf si nécessaire, puis redéployer)

3. **Toujours redémarrer les services après modification de `.env.monorepo`:**
   ```bash
   docker compose -f docker-compose.monorepo.yml down
   docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d
   ```

---

## 🎉 Résultat attendu

Après le déploiement réussi avec `deploy-vps-final.sh`, vous devez avoir :

- ✅ 1 utilisateur créé et confirmé
- ✅ 4 buckets Storage (recordings, avatars, public, private)
- ✅ Connexion web fonctionnelle
- ✅ Studio accessible avec authentification
- ✅ Tous les services en état `Up` et `healthy`
- ✅ Aucune erreur 401 ou 500
- ✅ Possibilité d'uploader des fichiers dans les buckets

---

**Fin du document de corrections**

