# 🧪 Guide de Test Complet - Streaming & Auto-Summary

## ✅ Changements Appliqués

### 1. **Toggle Auto-Generate AI Summary** ✨
- Emplacement : **Settings** → **Recording Behavior**
- Titre : `🤖 Auto-Generate AI Summary (Ollama)`
- Fonction : Génère automatiquement le titre et le résumé via Ollama après la fin de la transcription streaming

### 2. **Zone de Transcription en Temps Réel** 📜
- Visible dès l'activation du streaming
- Auto-scroll activé
- Détection automatique des noms des speakers

### 3. **Bouton "Generate Title & Summary"** 🤖
- Fonctionne avec **tous les providers** (Ollama, OpenAI, Gemini, Mistral)
- Visible uniquement si une transcription existe

---

## 🧪 Tests à Effectuer

### Test 1 : Activer les Fonctionnalités

1. **Ouvrir Settings** (`http://localhost:3000/settings`)
2. **Activer les toggles** :
   ```
   ✅ 🚀 Live Streaming Transcription = ON
   ✅ 🤖 Auto-Generate AI Summary (Ollama) = ON
   ```
3. **Sauvegarder** les paramètres
4. **Vérifier** : Un toast "Settings saved!" doit apparaître

---

### Test 2 : Vérifier WhisperX

```bash
# Vérifier que WhisperX est démarré
docker ps | grep whisperx

# Vérifier les logs
docker logs antislash-talk-whisperx --tail 50

# Tester le health endpoint
curl http://localhost:8082/health
```

**Résultat attendu** :
```json
{
  "status": "ok",
  "device": "cpu",
  "compute_type": "int8",
  "huggingface_token_set": true,
  "diarization_available": true
}
```

---

### Test 3 : Test de Streaming (Sans Ollama Auto-Summary)

#### 3.1 Préparation
1. **Désactiver** temporairement "Auto-Generate AI Summary"
2. **Activer** "Live Streaming Transcription"
3. **Sélectionner** un modèle avec diarization :
   - `small-diarization+diarization` (WhisperX recommandé)

#### 3.2 Enregistrement
1. **Aller sur** `/record`
2. **Cliquer** "Start Recording"
3. **Parler** dans le micro :
   ```
   Bonjour, je m'appelle Marie.
   [Pause]
   Aujourd'hui nous allons parler du projet.
   ```

#### 3.3 Vérifications en Temps Réel
✅ **Zone "💬 Live Transcription" apparaît** immédiatement  
✅ **Badge "STREAMING" vert** est visible  
✅ **Segments s'affichent** au fur et à mesure  
✅ **Toast "🎉 Locuteur identifié : Marie"** apparaît  
✅ **Nom "Marie"** appliqué rétroactivement aux segments précédents  

#### 3.4 Fin d'Enregistrement
1. **Cliquer** "Stop Recording"
2. **Attendre** la fin de la transcription
3. **Vérifier** : Badge passe à "COMPLETED" bleu

#### 3.5 Vérification de la Sauvegarde
1. **Aller sur** `/meetings`
2. **Vérifier** : Le meeting est présent dans la liste
3. **Cliquer** sur le meeting
4. **Vérifier** : La transcription complète est visible avec les noms

---

### Test 4 : Test Auto-Summary avec Ollama

#### 4.1 Préparation
1. **Vérifier Ollama** :
   ```bash
   curl http://localhost:11434/api/tags
   ```
2. **Activer** "Auto-Generate AI Summary" dans Settings
3. **Sauvegarder**

#### 4.2 Enregistrement
1. **Faire un enregistrement** avec streaming (même processus que Test 3)
2. **Stopper** l'enregistrement

#### 4.3 Vérifications
✅ **Toast "🤖 Génération du résumé..."** apparaît  
✅ **Titre** est généré automatiquement  
✅ **Summary** est généré automatiquement  
✅ **Meeting** est sauvegardé avec titre et summary  

#### 4.4 Logs à Observer
```javascript
// Dans la console du navigateur (F12):
[record] 🤖 AUTO-SUMMARY ACTIVATED!
[record] 📝 Generating title...
[record] ✅ Title generated
[record] 📊 Generating summary...
[record] ✅ Summary generated
[record] 💾 Saving meeting...
```

---

### Test 5 : Bouton "Generate Title & Summary" Manuel

#### 5.1 Cas d'Usage
Utiliser ce bouton si :
- Auto-summary était désactivé
- On veut régénérer avec un provider différent
- On veut un titre/summary pour un vieux meeting

#### 5.2 Test
1. **Aller sur** un meeting existant avec transcription
2. **Vérifier** : Bouton "Generate Title & Summary" est visible
3. **Cliquer** sur le bouton
4. **Attendre** (~10-30 secondes selon le provider)

#### 5.3 Vérifications
✅ **Bouton** affiche "Generating..." pendant le traitement  
✅ **Titre** est mis à jour  
✅ **Summary** est affiché  
✅ **Toast "✨ Title and summary generated successfully!"**  

---

## 🐛 Dépannage

### Problème 1 : Zone Streaming Vide
**Symptôme** : Zone "💬 Live Transcription" s'affiche mais reste vide

**Solutions** :
1. **Vérifier WhisperX** :
   ```bash
   docker logs antislash-talk-whisperx --tail 100
   ```
2. **Vérifier la console navigateur** (F12) :
   ```javascript
   [record] 🚀 STREAMING MODE ACTIVATED! // Doit être présent
   [record] 🎤 NEW LIVE SEGMENT #1 // Doit apparaître
   ```
3. **Vérifier le micro** : Permissions accordées ?
4. **Vérifier le modèle** : Un modèle avec "diarization" est sélectionné ?

### Problème 2 : Auto-Summary ne se Génère Pas
**Symptôme** : Meeting sauvegardé mais sans titre/summary

**Solutions** :
1. **Vérifier Ollama** :
   ```bash
   docker ps | grep ollama
   curl http://localhost:11434/api/tags
   ```
2. **Vérifier le toggle** dans Settings
3. **Vérifier les logs** :
   ```bash
   docker logs antislash-talk-web --tail 100
   ```

### Problème 3 : Bouton "Generate Title & Summary" Invisible
**Symptôme** : Bouton ne s'affiche pas sur la page meeting

**Raisons possibles** :
- ✅ Meeting n'a **pas de transcription** (transcript vide)
- ✅ Summary **déjà généré** (le bouton disparaît après génération)

**Solution** : Vérifier que le meeting a bien un transcript (onglet "Transcript" visible)

### Problème 4 : Détection de Noms ne Fonctionne Pas
**Symptôme** : Segments affichent "SPEAKER_00" au lieu des noms

**Solutions** :
1. **Patterns supportés** :
   ```
   ✅ "Je m'appelle Marie"
   ✅ "Je suis Paul"
   ✅ "Bonjour Marie" (interpellation)
   ✅ "C'est Sophie qui parle"
   ```
2. **Vérifier la console** :
   ```javascript
   [Speaker Detector] ✅ NOM DÉTECTÉ: "Marie"
   ```
3. **Parler clairement** et utiliser un des patterns ci-dessus

---

## 📊 Résumé des URLs

| Service | URL | Health Check |
|---------|-----|--------------|
| Web App | `http://localhost:3000` | `http://localhost:3000` |
| WhisperX | `http://localhost:8082` | `http://localhost:8082/health` |
| whisper.cpp | `http://localhost:8081` | `http://localhost:8081/health` |
| PyTorch | `http://localhost:8000` | `http://localhost:8000/health` |
| Ollama | `http://localhost:11434` | `http://localhost:11434/api/tags` |
| Supabase | `http://localhost:54321` | - |

---

## 🎉 Résultat Attendu Final

Une application complète avec :

✅ **Streaming en temps réel** avec affichage live des segments  
✅ **Détection automatique** des noms des speakers  
✅ **Auto-génération** du titre et summary via Ollama  
✅ **Bouton manuel** pour régénérer titre/summary  
✅ **Support multi-providers** (Ollama, OpenAI, Gemini, Mistral)  
✅ **UX fluide** avec feedback immédiat  

---

## 💡 Conseils d'Utilisation

### Pour les Réunions Courtes (< 5 min)
- ✅ Activer streaming
- ✅ Activer auto-summary
- 🎯 **Avantage** : Meeting prêt instantanément

### Pour les Réunions Longues (> 15 min)
- ✅ Activer streaming
- ❌ Désactiver auto-summary (générer manuellement après)
- 🎯 **Avantage** : Économise les ressources Ollama

### Pour les Présentations
- ❌ Désactiver streaming (mode batch suffit)
- ✅ Activer auto-summary
- 🎯 **Avantage** : Moins de bande passante pendant l'enregistrement

---

## 🚀 Prochaines Étapes

Si tout fonctionne :
1. ✅ Tester avec des enregistrements réels
2. ✅ Ajuster les prompts Ollama si besoin
3. ✅ Tester avec différents providers (OpenAI, Gemini)
4. ✅ Optimiser les performances si nécessaire

Bon test ! 🎊

