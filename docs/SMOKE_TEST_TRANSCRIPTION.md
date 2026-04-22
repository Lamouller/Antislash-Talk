# Smoke Test — Refactor Transcription Flow

Checklist a completer a chaque phase qui touche au flow audio/transcription.
A faire sur un **iPhone + un Android physique**, pas sur simulateur.

## Phase actuelle : ____________
## Testeur : ____________
## Date : ____________
## Commit teste : ____________

## Setup

- [ ] Apk Android installe sur device physique
- [ ] iPhone connecte a TestFlight ou app installee depuis build
- [ ] Feature flag actif cote user Supabase (`feature_flags: { ... }` dans `profiles`)
- [ ] Compte de test distinct des comptes clients

## Scenarios — Capture audio

### Micro interne

- [ ] iPhone — start record, parler 10s, stop → blob genere, transcription coherente
- [ ] Android — idem

### Micro externe (Bluetooth)

- [ ] iPhone + AirPods connectes avant start → record OK
- [ ] iPhone + AirPods debranches MID-record → fallback micro interne, pas de coupure >2s
- [ ] Android + casque BT connecte avant start → record OK
- [ ] Android — casque BT deconnecte MID-record → fallback

### Interruption systeme

- [ ] iPhone — appel entrant mid-record → pause auto → raccrocher → reprise
- [ ] iPhone — Siri declenchee mid-record → pause auto → fin Siri → reprise
- [ ] Android — notif Waze/Spotify vocal mid-record → pause auto → reprise

### Background / Visibility

- [ ] iPhone — app passee en background 30s → retour foreground → record toujours actif (ou reprise propre)
- [ ] Android — app passee en background 30s → retour foreground → idem
- [ ] iPhone — ecran verrouille 30s → deverrouille → record toujours actif

## Scenarios — Real-time transcription

- [ ] Provider Google Gemini WiFi stable → segments affiches <3s
- [ ] Provider Google Gemini sur 4G → idem
- [ ] Provider WhisperX Docker → segments affiches <10s
- [ ] Provider Local Transformers (WebGPU) → segments affiches

## Scenarios — Reseau instable (phase 8+)

- [ ] DevTools → throttle to Offline pendant 5s mid-record → back online → transcription reprend sans perte
- [ ] iPhone — switch WiFi → 4G mid-record → pas d'interruption visible
- [ ] Metro / ascenseur (perte 10-30s) → reprise auto

## Scenarios — Post-traitement

- [ ] 2 speakers, presentation de chaque par son nom ("Bonjour, c'est Tristan") → segments retroactifs renommes correctement
- [ ] 3 speakers → diarization stable
- [ ] Meeting 5 min → summary coherent, pas d'hallucination ("merci d'avoir regarde")

## Scenarios — Stabilite memoire

- [ ] Enregistrer 10 fois d'affilee (start/stop) → DevTools Memory : heap stable
- [ ] Meeting 30 min → pas de freeze / lag progressif

## Scenarios — Detection regression design

- [ ] Timeline meeting affiche les bons timestamps (pas "00:00")
- [ ] Speaker avatars/couleurs coherents entre live et enhanced view

## Verdict

- [ ] OK Tout passe — phase mergeable
- [ ] WARN Regression mineure — creer ticket
- [ ] FAIL Regression bloquante — revert flag ON → OFF
