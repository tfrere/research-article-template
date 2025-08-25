## Migration vers Astro (Markdown/MDX) – Spécification et guide

### Objectif
- Remplacer le template Distill par une pile moderne basée sur Markdown/MDX avec Astro, tout en conservant: front‑matter, maths, code, citations/bibliographie, table des matières, figures, sections de contenu, et composants interactifs (plots/tables).
- Offrir une optimisation d’images de premier ordre (AVIF/WebP, `srcset`, lazy‑loading) et un déploiement statique via Nginx.

### Stack cible
- Astro 4+ (SSG, sortie statique `dist/`)
- Markdown/MDX (contenu principal)
- Intégrations/Plugins:
  - `@astrojs/mdx` (MDX)
  - `remark-math` + `rehype-katex` (maths)
  - `rehype-slug` + `rehype-autolink-headings` (ancres H2/H3/H4)
  - `remark-toc` (table des matières auto)
  - `rehype-citation` (citations/bibliographie depuis BibTeX/CSL)
  - `@astrojs/image` avec `SquooshImageService` (optimisation d’images sans dépendances natives)
  - Surlignage code: Shiki par défaut d’Astro (fences ```lang)

### Mapping Distill → Astro
- `d-front-matter` → YAML front‑matter en tête de fichier `.md/.mdx` (titre, auteurs, dates, cover/hero, tags…)
- `d-title` → en‑tête de page dans un layout Astro (`src/layouts/BlogLayout.astro`) utilisant les métadonnées
- `d-byline` → bloc auteurs/affiliations dans le layout
- `d-article` → contenu Markdown principal
- `d-figure` → `<Image />` Astro (optimisé) + `<figure>/<figcaption>` sémantique
- `d-toc` → `remark-toc` + `rehype-slug/autolink` (TOC ancré)
- `d-footnote`/`d-footnote-list` → notes de bas de page Markdown standard
- `d-math` → Math Markdown via `remark-math`/`rehype-katex` (`$...$`, `$$...$$`)
- `d-code` (Prism) → fences Markdown + Shiki
- `d-cite`/`d-bibliography` → `rehype-citation` (génération des références + liens), section `## References` en bas

### Arborescence proposée
```
astro-site/
  src/
    assets/                  # images sources (ex: banner.png)
    content/
      bibliography.bib
      posts/
        finetasks.mdx        # migration de index.html → Markdown/MDX
    components/
      TOC.astro              # (optionnel) wrapper visuel autour du TOC
      PlotlyChart.jsx        # composant interactif (client:visible)
    layouts/
      BlogLayout.astro
  public/                    # assets statiques bruts si besoin
  astro.config.mjs
  package.json
```

### Configuration Astro (plugins)
```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import image from '@astrojs/image';
import { SquooshImageService } from '@astrojs/image/squoosh';

// Remark/Rehype
import remarkMath from 'remark-math';
import remarkToc from 'remark-toc';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeCitation from 'rehype-citation';

export default defineConfig({
  integrations: [
    mdx(),
    image({ serviceEntryPoint: SquooshImageService() })
  ],
  markdown: {
    remarkPlugins: [
      [remarkToc, { heading: 'Table of contents', maxDepth: 3 }],
      remarkMath,
    ],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
      rehypeKatex,
      // Génère les citations et la biblio (insertion en bas si "## References" existe)
      [rehypeCitation, {
        bibliography: 'src/content/bibliography.bib',
        linkCitations: true,
        // CSL optionnel: csl: 'src/content/ieee.csl'
      }],
    ],
    shikiConfig: { theme: 'github-dark' },
  },
  build: {
    assets: 'assets',
  },
  output: 'static'
});
```

Ajouter les styles KaTeX (dans `src/layouts/BlogLayout.astro` ou global CSS):
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous" />
```

### Layout principal
```astro
---
// src/layouts/BlogLayout.astro
const { title, description, authors = [], published, hero } = Astro.props;
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
  </head>
  <body>
    <header class="page-hero">
      {hero && <img src={hero} alt={title} loading="eager" fetchpriority="high" />}
      <h1>{title}</h1>
      {published && <p class="byline">{published}</p>}
      {authors.length > 0 && (
        <p class="authors">{authors.map(a => a.name || a).join(', ')}</p>
      )}
    </header>
    <main>
      <slot />
    </main>
  </body>
  <style>
    .page-hero img{width:100%;height:auto;}
    main{max-width:980px;margin:0 auto;padding:24px}
  </style>
</html>
```

### Exemple de page MDX (migration de `index.html`)
```mdx
---
layout: ../layouts/BlogLayout.astro
title: "Scaling FineWeb to 1000+ languages: Step 1: finding signal in 100s of evaluation tasks"
description: "Multilingual evaluation & FineTasks"
published: "Oct 23, 2024"
authors:
  - name: "Hynek Kydlíček"
  - name: "Guilherme Penedo"
  - name: "Clémentine Fourier"
  - name: "Nathan Habib"
  - name: "Thomas Wolf"
hero: "../assets/images/banner.png"
---

## Table of contents

<!-- Le TOC sera injecté ici par remark-toc -->

![FineTasks](../assets/images/banner.png)

Du texte… équations $e^{i\pi}+1=0$ et un bloc:

$$
\int_a^b f(x)\,dx
$$

Citation: [@kydlicek2024finetasksmultilingualtasks].

## Results

<PlotlyChart client:visible dataUrl="/data/..." />

## References
```

### Composants interactifs (exemples)
- Plotly (client‑side, hydraté quand visible):
```jsx
// src/components/PlotlyChart.jsx
import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-basic-dist-min';

export default function PlotlyChart({ data, layout, config }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    Plotly.newPlot(ref.current, data || [], layout || {}, config || {responsive:true});
    return () => { Plotly.purge(ref.current); };
  }, [data, layout, config]);
  return <div ref={ref} style={{width:'100%'}} />;
}
```

- DataTables: préférer générer des tables Markdown; pour un tableau interactif, créer un composant MDX dédié et l’hydrater `client:visible`.

### Optimisation d’images (Astro)
- Utiliser `@astrojs/image` (Squoosh) ou `astro:assets` pour images locales.
- Exemple responsive (MDX):
```astro
---
import { Image } from '@astrojs/image/components';
import banner from '../assets/images/banner.png';
---
<Image src={banner} alt="FineTasks" widths={[480,768,1080,1440]} formats={["avif","webp","png"]} sizes="(max-width: 768px) 100vw, 980px" loading="lazy" decoding="async" />
```
- Bonnes pratiques: dimensions explicites `width/height` (automatiques avec `Image`), `loading="lazy"` hors hero, `fetchpriority="high"` sur le hero.

### Citations et bibliographie
- Placer `src/content/bibliography.bib` (copie de `app/src/bibliography.bib`).
- Citer en Markdown: `[@clé]` ou `[-@clé]`. Ajouter `## References` à la fin; `rehype-citation` génère la bibliographie.

### Commandes/installation
```bash
npm create astro@latest astro-site -- --template minimal
cd astro-site
npm i -D @astrojs/mdx @astrojs/image remark-math rehype-katex rehype-slug rehype-autolink-headings remark-toc rehype-citation
npm run dev
# build
npm run build
```

### Dockerfile (multi‑stage)
```Dockerfile
FROM node:20 AS build
WORKDIR /site
COPY astro-site/package*.json ./
RUN npm ci
COPY astro-site/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /site/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 8080
CMD ["nginx","-g","daemon off;"]
```

### Nginx (statique, cache + SPA fallback)
```nginx
worker_processes auto;
events { worker_connections 1024; }
http {
  include /etc/nginx/mime.types;
  server {
    listen 8080;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location /assets/ {
      expires 30d;
      add_header Cache-Control "public, max-age=2592000, immutable";
    }
    location / {
      try_files $uri $uri/ /index.html;
    }
    location = /health { return 200 "ok"; add_header Content-Type text/plain; }
  }
}
```

### Étapes de migration depuis ce dépôt
1) Créer `astro-site/` et installer la stack (ci‑dessus).  
2) Copier `app/src/bibliography.bib` → `astro-site/src/content/bibliography.bib`.  
3) Copier les images `app/assets/images/*` → `astro-site/src/assets/images/*`.  
4) Convertir `app/src/index.html` → `astro-site/src/content/posts/finetasks.mdx` (reprendre sections H2/H3/H4, figures, équations, et remplacer les blocs Distill par Markdown/MDX).  
5) Recréer les applets (plots/tables) via composants MDX (`PlotlyChart.jsx`, etc.).  
6) Ajuster le layout (`BlogLayout.astro`) pour le titre, auteurs, date, hero.  
7) Ajouter TOC, maths, citations (plugins configurés).  
8) Vérifier le build (`npm run build`) et brancher le Docker/Nginx proposés.  

### Notes
- Pour éviter des dépendances natives (Sharp) en build Docker, on force le service image Squoosh (WASM).  
- Si besoin de SEO/sitemap/RSS, ajouter `@astrojs/sitemap`/`@astrojs/rss`.
- Les composants interactifs doivent être idempotents et hydratés avec `client:visible`/`client:idle`.


