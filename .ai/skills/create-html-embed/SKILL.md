---
name: create-html-embed
description: Build self-contained HTML embeds (D3 charts, interactive widgets, simulations, banners) for the research article template on the shared Embed.mount runtime, and verify them with the embed checker. Use when the user asks to create or fix a chart, visualization, embed, D3 chart, interactive figure, widget, banner, or any HTML fragment rendered through HtmlEmbed.
---

# Create HTML Embed

An embed is one `.html` fragment in `app/src/content/embeds/` that renders
inside an article through `<HtmlEmbed>`. This skill is the technical
contract: how an embed is wired, themed, sized, loaded and verified.

For the visual and editorial side of a chart (which chart, encodings,
labels, color use, annotation, density), also read
[`../design-dataviz/SKILL.md`](../design-dataviz/SKILL.md).

## Files in this skill

| File | Read it when |
|---|---|
| [runtime.md](runtime.md) | Always. `Embed.mount` API and the full embed contract. |
| [template.html](template.html) | Starting any chart. Copy it, it passes the checker. |
| [banners.md](banners.md) | Building the article hero (`banner.html`). |
| [banner-template.html](banner-template.html) | Starting a banner. |

Working examples in the repo: `app/src/content/embeds/d3-bar.html` (HTML
controls, stacked bars, legend) and `app/src/content/embeds/banner.html`
(generative hero).

## Workflow

1. **Clarify** what question the figure answers, the data (file, columns,
   size), and whether it needs interaction. If the user gave a CSV, open it
   and check its columns before writing code.
2. **Copy** `template.html` (or `banner-template.html`) to
   `app/src/content/embeds/d3-<name>.html` and rename the root class to
   `d3-<name>` everywhere (markup, CSS, `Embed.mount` first argument).
3. **Adapt** the setup and the render function. Keep the structure: one
   root `<div>`, one scoped `<style>`, one `<script>` calling
   `Embed.mount`. Follow [runtime.md](runtime.md).
4. **Put data** in `app/src/content/assets/data/` (served at `/data/`) and
   pass it with the `data` prop. Never hardcode a dataset that the article
   also ships as a file.
5. **Integrate** in MDX (see below).
6. **Verify** with the checker and fix every FAIL, then look at the
   screenshots it writes (light, dark, narrow, live theme flip):

```bash
cd app
npm run check:embed -- d3-<name>.html --data <file.csv>
npm run check:embed -- d3-<name>.html --config '{"metric":"loss"}' --widths 360,760,1100
npm run check:embed -- --all            # every embed in the repo
```

The checker renders the embed in headless Chrome inside the real
HtmlEmbed styles and reports runtime errors, failed requests, embeds
that never become ready, leaked globals, unreadable text (contrast below
2:1 fails, below 3:1 warns), overlapping labels, horizontal overflow and a
missing description. Screenshots land in `app/.embed-check/<name>/`.

## Integrate in MDX

```mdx
import HtmlEmbed from '../../components/HtmlEmbed.astro';

<HtmlEmbed
  src="d3-training-loss.html"
  title="Validation loss during pre-training"
  desc="Lower is better. Shaded bands show the min-max over 3 seeds."
  data="training_loss.csv"
  config={{ yLabel: 'Validation loss' }}
/>
```

| Prop | Type | Effect |
|---|---|---|
| `src` | string | File in `embeds/` (subfolders allowed: `demo/x.html`). Required. |
| `title` | string | Caption title above the card. |
| `desc` | string (HTML) | Text below the card. |
| `caption` | string (HTML) | Overrides `desc` as the caption below the card. |
| `frameless` | boolean | No card background, border or padding. |
| `wide` | boolean | Breaks out of the text column (about 1100px). |
| `align` | `left` / `center` / `right` | Title alignment. |
| `id` | string | Anchor id on the `<figure>` (defaults to the file name). |
| `data` | string or string[] | Data files, read with `ctx.data()`. Bare names resolve to `/data/`. |
| `config` | object | Free-form options, read with `ctx.config`. |
| `downloadable` | boolean | Adds a PNG download button. |

The same embed can be reused with different `data` and `config`, so make
labels, defaults and units configurable instead of baking them in.

## Non-negotiables (details in runtime.md)

- Use `Embed.mount`. Do not hand-roll D3 loading, container lookup, mount
  guards, `ResizeObserver`, theme observers or data fetching.
- No globals, no `document.querySelector` outside `ctx.root`, no ids
  without a per-instance suffix: the same embed can appear twice.
- Theme through CSS variables first; palette colors from `ctx.colors()`.
- The root is transparent. The card around it already has a surface.
- Call `ctx.describe()` with what the figure shows (and its main finding).
- Respect `ctx.reducedMotion`; animate with `ctx.animate`.
