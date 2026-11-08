// Shared runtime for HTML embeds.
//
// Every host that renders embeds (the article template, the collab editor
// iframe, the embed checker) loads this file as a classic script BEFORE any
// embed, so `Embed.mount` exists while embed scripts are being parsed.
//
//   <div class="d3-my-chart"></div>
//   <script>
//     Embed.mount('d3-my-chart', async (ctx) => {
//       const rows = await ctx.data();
//       const svg = d3.select(ctx.root).append('svg');
//       return ({ width, height, theme }) => { /* draw for this size */ };
//     });
//   </script>
//
// The runtime owns everything that is not the chart itself: finding the
// container, loading D3, reading HtmlEmbed props, fetching and parsing data,
// re-rendering on width / theme / palette changes, error display, cleanup,
// lazy mounting, the ready signal and the accessible description.

(() => {
  if (window.Embed && window.Embed.version) return;

  const VERSION = '1.0.0';
  const D3_URL = 'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js';
  const D3_TIMEOUT_MS = 15000;
  const LAZY_ROOT_MARGIN = '400px 0px';
  const LABEL_TINT = 0.4;
  const FALLBACK_CATEGORICAL = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'];

  const instances = new Set();
  const dataCache = new Map();
  let d3Promise = null;
  let removalObserver = null;

  const domReady = new Promise((resolve) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resolve, { once: true });
    else resolve();
  });

  // Reuses the `#d3-cdn-script` tag so legacy embeds and the runtime never
  // load D3 twice on the same page.
  const loadD3 = () => {
    if (window.d3 && typeof window.d3.select === 'function') return Promise.resolve(window.d3);
    if (d3Promise) return d3Promise;
    d3Promise = new Promise((resolve, reject) => {
      let tag = document.getElementById('d3-cdn-script');
      if (!tag) {
        tag = document.createElement('script');
        tag.id = 'd3-cdn-script';
        tag.src = Embed.d3Url;
        document.head.appendChild(tag);
      }
      const timer = setTimeout(() => reject(new Error(`D3 did not load within ${D3_TIMEOUT_MS / 1000}s (${tag.src}).`)), D3_TIMEOUT_MS);
      tag.addEventListener('load', () => {
        clearTimeout(timer);
        if (window.d3) resolve(window.d3);
        else reject(new Error('D3 script loaded but window.d3 is missing.'));
      }, { once: true });
      tag.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error(`Could not load D3 (${tag.src}).`));
      }, { once: true });
    }).catch((err) => {
      d3Promise = null;
      throw err;
    });
    return d3Promise;
  };

  const DEPENDENCIES = { d3: loadD3 };

  const currentTheme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  const parseAttribute = (raw) => {
    if (!raw || !raw.trim()) return null;
    try { return JSON.parse(raw); } catch (_) { return raw.trim(); }
  };

  // Bare file names point at the article data folder, like HtmlEmbed's `data` prop.
  const resolveDataUrl = (file) => (String(file).includes('/') ? String(file) : `${Embed.dataBase}${file}`);

  const parseData = async (url, text) => {
    const ext = url.split(/[?#]/)[0].split('.').pop().toLowerCase();
    if (ext === 'json') return JSON.parse(text);
    if (ext === 'ndjson' || ext === 'jsonl') return text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    if (ext === 'csv' || ext === 'tsv') {
      const d3 = await loadD3();
      return ext === 'csv' ? d3.csvParse(text, d3.autoType) : d3.tsvParse(text, d3.autoType);
    }
    return text;
  };

  const fetchData = (url) => {
    if (!dataCache.has(url)) {
      const promise = fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status}).`);
          return res.text();
        })
        .then((text) => parseData(url, text));
      promise.catch(() => dataCache.delete(url));
      dataCache.set(url, promise);
    }
    return dataCache.get(url);
  };

  const showError = (root, message) => {
    let pre = root.querySelector(':scope > .embed-error');
    if (!pre) {
      pre = document.createElement('pre');
      pre.className = 'embed-error';
      pre.setAttribute('role', 'alert');
      Object.assign(pre.style, {
        margin: '8px 0',
        padding: '10px 12px',
        borderRadius: '8px',
        whiteSpace: 'pre-wrap',
        fontSize: '12px',
        color: 'var(--danger-color, #d64545)',
        border: '1px solid color-mix(in srgb, var(--danger-color, #d64545) 40%, transparent)',
      });
      root.appendChild(pre);
    }
    pre.textContent = message;
  };

  const watchRemovals = () => {
    if (removalObserver || typeof MutationObserver === 'undefined') return;
    removalObserver = new MutationObserver((records) => {
      if (!records.some((r) => r.removedNodes.length)) return;
      instances.forEach((inst) => { if (!inst.root.isConnected) inst.destroy(); });
    });
    removalObserver.observe(document.documentElement, { childList: true, subtree: true });
  };

  // Headless browsers (PDF export, screenshots, the embed checker) and print
  // must see every embed, so lazy mounting only applies to real visitors.
  const mustMountEagerly = () => navigator.webdriver || typeof IntersectionObserver === 'undefined';

  // Resolve the container while the embed script is being parsed: this is the
  // only moment document.currentScript points at it.
  const findContainer = (rootClass) => {
    const script = document.currentScript;
    const sibling = script && script.parentElement
      ? script.parentElement.querySelector(`:scope > .${CSS.escape(rootClass)}:not([data-mounted])`)
      : null;
    return sibling || Array.from(document.querySelectorAll(`.${CSS.escape(rootClass)}:not([data-mounted])`)).pop() || null;
  };

  function mount(rootClass, setup, options = {}) {
    const root = options.root || findContainer(rootClass);
    if (!root) {
      console.error(`[Embed] No unmounted .${rootClass} element found for this script.`);
      return null;
    }
    root.dataset.mounted = 'true';

    const host = root.closest('[data-config], [data-datafiles]');
    const config = parseAttribute(host && host.getAttribute('data-config'));
    const rawFiles = parseAttribute(host && host.getAttribute('data-datafiles'));
    const files = (rawFiles == null ? [] : Array.isArray(rawFiles) ? rawFiles : [rawFiles]).map(resolveDataUrl);
    const deps = options.deps || ['d3'];
    const resizeMode = options.resize || 'width';
    const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const controller = new AbortController();
    const cleanups = [];
    let render = null;
    let description = null;
    let pending = false;
    let lastSize = '';
    let settled = false;
    let resolveReady;
    const ready = new Promise((resolve) => { resolveReady = resolve; });

    const settle = (status, error) => {
      if (settled) return;
      settled = true;
      root.dataset.embedStatus = status;
      root.dispatchEvent(new CustomEvent(status === 'ready' ? 'embed:ready' : 'embed:error', {
        bubbles: true,
        detail: { rootClass, description, error: error ? error.message : null },
      }));
      if (typeof window.__embedReady === 'function') {
        try { window.__embedReady(); } catch (_) {}
      }
      resolveReady({ rootClass, status, description, error: error ? error.message : null });
    };

    const fail = (error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[Embed .${rootClass}]`, err);
      showError(root, err.message);
      settle('error', err);
    };

    const applyDescription = () => {
      if (!description) return;
      root.dataset.description = description;
      root.querySelectorAll('svg, canvas').forEach((el) => {
        if (el.parentElement && el.parentElement.closest('svg')) return;
        if (!el.hasAttribute('aria-label')) {
          el.setAttribute('role', 'img');
          el.setAttribute('aria-label', description);
        }
      });
    };

    const frame = () => ({
      width: root.clientWidth,
      height: root.clientHeight,
      theme: currentTheme(),
      isDark: currentTheme() === 'dark',
    });

    const runRender = () => {
      pending = false;
      if (!render || controller.signal.aborted) return;
      try {
        render(frame());
        applyDescription();
        settle('ready');
      } catch (err) {
        fail(err);
      }
    };

    const schedule = () => {
      if (pending || !render) return;
      pending = true;
      requestAnimationFrame(runRender);
    };

    const ctx = {
      root,
      config: config && typeof config === 'object' ? config : {},
      files,
      reducedMotion,
      signal: controller.signal,
      theme: currentTheme,
      // ctx.data() -> first HtmlEmbed `data` file; ctx.data('x.csv') -> a named
      // file; ctx.data(true) -> every file. CSV/TSV use d3.autoType.
      data(which) {
        if (which === true) return Promise.all(files.map(fetchData));
        const url = which == null ? files[0] : resolveDataUrl(which);
        if (!url) return Promise.reject(new Error('This embed expects a data file: pass one with the HtmlEmbed `data` prop.'));
        return fetchData(url);
      },
      colors(kind = 'categorical', count = 8) {
        const fromPalette = window.ColorPalettes && typeof window.ColorPalettes.getColors === 'function'
          ? window.ColorPalettes.getColors(kind, count)
          : null;
        if (fromPalette && fromPalette.length) return fromPalette;
        const d3 = window.d3;
        if (d3 && kind === 'sequential') return d3.quantize(d3.interpolateBlues, count);
        if (d3 && kind === 'diverging') return d3.quantize(d3.interpolateRdBu, count);
        return Array.from({ length: count }, (_, i) => FALLBACK_CATEGORICAL[i % FALLBACK_CATEGORICAL.length]);
      },
      // Palette colors are tuned for marks; text in that color needs to be
      // pulled toward the text color to stay readable on both themes.
      labelColor(color, amount = LABEL_TINT) {
        const text = getComputedStyle(root).color;
        return window.d3 ? window.d3.interpolateRgb(color, text)(amount) : color;
      },
      describe(text) {
        description = String(text);
        applyDescription();
      },
      rerender: schedule,
      fail,
      onCleanup(fn) { cleanups.push(fn); },
      // Animation loop that pauses off-screen and in background tabs, and draws
      // a single frame when the visitor prefers reduced motion.
      animate(tick) {
        let raf = 0;
        let last = 0;
        let inView = true;
        const loop = (t) => {
          raf = 0;
          if (controller.signal.aborted) return;
          const dt = last ? t - last : 16;
          last = t;
          try { tick(t, dt); } catch (err) { fail(err); return; }
          if (!reducedMotion && inView && !document.hidden) raf = requestAnimationFrame(loop);
        };
        const start = () => {
          if (raf || controller.signal.aborted) return;
          last = 0;
          raf = requestAnimationFrame(loop);
        };
        if (typeof IntersectionObserver !== 'undefined') {
          const io = new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
            if (inView && !reducedMotion) start();
          });
          io.observe(root);
          cleanups.push(() => io.disconnect());
        }
        document.addEventListener('visibilitychange', () => { if (!document.hidden && !reducedMotion) start(); }, { signal: controller.signal });
        cleanups.push(() => cancelAnimationFrame(raf));
        start();
      },
    };

    const instance = {
      root,
      rootClass,
      ready,
      destroy() {
        if (controller.signal.aborted) return;
        controller.abort();
        cleanups.splice(0).forEach((fn) => { try { fn(); } catch (_) {} });
        instances.delete(instance);
      },
    };
    instances.add(instance);
    watchRemovals();

    const start = async () => {
      try {
        await domReady;
        await Promise.all(deps.map((name) => {
          if (!DEPENDENCIES[name]) throw new Error(`Unknown embed dependency "${name}".`);
          return DEPENDENCIES[name]();
        }));
        const result = await setup(ctx);
        if (controller.signal.aborted) return;
        if (typeof result !== 'function') {
          applyDescription();
          settle('ready');
          return;
        }
        render = result;

        const observer = new ResizeObserver(() => {
          const size = resizeMode === 'size' ? `${root.clientWidth}x${root.clientHeight}` : `${root.clientWidth}`;
          if (size === lastSize) return;
          lastSize = size;
          schedule();
        });
        observer.observe(root);
        cleanups.push(() => observer.disconnect());
        document.addEventListener('palettes:updated', schedule, { signal: controller.signal });

        lastSize = resizeMode === 'size' ? `${root.clientWidth}x${root.clientHeight}` : `${root.clientWidth}`;
        runRender();
      } catch (err) {
        fail(err);
      }
    };

    const lazy = options.lazy !== false && !mustMountEagerly();
    if (!lazy) {
      start();
    } else {
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        window.removeEventListener('beforeprint', onPrint);
        start();
      }, { rootMargin: LAZY_ROOT_MARGIN });
      const onPrint = () => {
        io.disconnect();
        start();
      };
      io.observe(root);
      window.addEventListener('beforeprint', onPrint, { once: true });
      cleanups.push(() => {
        io.disconnect();
        window.removeEventListener('beforeprint', onPrint);
      });
    }

    return instance;
  }

  // Resolves once every embed mounted so far has rendered or failed.
  const whenReady = (timeoutMs = 15000) => {
    const all = Promise.all(Array.from(instances, (inst) => inst.ready));
    if (!timeoutMs) return all;
    return Promise.race([
      all,
      new Promise((resolve) => setTimeout(() => resolve(Array.from(instances, (inst) => ({
        rootClass: inst.rootClass,
        status: inst.root.dataset.embedStatus || 'pending',
      }))), timeoutMs)),
    ]);
  };

  const Embed = {
    version: VERSION,
    d3Url: D3_URL,
    dataBase: '/data/',
    mount,
    whenReady,
    instances: () => Array.from(instances),
  };

  window.Embed = Embed;
})();
