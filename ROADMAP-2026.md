# Research Article Template — Roadmap 2026

> Rapport stratégique — Février 2026
> Objectif : identifier les actions à fort impact sur l'adoption pour les 6 prochains mois.

---

## 1. État des lieux

### 1.1 Le projet aujourd'hui

| Métrique | Valeur |
|----------|--------|
| Première version | Oct 2025 (extrait de smol-training-playbook) |
| Commits totaux | ~310 |
| Composants Astro | 20 |
| Embeds HTML (D3) | 26 |
| Scripts utilitaires | 19 fichiers .mjs |
| CSS (styles) | ~3 000 lignes |
| Total LOC (hors deps) | ~48 600 lignes |
| Formats d'export | PDF (normal + book), LaTeX |
| Importeurs | LaTeX → MDX, Notion → MDX |

### 1.2 Stack technique

- **Astro 4.10** + MDX pour le contenu
- **D3.js v7** (CDN) pour les visualisations interactives
- **Svelte 4** pour les composants interactifs (Trackio)
- **CSS custom properties** pour le theming light/dark
- **Playwright** pour l'export PDF
- **Pandoc** pour l'export LaTeX
- **Docker + Nginx** pour le déploiement HF Spaces

### 1.3 Points forts actuels

- **Architecture embed solide** : les charts D3 sont auto-contenus, themés, responsifs, et documentés pour les agents AI via une skill Cursor de très haute qualité (~500 lignes de directives).
- **Export multi-format** : PDF (normal + book), LaTeX, DOCX, TXT — rare pour un template web.
- **Sync-template** : mise à jour du template sans écraser le contenu utilisateur — feature unique dans l'écosystème.
- **Theming CSS variables** : dark mode complet, palette dynamique via `ColorPalettes`.
- **Contenu scientifique complet** : citations BibTeX, KaTeX, footnotes, sidenotes, glossaire, mermaid diagrams.

### 1.4 Points faibles identifiés

- **Onboarding lourd** : il faut cloner, supprimer le contenu demo, comprendre la structure. Pas de CLI.
- **Zéro CI/CD** : pas de GitHub Actions, pas de preview deployments, pas de build check.
- **Scripts d'export incomplets** : 4 scripts référencés dans package.json n'existent pas (docx, txt, images, bundle), parsing YAML manuel dans l'export LaTeX produit du LaTeX invalide.
- **Pas de recherche** dans les articles longs — paradoxalement moins navigable qu'un PDF.
- **Accessibilité incomplète** : pas de skip link, pas de focus trap sidebar, `:focus` au lieu de `:focus-visible`.
- **Documentation du sync-template** absente — la killer feature est invisible.
- **Pas de gallery d'embeds** — les 26 charts sont enfouis dans le filesystem.
- **Skills AI limitées** à la création d'embeds — manque "créer un article", "ajouter un chapitre", "debug export".

### 1.5 Composants les plus lourds (dette technique potentielle)

| Composant | Lignes | Observation |
|-----------|--------|-------------|
| TableOfContents.astro | 1 152 | Logique scroll + collapse complexe, prop naming incohérent avec le frontmatter |
| HtmlEmbed.astro | 942 | API large (11 props), `desc`/`caption` redondants, `skipGallery` non typé |
| Hero.astro | 665 | Monolithique, difficile à customiser |
| Image.astro | 626 | `[key: string]: any` dans les props — trop permissif |
| Footer.astro | 436 | Citation + BibTeX + licence dans un seul composant |

---

## 2. Contexte 2026 : ce qui a changé

### 2.1 Le paysage AI en février 2026

Claude Opus 4.6, GPT-5, Gemini 2.5 — les agents de code sont capables de :
- Générer un site web interactif complet en 30 secondes
- Comprendre et suivre des conventions de code complexes via des fichiers de directives
- Orchestrer des pipelines multi-étapes (import → écriture → build → deploy)

**Conséquence directe** : le concurrent du template n'est plus Overleaf ou un autre template. C'est l'agent qui génère un one-shot. La valeur ajoutée doit être dans ce qu'un one-shot ne peut pas offrir : la structure, l'écosystème, la maintenance continue, et l'intégration HF Spaces.

### 2.2 Ce que les chercheurs attendent en 2026

1. **"Je veux publier mon paper, pas configurer un build system"** — le setup doit être < 2 minutes.
2. **"J'ai un paper LaTeX, convertis-le"** — l'import doit être un one-liner fiable.
3. **"Montre-moi mes données de façon interactive"** — les charts doivent être un catalogue, pas un exercice de code.
4. **"Mon co-auteur a poussé un chapitre, je veux voir le résultat"** — preview deployments.
5. **"L'AI peut écrire/adapter mes charts"** — les skills doivent couvrir tout le workflow.

---

## 3. Roadmap : Mars – Août 2026

### Phase 1 : Fondations (Mars – Avril)

> Objectif : réduire le friction d'onboarding et stabiliser les outils existants.

#### 3.1.1 — CLI `create-research-article`

**Priorité : P0 — Impact très élevé**

Créer un package npm `create-research-article` qui scaffold un projet propre :

```bash
npm create research-article my-paper
# ou
npx create-research-article my-paper
```

Flux interactif :
1. Titre du paper
2. Auteur(s) et affiliation(s)
3. Couleur primaire (preset ou hex)
4. Inclure les embeds d'exemple ? (oui/non)
5. Configurer pour HF Spaces ? (oui/non)

Résultat : un `app/` propre avec `article.mdx` pré-rempli, `bibliography.bib` vide, un chapitre starter "Introduction", et un `README.md` personnalisé.

**Référence** : `create-astro`, `create-next-app`, `create-vite`.

**Livrable** : package npm publié, documenté dans le README.

**Estimation** : 1-2 semaines.

---

#### 3.1.2 — Stabiliser les scripts d'export

**Priorité : P0 — Impact élevé**

Les exports sont souvent le premier test d'un nouvel utilisateur. Problèmes actuels :

| Script | Problème | Fix |
|--------|----------|-----|
| `package.json` | 4 scripts référencés n'existent pas (docx, txt, images, bundle) | Retirer les entrées ou créer les scripts |
| `export-pdf.mjs` | `waitForD3` ne couvre que `.d3-line` et `.d3-bar` (26 types d'embeds) | Utiliser le sélecteur générique `[class^="d3-"]` |
| `export-pdf.mjs` | Code SVG fix dupliqué (60 lignes copier-collées) | Extraire en fonction réutilisable |
| `export-pdf.mjs` | Nombreux `catch {}` vides — erreurs silencieuses | Ajouter au minimum un `console.warn` |
| `export-latex.mjs` | Parsing YAML frontmatter à la main, ne gère pas les tableaux/objets | Utiliser `js-yaml` |
| `export-latex.mjs` | Mapping `\author{}` cassé (reçoit du YAML brut au lieu d'un nom) | Mapper `author.name` après parsing correct |

**Livrable** : les 2 exporteurs (PDF, LaTeX) passent un smoke test sans erreur sur le contenu demo. Scripts fantômes retirés de package.json.

**Estimation** : 1 semaine.

---

#### 3.1.3 — Accessibilité : quick wins

**Priorité : P1 — Impact moyen, effort très faible**

- [ ] Ajouter un lien "Skip to main content" dans le layout principal
- [ ] Focus trap dans la sidebar mobile (quand ouverte, Tab reste dans la sidebar)
- [ ] Remplacer `:focus` par `:focus-visible` sur HtmlEmbed download, Glossary, et autres contrôles interactifs
- [ ] Ajouter `role="main"` sur le conteneur principal si absent
- [ ] Vérifier que Escape ferme bien tous les modals/overlays

**Livrable** : 0 erreur axe-core sur la page d'accueil.

**Estimation** : 1-2 jours.

---

#### 3.1.4 — Documenter `sync-template`

**Priorité : P1 — Impact moyen, effort très faible**

Ajouter dans le README une section dédiée :

```markdown
## Keeping your article up to date

This template includes a built-in sync mechanism:

npm run sync:template         # Interactive sync
npm run sync:template:dry     # Preview changes without applying
npm run sync:template:force   # Force update all template files

Sync preserves your content (article.mdx, chapters/, bibliography.bib, 
assets/data/) and updates only template infrastructure.
```

Documenter aussi dans `CONTRIBUTING.md` ce que sync-template touche vs préserve.

**Estimation** : 2-3 heures.

---

### Phase 2 : Écosystème (Mai – Juin)

> Objectif : transformer le template en plateforme.

#### 3.2.1 — Gallery d'embeds avec preview live

**Priorité : P0 — Impact élevé**

Créer une page `/gallery` (ou enrichir `/dataviz`) qui :

- Liste les 26 embeds existants avec preview live et description
- Montre le code MDX d'usage (copier en un clic)
- Filtre par type : bar, line, scatter, matrix, flowchart, custom
- Indique la complexité et les données requises
- Permet de tester avec ses propres données (upload CSV → preview)

**Pourquoi c'est stratégique** : cette gallery devient le point d'entrée pour les agents AI. Un chercheur dit "fais-moi un chart comme le scatter de la gallery mais avec mes données", l'agent AI lit la gallery, identifie le bon embed, copie et adapte. La gallery est un **training set implicite**.

**Livrable** : page `/gallery` navigable, avec au moins 15 embeds catégorisés.

**Estimation** : 2 semaines.

---

#### 3.2.2 — Skills AI complètes

**Priorité : P0 — Impact très élevé, effort faible**

Actuellement, seule la skill `create-html-embed` existe. Ajouter :

| Skill | Fichier | Cas d'usage |
|-------|---------|-------------|
| **Créer un article** | `.cursor/skills/create-article/SKILL.md` | Nouveau utilisateur qui veut démarrer from scratch |
| **Ajouter un chapitre** | `.cursor/skills/add-chapter/SKILL.md` | L'opération la plus fréquente |
| **Customiser le thème** | `.cursor/skills/customize-theme/SKILL.md` | Changer les couleurs, la typo, le layout |
| **Debug export** | `.cursor/skills/debug-export/SKILL.md` | PDF cassé, LaTeX qui plante — le pain point #1 |
| **Importer du contenu** | `.cursor/skills/import-content/SKILL.md` | LaTeX → MDX, Notion → MDX, Markdown → MDX |

Chaque skill doit contenir :
- Le workflow étape par étape
- Les fichiers à lire/modifier
- Les conventions à respecter
- Un checklist de validation
- Un prompt modèle pour l'agent

**Vision** : un chercheur ouvre le projet dans Cursor et dit "transforme mon paper ArXiv en article interactif". L'agent sait exactement quoi faire grâce aux skills.

**Livrable** : 5 nouvelles skills documentées.

**Estimation** : 3-5 jours.

---

#### 3.2.3 — Recherche plein texte (Pagefind)

**Priorité : P1 — Impact moyen, effort très faible**

Intégrer [Pagefind](https://pagefind.app/) — moteur de recherche statique qui s'intègre nativement avec Astro :

- Indexation au build time (pas de serveur)
- Recherche instantanée côté client
- ~50 Ko gzippé
- Fonctionne avec le contenu MDX, les embeds, les accordéons

**Pourquoi c'est important** : un article scientifique de 15 000 mots sans recherche est paradoxalement **moins navigable** qu'un PDF. C'est un frein réel à l'adoption par les lecteurs.

**Livrable** : composant `Search` intégré dans le header ou la TOC.

**Estimation** : 1-2 jours.

---

#### 3.2.4 — GitHub Actions : build + preview

**Priorité : P1 — Impact élevé, effort faible**

Mettre en place un pipeline CI minimal :

```yaml
# .github/workflows/ci.yml
- Build check sur chaque PR
- Export PDF smoke test
- Lint MDX (frontmatter valide, imports résolus)
- Preview deployment (Vercel/Netlify/Cloudflare Pages)
```

**Pourquoi** : les équipes de recherche (2-5 personnes) ont besoin de preview pour collaborer. Sans CI, un co-auteur peut casser le build sans que personne ne le sache.

**Livrable** : workflow GitHub Actions fonctionnel + badge dans le README.

**Estimation** : 2-3 jours.

---

### Phase 3 : Différenciation (Juillet – Août)

> Objectif : créer un fossé avec les alternatives.

#### 3.3.1 — Mode "Collaboration Light"

Intégrer un système d'annotations/commentaires léger :

- **Option 1** : [Hypothesis](https://web.hypothes.is/) — intégration en une ligne de script, annotations publiques
- **Option 2** : Commentaires inline custom (stockés en JSON, visibles en mode review)
- **Option 3** : Intégration HF Discussions comme backend de commentaires

**Pourquoi** : la collaboration est le #1 feature request implicite des chercheurs. Git est le workflow de développeurs, pas de scientifiques.

**Estimation** : 1-2 semaines selon l'option.

---

#### 3.3.2 — Schema.org / Structured Data pour papers

Ajouter des métadonnées structurées (JSON-LD) pour :

```json
{
  "@type": "ScholarlyArticle",
  "headline": "...",
  "author": [{ "@type": "Person", "name": "..." }],
  "datePublished": "...",
  "publisher": { "@type": "Organization", "name": "Hugging Face" }
}
```

**Impact** : meilleur référencement Google Scholar, rich snippets, et interopérabilité avec les outils de citation.

**Estimation** : 1-2 jours.

---

#### 3.3.3 — Refactoring des composants lourds

Réduire la dette technique des composants monolithiques :

| Composant | Action | Bénéfice |
|-----------|--------|----------|
| TableOfContents (1 152 L) | Extraire la logique scroll dans un hook, séparer desktop/mobile | Maintenabilité, testabilité |
| HtmlEmbed (942 L) | Unifier `desc`/`caption`, typer `config`, ajouter `skipGallery` aux props | API plus claire |
| Hero (665 L) | Extraire AuthorList, AffiliationList, MetadataBar en sous-composants | Customisation plus facile |
| Image (626 L) | Retirer `[key: string]: any`, séparer BasicImage / ZoomableImage | Sécurité des types |

**Estimation** : 2-3 semaines.

---

#### 3.3.4 — Starter templates multiples

Proposer via le CLI plusieurs variantes :

| Template | Contenu | Public |
|----------|---------|--------|
| **Minimal** | 1 chapitre, pas d'embeds, hero simple | Chercheur pressé |
| **Standard** | 3 chapitres, 2-3 embeds d'exemple, citations | Paper classique |
| **Full** | Contenu demo complet, tous les embeds | Exploration du template |
| **Blog** | Layout simplifié, pas de citations, hero compact | Blog technique / tutoriel |

**Estimation** : 1 semaine (si le CLI existe déjà).

---

## 4. Métriques de succès

### 4.1 Adoption

| Métrique | Objectif H2 2026 | Comment mesurer |
|----------|-------------------|-----------------|
| Duplications HF Spaces | +200% vs actuel | Analytics HF |
| npm downloads (CLI) | 500/mois | npm stats |
| Stars GitHub/HF | +300% vs actuel | Platform stats |
| Articles publiés avec le template | 20+ identifiables | Tag `research-article-template` |

### 4.2 Qualité

| Métrique | Objectif | Comment mesurer |
|----------|----------|-----------------|
| Build success rate CI | > 98% | GitHub Actions |
| Lighthouse Accessibility | > 95 | CI automatisé |
| Export PDF success (smoke test) | 100% | CI automatisé |
| Time to first article (nouveau user) | < 5 minutes | User testing |

### 4.3 Communauté

| Métrique | Objectif | Comment mesurer |
|----------|----------|-----------------|
| Contributeurs externes | 5+ | Git history |
| Issues/discussions actives | 10+/mois | HF Discussions |
| Embeds communautaires | 10+ | Gallery contributions |

---

## 5. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Astro 5 breaking changes | Moyenne | Élevé | Rester sur Astro 4.x stable, prévoir migration Q3 |
| Playwright instable en CI | Moyenne | Moyen | Docker image dédiée avec browsers pré-installés |
| Faible contribution externe | Élevée | Moyen | Skills AI qui abaissent la barrière, gallery comme point d'entrée |
| Concurrence des outils AI one-shot | Élevée | Élevé | Miser sur l'écosystème (gallery, sync, exports, CI) — ce qu'un one-shot ne peut pas offrir |
| Surcharge de maintenance | Moyenne | Moyen | CI automatisée, refactoring composants, conventions strictes |

---

## 6. Vision long terme

### Le positionnement cible

> **Research Article Template** n'est pas un template — c'est le **framework open-source pour l'écriture scientifique interactive**.

Ce qui le différencie :

1. **AI-native** : skills complètes, gallery comme training set, conventions machine-readable
2. **Écosystème** : CLI + gallery + sync + exports + CI — pas juste du HTML
3. **HF-native** : déploiement en un clic, intégration avec l'écosystème ML de Hugging Face
4. **Print-ready** : le seul template web qui produit aussi des PDFs et du LaTeX de qualité
5. **Community-driven** : contributions via la gallery, starter templates thématiques

### Le parcours utilisateur cible (août 2026)

```
1. npm create research-article my-paper     (2 min)
2. Ouvre dans Cursor, dit "importe mon LaTeX"   (5 min)
3. Dit "ajoute un scatter plot avec mes données" (30 sec)
4. Pousse sur HF Spaces                          (1 min)
5. Co-auteur fait une PR → preview auto           (0 effort)
6. npm run sync:template quand le template évolue (30 sec)
```

**Temps total : < 10 minutes du LaTeX au site web interactif publié.**

C'est ça le standard à atteindre.

---

## 7. Calendrier synthétique

```
Mars 2026
├── CLI create-research-article (MVP)
├── Stabiliser export PDF/LaTeX/DOCX
├── Quick wins accessibilité
└── Documenter sync-template

Avril 2026
├── CLI : tests, publication npm
├── GitHub Actions (build + preview)
└── Recherche plein texte (Pagefind)

Mai 2026
├── Gallery d'embeds v1
├── 5 nouvelles skills AI
└── Schema.org structured data

Juin 2026
├── Gallery v2 (upload CSV, contributions)
├── Starter templates (minimal, standard, blog)
└── Début refactoring composants lourds

Juillet 2026
├── Collaboration light (Hypothesis ou custom)
├── Fin refactoring composants
└── Documentation complète (guides, tutoriels)

Août 2026
├── Stabilisation, bug fixes
├── User testing avec 5-10 chercheurs
└── Communication : blog post, HF community
```

---

*Dernière mise à jour : 18 février 2026*
