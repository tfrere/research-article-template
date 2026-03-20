# Research Article Template — Roadmap 2026

> Strategic report — February 2026
> Goal: identify high-impact actions for adoption over the next 6 months.

---

## 1. Current State

### 1.1 The project today

| Metric | Value |
|--------|-------|
| First version | Oct 2025 (extracted from smol-training-playbook) |
| Total commits | ~310 |
| Astro components | 20 |
| HTML embeds (D3) | 26 |
| Utility scripts | 19 .mjs files |
| CSS (styles) | ~3,000 lines |
| Total LOC (excl. deps) | ~48,600 lines |
| Export formats | PDF (normal + book), LaTeX |
| Importers | LaTeX → MDX, Notion → MDX |

### 1.2 Tech stack

- **Astro 4.10** + MDX for content
- **D3.js v7** (CDN) for interactive visualizations
- **Svelte 4** for interactive components (Trackio)
- **CSS custom properties** for light/dark theming
- **Playwright** for PDF export
- **Pandoc** for LaTeX export
- **Docker + Nginx** for HF Spaces deployment

### 1.3 Current strengths

- **Solid embed architecture**: D3 charts are self-contained, themed, responsive, and documented for AI agents via a high-quality Cursor skill (~500 lines of directives).
- **Multi-format export**: PDF (normal + book), LaTeX, DOCX, TXT - rare for a web template.
- **Sync-template**: update the template without overwriting user content - unique feature in the ecosystem.
- **CSS variables theming**: full dark mode, dynamic palette via `ColorPalettes`.
- **Complete scientific content**: BibTeX citations, KaTeX, footnotes, sidenotes, glossary, mermaid diagrams.

### 1.4 Identified weaknesses

- **Heavy onboarding**: you need to clone, delete demo content, understand the structure. No CLI.
- **Zero CI/CD**: no GitHub Actions, no preview deployments, no build checks.
- **Incomplete export scripts**: 4 scripts referenced in package.json don't exist (docx, txt, images, bundle), manual YAML parsing in LaTeX export produces invalid LaTeX.
- **No search** in long articles - paradoxically less navigable than a PDF.
- **Incomplete accessibility**: no skip link, no focus trap sidebar, `:focus` instead of `:focus-visible`.
- **Missing sync-template documentation** - the killer feature is invisible.
- **No embed gallery** - the 26 charts are buried in the filesystem.
- **AI skills limited** to embed creation - missing "create an article", "add a chapter", "debug export".

### 1.5 Heaviest components (potential technical debt)

| Component | Lines | Observation |
|-----------|-------|-------------|
| TableOfContents.astro | 1,152 | Complex scroll + collapse logic, prop naming inconsistent with frontmatter |
| HtmlEmbed.astro | 942 | Large API (11 props), `desc`/`caption` redundant, `skipGallery` untyped |
| Hero.astro | 665 | Monolithic, hard to customize |
| Image.astro | 626 | `[key: string]: any` in props - too permissive |
| Footer.astro | 436 | Citation + BibTeX + license in a single component |

---

## 2. 2026 Context: What Has Changed

### 2.1 The AI landscape in February 2026

Claude Opus 4.6, GPT-5, Gemini 2.5 - code agents are capable of:
- Generating a complete interactive website in 30 seconds
- Understanding and following complex code conventions via directive files
- Orchestrating multi-step pipelines (import → write → build → deploy)

**Direct consequence**: the template's competitor is no longer Overleaf or another template. It's the agent that generates a one-shot. The added value must lie in what a one-shot cannot offer: structure, ecosystem, ongoing maintenance, and HF Spaces integration.

### 2.2 What researchers expect in 2026

1. **"I want to publish my paper, not configure a build system"** - setup must be < 2 minutes.
2. **"I have a LaTeX paper, convert it"** - import must be a reliable one-liner.
3. **"Show me my data interactively"** - charts should be a catalog, not a coding exercise.
4. **"My co-author pushed a chapter, I want to see the result"** - preview deployments.
5. **"AI can write/adapt my charts"** - skills must cover the entire workflow.

---

## 3. Roadmap: March – August 2026

### Phase 1: Foundations (March – April)

> Goal: reduce onboarding friction and stabilize existing tools.

#### 3.1.1 — CLI `create-research-article`

**Priority: P0 — Very high impact**

Create an npm package `create-research-article` that scaffolds a clean project:

```bash
npm create research-article my-paper
# or
npx create-research-article my-paper
```

Interactive flow:
1. Paper title
2. Author(s) and affiliation(s)
3. Primary color (preset or hex)
4. Include example embeds? (yes/no)
5. Configure for HF Spaces? (yes/no)

Result: a clean `app/` with pre-filled `article.mdx`, empty `bibliography.bib`, a starter "Introduction" chapter, and a customized `README.md`.

**Reference**: `create-astro`, `create-next-app`, `create-vite`.

**Deliverable**: published npm package, documented in README.

**Estimate**: 1-2 weeks.

---

#### 3.1.2 — Stabilize export scripts

**Priority: P0 — High impact**

Exports are often the first test for a new user. Current issues:

| Script | Problem | Fix |
|--------|---------|-----|
| `package.json` | 4 referenced scripts don't exist (docx, txt, images, bundle) | Remove entries or create the scripts |
| `export-pdf.mjs` | `waitForD3` only covers `.d3-line` and `.d3-bar` (26 embed types) | Use the generic selector `[class^="d3-"]` |
| `export-pdf.mjs` | Duplicated SVG fix code (60 copy-pasted lines) | Extract into a reusable function |
| `export-pdf.mjs` | Many empty `catch {}` - silent errors | Add at minimum a `console.warn` |
| `export-latex.mjs` | Manual YAML frontmatter parsing, doesn't handle arrays/objects | Use `js-yaml` |
| `export-latex.mjs` | Broken `\author{}` mapping (receives raw YAML instead of a name) | Map `author.name` after proper parsing |

**Deliverable**: both exporters (PDF, LaTeX) pass a smoke test without errors on demo content. Ghost scripts removed from package.json.

**Estimate**: 1 week.

---

#### 3.1.3 — Accessibility: quick wins

**Priority: P1 — Medium impact, very low effort**

- [ ] Add a "Skip to main content" link in the main layout
- [ ] Focus trap in the mobile sidebar (when open, Tab stays within the sidebar)
- [ ] Replace `:focus` with `:focus-visible` on HtmlEmbed download, Glossary, and other interactive controls
- [ ] Add `role="main"` on the main container if missing
- [ ] Verify that Escape properly closes all modals/overlays

**Deliverable**: 0 axe-core errors on the home page.

**Estimate**: 1-2 days.

---

#### 3.1.4 — Document `sync-template`

**Priority: P1 — Medium impact, very low effort**

Add a dedicated section in the README:

```markdown
## Keeping your article up to date

This template includes a built-in sync mechanism:

npm run sync:template         # Interactive sync
npm run sync:template:dry     # Preview changes without applying
npm run sync:template:force   # Force update all template files

Sync preserves your content (article.mdx, chapters/, bibliography.bib, 
assets/data/) and updates only template infrastructure.
```

Also document in `CONTRIBUTING.md` what sync-template touches vs preserves.

**Estimate**: 2-3 hours.

---

### Phase 2: Ecosystem (May – June)

> Goal: transform the template into a platform.

#### 3.2.1 — Embed gallery with live preview

**Priority: P0 — High impact**

Create a `/gallery` page (or enrich `/dataviz`) that:

- Lists the 26 existing embeds with live preview and description
- Shows the MDX usage code (one-click copy)
- Filters by type: bar, line, scatter, matrix, flowchart, custom
- Indicates complexity and required data
- Allows testing with own data (upload CSV → preview)

**Why it's strategic**: this gallery becomes the entry point for AI agents. A researcher says "make me a chart like the scatter in the gallery but with my data", the AI agent reads the gallery, identifies the right embed, copies and adapts. The gallery is an **implicit training set**.

**Deliverable**: navigable `/gallery` page, with at least 15 categorized embeds.

**Estimate**: 2 weeks.

---

#### 3.2.2 — Complete AI skills

**Priority: P0 — Very high impact, low effort**

Currently, only the `create-html-embed` skill exists. Add:

| Skill | File | Use case |
|-------|------|----------|
| **Create an article** | `.cursor/skills/create-article/SKILL.md` | New user who wants to start from scratch |
| **Add a chapter** | `.cursor/skills/add-chapter/SKILL.md` | The most frequent operation |
| **Customize the theme** | `.cursor/skills/customize-theme/SKILL.md` | Change colors, typography, layout |
| **Debug export** | `.cursor/skills/debug-export/SKILL.md` | Broken PDF, crashing LaTeX - pain point #1 |
| **Import content** | `.cursor/skills/import-content/SKILL.md` | LaTeX → MDX, Notion → MDX, Markdown → MDX |

Each skill must contain:
- Step-by-step workflow
- Files to read/modify
- Conventions to follow
- Validation checklist
- Model prompt for the agent

**Vision**: a researcher opens the project in Cursor and says "turn my ArXiv paper into an interactive article". The agent knows exactly what to do thanks to the skills.

**Deliverable**: 5 new documented skills.

**Estimate**: 3-5 days.

---

#### 3.2.3 — Full-text search (Pagefind)

**Priority: P1 — Medium impact, very low effort**

Integrate [Pagefind](https://pagefind.app/) - a static search engine that integrates natively with Astro:

- Build-time indexing (no server)
- Instant client-side search
- ~50 KB gzipped
- Works with MDX content, embeds, accordions

**Why it matters**: a 15,000-word scientific article without search is paradoxically **less navigable** than a PDF. This is a real barrier to reader adoption.

**Deliverable**: `Search` component integrated in the header or TOC.

**Estimate**: 1-2 days.

---

#### 3.2.4 — GitHub Actions: build + preview

**Priority: P1 — High impact, low effort**

Set up a minimal CI pipeline:

```yaml
# .github/workflows/ci.yml
- Build check on every PR
- PDF export smoke test
- MDX lint (valid frontmatter, resolved imports)
- Preview deployment (Vercel/Netlify/Cloudflare Pages)
```

**Why**: research teams (2-5 people) need previews to collaborate. Without CI, a co-author can break the build without anyone knowing.

**Deliverable**: working GitHub Actions workflow + badge in README.

**Estimate**: 2-3 days.

---

### Phase 3: Differentiation (July – August)

> Goal: create a moat against alternatives.

#### 3.3.1 — "Light Collaboration" mode

Integrate a lightweight annotation/comment system:

- **Option 1**: [Hypothesis](https://web.hypothes.is/) - one-line script integration, public annotations
- **Option 2**: Custom inline comments (stored in JSON, visible in review mode)
- **Option 3**: HF Discussions integration as comment backend

**Why**: collaboration is the #1 implicit feature request from researchers. Git is a developer workflow, not a scientist's workflow.

**Estimate**: 1-2 weeks depending on the option.

---

#### 3.3.2 — Schema.org / Structured Data for papers

Add structured metadata (JSON-LD) for:

```json
{
  "@type": "ScholarlyArticle",
  "headline": "...",
  "author": [{ "@type": "Person", "name": "..." }],
  "datePublished": "...",
  "publisher": { "@type": "Organization", "name": "Hugging Face" }
}
```

**Impact**: better Google Scholar indexing, rich snippets, and interoperability with citation tools.

**Estimate**: 1-2 days.

---

#### 3.3.3 — Refactoring heavy components

Reduce technical debt in monolithic components:

| Component | Action | Benefit |
|-----------|--------|---------|
| TableOfContents (1,152 L) | Extract scroll logic into a hook, separate desktop/mobile | Maintainability, testability |
| HtmlEmbed (942 L) | Unify `desc`/`caption`, type `config`, add `skipGallery` to props | Cleaner API |
| Hero (665 L) | Extract AuthorList, AffiliationList, MetadataBar into sub-components | Easier customization |
| Image (626 L) | Remove `[key: string]: any`, separate BasicImage / ZoomableImage | Type safety |

**Estimate**: 2-3 weeks.

---

#### 3.3.4 — Multiple starter templates

Offer via the CLI several variants:

| Template | Content | Audience |
|----------|---------|----------|
| **Minimal** | 1 chapter, no embeds, simple hero | Researcher in a hurry |
| **Standard** | 3 chapters, 2-3 example embeds, citations | Classic paper |
| **Full** | Complete demo content, all embeds | Template exploration |
| **Blog** | Simplified layout, no citations, compact hero | Technical blog / tutorial |

**Estimate**: 1 week (if CLI already exists).

---

## 4. Success Metrics

### 4.1 Adoption

| Metric | H2 2026 Target | How to measure |
|--------|-----------------|----------------|
| HF Spaces duplications | +200% vs current | HF Analytics |
| npm downloads (CLI) | 500/month | npm stats |
| Stars GitHub/HF | +300% vs current | Platform stats |
| Articles published with the template | 20+ identifiable | Tag `research-article-template` |

### 4.2 Quality

| Metric | Target | How to measure |
|--------|--------|----------------|
| CI build success rate | > 98% | GitHub Actions |
| Lighthouse Accessibility | > 95 | Automated CI |
| PDF export success (smoke test) | 100% | Automated CI |
| Time to first article (new user) | < 5 minutes | User testing |

### 4.3 Community

| Metric | Target | How to measure |
|--------|--------|----------------|
| External contributors | 5+ | Git history |
| Active issues/discussions | 10+/month | HF Discussions |
| Community embeds | 10+ | Gallery contributions |

---

## 5. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Astro 5 breaking changes | Medium | High | Stay on stable Astro 4.x, plan migration Q3 |
| Playwright unstable in CI | Medium | Medium | Dedicated Docker image with pre-installed browsers |
| Low external contribution | High | Medium | AI skills that lower the barrier, gallery as entry point |
| Competition from AI one-shot tools | High | High | Bet on the ecosystem (gallery, sync, exports, CI) - what a one-shot cannot offer |
| Maintenance overload | Medium | Medium | Automated CI, component refactoring, strict conventions |

---

## 6. Long-term Vision

### Target positioning

> **Research Article Template** is not a template - it's the **open-source framework for interactive scientific writing**.

What sets it apart:

1. **AI-native**: complete skills, gallery as training set, machine-readable conventions
2. **Ecosystem**: CLI + gallery + sync + exports + CI - not just HTML
3. **HF-native**: one-click deployment, integration with Hugging Face's ML ecosystem
4. **Print-ready**: the only web template that also produces quality PDFs and LaTeX
5. **Community-driven**: contributions via the gallery, thematic starter templates

### Target user journey (August 2026)

```
1. npm create research-article my-paper     (2 min)
2. Open in Cursor, say "import my LaTeX"     (5 min)
3. Say "add a scatter plot with my data"     (30 sec)
4. Push to HF Spaces                         (1 min)
5. Co-author makes a PR → auto preview       (0 effort)
6. npm run sync:template when template evolves (30 sec)
```

**Total time: < 10 minutes from LaTeX to published interactive website.**

That's the standard to reach.

---

## 7. Summary Calendar

```
March 2026
├── CLI create-research-article (MVP)
├── Stabilize PDF/LaTeX/DOCX export
├── Accessibility quick wins
└── Document sync-template

April 2026
├── CLI: tests, npm publication
├── GitHub Actions (build + preview)
└── Full-text search (Pagefind)

May 2026
├── Embed gallery v1
├── 5 new AI skills
└── Schema.org structured data

June 2026
├── Gallery v2 (CSV upload, contributions)
├── Starter templates (minimal, standard, blog)
└── Begin heavy component refactoring

July 2026
├── Light collaboration (Hypothesis or custom)
├── Finish component refactoring
└── Complete documentation (guides, tutorials)

August 2026
├── Stabilization, bug fixes
├── User testing with 5-10 researchers
└── Communication: blog post, HF community
```

---

*Last updated: February 18, 2026*
