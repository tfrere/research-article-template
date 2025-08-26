#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { resolve, basename } from 'node:path';
import { promises as fs } from 'node:fs';
import process from 'node:process';

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
    } catch {}
    await delay(500);
  }
  throw new Error(`Le serveur n'a pas démarré à temps: ${url}`);
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

function parseMargin(margin) {
  if (!margin) return { top: '12mm', right: '12mm', bottom: '16mm', left: '12mm' };
  const parts = String(margin).split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  }
  if (parts.length === 2) {
    return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  }
  if (parts.length === 3) {
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  }
  return { top: parts[0] || '12mm', right: parts[1] || '12mm', bottom: parts[2] || '16mm', left: parts[3] || '12mm' };
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
    // Wait until plots exist or timeout
    while (!hasPlots() && (Date.now() - start) < timeout) {
      await new Promise(r => setTimeout(r, 200));
    }
    const deadline = start + timeout;
    // Then wait until each plot contains the main svg
    const allReady = () => Array.from(document.querySelectorAll('.js-plotly-plot')).every(el => el.querySelector('svg.main-svg'));
    while (!allReady() && Date.now() < deadline) {
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

async function main() {
  const cwd = process.cwd();
  const port = Number(process.env.PREVIEW_PORT || 8080);
  const baseUrl = `http://127.0.0.1:${port}/`;
  const args = parseArgs(process.argv);
  // Par défaut: light (n'emploie pas de variable d'environnement implicite)
  const theme = (args.theme === 'dark' || args.theme === 'light') ? args.theme : 'light';
  const format = args.format || 'A4';
  const margin = parseMargin(args.margin);
  const wait = (args.wait || 'full'); // 'networkidle' | 'images' | 'plotly' | 'full'

  // filename can be provided, else computed from page title later
  let outFileBase = (args.filename && String(args.filename).replace(/\.pdf$/i, '')) || 'article';

  console.log('> Build du site Astro…');
  await run('npm', ['run', 'build']);

  console.log('> Démarrage du preview Astro…');
  const preview = spawn('npm', ['run', 'preview'], { cwd, stdio: 'inherit' });

  try {
    await waitForServer(baseUrl, 60000);
    console.log('> Serveur prêt, génération PDF…');

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      await context.addInitScript((desired) => {
        try {
          localStorage.setItem('theme', desired);
          // Appliquer immédiatement le thème pour éviter les flashes
          if (document && document.documentElement) {
            document.documentElement.dataset.theme = desired;
          }
        } catch {}
      }, theme);
      const page = await context.newPage();
      await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 });
      // Compute slug from title if needed
      if (!args.filename) {
        const title = await page.evaluate(() => {
          const h1 = document.querySelector('h1.hero-title');
          const t = h1 ? h1.textContent : document.title;
          return (t || '').replace(/\s+/g, ' ').trim();
        });
        outFileBase = slugify(title);
      }

      // Wait for render readiness
      if (wait === 'images' || wait === 'full') {
        await waitForImages(page);
      }
      if (wait === 'plotly' || wait === 'full') {
        await waitForPlotly(page);
      }
      if (wait === 'full') {
        await waitForStableLayout(page);
      }
      await page.emulateMedia({ media: 'print' });
      const outPath = resolve(cwd, 'dist', `${outFileBase}.pdf`);
      await page.pdf({
        path: outPath,
        format,
        printBackground: true,
        margin
      });
      console.log(`✅ PDF généré: ${outPath}`);

      // Copie de compatibilité dans dist/article.pdf (pour serveurs Nginx qui ne servent que dist)
      const distCompatPath = resolve(cwd, 'dist', 'article.pdf');
      try {
        if (basename(outPath) !== 'article.pdf') {
          await fs.copyFile(outPath, distCompatPath);
          console.log(`✅ PDF copié (compat dist): ${distCompatPath}`);
        }
      } catch (e) {
        console.warn('Impossible de copier le PDF compat vers dist/article.pdf:', e?.message || e);
      }

      // Copie aussi dans public sous 2 noms: slug.pdf et article.pdf (compat)
      const publicSlugPath = resolve(cwd, 'public', `${outFileBase}.pdf`);
      const publicCompatPath = resolve(cwd, 'public', 'article.pdf');
      try {
        await fs.mkdir(resolve(cwd, 'public'), { recursive: true });
        await fs.copyFile(outPath, publicSlugPath);
        await fs.copyFile(outPath, publicCompatPath);
        console.log(`✅ PDF copié dans: ${publicSlugPath}`);
        console.log(`✅ PDF copié (compat): ${publicCompatPath}`);
      } catch (e) {
        console.warn('Impossible de copier le PDF vers public/:', e?.message || e);
      }
    } finally {
      await browser.close();
    }
  } finally {
    // Tenter un arrêt propre
    preview.kill('SIGINT');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


