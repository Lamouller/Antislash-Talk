# Configuration Capacitor pour iOS

## Prérequis

- Mac avec Xcode installé (App Store)
- Compte Apple Developer (99$/an) pour tester sur un vrai iPhone
- Node.js et pnpm installés

## Installation

### 1. Corriger les permissions (si nécessaire)

```bash
sudo chown -R $(whoami) /Users/trystanlamouller/Github_Lamouller/Antislash-Talk-1/node_modules
```

### 2. Installer les dépendances Capacitor

```bash
cd /Users/trystanlamouller/Github_Lamouller/Antislash-Talk-1
pnpm add @capacitor/core @capacitor/ios @capacitor/cli --filter web
```

### 3. Initialiser le projet iOS

```bash
cd apps/web
npx cap add ios
```

### 4. Configurer l'audio en arrière-plan

Ouvrir `ios/App/App/Info.plist` et ajouter :

```xml
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

### 5. Build et sync

```bash
# Build l'app web
pnpm run build

# Synchroniser avec iOS
npx cap sync ios
```

### 6. Ouvrir dans Xcode

```bash
npx cap open ios
```

## Tester sur iPhone

### Option A : Simulateur (gratuit)
Dans Xcode, sélectionner un simulateur iPhone et cliquer sur "Play"

### Option B : Vrai iPhone (nécessite compte Apple Developer)
1. Connecter l'iPhone au Mac
2. Dans Xcode : Signing & Capabilities → Sélectionner ton équipe
3. Sélectionner ton iPhone comme device
4. Cliquer sur "Play"

## Distribution

### TestFlight
```bash
# Dans Xcode : Product → Archive
# Puis : Distribute App → TestFlight
```

### Ad-Hoc (fichier .ipa direct)
```bash
# Dans Xcode : Product → Archive
# Puis : Distribute App → Ad Hoc
```

## Commandes utiles

```bash
# Rebuild et sync
pnpm run build && npx cap sync ios

# Ouvrir Xcode
npx cap open ios

# Voir les logs
npx cap run ios --livereload
```
