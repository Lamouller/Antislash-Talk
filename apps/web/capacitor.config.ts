import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.antislash.talk',
  appName: 'Antislash Talk',
  webDir: 'dist',
  server: {
    // Pour le dev, tu peux décommenter cette ligne pour charger depuis ton serveur local
    // url: 'http://192.168.1.X:5173',
    // cleartext: true
  },
  ios: {
    // Configuration iOS spécifique
    contentInset: 'automatic',
    backgroundColor: '#ffffff'
  },
  plugins: {
    // Configuration des plugins si nécessaire
  }
};

export default config;
