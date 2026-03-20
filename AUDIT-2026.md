# Research Article Template — Full Audit

> Technical audit — February 18, 2026
> Goal: exhaustive inventory of everything that can be cleaned up, fixed, or removed.

---

## Table of Contents

1. [Package.json — scripts and dependencies](#1-packagejson)
2. [Components — bugs, dead code, inconsistencies](#2-components)
3. [Scripts — issues by file](#3-scripts)
4. [CSS Styles — orphan rules and duplicates](#4-css-styles)
5. [Content — broken imports, orphan files](#5-content)
6. [HTML Embeds — orphans](#6-html-embeds)
7. [Data Assets — orphans](#7-data-assets)
8. [Plugins — orphans](#8-plugins)
9. [Miscellaneous files](#9-miscellaneous-files)
10. [Actionable summary](#10-summary)

---

## 1. Package.json

### Scripts pointing to non-existent files

| npm Script | Expected file | Exists? |
|------------|---------------|---------|
| `export:txt` | `./scripts/export-txt.mjs` | No |
| `export:docx` | `./scripts/export-docx.mjs` | No |
| `export:images` | `./scripts/screenshot-elements.mjs` | No |
| `export:bundle` | `./scripts/export-bundle.mjs` | No |

**Action**: remove these 4 entries from `package.json`, or create the scripts.

### Unused dependencies

| Package | In | Reason |
|---------|----|--------|
| `remark-toc` | devDependencies | Not referenced in `astro.config.mjs` |
| `rehype-pretty-code` | devDependencies | Not used (Shiki built into Astro) |
| `looks-same` | dependencies | No reference found in the code |
| `fonteditor-core` | dependencies | No reference found outside typography embeds (which are standalone scripts) |
| `opentype.js` | dependencies | Same |
| `stream-browserify` | dependencies | No reference found |
| `buffer` | dependencies | No reference found |

**Action**: verify each dependency, uninstall those not in use.

### Missing dependency

| Package | Required by | Situation |
|---------|-------------|-----------|
| `pagedjs` | `export-pdf-book.mjs` | Missing from `package.json`, only present as a transitive dependency. The script will crash if the transitive dependency disappears. |

**Action**: add `pagedjs` as an explicit dependency.

---

## 2. Components

### Bugs

| Component | Line | Issue |
|-----------|------|-------|
| **Stack.astro** | L59 | `{id}` is rendered as text instead of being an HTML attribute. Should be `id={id}`. |

### Dead code

| Component | Line | Dead code |
|-----------|------|-----------|
| **Stack.astro** | L21-52 | `getFlexProperties()` and `flexProps` defined but never used (the component uses grid, not flex). |
| **Note.astro** | L19 | `hasHeader` computed but never used. |
| **HtmlEmbed.astro** | L132-134 | `snapdomModule` (import `@zumer/snapdom`) is preloaded but never used. |

### Forgotten console.log

| Component | Line | Log |
|-----------|------|-----|
| **Hero.astro** | L305 | `console.log("[PDF Access]", { plan, isPro });` |

### Commented-out code

| Component | Line | Comment |
|-----------|------|---------|
| **Hero.astro** | L181-186 | Entirely commented-out DOI block (`<!-- {doi && (...)} -->`). |

### Unused props

| Component | Props | Issue |
|-----------|-------|-------|
| **Glossary.astro** | `position`, `delay` | Passed as `data-*` attributes but the JS script completely ignores them. The tooltip is always positioned at the mouse with no delay. |

### Naming inconsistencies

| Location | Name | Expected |
|----------|------|----------|
| **TableOfContents.astro** prop | `tableOfContentAutoCollapse` | `tableOfContentsAutoCollapse` (with an "s", as in the frontmatter) |

### Hardcoded colors (outside design system)

| Component | Line | Colors |
|-----------|------|--------|
| **HtmlEmbed.astro** | L531-554 | Errors displayed in `#fef2f2`, `#dc2626` (light) and `#1f2937`, `#ef4444` (dark) instead of using `--danger-color` and CSS variables. |

### Duplication between components

| Pattern | Components | Description |
|---------|------------|-------------|
| Theme toggle | ThemeToggle.astro, TableOfContents.astro | Same toggle logic duplicated in the sidebar TOC. |
| Slugify | TableOfContents.astro (L78-84), Hero.astro (L81-90) | Two similar but not identical implementations. |
| Download button | Image.astro, HtmlEmbed.astro | Download logic duplicated. |

### Typo

| Component | Line | Error |
|-----------|------|-------|
| **demo/ColorPicker.astro** | L203 | `"Agressive Aqua"` → `"Aggressive Aqua"` |

### Hardcoded dev config

| Component | Line | Issue |
|-----------|------|-------|
| **Hero.astro** | L241 | `LOCAL_IS_PRO = true` hardcoded instead of being driven by an env variable. |

---

## 3. Scripts

### export-pdf.mjs (683 lines)

| Issue | Lines | Detail |
|-------|-------|--------|
| Incomplete `waitForD3` | 139-144 | Only checks `.d3-line` and `.d3-bar` while there are 26 embed types. The `injectSvgViewBoxes` selector (L178-191) uses `[class^="d3-"]` - `waitForD3` should do the same. |
| Duplicated SVG code | 364-418 + 465-518 | `isSmallSvg`, `lockSmallSvgSize`, `fixSvg` copy-pasted in 2 distinct `page.evaluate()` calls. |
| Empty `catch {}` | ~18 occurrences | Errors silently swallowed. At minimum add `console.warn` in each. |
| `page.waitForTimeout` | L161, 425, 462, 530 | Discouraged by Playwright (not deprecated but bad practice). |
| Fragile preview shutdown | L655-673 | 6 nested try/catch blocks, risk of zombie process on port 8080. |

### export-latex.mjs (359 lines)

| Issue | Lines | Detail |
|-------|-------|--------|
| Hand-rolled YAML parsing | 57-116 | Doesn't handle arrays, nested objects, quoted strings with `:`. The actual frontmatter uses all of these. |
| Broken `\author{}` mapping | 239 | Receives raw YAML instead of formatted author names. |
| Single-pass `pdflatex` | 340 | Only one `pdflatex` run - cross-references and TOC will be incomplete. |
| No `pdflatex` check | 337-342 | Checks for Pandoc but not `pdflatex` when `--pdf` is passed. |

### export-pdf-book.mjs

| Issue | Detail |
|-------|--------|
| `pagedjs` not declared | Implicit dependency (transitive only). |
| Accordions not opened | Unlike `export-pdf-book-simple.mjs`, accordions stay closed → missing content in the PDF. |

### sync-template.mjs

| Issue | Detail |
|-------|--------|
| French messages | Inconsistent with the rest of the project (English). |
| `mergeSection('scripts')` | Returns `{ added, updated }` but these arrays are never populated - only dependencies are merged. |

### latex-importer/latex-converter.mjs

| Issue | Detail |
|-------|--------|
| `main()` executed on import | The `main()` / `--help` block at the bottom of the file runs even when the file is imported as a module by `index.mjs`. |
| Obsolete reference | Help text mentions `scripts/simple-latex-to-markdown.mjs` which doesn't exist. |

### latex-importer/mdx-converter.mjs

| Issue | Detail |
|-------|--------|
| Hardcoded path | `cleanSrcPath` contains a regex with `/Users/.../` - will only work on the developer's machine. |

### notion-importer/index.mjs

| Issue | Detail |
|-------|--------|
| `cleanDirectory(ASTRO_ASSETS_PATH)` | Deletes all images in `assets/image` before import - manually added images are lost. |

---

## 4. CSS Styles

### Undefined CSS variables being used

| Variable | Used in | Defined in `_variables.css`? |
|----------|---------|------------------------------|
| `--neutral-50` | `dataviz.astro` (L572) | No |
| `--neutral-900` | `dataviz.astro` (L580) | No |

**Action**: add these variables or use existing ones (`--neutral-200`, `--neutral-300`, etc.).

### Defined but likely unused CSS variables

| Variable | Defined | Used? |
|----------|---------|-------|
| `--danger-color` | `_variables.css` L22 | To verify (HtmlEmbed hardcodes its own error colors) |
| `--success-color` | `_variables.css` L23 | To verify |
| `--info-color` | `_variables.css` L24 | To verify |
| `--palette-count` | `_variables.css` L67 | To verify |
| `--transparent-page-contrast` | `_variables.css` | To verify |

### Duplicated CSS rules

| File | Lines | Issue |
|------|-------|-------|
| `_print.css` | 85-86 | `.html-embed__card` appears twice in the same selector. |
| `_table.css` | 20-24 | `.content-grid main thead th` defined 3 times. |

### Selectors with no matching component

| File | Lines | Selector |
|------|-------|----------|
| `_form.css` | 241-243 | `.scale-controls label`, `.theme-selector label` - no component uses these classes. |

### Suspicious CSS syntax

| File | Line | Issue |
|------|------|-------|
| `_print-book.css` | 749 | `content: "" ";` - misescaped quote, should be `content: "\201C";` |
| `_print-book.css` | 862 | `.toc { page: toc }` but no `@page toc` defined. |
| `_base.css` | 44, 66, 150 | Space before `;`: `transparent) ;` |
| `_code.css` | 313 | Empty rule `.code-output {}` |

---

## 5. Content

### article.mdx

| Issue | Line | Detail |
|-------|------|--------|
| Unused import | L29 | `AvailableBlocks` imported from `markdown.mdx` but never used (duplicate of `Markdown` L31). |
| Typo in filename | L27 | `best-pratices.mdx` - missing a "c" (`best-practices`). |

### Chapters

| File | Issue |
|------|-------|
| `components.mdx` L107 | Code example with broken path: `'./assets/image/placeholder.jpg'` (should be `'../../assets/image/placeholder.png'`). |
| `components.mdx` L596 | Example references `internal-debug.html` which doesn't exist. |
| `markdown.mdx` L456 | Audio example with incorrect relative path. |
| `chapters/your-first-chapter.mdx` | Template file not imported (intentional - it's a starter for the user). |
| `chapters/demo/debug-components.mdx` | Not imported in `article.mdx` (likely intentional). |

### bibliography.bib

| Issue | Line | Detail |
|-------|------|--------|
| Malformatted author | L3-4 | `{␊               }Lukasz` - the name "Lukasz" is split with a closing brace glued to it. May break some BibTeX parsers. |

---

## 6. HTML Embeds — Orphans

These embeds exist in `content/embeds/` but are not referenced in any `.mdx` file:

| Embed | Status |
|-------|--------|
| `rope-demo.html` | Orphan |
| `d3-pie.html` | Orphan |
| `d3-pie-quad.html` | Orphan |
| `d3-line-quad.html` | Orphan |
| `d3-scatter.html` | Orphan |
| `d3-matrix.html` | Orphan |
| `d3-confusion-matrix.html` | Orphan |
| `d3-benchmark.html` | Orphan |
| `d3-bar.html` | Orphan |
| `smol-playbook/model-architecture-decision-flowchart.html` | Orphan |

**Note**: these embeds are part of the demo catalog. If a `/dataviz` or `/gallery` page exists, they may be intentionally kept. Otherwise, they should be in a separate `examples/` folder or documented.

---

## 7. Data Assets — Orphans

These files exist in `content/assets/data/` but are not referenced by any embed or chapter:

| File | Status |
|------|--------|
| `no-wd_evals.csv` | Orphan |
| `no_wd_comparison.csv` | Orphan |
| `zloss_evals.csv` | Orphan |
| `zloss_comparison.csv` | Orphan |
| `nope_loss.csv` | Orphan |
| `nope_evals.csv` | Orphan |
| `tied-embeddings_evals.csv` | Orphan |
| `doc-masking_loss.csv` | Orphan |
| `doc-masking_evals.csv` | Orphan |
| `root-seq-write-heatmaps.json` | Orphan |
| `visual_dependency_filters.csv` | Orphan |
| `ss_vs_s1.csv` | Orphan |
| `s25_ratings.csv` | Orphan |
| `remove_ch.csv` | Orphan |
| `internal_deduplication.csv` | Orphan |
| `image_correspondence_filters.csv` | Orphan |
| `llm_benchmarks.json` | Orphan |
| `banner_visualisation_data_enriched.csv` | Orphan |
| `all_ratings_luis.csv` | Orphan |
| `against_baselines_deduplicated.csv` | Orphan |
| `against_baselines.csv` | Orphan |
| `against_baselines copy.csv` | Orphan (+ space in filename) |
| `font_manifest.json` | Orphan |
| `font-sprite-mapping.json` | Orphan |
| `font-sprite.svg` | Orphan |

Also in `assets/sprites/`:

| File | Status |
|------|--------|
| `font-sprite.svg` | Orphan |

**Note**: most of these files are remnants from the smol-training-playbook. They bloat the repo (especially with Git LFS) for no reason.

---

## 8. Plugins — Orphans

| File | Status |
|------|--------|
| `plugins/remark/outputs-container.mjs` | Orphan - not referenced in `astro.config.mjs`. Only `output-container.mjs` is used. |

Also in `public/scripts/`:

| File | Status |
|------|--------|
| `mermaid-zoom-optimized.js` | Orphan - pages load `mermaid-zoom.js`, not this version. |

---

## 9. Miscellaneous Files

| File | Status | Action |
|------|--------|--------|
| `public/test-book.pdf` | Likely orphan | Verify if useful, otherwise delete |
| `notion-importer/output/*.mdx` | Notion import output (6400+ lines) | Normal for the workflow, but heavy in the repo |
| `scripts/EXPORT-PDF-BOOK.md` | Documentation | Duplicate of `README-PDF-BOOK.md`? |
| `embeds-export.zip` | Project root | Likely an export artifact, delete |
| `rephrasing_metadata.json` | Project root (1627 lines) | Processing artifact, delete |

---

## 10. Actionable Summary

### Bugs to fix (functional impact)

| # | File | Action |
|---|------|--------|
| 1 | `Stack.astro` L59 | Change `{id}` to `id={id}` |
| 2 | `export-latex.mjs` L57-116 | Replace YAML parsing with `js-yaml` |
| 3 | `export-latex.mjs` L239 | Map `frontmatter.authors[].name` in `\author{}` |
| 4 | `bibliography.bib` L3-4 | Fix author formatting for Vaswani |
| 5 | `_print-book.css` L749 | Fix `content: "" ";` |
| 6 | `dataviz.astro` | Add `--neutral-50` and `--neutral-900` to `_variables.css` |

### Dead code to remove

| # | File | Action |
|---|------|--------|
| 7 | `package.json` | Remove the 4 ghost scripts |
| 8 | `Stack.astro` L21-52 | Remove `getFlexProperties()` and `flexProps` |
| 9 | `Note.astro` L19 | Remove `hasHeader` |
| 10 | `HtmlEmbed.astro` L132-134 | Remove the unused snapdom preload |
| 11 | `Hero.astro` L305 | Remove the `console.log` |
| 12 | `Hero.astro` L181-186 | Remove or restore the commented-out DOI block |
| 13 | `article.mdx` L29 | Remove the `AvailableBlocks` import |
| 14 | `plugins/remark/outputs-container.mjs` | Delete the file |
| 15 | `public/scripts/mermaid-zoom-optimized.js` | Delete the file |

### Orphan files to delete or move

| # | Category | Count | Action |
|---|----------|-------|--------|
| 16 | Unreferenced HTML embeds | 10 | Keep if gallery planned, otherwise document or delete |
| 17 | Orphan data files | 25+ | Delete (smol-training-playbook remnants) |
| 18 | `font-sprite.svg` (x2) | 2 | Delete |
| 19 | `against_baselines copy.csv` | 1 | Delete (duplicate with space in filename) |
| 20 | `embeds-export.zip` | 1 | Delete from root |
| 21 | `rephrasing_metadata.json` | 1 | Delete from root |
| 22 | `public/test-book.pdf` | 1 | Verify then delete |

### npm dependencies to clean up

| # | Action |
|---|--------|
| 23 | Uninstall `remark-toc`, `rehype-pretty-code` |
| 24 | Verify and potentially uninstall `looks-same`, `fonteditor-core`, `opentype.js`, `stream-browserify`, `buffer` |
| 25 | Explicitly add `pagedjs` |

### Quality improvements (non-blocking)

| # | File | Action |
|---|------|--------|
| 26 | `export-pdf.mjs` L139-144 | Broaden `waitForD3` with `[class^="d3-"]` |
| 27 | `export-pdf.mjs` L364-518 | Extract duplicated SVG code into a function |
| 28 | `export-pdf.mjs` | Replace empty `catch {}` with `catch(e) { console.warn(e) }` |
| 29 | `sync-template.mjs` | Switch messages to English |
| 30 | `TableOfContents.astro` | Rename prop to `tableOfContentsAutoCollapse` |
| 31 | `Glossary.astro` | Implement `position`/`delay` or remove them from the interface |
| 32 | `HtmlEmbed.astro` L531-554 | Use `--danger-color` instead of hardcoded colors |
| 33 | `best-pratices.mdx` | Rename to `best-practices.mdx` (+ update the import) |
| 34 | Shared utils | Extract `slugify()` and `toggleTheme()` into shared utilities |
| 35 | `_form.css` L241-243 | Remove `.scale-controls`, `.theme-selector` selectors |

---

### Estimate by priority

| Priority | Items | Estimated time |
|----------|-------|----------------|
| **P0 — Bugs** | #1-6 | 2-3 hours |
| **P1 — Dead code** | #7-15 | 1-2 hours |
| **P2 — Orphans** | #16-22 | 1 hour (mostly `rm` commands) |
| **P3 — Dependencies** | #23-25 | 30 minutes |
| **P4 — Quality** | #26-35 | 1-2 days |

**Total cleanup: ~1-2 days for P0-P3, ~1 week including P4.**

---

*Generated on February 18, 2026*
