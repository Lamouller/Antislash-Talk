#!/bin/bash
set -e

echo "🔧 Fix Profiles & Settings Issues"
echo "===================================="

cd ~/antislash-talk

echo ""
echo "📋 Diagnostic des problèmes..."
echo ""

# 1. Vérifier les profils en double
echo "1️⃣ Vérification des emails en double dans profiles:"
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
SELECT email, COUNT(*) as count 
FROM public.profiles 
GROUP BY email 
HAVING COUNT(*) > 1;
SQL

echo ""
echo "2️⃣ Vérification des utilisateurs sans profil:"
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
SELECT u.id, u.email 
FROM auth.users u 
LEFT JOIN public.profiles p ON u.id = p.id 
WHERE p.id IS NULL;
SQL

echo ""
echo "3️⃣ Structure de la table profiles:"
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
\d public.profiles
SQL

echo ""
echo "🔨 Application des correctifs..."
echo ""

# Correctif complet
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- 1. Supprimer la contrainte unique sur email si elle existe
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;

-- 2. Nettoyer les doublons de profiles (garder le plus récent)
DELETE FROM public.profiles a USING (
  SELECT MIN(ctid) as ctid, id
  FROM public.profiles 
  GROUP BY id HAVING COUNT(*) > 1
) b
WHERE a.id = b.id 
AND a.ctid <> b.ctid;

-- 3. Supprimer les profils orphelins (sans utilisateur)
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- 4. Créer les profils manquants
INSERT INTO public.profiles (id, email, display_name, avatar_url, created_at, updated_at)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'display_name', u.email),
    u.raw_user_meta_data->>'avatar_url',
    u.created_at,
    NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5. S'assurer que preferred_llm a une valeur par défaut
ALTER TABLE public.profiles 
ALTER COLUMN preferred_llm SET DEFAULT 'gpt-4';

-- 6. Mettre à jour les profils qui ont preferred_llm NULL
UPDATE public.profiles 
SET preferred_llm = 'gpt-4' 
WHERE preferred_llm IS NULL;

-- 7. Vérifier que tous les champs requis sont NOT NULL
ALTER TABLE public.profiles 
ALTER COLUMN email SET NOT NULL,
ALTER COLUMN created_at SET NOT NULL,
ALTER COLUMN updated_at SET NOT NULL;

-- 8. Re-créer l'index unique sur id (pas sur email)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey ON public.profiles(id);

-- 9. Afficher le résultat
SELECT COUNT(*) as total_profiles FROM public.profiles;
SELECT COUNT(*) as users_without_profile 
FROM auth.users u 
LEFT JOIN public.profiles p ON u.id = p.id 
WHERE p.id IS NULL;
SQL

echo ""
echo "✅ Correctifs appliqués !"
echo ""

echo "📊 État final:"
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
SELECT 
    (SELECT COUNT(*) FROM auth.users) as total_users,
    (SELECT COUNT(*) FROM public.profiles) as total_profiles,
    (SELECT COUNT(*) FROM public.profiles WHERE preferred_llm IS NULL) as profiles_without_llm;
SQL

echo ""
echo "🎉 Terminé ! Vous pouvez maintenant sauvegarder vos paramètres."
