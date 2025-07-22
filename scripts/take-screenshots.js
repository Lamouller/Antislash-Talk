#!/usr/bin/env node

/**
 * 📸 Automatic Screenshots Script
 * 
 * Ce script prend automatiquement des captures d'écran de l'application
 * Usage: node scripts/take-screenshots.js
 * 
 * Prérequis: npm install puppeteer
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://talk.antislash.studio';
const SCREENSHOTS_DIR = path.join(__dirname, '../docs/screenshots');

// Configuration des captures d'écran
const SCREENSHOTS = [
  {
    name: '02-register-coming-soon.png',
    url: '/auth/register',
    viewport: { width: 1920, height: 1080 },
    description: 'Page d\'inscription Coming Soon',
    requiresAuth: false
  },
  {
    name: '03-login.png',
    url: '/auth/login',
    viewport: { width: 1920, height: 1080 },
    description: 'Page de connexion',
    requiresAuth: false
  },
  {
    name: '04-dashboard.png',
    url: '/',
    viewport: { width: 1920, height: 1080 },
    description: 'Tableau de bord principal',
    requiresAuth: true
  },
  {
    name: '05-record-page.png',
    url: '/record',
    viewport: { width: 1920, height: 1080 },
    description: 'Page d\'enregistrement',
    requiresAuth: true
  },
  {
    name: '07-settings.png',
    url: '/settings',
    viewport: { width: 1920, height: 1080 },
    description: 'Page des paramètres',
    requiresAuth: true
  },
  // Mobile screenshots
  {
    name: '08-mobile-record.png',
    url: '/record',
    viewport: { width: 375, height: 812 },
    description: 'Enregistrement mobile',
    requiresAuth: true
  }
];

async function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    console.log(`✅ Dossier créé: ${SCREENSHOTS_DIR}`);
  }
}

async function takeScreenshot(browser, screenshot) {
  console.log(`📸 Capture: ${screenshot.description}...`);
  
  const page = await browser.newPage();
  
  try {
    // Configurer le viewport
    await page.setViewport(screenshot.viewport);
    
    // Aller à la page
    const fullUrl = `${BASE_URL}${screenshot.url}`;
    await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Attendre que la page soit chargée
    await page.waitForTimeout(2000);
    
    // Prendre la capture d'écran
    const screenshotPath = path.join(SCREENSHOTS_DIR, screenshot.name);
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
      quality: 90
    });
    
    console.log(`✅ Sauvegardé: ${screenshot.name}`);
    
  } catch (error) {
    console.error(`❌ Erreur pour ${screenshot.name}:`, error.message);
  } finally {
    await page.close();
  }
}

async function login(browser, email, password) {
  console.log('🔐 Connexion en cours...');
  
  const page = await browser.newPage();
  
  try {
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle2' });
    
    // Remplir le formulaire de connexion
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    
    // Cliquer sur submit
    await page.click('button[type="submit"]');
    
    // Attendre la redirection
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    console.log('✅ Connexion réussie');
    return true;
    
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
    return false;
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('🚀 Démarrage de la prise de captures d\'écran...\n');
  
  // S'assurer que le dossier existe
  await ensureScreenshotsDir();
  
  // Lancer le navigateur
  const browser = await puppeteer.launch({
    headless: false, // Mode visible pour debug
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // Demander les credentials si nécessaires
    const needsAuth = SCREENSHOTS.some(s => s.requiresAuth);
    
    if (needsAuth) {
      console.log('⚠️  Certaines captures nécessitent une connexion.');
      console.log('💡 Connectez-vous manuellement dans le navigateur qui s\'ouvre, puis appuyez sur Entrée...');
      
      // Ouvrir la page de login pour que l'utilisateur se connecte manuellement
      const loginPage = await browser.newPage();
      await loginPage.goto(`${BASE_URL}/auth/login`);
      
      // Attendre que l'utilisateur se connecte
      process.stdin.setRawMode(true);
      process.stdin.resume();
      await new Promise(resolve => {
        process.stdin.on('data', () => {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          resolve();
        });
      });
      
      await loginPage.close();
      console.log('✅ Connexion manuelle terminée\n');
    }
    
    // Prendre toutes les captures d'écran
    for (const screenshot of SCREENSHOTS) {
      await takeScreenshot(browser, screenshot);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Pause entre captures
    }
    
    console.log('\n🎉 Toutes les captures d\'écran ont été prises !');
    console.log(`📁 Emplacement: ${SCREENSHOTS_DIR}`);
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  } finally {
    await browser.close();
  }
}

// Vérifier si Puppeteer est installé
try {
  require.resolve('puppeteer');
  main().catch(console.error);
} catch (error) {
  console.log('❌ Puppeteer n\'est pas installé.');
  console.log('💡 Installez-le avec: npm install puppeteer');
  console.log('⚡ Ou utilisez le guide manuel dans docs/screenshots/CAPTURE_INSTRUCTIONS.md');
  process.exit(1);
} 