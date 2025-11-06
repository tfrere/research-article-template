#!/usr/bin/env node
/**
 * Export PDF Book avec Paged.js
 * 
 * Génère un PDF de qualité professionnelle avec mise en page type livre
 * à partir du contenu HTML compilé par Astro.
 * 
 * Fonctionnalités :
 * - Pagination automatique avec Paged.js
 * - Running headers (titres chapitres en haut de page)
 * - Numérotation des pages
 * - Marges différentes gauche/droite (reliure)
 * - Gestion veuves/orphelines
 * - Typographie professionnelle
 * 
 * Usage :
 *   npm run export:pdf:book
 *   npm run export:pdf:book -- --theme=dark --format=A4
 * 
 * Options :
 *   --theme=light|dark   Thème (défaut: light)
 *   --format=A4|Letter   Format de page (défaut: A4)
 *   --filename=xxx       Nom du fichier de sortie
 *   --wait=full          Mode d'attente (défaut: full)
 */

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Utilitaires
// ============================================================================

async function run(command, args = [], options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false, ...options });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise(undefined);
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { }
    await delay(500);
  }
  throw new Error(`Server did not start in time: ${url}`);
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith('--')) continue;
    const [k, v] = arg.replace(/^--/, '').split('=');
    out[k] = v === undefined ? true : v;
  }
  return out;
}

function slugify(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'article';
}

async function waitForImages(page, timeoutMs = 15000) {
  await page.evaluate(async (timeout) => {
    const deadline = Date.now() + timeout;
    const imgs = Array.from(document.images || []);
    const unloaded = imgs.filter(img => !img.complete || (img.naturalWidth === 0));
    await Promise.race([
      Promise.all(unloaded.map(img => new Promise(res => {
        if (img.complete && img.naturalWidth !== 0) return res(undefined);
        img.addEventListener('load', () => res(undefined), { once: true });
        img.addEventListener('error', () => res(undefined), { once: true });
      }))),
      new Promise(res => setTimeout(res, Math.max(0, deadline - Date.now())))
    ]);
  }, timeoutMs);
}

async function waitForPlotly(page, timeoutMs = 20000) {
  await page.evaluate(async (timeout) => {
    const start = Date.now();
    const hasPlots = () => Array.from(document.querySelectorAll('.js-plotly-plot')).length > 0;
    while (!hasPlots() && (Date.now() - start) < timeout) {
      await new Promise(r => setTimeout(r, 200));
    }
    const deadline = start + timeout;
    const allReady = () => Array.from(document.querySelectorAll('.js-plotly-plot')).every(el => el.querySelector('svg.main-svg'));
    while (!allReady() && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 200));
    }
  }, timeoutMs);
}

async function waitForD3(page, timeoutMs = 20000) {
  await page.evaluate(async (timeout) => {
    const start = Date.now();
    const isReady = () => {
      const hero = document.querySelector('.hero-banner');
      if (hero) {
        return !!hero.querySelector('svg circle, svg path, svg rect, svg g');
      }
      const containers = [
        ...Array.from(document.querySelectorAll('.d3-line')),
        ...Array.from(document.querySelectorAll('.d3-bar'))
      ];
      if (!containers.length) return true;
      return containers.every(c => c.querySelector('svg circle, svg path, svg rect, svg g'));
    };
    while (!isReady() && (Date.now() - start) < timeout) {
      await new Promise(r => setTimeout(r, 200));
    }
  }, timeoutMs);
}

async function waitForStableLayout(page, timeoutMs = 5000) {
  const start = Date.now();
  let last = await page.evaluate(() => document.scrollingElement ? document.scrollingElement.scrollHeight : document.body.scrollHeight);
  let stableCount = 0;
  while ((Date.now() - start) < timeoutMs && stableCount < 3) {
    await page.waitForTimeout(250);
    const now = await page.evaluate(() => document.scrollingElement ? document.scrollingElement.scrollHeight : document.body.scrollHeight);
    if (now === last) stableCount += 1; else { stableCount = 0; last = now; }
  }
}

// ============================================================================
// Script principal
// ============================================================================

async function main() {
  const cwd = process.cwd();
  const port = Number(process.env.PREVIEW_PORT || 8080);
  const baseUrl = `http://127.0.0.1:${port}/`;
  const args = parseArgs(process.argv);
  
  const theme = (args.theme === 'dark' || args.theme === 'light') ? args.theme : 'light';
  const format = args.format || 'A4';
  const wait = args.wait || 'full';
  
  let outFileBase = (args.filename && String(args.filename).replace(/\.pdf$/i, '')) || 'article-book';
  
  // Build si nécessaire
  const distDir = resolve(cwd, 'dist');
  let hasDist = false;
  try {
    const st = await fs.stat(distDir);
    hasDist = st && st.isDirectory();
  } catch { }
  
  if (!hasDist) {
    console.log('📦 Building Astro site…');
    await run('npm', ['run', 'build']);
  } else {
    console.log('✓ Using existing dist/ build');
  }
  
  console.log('🚀 Starting Astro preview server…');
  const preview = spawn('npm', ['run', 'preview'], { cwd, stdio: 'inherit', detached: true });
  const previewExit = new Promise((resolvePreview) => {
    preview.on('close', (code, signal) => resolvePreview({ code, signal }));
  });
  
  try {
    await waitForServer(baseUrl, 60000);
    console.log('✓ Server ready');
    
    console.log('📖 Launching browser with Paged.js…');
    const browser = await chromium.launch({ headless: true });
    
    try {
      const context = await browser.newContext();
      
      // Appliquer le thème
      await context.addInitScript((desired) => {
        try {
          localStorage.setItem('theme', desired);
          if (document && document.documentElement) {
            document.documentElement.dataset.theme = desired;
          }
        } catch { }
      }, theme);
      
      const page = await context.newPage();
      
      // Viewport large pour le contenu
      await page.setViewportSize({ width: 1200, height: 1600 });
      
      console.log('📄 Loading page…');
      await page.goto(baseUrl, { waitUntil: 'load', timeout: 60000 });
      
      // Attendre les libraries
      try { await page.waitForFunction(() => !!window.Plotly, { timeout: 8000 }); } catch { }
      try { await page.waitForFunction(() => !!window.d3, { timeout: 8000 }); } catch { }
      
      // Récupérer le nom du fichier
      if (!args.filename) {
        const fromBtn = await page.evaluate(() => {
          const btn = document.getElementById('download-pdf-btn');
          const f = btn ? btn.getAttribute('data-pdf-filename') : null;
          return f || '';
        });
        if (fromBtn) {
          outFileBase = String(fromBtn).replace(/\.pdf$/i, '') + '-book';
        } else {
          const title = await page.evaluate(() => {
            const h1 = document.querySelector('h1.hero-title');
            const t = h1 ? h1.textContent : document.title;
            return (t || '').replace(/\s+/g, ' ').trim();
          });
          outFileBase = slugify(title) + '-book';
        }
      }
      
      // Attendre le rendu du contenu
      if (wait === 'images' || wait === 'full') {
        console.log('⏳ Waiting for images…');
        await waitForImages(page);
      }
      if (wait === 'd3' || wait === 'full') {
        console.log('⏳ Waiting for D3…');
        await waitForD3(page);
      }
      if (wait === 'plotly' || wait === 'full') {
        console.log('⏳ Waiting for Plotly…');
        await waitForPlotly(page);
      }
      if (wait === 'full') {
        await waitForStableLayout(page);
      }
      
      // Activer le mode print AVANT d'injecter Paged.js
      await page.emulateMedia({ media: 'print' });
      
      console.log('📚 Injecting Paged.js…');
      
      // Injecter le CSS livre
      const bookCssPath = resolve(__dirname, '..', 'src', 'styles', '_print-book.css');
      const bookCss = await fs.readFile(bookCssPath, 'utf-8');
      await page.addStyleTag({ content: bookCss });
      
      // Injecter Paged.js depuis node_modules
      const pagedJsPath = resolve(cwd, 'node_modules', 'pagedjs', 'dist', 'paged.polyfill.js');
      await page.addScriptTag({ path: pagedJsPath });
      
      console.log('⏳ Running Paged.js pagination…');
      
      // Lancer la pagination avec Paged.Previewer
      await page.evaluate(async () => {
        if (window.Paged && window.Paged.Previewer) {
          const previewer = new window.Paged.Previewer();
          await previewer.preview();
        }
      });
      
      // Attendre que les pages soient créées
      await page.waitForFunction(() => {
        const pages = document.querySelectorAll('.pagedjs_page');
        return pages && pages.length > 0;
      }, { timeout: 60000 });
      
      // Petit délai pour s'assurer que tout est stabilisé
      await page.waitForTimeout(2000);
      
      console.log('✓ Pagination complete');
      
      // Informations sur la pagination
      const pageInfo = await page.evaluate(() => {
        const pages = document.querySelectorAll('.pagedjs_page');
        return {
          totalPages: pages.length,
          hasContent: pages.length > 0
        };
      });
      
      console.log(`📄 Generated ${pageInfo.totalPages} pages`);
      
      // Générer le PDF
      const outPath = resolve(cwd, 'dist', `${outFileBase}.pdf`);
      
      console.log('🖨️  Generating PDF…');
      
      await page.pdf({
        path: outPath,
        format,
        printBackground: true,
        preferCSSPageSize: true, // Important : respecte les @page CSS
        margin: { top: 0, right: 0, bottom: 0, left: 0 } // Marges gérées par CSS
      });
      
      console.log(`✅ PDF generated: ${outPath}`);
      
      // Copier dans public/
      const publicPath = resolve(cwd, 'public', `${outFileBase}.pdf`);
      try {
        await fs.mkdir(resolve(cwd, 'public'), { recursive: true });
        await fs.copyFile(outPath, publicPath);
        console.log(`✅ PDF copied to: ${publicPath}`);
      } catch (e) {
        console.warn('⚠️  Unable to copy PDF to public/:', e?.message || e);
      }
      
    } finally {
      await browser.close();
    }
    
  } finally {
    // Arrêter le serveur preview
    console.log('🛑 Stopping preview server…');
    try {
      if (process.platform !== 'win32') {
        try { process.kill(-preview.pid, 'SIGINT'); } catch { }
      }
      try { preview.kill('SIGINT'); } catch { }
      await Promise.race([previewExit, delay(3000)]);
      
      if (!preview.killed) {
        try {
          if (process.platform !== 'win32') {
            try { process.kill(-preview.pid, 'SIGKILL'); } catch { }
          }
          try { preview.kill('SIGKILL'); } catch { }
        } catch { }
        await Promise.race([previewExit, delay(1000)]);
      }
    } catch { }
  }
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    📚 PDF BOOK GENERATED! 📚                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

