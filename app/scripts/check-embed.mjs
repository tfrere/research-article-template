#!/usr/bin/env node
// Render HTML embeds in an isolated harness that mirrors the article runtime
// (design tokens, HtmlEmbed global styles, color-palettes.js) and report
// runtime errors, theme problems and layout issues. Screenshots are written
// so a human or an agent can look at the result.
//
// Usage:
//   npm run check:embed -- d3-bar.html
//   npm run check:embed -- path/to/file.html --data my.csv --config '{"xLabel":"Step"}'
//   npm run check:embed -- --all
//
// Options:
//   --all              Check every embed under src/content/embeds
//   --data <file>      Value passed as HtmlEmbed `data` (comma-separated for several)
//   --config <json>    Value passed as HtmlEmbed `config`
//   --frameless        Render without the card frame
//   --banner           Render inside the hero banner box (auto for banner*.html)
//   --widths <a,b>     Container widths in px (default 360,760)
//   --out <dir>        Screenshot directory (default .embed-check)

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile, readdir, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, extname, basename, relative } from 'path';
import { fileURLToPath } from 'url';

const APP_DIR = resolve(fileURLToPath(import.meta.url), '../..');
const EMBEDS_DIR = join(APP_DIR, 'src/content/embeds');
const DATA_DIR = join(APP_DIR, 'src/content/assets/data');
const PUBLIC_SCRIPTS_DIR = join(APP_DIR, 'public/scripts');
const SETTLE_MS = 700;
const READY_SETTLE_MS = 150;
// Same D3 build the article pages preload synchronously.
const D3_URL = 'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js';
const LOAD_TIMEOUT_MS = 20_000;
// Globals an embed may legitimately rely on or create.
const ALLOWED_GLOBALS = new Set(['d3', 'ColorPalettes', 'tf', 'THREE', 'katex', 'SVG']);

const MIME = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function parseArgs(argv) {
  const opts = { files: [], all: false, data: null, config: null, frameless: false, banner: false, widths: [360, 760], out: '.embed-check' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') opts.all = true;
    else if (a === '--frameless') opts.frameless = true;
    else if (a === '--banner') opts.banner = true;
    else if (a === '--data') opts.data = argv[++i];
    else if (a === '--config') opts.config = argv[++i];
    else if (a === '--widths') opts.widths = argv[++i].split(',').map(Number).filter(Boolean);
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
    else opts.files.push(a);
  }
  return opts;
}

async function listEmbeds(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listEmbeds(p)));
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out.sort();
}

async function resolveEmbed(name) {
  const direct = resolve(process.cwd(), name);
  if (existsSync(direct) && (await stat(direct)).isFile()) return direct;
  const wanted = name.endsWith('.html') ? name : `${name}.html`;
  const match = (await listEmbeds(EMBEDS_DIR)).find((p) => p.endsWith(`/${wanted}`));
  if (!match) throw new Error(`Embed not found: ${name}`);
  return match;
}

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

async function loadRuntimeCss() {
  const variables = (await readFile(join(APP_DIR, 'src/styles/_variables.css'), 'utf8'))
    .replace(/^\s*@custom-media[^;]*;\s*$/gm, '');
  const htmlEmbed = await readFile(join(APP_DIR, 'src/components/HtmlEmbed.astro'), 'utf8');
  const globalStyle = (htmlEmbed.match(/<style is:global>([\s\S]*?)<\/style>/) || [])[1] || '';
  return `${variables}\n${globalStyle}`;
}

function harnessHtml({ fragment, theme, width, data, config, frameless, banner, runtimeCss }) {
  const dataAttr = data ? ` data-datafiles="${escapeAttr(data.includes(',') ? JSON.stringify(data.split(',')) : data)}"` : '';
  const configAttr = config ? ` data-config="${escapeAttr(config)}"` : '';
  const figure = `<figure class="html-embed"><div class="html-embed__card${frameless || banner ? ' is-frameless' : ''}"><div id="frag-check"${dataAttr}${configAttr}>${fragment}</div></div></figure>`;
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<link rel="icon" href="data:,">
<style>${runtimeCss}</style>
<style>
  body { margin: 0; padding: 16px; background: var(--page-bg); color: var(--text-color); font-family: var(--default-font-family); }
  #stage { width: ${width}px; }
  /* Mirrors src/styles/layout/_hero.css: the banner root sets its own aspect ratio */
  .hero-banner { width: min(100%, 1080px); border-radius: 8px; overflow: hidden; }
  .hero-banner .html-embed { margin: 0; }
</style>
<script type="module" src="/scripts/color-palettes.js"></script>
<script src="/scripts/embed-runtime.js"></script>
<script src="${D3_URL}"></script>
<script>window.__baseGlobals = Object.keys(window);</script>
</head>
<body>
<div id="stage">${banner ? `<div class="hero-banner">${figure}</div>` : figure}</div>
</body>
</html>`;
}

function startServer(state) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/__harness') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(state.html);
        return;
      }
      const roots = [['/data/', DATA_DIR], ['/scripts/', PUBLIC_SCRIPTS_DIR]];
      for (const [prefix, dir] of roots) {
        if (!url.pathname.startsWith(prefix)) continue;
        const file = resolve(dir, decodeURIComponent(url.pathname.slice(prefix.length)));
        if (!file.startsWith(dir) || !existsSync(file)) break;
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(await readFile(file));
        return;
      }
      res.writeHead(404);
      res.end('Not found');
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// Runs in the page. Returns structural facts and low-contrast text samples.
function inspectPage() {
  const frag = document.getElementById('frag-check');
  const card = frag.closest('.html-embed__card');
  const root = Array.from(frag.children).find((el) => !['STYLE', 'SCRIPT', 'LINK', 'META', 'TITLE', 'BASE'].includes(el.tagName));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const toRgba = (css) => {
    // Patterns and gradients (`url(#id)`) have no single color: treat them as
    // see-through and keep looking at what is underneath.
    if (!css || css === 'none' || css === 'transparent' || css.startsWith('url(')) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#010203';
    ctx.fillStyle = css;
    if (ctx.fillStyle === '#010203' && css.replace(/\s/g, '') !== 'rgb(1,2,3)') return null;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a === 0 ? null : { r, g, b, a: a / 255 };
  };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const lum = ({ r, g, b }) => {
    const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const pageBg = toRgba(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  const cardBg = toRgba(getComputedStyle(card).backgroundColor);
  const baseBg = cardBg ? blend(cardBg, pageBg) : pageBg;

  // Halo: a copy of a label drawn underneath it with a thick stroke in the
  // background color, so the label stays readable over marks.
  const haloColor = (el) => {
    if (!(el instanceof SVGElement) || el.tagName !== 'text') return null;
    const cs = getComputedStyle(el);
    const stroke = toRgba(cs.stroke);
    if (!stroke || parseFloat(cs.strokeWidth) < 2) return null;
    const fill = toRgba(cs.fill);
    const sameAsFill = !fill || (fill.r === stroke.r && fill.g === stroke.g && fill.b === stroke.b);
    return sameAsFill ? stroke : null;
  };

  // Label drawn with its own outline (`paint-order: stroke`), or over a halo
  // twin. Labels often have `pointer-events: none`, which hides them (and
  // their halo) from elementsFromPoint, so look for the twin directly.
  const ownHalo = (el) => {
    const text = el instanceof SVGElement ? el.closest('text') : null;
    if (!text) return null;
    const cs = getComputedStyle(text);
    if (cs.paintOrder.startsWith('stroke') && parseFloat(cs.strokeWidth) >= 2) return toRgba(cs.stroke);
    const content = text.textContent.trim();
    const twin = text.parentNode && [...text.parentNode.children].find((s) => s !== text && s.tagName === 'text' && s.textContent.trim() === content && haloColor(s));
    return twin ? haloColor(twin) : null;
  };

  // elementsFromPoint still returns hidden tooltips (opacity: 0, visibility: hidden).
  const isInvisible = (el) => {
    if (getComputedStyle(el).visibility === 'hidden') return true;
    for (let node = el; node && node !== frag; node = node.parentElement) {
      if (Number(getComputedStyle(node).opacity) === 0) return true;
    }
    return false;
  };

  const backgroundUnder = (el, x, y) => {
    const isSvgText = el instanceof SVGElement;
    for (const under of document.elementsFromPoint(x, y)) {
      // An HTML element's own background sits behind its text; SVG text has none.
      if ((under === el && isSvgText) || (under !== el && el.contains(under)) || under === frag || under === card) continue;
      if (!root.contains(under)) break;
      if (isInvisible(under)) continue;
      const halo = haloColor(under);
      if (halo) return blend(halo, baseBg);
      const cs = getComputedStyle(under);
      const isSvgShape = under instanceof SVGElement && !(under instanceof SVGSVGElement) && under.tagName !== 'g' && under.tagName !== 'text';
      const fill = isSvgShape ? toRgba(cs.fill) : toRgba(cs.backgroundColor);
      if (fill) {
        const opacity = Number(cs.opacity) * (isSvgShape ? Number(cs.fillOpacity) : 1);
        return blend({ ...fill, a: fill.a * opacity }, baseBg);
      }
    }
    return baseBg;
  };

  const lowContrast = [];
  let textCount = 0;
  if (root) {
    const candidates = [...root.querySelectorAll('text, tspan')].filter((t) => !t.querySelector('tspan'));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (parent && !(parent instanceof SVGElement) && walker.currentNode.textContent.trim()) candidates.push(parent);
    }
    for (const el of new Set(candidates)) {
      const text = (el.textContent || '').trim();
      if (!text) continue;
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (rect.width < 1 || rect.height < 1 || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      if (el.closest('.d3-tooltip') || haloColor(el.closest('text') || el)) continue;
      let hidden = false;
      for (let p = el; p && p !== root; p = p.parentElement) {
        if (Number(getComputedStyle(p).opacity) === 0) { hidden = true; break; }
      }
      if (hidden) continue;
      const fg = toRgba(el instanceof SVGElement ? cs.fill : cs.color);
      if (!fg) continue;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const under = backgroundUnder(el, cx, cy);
      const outline = ownHalo(el);
      const bg = outline ? blend(outline, under) : under;
      const ratio = contrast(blend(fg, bg), bg);
      textCount++;
      if (ratio < 3) lowContrast.push({ text: text.slice(0, 40), ratio: Math.round(ratio * 100) / 100, fill: el instanceof SVGElement ? cs.fill : cs.color });
    }
  }

  const overlaps = [];
  if (root) {
    const boxes = [...root.querySelectorAll('text')]
      .filter((t) => (t.textContent || '').trim() && !t.closest('.d3-tooltip') && !haloColor(t) && Number(getComputedStyle(t).opacity) > 0)
      .map((t) => ({ text: t.textContent.trim().slice(0, 30), r: t.getBoundingClientRect() }))
      .filter((b) => b.r.width > 1 && b.r.height > 1);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r;
        const b = boxes[j].r;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w <= 0 || h <= 0) continue;
        // A thin full-height overlap already hides letters; area ratios miss it.
        if (w > 4 && h > 0.4 * Math.min(a.height, b.height)) overlaps.push(`"${boxes[i].text}" / "${boxes[j].text}"`);
      }
    }
  }

  let overflowPx = 0;
  if (root) {
    const limit = (card || frag).getBoundingClientRect().right;
    for (const el of root.querySelectorAll('svg, canvas, div, table')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) overflowPx = Math.max(overflowPx, Math.round(r.right - limit));
    }
  }

  const rootStyle = root ? getComputedStyle(root) : null;
  const rootBox = root ? root.getBoundingClientRect() : { width: 0, height: 0 };
  return {
    hasRoot: !!root,
    rootClass: root ? root.className : null,
    mounted: root ? root.dataset.mounted === 'true' : false,
    rootBackground: rootStyle && (rootStyle.backgroundImage !== 'none' || toRgba(rootStyle.backgroundColor)) ? (rootStyle.backgroundImage !== 'none' ? rootStyle.backgroundImage.slice(0, 60) : rootStyle.backgroundColor) : null,
    size: { width: Math.round(rootBox.width), height: Math.round(rootBox.height) },
    hasVisual: root ? !!root.querySelector('svg, canvas, img, video, table') || root.children.length > 0 : false,
    leakedGlobals: Object.keys(window).filter((k) => k !== '__baseGlobals' && !window.__baseGlobals.includes(k)),
    textCount,
    lowContrast,
    overlaps,
    overflowPx,
  };
}

async function checkOne(browser, server, state, file, opts, runtimeCss) {
  const name = basename(file, '.html');
  const fragment = await readFile(file, 'utf8');
  const banner = opts.banner || /(^|-)banner(-|$)/.test(name);
  const usesRuntime = /\bEmbed\.mount\(/.test(fragment);
  const outDir = resolve(APP_DIR, opts.out, name);
  await mkdir(outDir, { recursive: true });
  const port = server.address().port;
  const fails = [];
  const warns = [];
  const shots = [];
  if (/^\s*(<!doctype|<html|<head)/i.test(fragment)) {
    warns.push('file is a full HTML document; embeds are fragments (root div + style + script), the <head> and <title> end up inside the article');
  }

  const runs = [];
  for (const theme of ['light', 'dark']) for (const width of opts.widths) runs.push({ theme, width });
  const toggleWidth = Math.max(...opts.widths);

  for (const { theme, width } of runs) {
    const tag = `${theme}@${width}`;
    state.html = harnessHtml({ fragment, theme, width, data: opts.data, config: opts.config, frameless: opts.frameless, banner, runtimeCss });
    const context = await browser.newContext({ viewport: { width: width + 32, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on('pageerror', (err) => runtimeErrors.push(`page error: ${err.message}`));
    page.on('console', (msg) => { if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) runtimeErrors.push(`console error: ${msg.text().slice(0, 200)}`); });
    page.on('response', (r) => { if (r.status() >= 400) runtimeErrors.push(`HTTP ${r.status()}: ${r.url().replace(`http://127.0.0.1:${port}`, '')}`); });
    page.on('requestfailed', (r) => runtimeErrors.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));

    try {
      await page.goto(`http://127.0.0.1:${port}/__harness`, { waitUntil: 'networkidle', timeout: LOAD_TIMEOUT_MS });
    } catch (err) {
      fails.push(`${tag}: page did not settle (${err.message.split('\n')[0]})`);
    }
    const statuses = usesRuntime
      ? await page.evaluate(() => window.Embed.whenReady(15000))
      : null;
    await page.waitForTimeout(usesRuntime ? READY_SETTLE_MS : SETTLE_MS);
    (statuses || []).forEach((s) => {
      if (s.status === 'error') fails.push(`${tag}: embed reported an error: ${s.error}`);
      else if (s.status !== 'ready') fails.push(`${tag}: embed never signalled ready (status: ${s.status})`);
      else if (!s.description) warns.push(`${tag}: no ctx.describe() text: screen readers and the Markdown twin get nothing`);
    });
    // elementsFromPoint only sees the viewport: grow it so tall embeds are measured in full.
    const pageHeight = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    if (pageHeight > 900) {
      await page.setViewportSize({ width: width + 32, height: pageHeight });
      await page.waitForTimeout(200);
    }
    const facts = await page.evaluate(inspectPage);
    const shot = join(outDir, `${theme}-${width}.png`);
    await page.locator('#stage').screenshot({ path: shot });
    shots.push(shot);

    [...new Set(runtimeErrors)].forEach((e) => fails.push(`${tag}: ${e}`));
    if (!facts.hasRoot) fails.push(`${tag}: no root element found in the fragment`);
    else {
      if (facts.size.height < 20 || !facts.hasVisual) fails.push(`${tag}: nothing rendered (root is ${facts.size.width}x${facts.size.height})`);
      if (!facts.mounted) warns.push(`${tag}: root has no data-mounted="true" guard`);
      if (facts.rootBackground) warns.push(`${tag}: root has a background (${facts.rootBackground}); embeds should be transparent`);
      if (facts.overflowPx > 2) warns.push(`${tag}: content overflows the card by ${facts.overflowPx}px`);
      if (facts.overlaps.length) warns.push(`${tag}: ${facts.overlaps.length} overlapping SVG text pair(s), e.g. ${facts.overlaps.slice(0, 3).join(', ')}`);
    }
    const leaked = facts.leakedGlobals.filter((k) => !ALLOWED_GLOBALS.has(k));
    if (leaked.length) warns.push(`${tag}: leaked globals: ${leaked.join(', ')}`);
    const unreadable = facts.lowContrast.filter((t) => t.ratio < 2);
    const weak = facts.lowContrast.filter((t) => t.ratio >= 2);
    if (unreadable.length) fails.push(`${tag}: ${unreadable.length}/${facts.textCount} text(s) unreadable, e.g. ${unreadable.slice(0, 3).map((t) => `"${t.text}" ${t.ratio}:1 (${t.fill})`).join('; ')}`);
    if (weak.length) warns.push(`${tag}: ${weak.length}/${facts.textCount} text(s) below 3:1 contrast, e.g. ${weak.slice(0, 2).map((t) => `"${t.text}" ${t.ratio}:1`).join('; ')}`);

    // Live theme flip: catches colors baked in at mount time.
    if (width === toggleWidth && theme === 'light' && facts.hasRoot) {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.waitForTimeout(SETTLE_MS);
      const flipped = await page.evaluate(inspectPage);
      const flipShot = join(outDir, `light-to-dark-${width}.png`);
      await page.locator('#stage').screenshot({ path: flipShot });
      shots.push(flipShot);
      const flippedBad = flipped.lowContrast.filter((t) => t.ratio < 2);
      if (flippedBad.length) fails.push(`light->dark@${width}: ${flippedBad.length}/${flipped.textCount} text(s) unreadable after a live theme switch, e.g. ${flippedBad.slice(0, 3).map((t) => `"${t.text}" ${t.ratio}:1`).join('; ')}. Repaint JS colors on 'palettes:updated' or drive them from CSS variables.`);
    }
    await context.close();
  }
  return { name, file, fails: [...new Set(fails)], warns: [...new Set(warns)], shots };
}

// Prefer Playwright's bundled Chromium, fall back to a locally installed Chrome.
async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (bundledErr) {
    try {
      return await chromium.launch({ channel: 'chrome' });
    } catch (_) {
      throw new Error(`No browser available for the check. Run \`npx playwright install chromium\` or install Google Chrome.\n${bundledErr.message.split('\n')[0]}`);
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (!opts.all && !opts.files.length)) {
    console.log('Usage: npm run check:embed -- <embed.html> [...] | --all [--data f.csv] [--config json] [--frameless] [--banner] [--widths 360,760]');
    process.exit(opts.help ? 0 : 1);
  }
  const files = opts.all ? await listEmbeds(EMBEDS_DIR) : await Promise.all(opts.files.map(resolveEmbed));
  const runtimeCss = await loadRuntimeCss();
  const state = { html: '' };
  const server = await startServer(state);
  const browser = await launchBrowser();
  let failed = 0;
  try {
    for (const file of files) {
      const r = await checkOne(browser, server, state, file, opts, runtimeCss);
      const status = r.fails.length ? 'FAIL' : r.warns.length ? 'WARN' : 'PASS';
      if (r.fails.length) failed++;
      console.log(`\n${status}  ${relative(process.cwd(), r.file)}`);
      r.fails.forEach((m) => console.log(`  x ${m}`));
      r.warns.forEach((m) => console.log(`  ! ${m}`));
      console.log(`  screenshots: ${relative(process.cwd(), resolve(APP_DIR, opts.out, r.name))}/`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\n${files.length - failed}/${files.length} embed(s) without failures.`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
