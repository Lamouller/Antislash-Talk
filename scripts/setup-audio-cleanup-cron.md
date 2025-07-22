# Configuration du nettoyage automatique des audios

## 🎯 Objectif
Supprimer automatiquement les fichiers audio de plus de 48 heures pour optimiser le stockage et la sécurité.

## 🔧 Configuration

### 1. Déploiement de la fonction Supabase

```bash
# Déployer la fonction de nettoyage
supabase functions deploy cleanup-expired-audio

# Tester la fonction manuellement
supabase functions invoke cleanup-expired-audio
```

### 2. Configuration du CRON (GitHub Actions)

Créer le fichier `.github/workflows/cleanup-audio.yml` :

```yaml
name: Cleanup Expired Audio Files
on:
  schedule:
    # Tous les jours à 02:00 UTC
    - cron: '0 2 * * *'
  workflow_dispatch: # Permet le déclenchement manuel

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup expired audio
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            "${{ secrets.SUPABASE_URL }}/functions/v1/cleanup-expired-audio"
```

### 3. Configuration des secrets GitHub

Dans les settings du repository, ajouter :
- `SUPABASE_URL` : URL de votre projet Supabase
- `SUPABASE_SERVICE_ROLE_KEY` : Clé service role

### 4. Configuration alternative avec Supabase CRON

```sql
-- Créer une extension cron (si disponible)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programmer le nettoyage quotidien à 02:00 UTC
SELECT cron.schedule(
  'cleanup-expired-audio',
  '0 2 * * *',
  $$
  -- Supprimer les enregistrements expirés (sera géré par la fonction Edge)
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/cleanup-expired-audio',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

## 🔍 Surveillance

### Logs des nettoyages

Consulter les logs dans :
- Supabase Dashboard > Functions > cleanup-expired-audio > Logs
- GitHub Actions (si configuré)

### Métriques importantes

La fonction retourne :
```json
{
  "success": true,
  "message": "Cleanup completed. Deleted 5 of 7 expired audio files",
  "deletedCount": 5,
  "totalExpired": 7,
  "errors": ["Meeting xyz: Permission denied"]
}
```

## 🚨 Points d'attention

1. **Sauvegarde** : Aucune sauvegarde n'est effectuée avant suppression
2. **Logs audit** : La colonne `audio_expires_at` est conservée pour traçabilité
3. **Erreurs** : Les erreurs sont loggées mais n'interrompent pas le processus
4. **Permissions** : Nécessite les droits Service Role sur storage et tables

## 🧪 Test manuel

```bash
# Tester la fonction de nettoyage
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "https://your-project.supabase.co/functions/v1/cleanup-expired-audio"
``` 