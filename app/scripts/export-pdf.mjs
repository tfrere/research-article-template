#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
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

function cssLengthToMm(val) {
  if (!val) return 0;
  const s = String(val).trim();
  if (/mm$/i.test(s)) return parseFloat(s);
  if (/cm$/i.test(s)) return parseFloat(s) * 10;
  if (/in$/i.test(s)) return parseFloat(s) * 25.4;
  if (/px$/i.test(s)) return (parseFloat(s) / 96) * 25.4; // 96 CSS px per inch
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : 0; // assume mm if unitless
}

function getFormatSizeMm(format) {
  const f = String(format || 'A4').toLowerCase();
  switch (f) {
    case 'letter': return { w: 215.9, h: 279.4 };
    case 'legal': return { w: 215.9, h: 355.6 };
    case 'a3': return { w: 297, h: 420 };
    case 'tabloid': return { w: 279.4, h: 431.8 };
    case 'a4':
    default: return { w: 210, h: 297 };
  }
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

async function waitForD3(page, timeoutMs = 20000) {
  await page.evaluate(async (timeout) => {
    const start = Date.now();
    const isReady = () => {
      // Prioritize hero banner if present
      const hero = document.querySelector('.hero .d3-galaxy') || document.querySelector('.d3-galaxy');
      if (hero) {
        return !!hero.querySelector('svg circle, svg path, svg rect, svg g');
      }
      // Else require all D3 containers on page to have shapes
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

async function main() {
  const cwd = process.cwd();
  const port = Number(process.env.PREVIEW_PORT || 8080);
  const baseUrl = `http://127.0.0.1:${port}/`;
  const args = parseArgs(process.argv);
  // Default: light (do not rely on env vars implicitly)
  const theme = (args.theme === 'dark' || args.theme === 'light') ? args.theme : 'light';
  const format = args.format || 'A4';
  const margin = parseMargin(args.margin);
  const wait = (args.wait || 'full'); // 'networkidle' | 'images' | 'plotly' | 'full'

  // filename can be provided, else computed from DOM (button) or page title later
  let outFileBase = (args.filename && String(args.filename).replace(/\.pdf$/i, '')) || 'article';

  console.log('> Building Astro site…');
  await run('npm', ['run', 'build']);

  console.log('> Starting Astro preview…');
  // Start preview in its own process group so we can terminate all children reliably
  const preview = spawn('npm', ['run', 'preview'], { cwd, stdio: 'inherit', detached: true });
  const previewExit = new Promise((resolvePreview) => {
    preview.on('close', (code, signal) => resolvePreview({ code, signal }));
  });

  try {
    await waitForServer(baseUrl, 60000);
    console.log('> Server ready, generating PDF…');

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      await context.addInitScript((desired) => {
        try {
          localStorage.setItem('theme', desired);
          // Apply theme immediately to avoid flashes
          if (document && document.documentElement) {
            document.documentElement.dataset.theme = desired;
          }
        } catch {}
      }, theme);
      const page = await context.newPage();
      // Pre-fit viewport width to printable width so charts size correctly
      const fmt = getFormatSizeMm(format);
      const mw = fmt.w - cssLengthToMm(margin.left) - cssLengthToMm(margin.right);
      const printableWidthPx = Math.max(320, Math.round((mw / 25.4) * 96));
      await page.setViewportSize({ width: printableWidthPx, height: 1200 });
      await page.goto(baseUrl, { waitUntil: 'load', timeout: 60000 });
      // Give time for CDN scripts (Plotly/D3) to attach and for our fragment hooks to run
      try { await page.waitForFunction(() => !!window.Plotly, { timeout: 8000 }); } catch {}
      try { await page.waitForFunction(() => !!window.d3, { timeout: 8000 }); } catch {}
      // Prefer explicit filename from the download button if present
      if (!args.filename) {
        const fromBtn = await page.evaluate(() => {
          const btn = document.getElementById('download-pdf-btn');
          const f = btn ? btn.getAttribute('data-pdf-filename') : null;
          return f || '';
        });
        if (fromBtn) {
          outFileBase = String(fromBtn).replace(/\.pdf$/i, '');
        } else {
          // Fallback: compute slug from hero title or document.title
          const title = await page.evaluate(() => {
            const h1 = document.querySelector('h1.hero-title');
            const t = h1 ? h1.textContent : document.title;
            return (t || '').replace(/\s+/g, ' ').trim();
          });
          outFileBase = slugify(title);
        }
      }

      // Wait for render readiness
      if (wait === 'images' || wait === 'full') {
        await waitForImages(page);
      }
      if (wait === 'd3' || wait === 'full') {
        await waitForD3(page);
      }
      if (wait === 'plotly' || wait === 'full') {
        await waitForPlotly(page);
      }
      if (wait === 'full') {
        await waitForStableLayout(page);
      }
      await page.emulateMedia({ media: 'print' });

      // Generate OG thumbnail (1200x630)
      try {
        const ogW = 1200, ogH = 630;
        await page.setViewportSize({ width: ogW, height: ogH });
        // Give layout a tick to adjust
        await page.waitForTimeout(200);
        // Ensure layout & D3 re-rendered after viewport change
        await page.evaluate(() => { window.scrollTo(0, 0); window.dispatchEvent(new Event('resize')); });
        try { await waitForD3(page, 8000); } catch {}

        // Temporarily improve visibility for light theme thumbnails
        // - Force normal blend for points
        // - Ensure an SVG background (CSS background on svg element)
        const cssHandle = await page.addStyleTag({ content: `
          .hero .points { mix-blend-mode: normal !important; }
          .d3-galaxy svg { background: var(--surface-bg); }
        ` });
        const thumbPath = resolve(cwd, 'dist', 'thumb.jpg');
        await page.screenshot({ path: thumbPath, type: 'jpeg', quality: 85, fullPage: false });
        // Also emit PNG for compatibility if needed
        const thumbPngPath = resolve(cwd, 'dist', 'thumb.png');
        await page.screenshot({ path: thumbPngPath, type: 'png', fullPage: false });
        const publicThumb = resolve(cwd, 'public', 'thumb.jpg');
        const publicThumbPng = resolve(cwd, 'public', 'thumb.png');
        try { await fs.copyFile(thumbPath, publicThumb); } catch {}
        try { await fs.copyFile(thumbPngPath, publicThumbPng); } catch {}
        // Remove temporary style so PDF is unaffected
        try { await cssHandle.evaluate((el) => el.remove()); } catch {}
        console.log(`✅ OG thumbnail generated: ${thumbPath}`);
      } catch (e) {
        console.warn('Unable to generate OG thumbnail:', e?.message || e);
      }
      const outPath = resolve(cwd, 'dist', `${outFileBase}.pdf`);
      // Restore viewport to printable width before PDF (thumbnail changed it)
      try {
        const fmt2 = getFormatSizeMm(format);
        const mw2 = fmt2.w - cssLengthToMm(margin.left) - cssLengthToMm(margin.right);
        const printableWidthPx2 = Math.max(320, Math.round((mw2 / 25.4) * 96));
        await page.setViewportSize({ width: printableWidthPx2, height: 1400 });
        await page.evaluate(() => { window.scrollTo(0, 0); window.dispatchEvent(new Event('resize')); });
        try { await waitForD3(page, 8000); } catch {}
        await waitForStableLayout(page);
      } catch {}
      // Temporarily make D3 banner reliably visible for PDF
      let pdfCssHandle = null;
      try {
        pdfCssHandle = await page.addStyleTag({ content: `
          .hero .points { mix-blend-mode: normal !important; }
          .d3-galaxy svg { background: var(--surface-bg); }
        ` });
      } catch {}
      await page.pdf({
        path: outPath,
        format,
        printBackground: true,
        margin
      });
      try { if (pdfCssHandle) await pdfCssHandle.evaluate((el) => el.remove()); } catch {}
      console.log(`✅ PDF generated: ${outPath}`);

      // Copy into public only under the slugified name
      const publicSlugPath = resolve(cwd, 'public', `${outFileBase}.pdf`);
      try {
        await fs.mkdir(resolve(cwd, 'public'), { recursive: true });
        await fs.copyFile(outPath, publicSlugPath);
        console.log(`✅ PDF copied to: ${publicSlugPath}`);
      } catch (e) {
        console.warn('Unable to copy PDF to public/:', e?.message || e);
      }
    } finally {
      await browser.close();
    }
  } finally {
    // Try a clean shutdown of preview (entire process group first)
    try {
      if (process.platform !== 'win32') {
        try { process.kill(-preview.pid, 'SIGINT'); } catch {}
      }
      try { preview.kill('SIGINT'); } catch {}
      await Promise.race([previewExit, delay(3000)]);
      // Force kill if still alive
      // eslint-disable-next-line no-unsafe-optional-chaining
      if (!preview.killed) {
        try {
          if (process.platform !== 'win32') {
            try { process.kill(-preview.pid, 'SIGKILL'); } catch {}
          }
          try { preview.kill('SIGKILL'); } catch {}
        } catch {}
        await Promise.race([previewExit, delay(1000)]);
      }
    } catch {}
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


