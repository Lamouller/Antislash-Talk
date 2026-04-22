# Rollout — Refactor Transcription Flow

## Vue d'ensemble

Le refactor touche 9 phases (0→12.5) qui sont toutes **gated par feature flags**.
Le rollout se fait en 4 étapes, **sans redeploy entre chaque étape** — seules des
updates SQL sur la table `profiles.feature_flags` suffisent.

## Pré-requis

- [ ] Branche `refactor/transcription-flow` mergée sur `main`
- [ ] Build web prod déployé sur talk.antislash.studio (`docker compose -f docker-compose.monorepo.yml up -d --build --no-cache web`)
- [ ] Migration `feature_flags jsonb` appliquée sur Supabase (`20260422000000_add_profile_feature_flags.sql`)
- [ ] Migration `transcription_events` table appliquée (`20260422010000_add_transcription_events.sql`)
- [ ] Tous les flags OFF par défaut (verified via `SELECT id FROM profiles WHERE feature_flags != '{}'`)

## Feature flags disponibles

| Flag | Phase | Effet |
|------|-------|-------|
| `newTranscriptionFlow` | master | Kill-switch : si false, TOUS les sous-flags forcés false |
| `normalizedTimestamps` | 5 | Utilise startSec/endSec numeric |
| `speakerLockDedup` | 7 | Speaker mapping atomique + dedup |
| `wsReconnect` | 8 | Exponential backoff reconnect Gemini |
| `clientVAD` | 9 | Drop silence avant envoi PCM |
| `unifiedMicStream` | 10 | 1 seul getUserMedia partagé |
| `providerMutex` | 11 | State machine + fallback auto |
| `micRouteHandling` | 12.5 | Détecte changement micro |

## Étape 1 — J+0 : testeur unique (vous)

SQL à exécuter sur Supabase prod :

```sql
UPDATE public.profiles
SET feature_flags = jsonb_build_object(
  'newTranscriptionFlow', true,
  'normalizedTimestamps', true,
  'speakerLockDedup', true,
  'wsReconnect', true,
  'clientVAD', true,
  'unifiedMicStream', true,
  'providerMutex', true,
  'micRouteHandling', true
)
WHERE id = '<YOUR_USER_ID>';
```

Activer la collecte de telemetry (env var, pas de redeploy nécessaire si déjà dans .env) :

```
VITE_FLAG_TRANSCRIPTION_TELEMETRY=true
```

### Tests à faire (48h)

- [ ] Meeting 5min iPhone (WiFi)
- [ ] Meeting 5min iPhone (4G + métro)
- [ ] Meeting 5min Android (WiFi)
- [ ] AirPods plug/unplug mid-record
- [ ] Appel entrant pendant enregistrement
- [ ] App background 30s

### Critères de succès

- Pas de crash, pas de freeze
- Segments live affichés <3s de latence
- Speaker names détectés rétroactivement
- Zéro hallucination "merci d'avoir regardé"

## Étape 2 — J+2 : 10% users

Sélection aléatoire stable (hash du user_id) :

```sql
UPDATE public.profiles
SET feature_flags = jsonb_set(
  COALESCE(feature_flags, '{}'::jsonb),
  '{newTranscriptionFlow}',
  'true'
)
WHERE (hashtext(id::text) % 10) = 0
  AND (feature_flags->>'newTranscriptionFlow') IS NULL;
```

### Monitoring (48h)

```sql
-- Reconnects WS
SELECT event_type, COUNT(*), AVG((payload->>'attempts')::int) AS avg_attempts
FROM transcription_events
WHERE event_type LIKE 'ws_reconnect%'
  AND created_at > now() - interval '48 hours'
GROUP BY event_type;

-- Providers transitions
SELECT payload->>'to' AS activated, COUNT(*)
FROM transcription_events
WHERE event_type = 'provider_transition'
  AND created_at > now() - interval '48 hours'
GROUP BY 1;

-- VAD drop ratio
SELECT SUM((payload->>'dropped')::bigint) AS total_dropped
FROM transcription_events
WHERE event_type = 'vad_drop_batch'
  AND created_at > now() - interval '48 hours';

-- Sessions uniques actives
SELECT COUNT(DISTINCT session_id) AS sessions,
       COUNT(DISTINCT user_id) AS users
FROM transcription_events
WHERE created_at > now() - interval '48 hours';
```

### Critères de poursuite

- `ws_reconnect_exhausted` < 5% des sessions
- `provider_fallback` < 10% des sessions
- Aucun ticket user bloquant

## Étape 3 — J+4 : 50% users

```sql
UPDATE public.profiles
SET feature_flags = jsonb_set(
  COALESCE(feature_flags, '{}'::jsonb),
  '{newTranscriptionFlow}',
  'true'
)
WHERE (hashtext(id::text) % 2) = 0
  AND (feature_flags->>'newTranscriptionFlow') IS NULL;
```

48h de monitoring avec les mêmes requêtes. Mêmes critères.

## Étape 4 — J+6 : 100%

```sql
UPDATE public.profiles
SET feature_flags = COALESCE(feature_flags, '{}'::jsonb) || '{"newTranscriptionFlow": true}'::jsonb
WHERE (feature_flags->>'newTranscriptionFlow') IS NULL;
```

## Kill-switch

Si régression détectée à n'importe quelle étape :

```sql
UPDATE public.profiles
SET feature_flags = '{}'::jsonb
WHERE feature_flags->>'newTranscriptionFlow' = 'true';
```

Pas de redeploy. Les users repassent sur l'ancien code au prochain render (cache flags = 60s côté client).

## Nettoyage (J+30 si tout stable)

Phase post-rollout (à scheduler) :

- Supprimer les branches legacy `if (!useX)` dans chaque hook
- Simplifier `record.tsx` (supprimer le fallback if/else if/else)
- Marquer les flags comme `always-on` dans `featureFlags.ts` puis supprimer leur résolution conditionnelle
- Archiver ce document dans `docs/archive/`
