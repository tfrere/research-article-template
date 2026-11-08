# Agent Instructions

This file provides context for AI coding agents (Claude Code, GitHub Copilot, Cursor, Windsurf, etc.) working on this project.

## Project overview

This is a **research article template** built with Astro + MDX. It produces interactive, web-native scientific papers with D3.js data visualizations, dark mode support, and PDF export.

### Key paths

| What | Where |
|------|-------|
| Astro app | `app/` |
| MDX content | `app/src/content/` (article.mdx, chapters/) |
| Components | `app/src/components/` |
| HTML embeds (D3 charts) | `app/src/content/embeds/` |
| Data files (CSV/JSON) | `app/src/content/assets/data/` |
| Styles & CSS variables | `app/src/styles/` |
| Layout grid tokens | `app/src/styles/_grid.css` |
| Scripts (export, import) | `app/scripts/` |

### Tech stack

- **Astro 4** with MDX
- **D3.js v7** for data visualization (loaded via CDN in embeds)
- **Svelte** for interactive components (e.g., Trackio)
- **CSS custom properties** for theming (light/dark mode)

## Agent skills

Detailed guides for common tasks live in `.ai/skills/`. Read the relevant skill file before starting work:

| Skill | File | When to use |
|-------|------|-------------|
| Write MDX content | [`.ai/skills/write-mdx-content/SKILL.md`](.ai/skills/write-mdx-content/SKILL.md) | Writing chapters, using components, adding math/citations/footnotes |
| Create HTML embed | [`.ai/skills/create-html-embed/SKILL.md`](.ai/skills/create-html-embed/SKILL.md) | Building any embed (D3 chart, widget, banner) on the `Embed.mount` runtime and verifying it |
| Design dataviz | [`.ai/skills/design-dataviz/SKILL.md`](.ai/skills/design-dataviz/SKILL.md) | Choosing and designing a chart: encodings, color, labels, uncertainty, review checklist |
| Article frontmatter | [`.ai/skills/article-frontmatter/SKILL.md`](.ai/skills/article-frontmatter/SKILL.md) | Configuring title, authors, template variant, DOI, PDF |
| Deploy to HF Spaces | [`.ai/skills/deploy-to-hf-spaces/SKILL.md`](.ai/skills/deploy-to-hf-spaces/SKILL.md) | Deploying, pushing, or updating a Hugging Face Space |

> **Cursor users**: these skills are also available at `.cursor/skills/` and auto-detected by the IDE.

## Writing MDX content

When asked to write or edit article content, add a chapter, or use components, read `.ai/skills/write-mdx-content/SKILL.md`.

Key points:
- Chapters are `.mdx` files in `app/src/content/chapters/`, imported in `article.mdx`
- Components (`Image`, `Note`, `Sidenote`, `Quote`, `Stack`, `HtmlEmbed`, etc.) must be imported from `../../components/`
- Math via KaTeX (`$...$` inline, `$$...$$` block), citations via `[@key]` referencing `bibliography.bib`

## Creating HTML embed charts

When asked to create a chart, visualization, or D3 embed, read the skill files:

1. **Workflow**: `.ai/skills/create-html-embed/SKILL.md`
2. **Runtime API & embed contract**: `.ai/skills/create-html-embed/runtime.md`
3. **Chart design**: `.ai/skills/design-dataviz/SKILL.md`

### TL;DR

- Embeds are self-contained `.html` files in `app/src/content/embeds/`
- Structure: single root `<div>` + scoped `<style>` + `<script>` calling `Embed.mount('d3-name', setup)`
- The runtime (`app/public/scripts/embed-runtime.js`) loads D3, reads `data` / `config`, re-renders on resize and theme changes, shows errors and signals readiness
- Theming via CSS variables, palette colors via `ctx.colors()`, transparent root
- Start from `.ai/skills/create-html-embed/template.html`
- Verify with `cd app && npm run check:embed -- d3-name.html`
- Integrated in MDX via `<HtmlEmbed src="d3-name.html" title="..." />`

## Article frontmatter

When asked to configure article metadata (title, authors, template variant, etc.), read `.ai/skills/article-frontmatter/SKILL.md`.

Key points:
- `template: "article"` (default) = full layout; `template: "paper"` = lighter single-column
- Titles support `\n` for line breaks; long titles are auto-sized
- Authors use 1-based affiliation indices

## Page layout and debug grid

The `article` template is one CSS grid with named lines (`screen`, `page`, `toc`, `outset`, `body`, `margin`).

- **Tokens**: every width, gutter, breakpoint tier and sticky offset lives in `app/src/styles/_grid.css` (`--layout-*`). Change the layout there, not in components.
- **Placement**: children of `<main>` go to `body`; `.wide` spans `body-start / margin-end`; `.full-width` spans `screen`; a `<Sidenote>` placed right after a block sits in `margin` from 1280px (inline below).
- **Components**: `Hero.astro`, `MetaColumns.astro`, `Toc.astro`, `Sidenote.astro`, `DebugGrid.astro`; their styles are in `app/src/styles/layout/`, their scripts in `app/src/scripts/layout/` (vanilla TS).
- **Breakpoints**: use the `@custom-media` aliases from `_variables.css` (`--bp-margin`, `--bp-margin-inline`, `--bp-content-collapse`) in global stylesheets; they are not resolved inside component `<style>` blocks.
- **Debug grid**: press `G` in `npm run dev`, or add `?grid` to any URL (`Shift+G` toggles the baseline). It reads the live grid, so it always shows the current tokens. Use it to check alignment after layout changes.

## Deploy to Hugging Face Spaces

When asked to deploy or update a Space, read `.ai/skills/deploy-to-hf-spaces/SKILL.md`.

Quick reference:
- SDK is Docker (`app_port: 8080`), build uses the included `Dockerfile`
- Push with `git push space main` (add remote first if needed)
- Cache issues: push an empty commit to force rebuild
- **Never remove the `research-article-template` tag from `README.md`** - it powers the [Research Article Gallery](https://huggingface.co/spaces/tfrere/research-article-gallery)

## Coding conventions

- **Commits**: follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, etc.)
- **Styles**: scoped CSS, use existing CSS variables from `app/src/styles/_variables.css`
- **Components**: Astro components (`.astro`), Svelte for interactivity (`.svelte`)
- **No globals**: embeds use IIFEs, no `window` pollution
- **Accessibility**: `aria-label` on interactive elements, `alt` on images, focus-visible styles
