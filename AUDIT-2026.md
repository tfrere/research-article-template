# Research Article Template — Audit complet

> Audit technique — 18 février 2026
> Objectif : inventaire exhaustif de tout ce qui peut être nettoyé, corrigé, ou supprimé.

---

## Table des matières

1. [Package.json — scripts et dépendances](#1-packagejson)
2. [Composants — bugs, dead code, incohérences](#2-composants)
3. [Scripts — problèmes par fichier](#3-scripts)
4. [Styles CSS — règles orphelines et doublons](#4-styles-css)
5. [Contenu — imports cassés, fichiers orphelins](#5-contenu)
6. [Embeds HTML — orphelins](#6-embeds-html)
7. [Assets data — orphelins](#7-assets-data)
8. [Plugins — orphelins](#8-plugins)
9. [Fichiers divers](#9-fichiers-divers)
10. [Résumé actionable](#10-résumé)

---

## 1. Package.json

### Scripts pointant vers des fichiers inexistants

| Script npm | Fichier attendu | Existe ? |
|------------|-----------------|----------|
| `export:txt` | `./scripts/export-txt.mjs` | Non |
| `export:docx` | `./scripts/export-docx.mjs` | Non |
| `export:images` | `./scripts/screenshot-elements.mjs` | Non |
| `export:bundle` | `./scripts/export-bundle.mjs` | Non |

**Action** : supprimer ces 4 entrées de `package.json`, ou créer les scripts.

### Dépendances inutilisées

| Package | Dans | Raison |
|---------|------|--------|
| `remark-toc` | devDependencies | Non référencé dans `astro.config.mjs` |
| `rehype-pretty-code` | devDependencies | Non utilisé (Shiki intégré à Astro) |
| `looks-same` | dependencies | Aucune référence trouvée dans le code |
| `fonteditor-core` | dependencies | Aucune référence trouvée hors embeds typography (qui sont des scripts standalone) |
| `opentype.js` | dependencies | Idem |
| `stream-browserify` | dependencies | Aucune référence trouvée |
| `buffer` | dependencies | Aucune référence trouvée |

**Action** : vérifier chaque dépendance, désinstaller celles non utilisées.

### Dépendance manquante

| Package | Requis par | Situation |
|---------|-----------|-----------|
| `pagedjs` | `export-pdf-book.mjs` | Absent de `package.json`, présent seulement comme dépendance transitive. Le script crashera si la dépendance transitive disparaît. |

**Action** : ajouter `pagedjs` comme dépendance explicite.

---

## 2. Composants

### Bugs

| Composant | Ligne | Problème |
|-----------|-------|----------|
| **Stack.astro** | L59 | `{id}` est rendu comme texte au lieu d'être un attribut HTML. Devrait être `id={id}`. |

### Dead code

| Composant | Ligne | Code mort |
|-----------|-------|-----------|
| **Stack.astro** | L21-52 | `getFlexProperties()` et `flexProps` définis mais jamais utilisés (le composant utilise grid, pas flex). |
| **Note.astro** | L19 | `hasHeader` calculé mais jamais utilisé. |
| **HtmlEmbed.astro** | L132-134 | `snapdomModule` (import `@zumer/snapdom`) est chargé en preload mais jamais utilisé. |

### Console.log oublié

| Composant | Ligne | Log |
|-----------|-------|-----|
| **Hero.astro** | L305 | `console.log("[PDF Access]", { plan, isPro });` |

### Code commenté

| Composant | Ligne | Commentaire |
|-----------|-------|-------------|
| **Hero.astro** | L181-186 | Bloc DOI entièrement commenté (`<!-- {doi && (...)} -->`). |

### Props inutilisées

| Composant | Props | Problème |
|-----------|-------|----------|
| **Glossary.astro** | `position`, `delay` | Passées en `data-*` attributes mais le script JS les ignore complètement. Le tooltip est toujours positionné à la souris sans délai. |

### Incohérences de nommage

| Lieu | Nom | Attendu |
|------|-----|---------|
| **TableOfContents.astro** prop | `tableOfContentAutoCollapse` | `tableOfContentsAutoCollapse` (avec un "s", comme dans le frontmatter) |

### Couleurs hardcodées (hors design system)

| Composant | Ligne | Couleurs |
|-----------|-------|----------|
| **HtmlEmbed.astro** | L531-554 | Erreurs affichées en `#fef2f2`, `#dc2626` (light) et `#1f2937`, `#ef4444` (dark) au lieu d'utiliser `--danger-color` et les variables CSS. |

### Duplication entre composants

| Pattern | Composants | Description |
|---------|-----------|-------------|
| Theme toggle | ThemeToggle.astro, TableOfContents.astro | Même logique de toggle dupliquée dans la sidebar TOC. |
| Slugify | TableOfContents.astro (L78-84), Hero.astro (L81-90) | Deux implémentations similaires mais pas identiques. |
| Download button | Image.astro, HtmlEmbed.astro | Logique de téléchargement dupliquée. |

### Typo

| Composant | Ligne | Erreur |
|-----------|-------|--------|
| **demo/ColorPicker.astro** | L203 | `"Agressive Aqua"` → `"Aggressive Aqua"` |

### Config dev en dur

| Composant | Ligne | Problème |
|-----------|-------|----------|
| **Hero.astro** | L241 | `LOCAL_IS_PRO = true` hardcodé au lieu d'être piloté par une variable d'env. |

---

## 3. Scripts

### export-pdf.mjs (683 lignes)

| Problème | Lignes | Détail |
|----------|--------|--------|
| `waitForD3` incomplet | 139-144 | Ne vérifie que `.d3-line` et `.d3-bar` alors qu'il y a 26 types d'embeds. Le sélecteur `injectSvgViewBoxes` (L178-191) utilise `[class^="d3-"]` — `waitForD3` devrait faire pareil. |
| Code SVG dupliqué | 364-418 + 465-518 | `isSmallSvg`, `lockSmallSvgSize`, `fixSvg` copiés-collés dans 2 `page.evaluate()` distincts. |
| `catch {}` vides | ~18 occurrences | Erreurs avalées silencieusement. Au minimum un `console.warn` dans chaque. |
| `page.waitForTimeout` | L161, 425, 462, 530 | Déconseillé par Playwright (pas deprecated mais mauvaise pratique). |
| Shutdown preview fragile | L655-673 | 6 try/catch imbriqués, risque de process zombie sur port 8080. |

### export-latex.mjs (359 lignes)

| Problème | Lignes | Détail |
|----------|--------|--------|
| Parsing YAML artisanal | 57-116 | Ne gère pas les tableaux, objets imbriqués, strings quotées avec `:`. Le vrai frontmatter utilise tout ça. |
| Mapping `\author{}` cassé | 239 | Reçoit du YAML brut au lieu de noms d'auteurs formatés. |
| `pdflatex` mono-pass | 340 | Un seul run de `pdflatex` — les références croisées et la TOC seront incomplètes. |
| Pas de check `pdflatex` | 337-342 | Vérifie Pandoc mais pas `pdflatex` quand `--pdf` est passé. |

### export-pdf-book.mjs

| Problème | Détail |
|----------|--------|
| `pagedjs` non déclaré | Dépendance implicite (transitive seulement). |
| Accordéons non ouverts | Contrairement à `export-pdf-book-simple.mjs`, les accordéons restent fermés → contenu manquant dans le PDF. |

### sync-template.mjs

| Problème | Détail |
|----------|--------|
| Messages en français | Incohérent avec le reste du projet (anglais). |
| `mergeSection('scripts')` | Retourne `{ added, updated }` mais ces tableaux ne sont jamais peuplés — seules les dependencies sont mergées. |

### latex-importer/latex-converter.mjs

| Problème | Détail |
|----------|--------|
| `main()` exécuté à l'import | Le bloc `main()` / `--help` en bas du fichier s'exécute même quand le fichier est importé comme module par `index.mjs`. |
| Référence obsolète | Help text mentionne `scripts/simple-latex-to-markdown.mjs` qui n'existe pas. |

### latex-importer/mdx-converter.mjs

| Problème | Détail |
|----------|--------|
| Path hardcodé | `cleanSrcPath` contient un regex avec `/Users/.../` — ne fonctionnera que sur la machine du développeur. |

### notion-importer/index.mjs

| Problème | Détail |
|----------|--------|
| `cleanDirectory(ASTRO_ASSETS_PATH)` | Supprime toutes les images dans `assets/image` avant import — les images ajoutées manuellement sont perdues. |

---

## 4. Styles CSS

### Variables CSS non définies mais utilisées

| Variable | Utilisée dans | Définie dans `_variables.css` ? |
|----------|--------------|-------------------------------|
| `--neutral-50` | `dataviz.astro` (L572) | Non |
| `--neutral-900` | `dataviz.astro` (L580) | Non |

**Action** : ajouter ces variables ou utiliser celles qui existent (`--neutral-200`, `--neutral-300`, etc.).

### Variables CSS définies mais probablement inutilisées

| Variable | Définie | Utilisée ? |
|----------|---------|-----------|
| `--danger-color` | `_variables.css` L22 | À vérifier (HtmlEmbed hardcode ses propres couleurs d'erreur) |
| `--success-color` | `_variables.css` L23 | À vérifier |
| `--info-color` | `_variables.css` L24 | À vérifier |
| `--palette-count` | `_variables.css` L67 | À vérifier |
| `--transparent-page-contrast` | `_variables.css` | À vérifier |

### Règles CSS dupliquées

| Fichier | Lignes | Problème |
|---------|--------|----------|
| `_print.css` | 85-86 | `.html-embed__card` apparaît en double dans le même sélecteur. |
| `_table.css` | 20-24 | `.content-grid main thead th` défini 3 fois. |

### Sélecteurs sans composant correspondant

| Fichier | Lignes | Sélecteur |
|---------|--------|-----------|
| `_form.css` | 241-243 | `.scale-controls label`, `.theme-selector label` — aucun composant n'utilise ces classes. |

### Syntaxe CSS suspecte

| Fichier | Ligne | Problème |
|---------|-------|----------|
| `_print-book.css` | 749 | `content: "" ";` — guillemet mal échappé, devrait être `content: "\201C";` |
| `_print-book.css` | 862 | `.toc { page: toc }` mais pas de `@page toc` défini. |
| `_base.css` | 44, 66, 150 | Espace avant `;` : `transparent) ;` |
| `_code.css` | 313 | Règle vide `.code-output {}` |

---

## 5. Contenu

### article.mdx

| Problème | Ligne | Détail |
|----------|-------|--------|
| Import inutilisé | L29 | `AvailableBlocks` importé depuis `markdown.mdx` mais jamais utilisé (doublon avec `Markdown` L31). |
| Typo dans le nom de fichier | L27 | `best-pratices.mdx` — il manque un "c" (`best-practices`). |

### Chapitres

| Fichier | Problème |
|---------|----------|
| `components.mdx` L107 | Exemple de code avec path cassé : `'./assets/image/placeholder.jpg'` (devrait être `'../../assets/image/placeholder.png'`). |
| `components.mdx` L596 | Exemple référence `internal-debug.html` qui n'existe pas. |
| `markdown.mdx` L456 | Exemple audio avec mauvais path relatif. |
| `chapters/your-first-chapter.mdx` | Fichier template non importé (intentionnel — c'est un starter pour l'utilisateur). |
| `chapters/demo/debug-components.mdx` | Non importé dans `article.mdx` (probablement intentionnel). |

### bibliography.bib

| Problème | Ligne | Détail |
|----------|-------|--------|
| Auteur mal formaté | L3-4 | `{␊               }Lukasz` — le nom "Lukasz" est coupé avec une accolade fermante collée. Peut casser certains parsers BibTeX. |

---

## 6. Embeds HTML — orphelins

Ces embeds existent dans `content/embeds/` mais ne sont référencés dans aucun fichier `.mdx` :

| Embed | Taille |
|-------|--------|
| `rope-demo.html` | Orphelin |
| `d3-pie.html` | Orphelin |
| `d3-pie-quad.html` | Orphelin |
| `d3-line-quad.html` | Orphelin |
| `d3-scatter.html` | Orphelin |
| `d3-matrix.html` | Orphelin |
| `d3-confusion-matrix.html` | Orphelin |
| `d3-benchmark.html` | Orphelin |
| `d3-bar.html` | Orphelin |
| `smol-playbook/model-architecture-decision-flowchart.html` | Orphelin |

**Note** : ces embeds font partie du catalogue de démonstration. Si une gallery `/dataviz` ou `/gallery` existe, ils peuvent être conservés intentionnellement. Sinon, ils devraient être dans un dossier `examples/` séparé ou documentés.

---

## 7. Assets data — orphelins

Ces fichiers existent dans `content/assets/data/` mais ne sont référencés par aucun embed ni chapitre :

| Fichier | Statut |
|---------|--------|
| `no-wd_evals.csv` | Orphelin |
| `no_wd_comparison.csv` | Orphelin |
| `zloss_evals.csv` | Orphelin |
| `zloss_comparison.csv` | Orphelin |
| `nope_loss.csv` | Orphelin |
| `nope_evals.csv` | Orphelin |
| `tied-embeddings_evals.csv` | Orphelin |
| `doc-masking_loss.csv` | Orphelin |
| `doc-masking_evals.csv` | Orphelin |
| `root-seq-write-heatmaps.json` | Orphelin |
| `visual_dependency_filters.csv` | Orphelin |
| `ss_vs_s1.csv` | Orphelin |
| `s25_ratings.csv` | Orphelin |
| `remove_ch.csv` | Orphelin |
| `internal_deduplication.csv` | Orphelin |
| `image_correspondence_filters.csv` | Orphelin |
| `llm_benchmarks.json` | Orphelin |
| `banner_visualisation_data_enriched.csv` | Orphelin |
| `all_ratings_luis.csv` | Orphelin |
| `against_baselines_deduplicated.csv` | Orphelin |
| `against_baselines.csv` | Orphelin |
| `against_baselines copy.csv` | Orphelin (+ espace dans le nom) |
| `font_manifest.json` | Orphelin |
| `font-sprite-mapping.json` | Orphelin |
| `font-sprite.svg` | Orphelin |

Également dans `assets/sprites/` :

| Fichier | Statut |
|---------|--------|
| `font-sprite.svg` | Orphelin |

**Note** : la plupart de ces fichiers sont des vestiges du smol-training-playbook. Ils alourdissent le repo (surtout avec Git LFS) pour rien.

---

## 8. Plugins — orphelins

| Fichier | Statut |
|---------|--------|
| `plugins/remark/outputs-container.mjs` | Orphelin — non référencé dans `astro.config.mjs`. Seul `output-container.mjs` est utilisé. |

Également dans `public/scripts/` :

| Fichier | Statut |
|---------|--------|
| `mermaid-zoom-optimized.js` | Orphelin — les pages chargent `mermaid-zoom.js`, pas cette version. |

---

## 9. Fichiers divers

| Fichier | Statut | Action |
|---------|--------|--------|
| `public/test-book.pdf` | Probablement orphelin | Vérifier si utile, sinon supprimer |
| `notion-importer/output/*.mdx` | Sortie d'import Notion (6400+ lignes) | Normal pour le workflow, mais lourd dans le repo |
| `scripts/EXPORT-PDF-BOOK.md` | Documentation | Doublon avec `README-PDF-BOOK.md` ? |
| `embeds-export.zip` | Racine du projet | Probablement un artefact d'export, à supprimer |
| `rephrasing_metadata.json` | Racine du projet (1627 lignes) | Artefact de processing, à supprimer |

---

## 10. Résumé actionable

### Bugs à corriger (impact fonctionnel)

| # | Fichier | Action |
|---|---------|--------|
| 1 | `Stack.astro` L59 | Changer `{id}` en `id={id}` |
| 2 | `export-latex.mjs` L57-116 | Remplacer le parsing YAML par `js-yaml` |
| 3 | `export-latex.mjs` L239 | Mapper `frontmatter.authors[].name` dans `\author{}` |
| 4 | `bibliography.bib` L3-4 | Corriger le formatage de l'auteur Vaswani |
| 5 | `_print-book.css` L749 | Corriger `content: "" ";` |
| 6 | `dataviz.astro` | Ajouter `--neutral-50` et `--neutral-900` à `_variables.css` |

### Dead code à supprimer

| # | Fichier | Action |
|---|---------|--------|
| 7 | `package.json` | Supprimer les 4 scripts fantômes |
| 8 | `Stack.astro` L21-52 | Supprimer `getFlexProperties()` et `flexProps` |
| 9 | `Note.astro` L19 | Supprimer `hasHeader` |
| 10 | `HtmlEmbed.astro` L132-134 | Supprimer le preload snapdom inutilisé |
| 11 | `Hero.astro` L305 | Supprimer le `console.log` |
| 12 | `Hero.astro` L181-186 | Supprimer ou restaurer le bloc DOI commenté |
| 13 | `article.mdx` L29 | Supprimer l'import `AvailableBlocks` |
| 14 | `plugins/remark/outputs-container.mjs` | Supprimer le fichier |
| 15 | `public/scripts/mermaid-zoom-optimized.js` | Supprimer le fichier |

### Fichiers orphelins à supprimer ou déplacer

| # | Catégorie | Nombre | Action |
|---|-----------|--------|--------|
| 16 | Embeds HTML non référencés | 10 | Garder si gallery prévue, sinon documenter ou supprimer |
| 17 | Fichiers data orphelins | 25+ | Supprimer (vestiges smol-training-playbook) |
| 18 | `font-sprite.svg` (×2) | 2 | Supprimer |
| 19 | `against_baselines copy.csv` | 1 | Supprimer (doublon avec espace dans le nom) |
| 20 | `embeds-export.zip` | 1 | Supprimer de la racine |
| 21 | `rephrasing_metadata.json` | 1 | Supprimer de la racine |
| 22 | `public/test-book.pdf` | 1 | Vérifier puis supprimer |

### Dépendances npm à nettoyer

| # | Action |
|---|--------|
| 23 | Désinstaller `remark-toc`, `rehype-pretty-code` |
| 24 | Vérifier et potentiellement désinstaller `looks-same`, `fonteditor-core`, `opentype.js`, `stream-browserify`, `buffer` |
| 25 | Ajouter `pagedjs` explicitement |

### Améliorations de qualité (non bloquantes)

| # | Fichier | Action |
|---|---------|--------|
| 26 | `export-pdf.mjs` L139-144 | Élargir `waitForD3` avec `[class^="d3-"]` |
| 27 | `export-pdf.mjs` L364-518 | Extraire le code SVG dupliqué en fonction |
| 28 | `export-pdf.mjs` | Remplacer les `catch {}` vides par `catch(e) { console.warn(e) }` |
| 29 | `sync-template.mjs` | Passer les messages en anglais |
| 30 | `TableOfContents.astro` | Renommer la prop en `tableOfContentsAutoCollapse` |
| 31 | `Glossary.astro` | Implémenter `position`/`delay` ou les retirer de l'interface |
| 32 | `HtmlEmbed.astro` L531-554 | Utiliser `--danger-color` au lieu des couleurs hardcodées |
| 33 | `best-pratices.mdx` | Renommer en `best-practices.mdx` (+ mettre à jour l'import) |
| 34 | Shared utils | Extraire `slugify()` et `toggleTheme()` en utilitaires partagés |
| 35 | `_form.css` L241-243 | Supprimer les sélecteurs `.scale-controls`, `.theme-selector` |

---

### Estimation par priorité

| Priorité | Items | Temps estimé |
|----------|-------|-------------|
| **P0 — Bugs** | #1-6 | 2-3 heures |
| **P1 — Dead code** | #7-15 | 1-2 heures |
| **P2 — Orphelins** | #16-22 | 1 heure (principalement des `rm`) |
| **P3 — Dépendances** | #23-25 | 30 minutes |
| **P4 — Qualité** | #26-35 | 1-2 jours |

**Total nettoyage : ~1-2 jours pour P0-P3, ~1 semaine avec P4.**

---

*Généré le 18 février 2026*
