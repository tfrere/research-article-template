## Embed Chart Authoring Guidelines

Authoring rules for creating a new interactive chart as a single self-contained `.html` file under `src/content/embeds/`. These conventions are derived from `d3-bar.html`, `d3-comparison.html`, `d3-neural.html`, `d3-line.html`, and `d3-pie.html`.

### 1) File, naming, and structure
- Name files with a clear prefix and purpose: `d3-<type>.html` (e.g., `d3-scatter.html`).
- Wrap everything in a single `<div class="<root-class>">`, a `<style>` block scoped to that root class, and a `<script>` IIFE.
- Do not leak globals; do not attach anything to `window`.
- Use a unique, descriptive root class (e.g., `.d3-scatter`).

Minimal skeleton:
```html
<div class="d3-yourchart" style="width:100%;margin:10px 0;"></div>
<style>
  .d3-yourchart {/* all styles scoped to the root */}
</style>
<script>
  (() => {
    // Optional dependency loader (e.g., D3)
    const ensureD3 = (cb) => {
      if (window.d3 && typeof window.d3.select === 'function') return cb();
      let s = document.getElementById('d3-cdn-script');
      if (!s) { s = document.createElement('script'); s.id = 'd3-cdn-script'; s.src = 'https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js'; document.head.appendChild(s); }
      const onReady = () => { if (window.d3 && typeof window.d3.select === 'function') cb(); };
      s.addEventListener('load', onReady, { once: true });
      if (window.d3) onReady();
    };

    const bootstrap = () => {
      const scriptEl = document.currentScript;
      // Prefer the closest previous sibling with the root class
      let container = scriptEl ? scriptEl.previousElementSibling : null;
      if (!(container && container.classList && container.classList.contains('d3-yourchart'))) {
        // Fallback: pick the last unmounted instance in the page
        const candidates = Array.from(document.querySelectorAll('.d3-yourchart'))
          .filter((el) => !(el.dataset && el.dataset.mounted === 'true'));
        container = candidates[candidates.length - 1] || null;
      }
      if (!container) return;
      if (container.dataset) {
        if (container.dataset.mounted === 'true') return;
        container.dataset.mounted = 'true';
      }

      // Tooltip (optional)
      container.style.position = container.style.position || 'relative';
      let tip = container.querySelector('.d3-tooltip'); let tipInner;
      if (!tip) {
        tip = document.createElement('div'); tip.className = 'd3-tooltip';
        Object.assign(tip.style, { position:'absolute', top:'0px', left:'0px', transform:'translate(-9999px, -9999px)', pointerEvents:'none', padding:'8px 10px', borderRadius:'8px', fontSize:'12px', lineHeight:'1.35', border:'1px solid var(--border-color)', background:'var(--surface-bg)', color:'var(--text-color)', boxShadow:'0 4px 24px rgba(0,0,0,.18)', opacity:'0', transition:'opacity .12s ease' });
        tipInner = document.createElement('div'); tipInner.className = 'd3-tooltip__inner'; tipInner.style.textAlign='left'; tip.appendChild(tipInner); container.appendChild(tip);
      } else { tipInner = tip.querySelector('.d3-tooltip__inner') || tip; }

      // SVG scaffolding (if using D3)
      const svg = d3.select(container).append('svg').attr('width','100%').style('display','block');
      const gRoot = svg.append('g');

      // State & layout
      let width = 800, height = 360; const margin = { top: 16, right: 28, bottom: 56, left: 64 };
      function updateSize(){
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        width = container.clientWidth || 800;
        height = Math.max(260, Math.round(width / 3));
        svg.attr('width', width).attr('height', height);
        gRoot.attr('transform', `translate(${margin.left},${margin.top})`);
        return { innerWidth: width - margin.left - margin.right, innerHeight: height - margin.top - margin.bottom, isDark };
      }

      function render(){
        const { innerWidth, innerHeight } = updateSize();
        // ... draw/update your chart here using data joins
      }

      // Initial render + resize handling
      render();
      const rerender = () => render();
      if (window.ResizeObserver) { const ro = new ResizeObserver(() => rerender()); ro.observe(container); }
      else { window.addEventListener('resize', rerender); }
    };

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => ensureD3(bootstrap), { once: true }); }
    else { ensureD3(bootstrap); }
  })();
</script>
```

### 2) Mounting and re-entrancy
- Select the closest previous sibling with the root class; fallback to the last unmounted matching element in the document.
- Gate with `data-mounted` to avoid double-initialization when the fragment re-runs.
- Assume the chart can appear multiple times on the same page.

### 3) Styling and theming
- Scope all rules under the root class; do not style `body`, `svg` globally.
- Use CSS variables for theme alignment: `--primary-color`, `--text-color`, `--muted-color`, `--surface-bg`, `--border-color`.
- For dark mode–aware strokes/ticks, either:
  - Read `document.documentElement.getAttribute('data-theme') === 'dark'`, or
  - Prefer CSS-only where possible.
- Keep backgrounds light and borders subtle; the outer card frame is handled by `HtmlEmbed.astro`.

### 4) Controls (labels, selects, sliders)
- Compose controls as plain HTML elements appended inside the root container.
- Style selects like in `d3-line.html`/`d3-bar.html` for consistency (rounded 8px, custom caret via data-URI, focus ring).
- Use `<label>` wrapping the input for accessibility; set concise text (e.g., "Metric", "Model Size").

### 5) Tooltip pattern
- Create a single `.d3-tooltip` absolutely positioned inside the container.
- Show on hover, hide on leave; position using `d3.pointer(event, container)` plus a small offset.
- Keep content in a `.d3-tooltip__inner` node; avoid large inner HTML.

### 6) Data loading
- Prefer public assets first, then fall back to content assets:
  - Example CSV paths: `/data/<file>.csv`, then `./assets/data/<file>.csv`, `../assets/data/<file>.csv`, etc.
- Implement `fetchFirstAvailable(paths)`; try in order with `cache:'no-cache'`; handle errors gracefully with a red `<pre>` message.
- For images or JSON models, mirror the same approach (see `d3-comparison.html`, `d3-neural.html`).

### 7) Responsiveness and layout
- Compute `width = container.clientWidth`, and a height derived from width (e.g., `width / 3`), with a sensible minimum height.
- Maintain a `margin` object and derive `innerWidth/innerHeight` for plots.
- Use a `ResizeObserver` on the container; fallback to `window.resize`.
- Recompute scales/axes/grid on every render.

### 8) Legends and labels
- Use `foreignObject` + inline HTML to render compact legends that wrap nicely (see `d3-line.html`, `d3-pie.html`).
- For axes, remove and re-append groups each render (simple and predictable), or update in place if needed.
- Always add axis labels when applicable (e.g., `Step`, `Value`).

### 9) Accessibility
- Provide `alt` attributes on `<img>` (see `d3-comparison.html`).
- Provide `aria-label` on interactive buttons (e.g., the erase button in `d3-neural.html`).
- Ensure focus-visible styles for interactive controls; avoid relying on color alone to encode meaning.

### 10) Performance and updates
- Use D3 data joins (`.data().join()` or explicit enter/merge/exit) and keep transitions short (≤200ms).
- Recompute only what is necessary on each render; avoid repeated DOM clears if not needed.
- Debounce or gate expensive computations, especially on `mousemove`.

### 11) External dependencies
- Load D3 (and optional TFJS) via CDN only once using an element id (e.g., `d3-cdn-script`, `tfjs-cdn-script`).
- After `.load`, verify the expected API (e.g., `window.d3.select`).
- Prefer pure D3 and built-ins; do not introduce new runtime dependencies unless necessary.

### 12) Error handling and fallbacks
- Fail gracefully: append a small `<pre>` with a readable message inside the container.
- For optional models (e.g., TFJS), attempt multiple URLs and fall back to a heuristic if load fails.

### 13) Printing
- Favor vector (`svg`) or simple shapes; avoid large bitmap backgrounds.
- Let `HtmlEmbed.astro` handle most print constraints; ensure the chart scales with width 100% and auto height.

### 14) Conventions checklist (before committing)
- Root class is unique and matches file name (`d3-<type>`).
- No globals added; script wrapped in an IIFE.
- `data-mounded` guard is present to avoid double-mount.
- Uses CSS variables for colors; dark-mode friendly.
- Responsive: recomputes layout on resize; uses `ResizeObserver`.
- Controls are accessible and consistently styled.
- Tooltip is present (if hover/inspect is required).
- Data loading includes public-path-first strategy and graceful error.
- Axes/labels/legends are legible at small widths.
- Code is easy to skim: clear naming, early returns, short functions.

### 15) Example: small bar chart (structure only)
```html
<div class="d3-mini-bar" style="width:100%;margin:10px 0;"></div>
<style>
  .d3-mini-bar .bar { stroke: none; }
</style>
<script>
  (() => {
    const ensureD3 = (cb) => {
      if (window.d3 && d3.select) return cb();
      let s = document.getElementById('d3-cdn-script');
      if (!s) { s = document.createElement('script'); s.id='d3-cdn-script'; s.src='https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js'; document.head.appendChild(s); }
      const onReady = () => { if (window.d3 && d3.select) cb(); };
      s.addEventListener('load', onReady, { once:true }); if (window.d3) onReady();
    };
    const bootstrap = () => {
      const scriptEl = document.currentScript;
      let container = scriptEl ? scriptEl.previousElementSibling : null;
      if (!(container && container.classList && container.classList.contains('d3-mini-bar'))){
        const cs = Array.from(document.querySelectorAll('.d3-mini-bar')).filter(el => !(el.dataset && el.dataset.mounted==='true'));
        container = cs[cs.length-1] || null;
      }
      if (!container) return;
      if (container.dataset){ if (container.dataset.mounted==='true') return; container.dataset.mounted='true'; }

      const svg = d3.select(container).append('svg').attr('width','100%').style('display','block');
      const g = svg.append('g');
      let width=800,height=280; const margin={top:16,right:16,bottom:40,left:40};
      const x=d3.scaleBand().padding(0.2), y=d3.scaleLinear();
      const data=[{k:'A',v:3},{k:'B',v:7},{k:'C',v:5}];

      function render(){
        width = container.clientWidth || 800; height = Math.max(220, Math.round(width/3.2));
        svg.attr('width', width).attr('height', height);
        g.attr('transform',`translate(${margin.left},${margin.top})`);
        const iw=width-margin.left-margin.right, ih=height-margin.top-margin.bottom;
        x.domain(data.map(d=>d.k)).range([0,iw]); y.domain([0, d3.max(data,d=>d.v)||1]).range([ih,0]).nice();
        const bars=g.selectAll('rect.bar').data(data);
        bars.join('rect').attr('class','bar').attr('x',d=>x(d.k)).attr('y',d=>y(d.v)).attr('width',x.bandwidth()).attr('height',d=>Math.max(0.5, ih - y(d.v))).attr('fill','var(--primary-color)');
        g.selectAll('.x').data([0]).join('g').attr('class','x').attr('transform',`translate(0,${ih})`).call(d3.axisBottom(x));
        g.selectAll('.y').data([0]).join('g').attr('class','y').call(d3.axisLeft(y).ticks(5));
      }
      render();
      const ro = window.ResizeObserver ? new ResizeObserver(() => render()) : null; if (ro) ro.observe(container); else window.addEventListener('resize', render);
    };
    if (document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', () => ensureD3(bootstrap), { once:true }); } else { ensureD3(bootstrap); }
  })();
</script>
```


