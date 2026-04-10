---
title: 'Bringing paper to life: A modern template for scientific writing'
short_desc: 'A practical journey behind training SOTA LLMs'
emoji: 📝
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
header: mini
app_port: 8080
tags:
  - research-article-template
  - research paper
  - scientific paper
  - data visualization
thumbnail: https://HuggingFaceTB-smol-training-playbook.hf.space/thumb.png
---
<div align="center">

# Research Article Template

**A modern, interactive template for scientific writing that brings papers to life.**

Interactive diagrams, math, citations, dark mode, PDF export - all with minimal setup.

**[Live demo & docs](https://huggingface.co/spaces/tfrere/research-article-template)** | [![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/) [![Hugging Face Spaces](https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-Spaces-blue)](https://huggingface.co/spaces/tfrere/research-article-template)

</div>

## Quick start

```bash
npx create-research-article my-paper
```

The CLI walks you through setup interactively:
- **Project name** and basic metadata (title, authors, affiliations)
- **Template choice**: `article` (full layout with banner, TOC, citations, figure numbering, PDF export) or `paper` (lighter centered single-column layout)
- **Hugging Face deployment** (optional, auto-creates a Space if `huggingface-cli` is installed)

Then start writing:

```bash
cd my-paper/app
npm run dev              # dev server at localhost:4321
```

## Deploy to Hugging Face

If you skipped the auto-deploy during setup, push manually:

```bash
# create a Docker Space at huggingface.co/new-space, then:
git remote add space git@hf.co:spaces/<your-username>/<your-space>
git push space main
```

The project ships with Dockerfile, nginx config, and HF Space metadata ready to go.

## Template variants

Set `template` in `app/src/content/article.mdx` frontmatter:

| Value | Layout | Best for |
|-------|--------|----------|
| `article` (default) | Banner, sidebar TOC, figure numbering, citation block, PDF export | Full research articles |
| `paper` | Centered single column, no figure numbering, minimal footer | Blog posts, lighter papers |

### External links (paper template)

The `paper` template supports external link buttons below the authors:

```yaml
links:
  - label: "Paper"
    url: "https://arxiv.org/abs/..."
  - label: "Code"
    url: "https://github.com/..."
  - label: "Demo"
    url: "https://huggingface.co/spaces/..."
```

### Title line breaks

Long titles are automatically balanced across lines. You can also force a line break with `\n`:

```yaml
title: "Why Open-Source LLMs\nAre Reshaping the AI Landscape"
```

Titles longer than 60 characters are automatically downsized for readability.

## Edit your content

| File | What |
|------|------|
| `app/src/content/article.mdx` | Main article (metadata + chapter imports) |
| `app/src/content/chapters/` | Chapters (one .mdx per section) |
| `app/src/content/bibliography.bib` | BibTeX references |
| `app/src/content/embeds/` | D3.js HTML visualizations |
| `app/src/content/assets/image/` | Images |
| `app/src/content/assets/data/` | CSV/JSON data files |

## Commands

| Command | What |
|---------|------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run export:pdf` | Export as PDF |
| `npm run export:latex` | Export as LaTeX |
| `npm run sync:template` | Pull latest template updates |

## Alternative setup

<details>
<summary>Duplicate on Hugging Face</summary>

1. Visit **[Research Article Template](https://huggingface.co/spaces/tfrere/research-article-template)**, click **"Duplicate this Space"**
2. Clone: `git clone git@hf.co:spaces/<your-username>/<your-space>`
3. `cd <your-space>/app && git lfs pull && npm install && npm run dev`
</details>

<details>
<summary>Clone directly</summary>

```bash
git clone https://github.com/tfrere/research-article-template.git
cd research-article-template/app
git lfs install && git lfs pull
npm install && npm run dev
```
</details>

## License

CC-BY-4.0 - [Distill](https://distill.pub/)-inspired, built with [Astro](https://astro.build/) + MDX + D3.js.

**[Discussions](https://huggingface.co/spaces/tfrere/research-article-template/discussions)** | **[@tfrere](https://huggingface.co/tfrere)**