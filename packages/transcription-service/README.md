# 🎙️ Service de Transcription PyTorch (OPTIONNEL)

Service **optionnel** de transcription avec Whisper V3 + diarisation PyTorch.

## ⚠️ Important : Ne remplace PAS les APIs existantes

Ce service **complète** les APIs cloud (Gemini, OpenAI, Mistral) :
- ✅ Les **clés API** continuent de fonctionner normalement
- ✅ C'est une **option supplémentaire** "Local Server" dans les settings
- ✅ **Désactivable** si non utilisé (économise ressources)

## 🚀 Activation

### Sans GPU (CPU uniquement)
```bash
# Démarrer TOUS les services + PyTorch
docker-compose -f docker-compose.monorepo.yml --profile pytorch up -d

# Ou seulement le service PyTorch
docker-compose -f docker-compose.monorepo.yml up transcription-pytorch
```

### Avec GPU NVIDIA (recommandé pour production)
1. Installer [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
2. Décommenter la section `deploy` dans `docker-compose.monorepo.yml`
3. Lancer :
```bash
docker-compose -f docker-compose.monorepo.yml --profile pytorch up -d
```

## 📊 Vérification

```bash
# Status du service
curl http://localhost:8000/status

# Health check
curl http://localhost:8000/health
```

## 🔧 Configuration

### Token HuggingFace (pour diarisation)
Pour activer la diarisation (séparation des locuteurs) :

1. Créer un compte sur [HuggingFace](https://huggingface.co)
2. Accepter les conditions de pyannote : https://huggingface.co/pyannote/speaker-diarization-3.1
3. Créer un token : https://huggingface.co/settings/tokens
4. Ajouter dans `.env.local` :
```env
HUGGINGFACE_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxx
```

**Sans token** : la transcription fonctionne, mais sans identification des locuteurs.

## 🎯 Avantages vs API Cloud

| Critère | PyTorch Local | API Cloud |
|---------|--------------|-----------|
| **Coût** | Gratuit (après installation) | Payant par utilisation |
| **Confidentialité** | 100% local | Envoi vers serveurs tiers |
| **Vitesse (avec GPU)** | 🚀 Très rapide | Dépend du réseau |
| **Modèles** | Whisper V3 complet | Selon provider |
| **Diarisation** | ✅ pyannote 3.1 | Limité |
| **Hors ligne** | ✅ Fonctionne | ❌ Nécessite Internet |
| **Setup** | Plus complexe | Simple (juste clé API) |

## 📦 Modèles disponibles

- `tiny` : 39M params, ~70MB, très rapide
- `base` : 74M params, ~140MB, rapide
- `small` : 244M params, ~470MB, bon compromis
- `medium` : 769M params, ~1.5GB, qualité élevée ⭐ **Recommandé**
- `large-v2` : 1550M params, ~3GB, excellente qualité
- `large-v3` : 1550M params, ~3GB, meilleure version 🏆

Le modèle se télécharge automatiquement au premier usage et est mis en cache.

## 🔌 API Endpoints

### POST /transcribe
Transcription d'un fichier audio

```bash
curl -X POST http://localhost:8000/transcribe \
  -F "file=@audio.mp3" \
  -F "language=fr" \
  -F "model=medium" \
  -F "enable_diarization=true"
```

Réponse :
```json
{
  "transcript": "Bonjour, c'est la transcription...",
  "language": "fr",
  "segments": [
    {"id": 0, "start": 0.0, "end": 2.5, "text": "Bonjour"}
  ],
  "speakers": [
    {"speaker": "SPEAKER_00", "start": 0.0, "end": 5.2}
  ],
  "model_used": "whisper-medium",
  "processing_time": 12.34
}
```

## 🛑 Désactivation

Si vous n'utilisez pas le service PyTorch :

```bash
# Arrêter uniquement PyTorch
docker-compose -f docker-compose.monorepo.yml stop transcription-pytorch

# Ou démarrer SANS le profil pytorch
docker-compose -f docker-compose.monorepo.yml up -d
```

Le service ne consomme alors **aucune ressource**.

## 📝 Notes

- Premier démarrage : téléchargement des modèles (~5-10min selon connexion)
- Avec GPU : transcription 10-50x plus rapide
- Compatible Mac M1/M2 (via MPS), Linux GPU (CUDA), CPU partout

