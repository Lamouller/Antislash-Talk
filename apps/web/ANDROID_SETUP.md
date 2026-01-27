# 📱 Guide Android - Antislash Talk

## Prérequis

### 1. Installer Android Studio
- Télécharger : https://developer.android.com/studio
- Installer Android Studio avec les composants SDK par défaut

### 2. Installer Java JDK (si pas déjà installé)
```bash
brew install openjdk@17
```

### 3. Configurer les variables d'environnement
Ajouter dans votre `~/.zshrc` ou `~/.bash_profile` :
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home
```

Puis recharger :
```bash
source ~/.zshrc
```

---

## 🚀 Développement Local

### 1. Build de l'app web
```bash
cd apps/web
pnpm build
```

### 2. Synchroniser avec Android
```bash
npx cap sync android
```

### 3. Ouvrir dans Android Studio
```bash
npx cap open android
```

### 4. Exécuter sur émulateur ou appareil
- Dans Android Studio, créer un AVD (émulateur) si nécessaire
- Connecter un appareil Android en USB (avec USB Debugging activé)
- Cliquer sur "Run" ▶️ dans Android Studio

---

## 📦 Build APK pour Test

### APK Debug (pour test interne)
```bash
cd apps/web/android
./gradlew assembleDebug
```

L'APK sera dans : `android/app/build/outputs/apk/debug/app-debug.apk`

### APK Release (pour distribution)
```bash
cd apps/web/android
./gradlew assembleRelease
```

L'APK sera dans : `android/app/build/outputs/apk/release/app-release-unsigned.apk`

---

## 🔐 Signature de l'APK (pour Play Store)

### 1. Générer une clé de signature
```bash
keytool -genkey -v -keystore antislash-talk-release.keystore -alias antislash-talk -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Configurer Gradle
Créer `apps/web/android/keystore.properties` :
```properties
storePassword=VOTRE_MOT_DE_PASSE
keyPassword=VOTRE_MOT_DE_PASSE
keyAlias=antislash-talk
storeFile=../antislash-talk-release.keystore
```

⚠️ **IMPORTANT** : Ajouter `keystore.properties` au `.gitignore` !

### 3. Build AAB (Android App Bundle) pour Play Store
```bash
cd apps/web/android
./gradlew bundleRelease
```

Le fichier AAB sera dans : `android/app/build/outputs/bundle/release/app-release.aab`

---

## 🧪 Tester l'APK sur votre téléphone

### Méthode 1 : Installation directe
```bash
# Installer l'APK sur un appareil connecté
adb install apps/web/android/app/build/outputs/apk/debug/app-debug.apk
```

### Méthode 2 : Partager l'APK
1. Copier `app-debug.apk` sur votre téléphone
2. Activer "Sources inconnues" dans les paramètres Android
3. Ouvrir et installer l'APK

---

## 📲 Modes de fonctionnement

### Mode Production (par défaut)
L'app charge depuis : `https://app.riquelme-talk.antislash.studio`
- Aucune modification nécessaire
- Build directement

### Mode Dev Local
Dans `capacitor.config.ts`, modifier :
```typescript
server: {
  url: 'http://192.168.1.XXX:5173',  // Votre IP locale
  cleartext: true
}
```

Puis :
```bash
pnpm dev          # Lancer le serveur de dev
npx cap sync      # Synchroniser
npx cap run android  # Lancer sur appareil
```

---

## 🐛 Debug avec Chrome DevTools

1. Connecter votre Android en USB
2. Activer "USB Debugging" sur Android
3. Ouvrir Chrome sur votre PC
4. Aller sur : `chrome://inspect#devices`
5. Sélectionner votre app pour voir la console

---

## 📝 Commandes utiles

```bash
# Voir les logs en temps réel
adb logcat

# Lister les appareils connectés
adb devices

# Désinstaller l'app
adb uninstall com.antislash.talk

# Nettoyer le build
cd android && ./gradlew clean

# Rebuild complet
npx cap sync android
```

---

## 🔄 Workflow de mise à jour

1. Modifier le code dans `apps/web/src/`
2. Build : `pnpm build`
3. Sync : `npx cap sync android`
4. Test dans Android Studio ou : `npx cap run android`

---

## 📤 Publication sur Google Play Store

### 1. Créer un compte développeur
- https://play.google.com/console
- Frais unique : ~25€

### 2. Préparer les assets
- Icône 512x512px
- Screenshots (différentes tailles)
- Description en français et anglais
- Politique de confidentialité (URL)

### 3. Upload
- Créer une nouvelle app dans la console
- Upload le fichier AAB (`app-release.aab`)
- Remplir les informations
- Soumettre pour review

### 4. Mises à jour
- Incrémenter le `versionCode` dans `android/app/build.gradle`
- Build un nouveau AAB
- Upload dans "Production" ou "Test interne"

---

## 🎯 Prochaines étapes

- [ ] Tester l'APK sur votre Android
- [ ] Configurer les icônes et splash screen
- [ ] Tester les permissions (micro, stockage)
- [ ] Tester les notifications push (si applicable)
- [ ] Générer la clé de signature pour la release
- [ ] Build l'AAB pour le Play Store

---

## 🆘 Problèmes courants

### "SDK not found"
```bash
# Vérifier que ANDROID_HOME est bien défini
echo $ANDROID_HOME
# Devrait afficher : /Users/votre-nom/Library/Android/sdk
```

### "Gradle build failed"
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### "App crashes on startup"
- Vérifier les logs : `adb logcat`
- Vérifier que l'URL du serveur est accessible
- Tester en mode dev local d'abord

---

## 📚 Ressources

- [Capacitor Android Docs](https://capacitorjs.com/docs/android)
- [Android Studio Guide](https://developer.android.com/studio/intro)
- [Play Store Publishing](https://developer.android.com/distribute)
