# Embed runtime and contract

Every host that renders embeds loads `app/public/scripts/embed-runtime.js`
before any embed: the article pages, the collaborative editor's sandboxed
iframe and the embed checker. It defines `window.Embed`. An embed only
describes its chart; the runtime owns the plumbing.

## Shape of an embed

```html
<div class="d3-my-chart"></div>
<style>
  .d3-my-chart { position: relative; color: var(--text-color); font-size: 12px; }
  .d3-my-chart svg { display: block; width: 100%; overflow: visible; }
  .d3-my-chart .axis path, .d3-my-chart .axis line { stroke: var(--axis-color); }
  .d3-my-chart .axis text { fill: var(--tick-color); }
  .d3-my-chart .grid line { stroke: var(--grid-color); }
</style>
<script>
  Embed.mount('d3-my-chart', async (ctx) => {
    // 1. Setup, runs once: data, scales, persistent DOM.
    const rows = ctx.files.length ? await ctx.data() : demoRows();
    const svg = d3.select(ctx.root).append('svg');
    ctx.describe(`Bar chart of ... ${rows.length} models; X is highest.`);

    // 2. Render, runs on first paint, width change, theme or palette change.
    return ({ width, height, theme, isDark }) => {
      const h = Math.max(240, Math.round(width * 0.5));
      svg.attr('viewBox', `0 0 ${width} ${h}`).attr('height', h);
      // ... data joins ...
    };
  });
</script>
```

Rules for the fragment itself:

- Exactly one root element whose class is unique and matches the file name
  (`d3-my-chart.html` -> `.d3-my-chart`). No `id` on the root.
- Every CSS rule is prefixed with the root class. Never style `body`,
  `html`, `svg` or `text` unprefixed.
- The script is a classic inline script calling `Embed.mount` at top
  level. Do not wrap the call in `DOMContentLoaded`, `setTimeout` or an
  async function: the runtime finds the container from
  `document.currentScript`, which only exists while the script is parsed.
- No globals. Keep state in the setup closure.
- Any `id` or `for` inside the embed gets a per-instance suffix
  (`const uid = Math.random().toString(36).slice(2, 8)`), because the
  same embed can be used twice on a page.
- Query only inside `ctx.root` (`ctx.root.querySelector`, `d3.select(ctx.root)`).

## `Embed.mount(rootClass, setup, options)`

| Option | Default | Meaning |
|---|---|---|
| `deps` | `['d3']` | Libraries to load before `setup`. Use `[]` for vanilla JS / canvas embeds. |
| `resize` | `'width'` | Re-render on width changes only. `'size'` also re-renders on height changes (banners, fill-the-box layouts). |
| `lazy` | `true` | Mount when the embed nears the viewport (400px margin). Headless browsers, print and PDF export always mount eagerly. Pass `false` for above-the-fold content. |

`setup(ctx)` may be async. It may return a render function, or nothing
for static or self-driven embeds (then the embed is ready when setup
resolves).

The render function receives `{ width, height, theme, isDark }`, where
`width` / `height` are the root's client size. The first render runs
synchronously after setup; later renders are coalesced to one per frame.
Make render idempotent: use data joins (`selection.join()`), never append
unconditionally inside it.

## `ctx`

| Member | Purpose |
|---|---|
| `root` | The embed's root element. |
| `config` | Parsed HtmlEmbed `config` prop (`{}` when absent). |
| `files` | Resolved URLs of the HtmlEmbed `data` prop (`[]` when absent). |
| `data()` | Fetch and parse the first file. `data('name.csv')` loads a named file, `data(true)` loads all of them. CSV/TSV are parsed with `d3.autoType` (numbers and dates typed), JSON and NDJSON are parsed, other files return text. Results are cached per URL. |
| `colors(kind, n)` | `kind`: `'categorical'`, `'sequential'` or `'diverging'`. Colors derived from the article's `--primary-color`, with fallbacks when the palette script is missing. |
| `labelColor(color, t = 0.4)` | A palette color mixed toward the text color, so text in a series color stays readable on both themes. |
| `describe(text)` | Accessible description: sets `role="img"` and `aria-label` on the top-level svg/canvas and `data-description` on the root. |
| `rerender()` | Ask for a render (after a control changes, for example). |
| `animate(tick)` | `tick(time, dt)` on every frame. Paused off-screen and in background tabs; with reduced motion it runs exactly once. |
| `reducedMotion` | `true` when the visitor prefers reduced motion. |
| `theme()` | `'light'` or `'dark'`, read at call time. |
| `signal` | `AbortSignal` aborted when the embed is removed. Pass it to `addEventListener(..., { signal })` and `fetch`. |
| `onCleanup(fn)` | Run `fn` on removal (timers, workers, WebGL contexts). |
| `fail(error)` | Show an error inside the embed and mark it failed. Thrown errors in setup or render do this automatically. |

Lifecycle signals, for hosts and tests: the root gets
`data-embed-status="ready"` or `"error"` and dispatches a bubbling
`embed:ready` / `embed:error` event after the first successful render (or
failure). `Embed.whenReady()` resolves when every mounted embed has
settled.

## Theming

Theme with CSS variables first. They switch instantly with the theme and
need no JavaScript:

| Variable | Use |
|---|---|
| `--text-color` | Primary text, direct labels, emphasized values. |
| `--muted-color` | Secondary text, axis titles, annotations. |
| `--axis-color`, `--tick-color`, `--grid-color` | Axis lines, tick labels, gridlines. |
| `--border-color` | Separators, swatch outlines, control borders. |
| `--surface-bg` | Tooltips, popovers, controls. |
| `--primary-color` | The one accent: highlight, selection, focus. |
| `--danger-color` | Errors and genuinely negative values. |

Palette colors come from `ctx.colors()` and must be read inside render,
because they change with the theme and the primary color. The runtime
re-renders on theme flips and on `palettes:updated`, so no
`MutationObserver` on `data-theme` is needed.

Gotchas that the checker catches:

- **Colored SVG text.** The article applies
  `.html-embed__card svg text { fill: var(--text-color) }`, which beats
  the SVG `fill` attribute. Color text with
  `.style('fill', ...)` or a scoped CSS rule, never `.attr('fill', ...)`.
- **Palette colors as text.** Palette colors are tuned for marks and are
  too light for text (often below 2:1). Use `ctx.labelColor(color)` for
  text in a series color, or `--text-color` next to a swatch.
- **Text on colored cells.** For labels over heatmap cells or bars, pick
  black or white per cell from the cell luminance
  (`d3.hsl(color).l > 0.6 ? '#111' : '#fff'`) instead of the theme.
- **Background.** The root and its children are transparent unless the
  user asks for a surface; the HtmlEmbed card already provides one. Use
  `--surface-bg` if you need one, never a hardcoded color.

## Layout and responsiveness

- Width comes from the render argument. Derive height from width with a
  floor and a ceiling (`Math.max(240, Math.min(420, width * 0.5))`), and
  set it on the svg with a matching `viewBox`.
- Test at 360px. Below about 520px, drop what does not fit: fewer ticks
  (`Math.floor(innerW / 80)`), direct labels replaced by a legend,
  controls stacked.
- Nothing may overflow the root horizontally.
- Wide figures can use `wide` on HtmlEmbed instead of squeezing.

## UI: controls, legends, tooltips

- Controls, legends and tooltips are HTML inside the root, never SVG.
- Controls are labeled `<label for>` + `<select>` / `<input>` with a
  per-instance id, styled with the theme variables, with a visible focus
  style. Changing a control updates state and calls `ctx.rerender()`.
- Prefer direct labels on the marks over a legend. When a legend is
  needed (many series, narrow screens), make it compact HTML: swatch plus
  name. A "Legend" title is optional and usually redundant.
- One tooltip element per embed, absolutely positioned inside the root
  (`position: relative` on the root), clamped so it stays inside the
  root, hidden on pointer leave. Escape any data value you inject as HTML.
- Use pointer events (`pointermove`, `pointerleave`) so touch works.

## Data

- Data files live in `app/src/content/assets/data/` and are served at
  `/data/`. Pass them with `data="file.csv"`; read them with `ctx.data()`.
- Embeds that must work standalone (demos, templates) can fall back to a
  small inline demo dataset when `ctx.files` is empty.
- Validate what you rely on and fail with a useful message:
  `if (!rows[0] || !('loss' in rows[0])) throw new Error('Expected a "loss" column in ' + ctx.files[0]);`
- Above about 5k marks prefer canvas, above about 50k pre-aggregate.

## Accessibility

- Call `ctx.describe()` with the chart type, what is plotted, and the
  main takeaway in one or two sentences. Compute it from the data.
- Never encode meaning by color alone: pair color with labels, position,
  or shape.
- Interactive elements are focusable, labeled (`aria-label` for icon
  buttons), and have `:focus-visible` styles.

## Motion

- Use `ctx.animate(tick)` for loops; it handles visibility and reduced
  motion.
- Keep transitions short (under 300ms) and skip them when
  `ctx.reducedMotion` is true.
- Animation is never the only way to see the data: the final state must
  be readable as a still (PDF export and print show a single frame).

## Hosts

| Host | Notes |
|---|---|
| Article template | `/data/` files, real HtmlEmbed card, lazy mount. |
| Collaborative editor iframe | Sandboxed srcdoc with the same runtime and theme variables. No network data: inline the data in the script. Theme flips arrive as `palettes:updated`. |
| Embed checker | Headless Chrome with the article styles, `/data/` served from the repo, eager mount. |
| PDF export | Headless, eager mount, single animation frame. |

## Other libraries

D3 is loaded by the runtime. For anything else (Three.js, TF.js, Plotly),
pass `deps: []` and load it inside setup with a single shared script tag
(check `window.THREE` first, reuse an element id such as
`three-cdn-script`), pin the version, and release GPU resources in
`ctx.onCleanup`.
