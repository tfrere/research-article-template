// Global color palettes generator and watcher
// - Observes CSS variable --primary-color and theme changes
// - Generates categorical, sequential, and diverging palettes (OKLCH/OKLab)
// - Exposes results as CSS variables on :root
// - Supports variable color counts per palette via CSS vars
// - Dispatches a 'palettes:updated' CustomEvent after each update

(() => {
  const MODE = { cssRoot: document.documentElement };

  const getCssVar = (name) => {
    try { return getComputedStyle(MODE.cssRoot).getPropertyValue(name).trim(); } catch { return ''; }
  };
  const getIntFromCssVar = (name, fallback) => {
    const raw = getCssVar(name);
    if (!raw) return fallback;
    const v = parseInt(String(raw), 10);
    if (Number.isNaN(v)) return fallback;
    return v;
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  // Color math (OKLab/OKLCH)
  const srgbToLinear = (u) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
  const linearToSrgb = (u) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(Math.max(0, u), 1 / 2.4) - 0.055);
  const rgbToOklab = (r, g, b) => {
    const rl = srgbToLinear(r), gl = srgbToLinear(g), bl = srgbToLinear(b);
    const l = Math.cbrt(0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl);
    const m = Math.cbrt(0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl);
    const s = Math.cbrt(0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl);
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const b2 = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return { L, a, b: b2 };
  };
  const oklabToRgb = (L, a, b) => {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;
    const r = linearToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
    const g = linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
    const b3 = linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
    return { r, g, b: b3 };
  };
  const oklchToOklab = (L, C, hDeg) => { const h = (hDeg * Math.PI) / 180; return { L, a: C * Math.cos(h), b: C * Math.sin(h) }; };
  const oklabToOklch = (L, a, b) => { const C = Math.sqrt(a*a + b*b); let h = Math.atan2(b, a) * 180 / Math.PI; if (h < 0) h += 360; return { L, C, h }; };
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const isInGamut = ({ r, g, b }) => r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1;
  const toHex = ({ r, g, b }) => { const R = Math.round(clamp01(r)*255), G = Math.round(clamp01(g)*255), B = Math.round(clamp01(b)*255); const h = (n) => n.toString(16).padStart(2,'0'); return `#${h(R)}${h(G)}${h(B)}`.toUpperCase(); };
  const oklchToHexSafe = (L, C, h) => { let c = C; for (let i=0;i<12;i++){ const { a, b } = oklchToOklab(L,c,h); const rgb = oklabToRgb(L,a,b); if (isInGamut(rgb)) return toHex(rgb); c = Math.max(0, c-0.02);} return toHex(oklabToRgb(L,0,0)); };
  const parseCssColorToRgb = (css) => { try { const el = document.createElement('span'); el.style.color = css; document.body.appendChild(el); const cs = getComputedStyle(el).color; document.body.removeChild(el); const m = cs.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i); if (!m) return null; return { r: Number(m[1])/255, g: Number(m[2])/255, b: Number(m[3])/255 }; } catch { return null; } };

  const getPrimaryHex = () => {
    const css = getCssVar('--primary-color');
    if (!css) return '#E889AB';
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(css)) return css.toUpperCase();
    const rgb = parseCssColorToRgb(css);
    if (rgb) return toHex(rgb);
    return '#E889AB';
  };
  // No count management via CSS anymore; counts are passed directly to the API

  const generators = {
    categorical: (baseHex, count) => {
      const parseHex = (h) => { const s = h.replace('#',''); const v = s.length===3 ? s.split('').map(ch=>ch+ch).join('') : s; return { r: parseInt(v.slice(0,2),16)/255, g: parseInt(v.slice(2,4),16)/255, b: parseInt(v.slice(4,6),16)/255 }; };
      const { r, g, b } = parseHex(baseHex);
      const { L, a, b: bb } = rgbToOklab(r,g,b);
      const { C, h } = oklabToOklch(L,a,bb);
      const L0 = Math.min(0.85, Math.max(0.4, L));
      const C0 = Math.min(0.35, Math.max(0.1, C || 0.2));
      const total = Math.max(1, Math.min(12, count || 8));
      const hueStep = 360 / total;
      const results = [];
      for (let i=0;i<total;i++) { const hDeg = (h + i*hueStep) % 360; const lVar = ((i % 3) - 1) * 0.04; results.push(oklchToHexSafe(Math.max(0.4, Math.min(0.85, L0 + lVar)), C0, hDeg)); }
      return results;
    },
    sequential: (baseHex, count) => {
      const parseHex = (h) => { const s = h.replace('#',''); const v = s.length===3 ? s.split('').map(ch=>ch+ch).join('') : s; return { r: parseInt(v.slice(0,2),16)/255, g: parseInt(v.slice(2,4),16)/255, b: parseInt(v.slice(4,6),16)/255 }; };
      const { r, g, b } = parseHex(baseHex);
      const { L, a, b: bb } = rgbToOklab(r,g,b);
      const { C, h } = oklabToOklch(L,a,bb);
      const total = Math.max(1, Math.min(12, count || 8));
      const startL = Math.max(0.25, L - 0.18);
      const endL = Math.min(0.92, L + 0.18);
      const cBase = Math.min(0.33, Math.max(0.08, C * 0.9 + 0.06));
      const out = [];
      for (let i=0;i<total;i++) { const t = total===1 ? 0 : i/(total-1); const lNow = startL*(1-t)+endL*t; const cNow = cBase*(0.85 + 0.15*(1 - Math.abs(0.5 - t)*2)); out.push(oklchToHexSafe(lNow, cNow, h)); }
      return out;
    },
    diverging: (baseHex, count) => {
      const parseHex = (h) => { const s = h.replace('#',''); const v = s.length===3 ? s.split('').map(ch=>ch+ch).join('') : s; return { r: parseInt(v.slice(0,2),16)/255, g: parseInt(v.slice(2,4),16)/255, b: parseInt(v.slice(4,6),16)/255 }; };
      const { r, g, b } = parseHex(baseHex);
      const baseLab = rgbToOklab(r,g,b);
      const baseLch = oklabToOklch(baseLab.L, baseLab.a, baseLab.b);
      const total = Math.max(1, Math.min(12, count || 8));

      // Left endpoint: EXACT primary color (no darkening)
      const leftLab = baseLab;
      // Right endpoint: complement with same L and similar C (clamped safe)
      const compH = (baseLch.h + 180) % 360;
      const cSafe = Math.min(0.35, Math.max(0.08, baseLch.C));
      const rightLab = oklchToOklab(baseLab.L, cSafe, compH);
      const whiteLab = { L: 0.98, a: 0, b: 0 }; // center near‑white

      const hexFromOKLab = (L, a, b) => toHex(oklabToRgb(L, a, b));
      const lerp = (a, b, t) => a + (b - a) * t;
      const lerpOKLabHex = (A, B, t) => hexFromOKLab(lerp(A.L, B.L, t), lerp(A.a, B.a, t), lerp(A.b, B.b, t));

      const out = [];
      if (total % 2 === 1) {
        const nSide = (total - 1) >> 1; // items on each side
        // Left side: include left endpoint exactly at index 0
        for (let i = 0; i < nSide; i++) {
          const t = nSide <= 1 ? 0 : (i / (nSide - 1)); // 0 .. 1
          // Move from leftLab to a value close (but not equal) to white; ensure last before center is lighter
          const tt = t * 0.9; // keep some distance from pure white before center
          out.push(lerpOKLabHex(leftLab, whiteLab, tt));
        }
        // Center
        out.push(hexFromOKLab(whiteLab.L, whiteLab.a, whiteLab.b));
        // Right side: start near white and end EXACTLY at rightLab
        for (let i = 0; i < nSide; i++) {
          const t = nSide <= 1 ? 1 : ((i + 1) / nSide); // (1/n)..1
          const tt = Math.max(0.1, t); // avoid starting at pure white
          out.push(lerpOKLabHex(whiteLab, rightLab, tt));
        }
        // Ensure first and last are exact endpoints
        if (out.length) { out[0] = hexFromOKLab(leftLab.L, leftLab.a, leftLab.b); out[out.length - 1] = hexFromOKLab(rightLab.L, rightLab.a, rightLab.b); }
      } else {
        const nSide = total >> 1;
        // Left half including left endpoint, approaching white but not reaching it
        for (let i = 0; i < nSide; i++) {
          const t = nSide <= 1 ? 0 : (i / (nSide - 1)); // 0 .. 1
          const tt = t * 0.9;
          out.push(lerpOKLabHex(leftLab, whiteLab, tt));
        }
        // Right half: mirror from near white to exact right endpoint
        for (let i = 0; i < nSide; i++) {
          const t = nSide <= 1 ? 1 : ((i + 1) / nSide); // (1/n)..1
          const tt = Math.max(0.1, t);
          out.push(lerpOKLabHex(whiteLab, rightLab, tt));
        }
        if (out.length) { out[0] = hexFromOKLab(leftLab.L, leftLab.a, leftLab.b); out[out.length - 1] = hexFromOKLab(rightLab.L, rightLab.a, rightLab.b); }
      }
      return out;
    }
  };

  let lastSignature = '';

  const updatePalettes = () => {
    const primary = getPrimaryHex();
    const signature = `${primary}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    try { document.dispatchEvent(new CustomEvent('palettes:updated', { detail: { primary } })); } catch {}
  };

  const bootstrap = () => {
    updatePalettes();
    const mo = new MutationObserver(() => updatePalettes());
    mo.observe(MODE.cssRoot, { attributes: true, attributeFilter: ['style', 'data-theme'] });
    setInterval(updatePalettes, 400);
    // Utility: choose high-contrast (or softened) text style against an arbitrary background color
    const pickTextStyleForBackground = (bgCss, opts = {}) => {
      const cssRoot = document.documentElement;
      const getCssVar = (name) => {
        try { return getComputedStyle(cssRoot).getPropertyValue(name).trim(); } catch { return ''; }
      };
      const resolveCssToRgb01 = (css) => {
        const rgb = parseCssColorToRgb(css);
        if (!rgb) return null;
        return rgb; // already 0..1
      };
      const mixRgb01 = (a, b, t) => ({ r: a.r*(1-t)+b.r*t, g: a.g*(1-t)+b.g*t, b: a.b*(1-t)+b.b*t });
      const relLum = (rgb) => {
        const f = (u) => srgbToLinear(u);
        return 0.2126*f(rgb.r) + 0.7152*f(rgb.g) + 0.0722*f(rgb.b);
      };
      const contrast = (fg, bg) => {
        const L1 = relLum(fg), L2 = relLum(bg); const a = Math.max(L1,L2), b = Math.min(L1,L2);
        return (a + 0.05) / (b + 0.05);
      };
      try {
        const bg = resolveCssToRgb01(bgCss);
        if (!bg) return { fill: getCssVar('--text-color') || '#000', stroke: 'var(--transparent-page-contrast)', strokeWidth: 1 };
        const candidatesCss = [getCssVar('--text-color') || '#111', getCssVar('--on-primary') || '#0f1115', '#000', '#fff'];
        const candidates = candidatesCss
          .map(css => ({ css, rgb: resolveCssToRgb01(css) }))
          .filter(x => !!x.rgb);
        // Pick the max contrast
        let best = candidates[0]; let bestCR = contrast(best.rgb, bg);
        for (let i=1;i<candidates.length;i++){
          const cr = contrast(candidates[i].rgb, bg);
          if (cr > bestCR) { best = candidates[i]; bestCR = cr; }
        }
        // Optional softening via blend factor (0..1), blending towards muted color
        const blend = Math.min(1, Math.max(0, Number(opts.blend || 0)));
        let finalRgb = best.rgb;
        if (blend > 0) {
          const mutedCss = getCssVar('--muted-color') || (getCssVar('--text-color') || '#111');
          const mutedRgb = resolveCssToRgb01(mutedCss) || best.rgb;
          finalRgb = mixRgb01(best.rgb, mutedRgb, blend);
        }
        const haloStrength = Math.min(1, Math.max(0, Number(opts.haloStrength == null ? 0.5 : opts.haloStrength)));
        const stroke = (best.css === '#000' || best.css.toLowerCase() === 'black') ? `rgba(255,255,255,${0.30 + 0.40*haloStrength})` : `rgba(0,0,0,${0.30 + 0.30*haloStrength})`;
        return { fill: toHex(finalRgb), stroke, strokeWidth: (opts.haloWidth == null ? 1 : Number(opts.haloWidth)) };
      } catch {
        return { fill: getCssVar('--text-color') || '#000', stroke: 'var(--transparent-page-contrast)', strokeWidth: 1 };
      }
    };
    window.ColorPalettes = {
      refresh: updatePalettes,
      notify: () => { try { const primary = getPrimaryHex(); document.dispatchEvent(new CustomEvent('palettes:updated', { detail: { primary } })); } catch {} },
      getPrimary: () => getPrimaryHex(),
      getColors: (key, count = 6) => {
        const primary = getPrimaryHex();
        const total = Math.max(1, Math.min(12, Number(count) || 6));
        if (key === 'categorical') return generators.categorical(primary, total);
        if (key === 'sequential') return generators.sequential(primary, total);
        if (key === 'diverging') return generators.diverging(primary, total);
        return [];
      },
      getTextStyleForBackground: (bgCss, opts) => pickTextStyleForBackground(bgCss, opts || {}),
      chooseReadableText: (bgCss, opts) => pickTextStyleForBackground(bgCss, opts || {})
    };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  else bootstrap();
})();


