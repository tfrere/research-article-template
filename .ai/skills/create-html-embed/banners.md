# Banners (article hero)

A banner is the decorative embed at the top of an article, rendered by
the hero below the title and description. It follows [runtime.md](runtime.md) with these
differences. Start from [banner-template.html](banner-template.html).

| Constraint | Value |
|---|---|
| File | Any file in `app/src/content/embeds/`, picked with the `banner` frontmatter field (default `banner.html`, `false` hides it). Rendered frameless. Dev gallery of all banners: `/banners` in `npm run dev`. |
| Box | The hero box is up to 1080px wide and takes the height of the banner root. 5:2 by default (1080x432), 12:5 for the article-anatomy banners. |
| Root CSS | `width: 100%; aspect-ratio: 5 / 2; overflow: hidden; position: relative;` |
| Mount | `Embed.mount('<root-class>', setup, { resize: 'size' })` and draw from both `width` and `height`. |
| SVG / canvas | Fills the root edge to edge (`width: 100%; height: 100%; display: block`), no margins. |
| Background | Transparent, like every embed. Weight comes from shapes, lines, motion and color, never from a filled rectangle. |
| UI | No legend, no controls, no tooltip unless explicitly asked. |
| Colors | `ctx.colors('sequential' | 'categorical', n)` and `--primary-color`, read inside render so the banner follows the theme and accent color. |
| Motion | Optional, subtle (drift, slow rotation) through `ctx.animate`. |

The root carries its own `aspect-ratio` because the wrapper HtmlEmbed puts
around the fragment has no explicit height: `height: 100%` on the root
resolves to nothing.

## Style direction

Banners set the mood of the article. Prefer abstract or generative
visuals tied to the topic: particle fields, flow fields, constellations,
wave forms, topographic lines, isotype grids, network meshes. Data can be
synthetic; seed randomness (`d3.randomLcg(42)`) so the banner looks the
same on every load and in the PDF.

## Checks

- Looks good at 980x392 and at 360px wide, in light and dark.
- The lightest palette stops vanish on a light page: skip them or raise
  their opacity.
- With reduced motion, the single drawn frame is a complete composition.
- Thousands of SVG nodes animated per frame are slow: above about 1,500
  moving elements, use canvas.

```bash
cd app && npm run check:embed -- banner.html
```
