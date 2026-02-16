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
| Scripts (export, import) | `app/scripts/` |

### Tech stack

- **Astro 4** with MDX
- **D3.js v7** for data visualization (loaded via CDN in embeds)
- **Svelte** for interactive components (e.g., Trackio)
- **CSS custom properties** for theming (light/dark mode)

## Creating HTML embed charts

When asked to create a chart, visualization, or D3 embed, read and follow these files:

1. **Workflow & quick reference**: `.cursor/skills/create-html-embed/SKILL.md`
2. **Full conventions & directives**: `.cursor/skills/create-html-embed/directives.md`

### TL;DR

- Embeds are self-contained `.html` files in `app/src/content/embeds/`
- Structure: single root `<div>` + scoped `<style>` + IIFE `<script>`
- Colors from `window.ColorPalettes`, theming via CSS variables
- Dark mode aware, responsive (ResizeObserver), mount-guarded (`data-mounted`)
- Integrated in MDX via `<HtmlEmbed src="d3-name.html" title="..." />`

## Coding conventions

- **Commits**: follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, etc.)
- **Styles**: scoped CSS, use existing CSS variables from `app/src/styles/_variables.css`
- **Components**: Astro components (`.astro`), Svelte for interactivity (`.svelte`)
- **No globals**: embeds use IIFEs, no `window` pollution
- **Accessibility**: `aria-label` on interactive elements, `alt` on images, focus-visible styles
