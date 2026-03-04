# Audit UX/UI Mobile-First -- Antislash Talk

- **From**: pm + design
- **To**: frontend (implementation)
- **Date**: 2026-03-04
- **Status**: done
- **Priority**: high
- **Request type**: investigation + design

---

## 1. Etat des lieux

### 1.1 Architecture des pages

| Route | Fichier | Role |
|-------|---------|------|
| `/` | `pages/index.tsx` | Landing page marketing (hero + features + CTA) |
| `/auth/login` | `pages/auth/login.tsx` | Login (2 variantes : SimplifiedLoginForm + FullLoginForm selon env) |
| `/auth/register` | `pages/auth/register.tsx` | Inscription (2 variantes : FunctionalRegisterForm + ComingSoonRegister) |
| `/auth/forgot-password` | `pages/auth/forgot-password.tsx` | Reset password |
| `/offline` | `pages/offline.tsx` | Page erreur Supabase offline |
| `/tabs` | `pages/(tabs)/index.tsx` | Dashboard (stats + chart + recent meetings + quick actions) |
| `/tabs/meetings` | `pages/(tabs)/meetings.tsx` | Liste des meetings (search + filter + grid) |
| `/tabs/record` | `pages/(tabs)/record.tsx` | Enregistrement (gros fichier ~1000 lignes, toute la logique recording) |
| `/tabs/upload` | `pages/(tabs)/upload.tsx` | Upload fichier audio (drag & drop + progress) |
| `/tabs/prompts` | `pages/(tabs)/prompts.tsx` | Atelier prompts (liste + editeur + assistant IA) |
| `/tabs/settings` | `pages/(tabs)/settings.tsx` | Parametres (providers LLM/STT, cles API, preferences) |
| `/tabs/meeting/:id` | `pages/(tabs)/meeting/[id].tsx` | Detail meeting (transcript + summary + waveform + export) |
| `/report/*` | `pages/report/*.tsx` | Generation de rapports |
| `*` | `pages/+not-found.tsx` | Page 404 |

### 1.2 Composants de layout

| Composant | Role | Notes |
|-----------|------|-------|
| `_layout.tsx` (root) | Layout racine + RecordingProvider + animated background + GlobalRecordingButton + GlobalDebugLogsPanel + Toaster | Contient le bouton flottant d'enregistrement global |
| `(tabs)/_layout.tsx` | Layout tabs avec SideBar (desktop) + NavBar (mobile) + safe areas | Bonne structure responsive md:ml-64 |
| `NavBar.tsx` | Navigation mobile : barre fixe en haut + menu hamburger | Pas de bottom tab bar |
| `SideBar.tsx` | Navigation desktop : sidebar fixe gauche 64px width | hidden md:flex |
| `TabsLayout.tsx` (component) | Layout alternatif inutilise avec bottom tab bar | Fichier orphelin dans components/layout/ |

### 1.3 Design system actuel

**Points forts :**
- Design system Liquid Glass coherent et bien implemente (glass-card, glass-button, glass-input)
- Palette monochrome noir/blanc/gris sobre et lisible
- Variables CSS pour les couleurs avec support dark mode prepare
- Safe areas iOS/Android bien gerees dans le CSS (env(safe-area-inset-*))
- Animations soignees (fadeIn, slideIn, stagger-children, float)
- Composants Button et Card bien structures avec CVA (class-variance-authority)
- Typographie Inter avec bons reglages (-webkit-font-smoothing, text-rendering)
- Custom scrollbar defini
- Overscroll-behavior: none pour empecher le bounce iOS

**Background :**
- Fond #F5F5F7 avec 3 blobs animes en blur (gris) pour un effet vivant
- Grille overlay subtile a 0.015 opacity
- Incoherence : index.html utilise un gradient bleu-indigo (`#f8fafc, #eff6ff, #eef2ff`) tandis que le CSS et les composants utilisent `#F5F5F7` gris

### 1.4 Composants UI

| Composant | Qualite | Notes |
|-----------|---------|-------|
| `Button.tsx` | Excellent | CVA avec 7 variantes + 8 tailles + loading state |
| `Card.tsx` | Bon | CVA avec 4 variantes, bon padding/spacing |
| `FeatureGate.tsx` | Correct | Gating enterprise avec comparaison features |
| `MarkdownRenderer.tsx` | Basique | Rendu markdown maison (bold, italic, headers, lists) via dangerouslySetInnerHTML |
| `MeetingCard.tsx` | Bon | Card meeting avec status badge, date, duration |
| `Waveform.tsx` | Problematique | Utilise encore des couleurs indigo (#6E41E2), dark mode classes, hors design system |
| `RecordingControls.tsx` | Minimal | Classes CSS non definies (start-button, pause-button, stop-button) - composant orphelin |
| `AuthHeader.tsx` | Bon | Header auth avec branding coherent |

---

## 2. Problemes UX/UI identifies

### 2.1 CRITIQUE -- Bloque l'usage mobile

#### C1. Pas de bottom tab bar pour la navigation mobile
**Severite : CRITIQUE**
La navigation mobile repose sur un **menu hamburger** en haut a droite. Sur une app mobile Capacitor, c'est un anti-pattern majeur. L'utilisateur doit :
1. Tendre le pouce en haut de l'ecran (zone non-reachable)
2. Ouvrir le menu
3. Selectionner la page

**Impact :** Les utilisateurs ne decouvrent pas les pages (upload, prompts, settings). Le taux de navigation entre sections est probablement tres bas.

**Fichiers concernes :** `NavBar.tsx`, `(tabs)/_layout.tsx`
**Le fichier `TabsLayout.tsx` dans `components/layout/` contient deja un bottom tab bar mais il n'est PAS utilise.**

#### C2. La page Record est un monolithe inutilisable sur mobile
**Severite : CRITIQUE**
`record.tsx` fait ~1000 lignes avec :
- Des dizaines d'options configurables (provider, model, streaming toggle, auto-transcribe, auto-summary)
- Des panneaux de configuration inlines
- Une zone de transcription live scrollable
- Des controles d'enregistrement
- Un panneau de resultats

Sur mobile, tout est empile verticalement. L'utilisateur doit scroller enormement pour trouver les controles d'enregistrement ou voir la transcription.

**Fichiers concernes :** `pages/(tabs)/record.tsx`

#### C3. Le bouton d'enregistrement global chevauche le contenu
**Severite : CRITIQUE**
Le `GlobalRecordingButton` est positionne en `fixed bottom-0` avec un `pointer-events-none` sur le container. Sur les pages avec du contenu en bas (meetings list, dashboard quick actions), le bouton flottant chevauche le contenu sans aucun padding-bottom compensatoire.

**Fichiers concernes :** `_layout.tsx`, toutes les pages du tabs layout

### 2.2 IMPORTANT -- Degrade l'experience

#### I1. Incoherence de fond entre index.html et le CSS
**Severite : Important**
`index.html` definit un `background: linear-gradient(to bottom right, #f8fafc, #eff6ff, #eef2ff)` (teintes bleues) sur le html et body, tandis que TOUT le reste du code utilise `#F5F5F7` (gris). En premiere charge, un flash bleu peut apparaitre avant que React ne monte.

**Fichiers concernes :** `index.html`, `index.css`

#### I2. Waveform component hors design system
**Severite : Important**
Le composant `Waveform.tsx` utilise :
- Couleur de progression `#6E41E2` (violet/indigo) au lieu du noir
- Classes `dark:border-gray-700`, `dark:text-gray-400` alors que le dark mode n'est pas implemente
- Boutons play/pause en `bg-indigo-600` au lieu du design system noir
- Un message iOS en dur avec emoji ("iOS users: Use the HTML5 player above")

**Fichiers concernes :** `components/meetings/Waveform.tsx`

#### I3. Page Settings beaucoup trop longue
**Severite : Important**
La page Settings contient une quantite massive de modeles LLM/STT/TTS listes dans des tableaux inline. Sur mobile, c'est un scroll infini de radio buttons. Pas de sections collapsibles, pas de navigation interne.

**Fichiers concernes :** `pages/(tabs)/settings.tsx`

#### I4. RecordingControls.tsx utilise des classes CSS inexistantes
**Severite : Important**
Le composant `RecordingControls.tsx` reference `start-button`, `pause-button`, `stop-button`, `controls-container` -- aucune de ces classes n'est definie dans le CSS. Le composant semble etre un reliquat non utilise.

**Fichiers concernes :** `components/recording/RecordingControls.tsx`

#### I5. Route `/tabs/upload` declaree en double dans le router
**Severite : Important**
Dans `main.tsx`, la route `upload` est declaree deux fois :
```tsx
{ path: 'upload', element: <UploadScreen /> },
{ path: 'upload', element: <UploadScreen /> },
```

**Fichiers concernes :** `main.tsx` (ligne 58-59)

#### I6. Pas de feedback haptic/visuel pendant l'enregistrement sur mobile
**Severite : Important**
L'enregistrement sur mobile n'a pas de retour haptique (vibration au start/stop), pas d'animation de waveform en temps reel pendant le recording (seulement apres), et le timer est petit.

**Fichiers concernes :** `pages/(tabs)/record.tsx`

#### I7. Le GlobalDebugLogsPanel est visible en production
**Severite : Important**
Le bouton "D" (debug) est toujours affiche en `fixed bottom-20 right-4`. Il prend de la place et peut etre touche accidentellement. Il devrait etre conditionnel a un flag dev.

**Fichiers concernes :** `pages/_layout.tsx`

#### I8. Inputs de formulaire sans font-size 16px sur iOS
**Severite : Important**
Sur iOS Safari, un input avec `font-size < 16px` provoque un zoom automatique au focus. Les inputs utilisent `text-sm` (14px) via les classes Tailwind. Cela cause un zoom intrusif sur chaque champ de formulaire sur iPhone.

**Fichiers concernes :** Tous les inputs (login, register, search, settings)

### 2.3 MINEUR -- Polish

#### M1. MeetingTimeline utilise des couleurs hors palette
Les status colors du MeetingTimeline utilisent blue-500, yellow-500, green-500, red-500 -- hors de la palette monochrome noir/blanc/gris. A harmoniser.

#### M2. Le footer de la landing page affiche "2024 Antislash Studio"
Date obsolete (on est en 2026). Fichier : `pages/index.tsx`

#### M3. Texte "Back" en anglais dans AuthHeader.tsx
Le composant AuthHeader a "Back" en dur au lieu d'utiliser i18n. Le projet supporte la localisation via react-i18next mais pas partout.

#### M4. Pas de skeleton loader homogene
Les skeletons sont implementes ad-hoc dans chaque page (dashboard, meetings). Pas de composant Skeleton reutilisable.

#### M5. Icons navItems : Record utilise `FilePlus` au lieu de `Mic`
Dans NavBar et SideBar, l'item "Record" utilise l'icone `FilePlus` ce qui est semantiquement incorrect. L'icone `Mic` serait plus appropriee.

#### M6. Le composant MarkdownRenderer utilise dangerouslySetInnerHTML
Risque XSS si le contenu n'est pas sanitize. Pas critique car le contenu vient de l'IA mais a surveiller.

#### M7. Touch targets insuffisants pour certains boutons
Les badges de status dans MeetingCard (`px-2 py-1`, `px-2.5 py-1`) sont en dessous de la taille minimale recommandee de 44x44px pour les targets tactiles iOS.

---

## 3. Propositions d'amelioration mobile-first

### P1. Implementer une bottom tab bar native
**Description :** Remplacer le menu hamburger par une bottom tab bar fixe avec 5 onglets : Home, Meetings, Record (central, accentue), Upload, Settings. L'onglet Prompts serait accessible depuis Settings ou via un sous-menu.

**Pages/composants impactes :** `NavBar.tsx`, `(tabs)/_layout.tsx`, `_layout.tsx`
**Effort :** M (Medium)
**Impact UX :** 5/5

**Mockup textuel :**
```
+--------------------------------------------------+
|  [Logo] Antislash Talk                      [...]|  <- Top bar simplifie (titre + overflow menu)
|================================================|
|                                                  |
|             CONTENU DE LA PAGE                   |
|                                                  |
|================================================|
|                                                  |
|  [Home] [Meetings]  [O REC]  [Upload] [Settings]|  <- Bottom tab bar fixe
|                       ^^^ bouton circulaire noir |
+--------------------------------------------------+
```

### P2. Refactorer la page Record en etapes
**Description :** Decomposer record.tsx en un flow multi-etapes :
1. **Pre-recording** : choix du provider/model + titre + notes (collapsible "options avancees")
2. **Recording** : plein ecran, gros timer, gros bouton stop, waveform live, transcription live scrollable
3. **Post-recording** : resultats, generation titre/resume, navigation vers meeting detail

**Pages/composants impactes :** `record.tsx`, nouveau composant `RecordingView.tsx`
**Effort :** L (Large)
**Impact UX :** 5/5

### P3. Ajouter un padding-bottom global pour le bouton flottant
**Description :** Ajouter `pb-24 md:pb-0` au main content des tabs pour eviter que le GlobalRecordingButton chevauche le contenu. Sur desktop, pas de padding car pas de bouton flottant (accessible via sidebar).

**Pages/composants impactes :** `(tabs)/_layout.tsx`
**Effort :** S (Small)
**Impact UX :** 4/5

### P4. Harmoniser le fond index.html avec le design system
**Description :** Remplacer le gradient bleu dans `index.html` par `background: #F5F5F7` pour matcher le CSS.

**Pages/composants impactes :** `index.html`
**Effort :** S (Small)
**Impact UX :** 2/5

### P5. Refondre le Waveform component dans le design system
**Description :** Remplacer les couleurs indigo par les couleurs du design system (noir pour la progression, gris pour le fond, eliminer le dark mode non-implemente). Ameliorer le player audio mobile.

**Pages/composants impactes :** `Waveform.tsx`
**Effort :** S (Small)
**Impact UX :** 3/5

### P6. Sections collapsibles dans Settings
**Description :** Organiser les parametres en accordeons : "Transcription", "Generation IA", "Cles API", "Preferences". Un seul ouvert a la fois.

**Pages/composants impactes :** `settings.tsx`
**Effort :** M (Medium)
**Impact UX :** 4/5

### P7. Supprimer les dead code et doublons
**Description :**
- Supprimer `RecordingControls.tsx` (orphelin)
- Supprimer le doublon route upload dans `main.tsx`
- Supprimer `TabsLayout.tsx` de components/ (non utilise)
- Conditionner le GlobalDebugLogsPanel a un env var dev

**Pages/composants impactes :** Multiples
**Effort :** S (Small)
**Impact UX :** 2/5 (proprete du code)

### P8. Fixer le zoom iOS sur les inputs
**Description :** Ajouter `text-base` (16px) sur tous les inputs de formulaire, ou ajouter un meta viewport sans `maximum-scale=1.0` et gerer autrement. Recommandation : utiliser `text-base` pour les inputs.

**Pages/composants impactes :** Tous les formulaires (login, register, search, settings)
**Effort :** S (Small)
**Impact UX :** 4/5

### P9. Creer un composant Skeleton reutilisable
**Description :** Un composant `<Skeleton width height className />` utilise dans dashboard, meetings list, meeting detail pour harmoniser les loading states.

**Pages/composants impactes :** `components/ui/Skeleton.tsx` (nouveau)
**Effort :** S (Small)
**Impact UX :** 2/5

### P10. Ajouter des micro-interactions mobile
**Description :** Vibration haptic au start/stop recording (via Capacitor Haptics), animation pulse plus visible pendant l'enregistrement, confetti ou feedback visuel fort quand la transcription est terminee.

**Pages/composants impactes :** `record.tsx`, `RecordingContext.tsx`
**Effort :** M (Medium)
**Impact UX :** 3/5

---

## 4. Roadmap design recommandee

### Sprint 1 -- Quick Wins (1-2 jours)

| # | Tache | Effort | Impact |
|---|-------|--------|--------|
| 1 | P3. Padding-bottom pour le bouton flottant | S | 4/5 |
| 2 | P4. Harmoniser le fond index.html | S | 2/5 |
| 3 | P7. Cleanup dead code (RecordingControls, doublon route, debug panel) | S | 2/5 |
| 4 | P8. Fix zoom iOS inputs (text-base) | S | 4/5 |
| 5 | I5. Supprimer la route upload dupliquee | S | - |
| 6 | M2. Mettre a jour le copyright 2024 -> 2026 | S | - |
| 7 | M5. Icone Record : FilePlus -> Mic dans NavBar/SideBar | S | 1/5 |

### Sprint 2 -- Ameliorations structurelles (3-5 jours)

| # | Tache | Effort | Impact |
|---|-------|--------|--------|
| 1 | **P1. Bottom tab bar mobile** | M | 5/5 |
| 2 | P5. Refonte Waveform dans le design system | S | 3/5 |
| 3 | P6. Sections collapsibles Settings | M | 4/5 |
| 4 | P9. Composant Skeleton reutilisable | S | 2/5 |
| 5 | M1. Harmoniser les couleurs status timeline | S | 1/5 |
| 6 | M3. i18n manquant dans AuthHeader et autres textes en dur | S | 1/5 |

### Sprint 3 -- Polish + Animations + Refactoring record (5-8 jours)

| # | Tache | Effort | Impact |
|---|-------|--------|--------|
| 1 | **P2. Refactorer record.tsx en flow multi-etapes** | L | 5/5 |
| 2 | P10. Micro-interactions mobile (haptics, animations) | M | 3/5 |
| 3 | Transition animations entre pages (framer-motion) | M | 3/5 |
| 4 | Pull-to-refresh sur la meetings list | S | 2/5 |
| 5 | Swipe gestures sur les meeting cards (supprimer, archiver) | M | 3/5 |
| 6 | M6. Sanitizer le MarkdownRenderer | S | 2/5 |

---

## Resume executif

L'app Antislash Talk dispose d'un **design system Liquid Glass de bonne qualite** avec une palette monochrome coherente, des composants bien structures (Button CVA, Card CVA), et une gestion correcte des safe areas iOS/Android dans le CSS.

Les **3 problemes critiques** qui bloquent l'experience mobile sont :
1. **Pas de bottom tab bar** -- le hamburger menu est un anti-pattern mobile
2. **Page Record monolithique** -- 1000 lignes, impossible a utiliser sur petit ecran
3. **Bouton flottant qui chevauche le contenu** -- pas de padding compensatoire

La **priorite absolue** est d'implementer la bottom tab bar (Sprint 2, P1), qui transformerait immediatement la navigation mobile. Les quick wins du Sprint 1 peuvent etre faits en parallele.

Le refactoring de record.tsx (Sprint 3, P2) est le plus gros chantier mais aussi le plus impactant pour l'experience utilisateur. Il devrait etre precede par le Sprint 2 car la bottom tab bar est prerequise pour une navigation coherente.
