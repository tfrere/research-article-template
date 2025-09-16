# Convertisseur LaTeX vers Markdown

Conversion robuste de projets LaTeX complexes vers Markdown/MDX pour Astro.

## 🚀 Usage rapide

```bash
# Conversion standard
node scripts/latex-converter/index.mjs

# Avec nettoyage du dossier de sortie
node scripts/latex-converter/index.mjs --clean

# Chemins personnalisés
node scripts/latex-converter/index.mjs \
  --input=../tools/latex-to-markdown/input \
  --output=src/content \
  --clean
```

## 📁 Architecture

```
scripts/latex-converter/
├── index.mjs              # Point d'entrée principal
├── config.mjs             # Configuration et mappings
├── preprocessor.mjs       # Préprocesseur LaTeX
├── bibliography-cleaner.mjs # Nettoyeur de bibliographie
├── converter.mjs          # Convertisseur principal
└── README.md             # Documentation
```

## 🔧 Fonctionnalités

### ✅ Ce qui est géré
- **412+ commandes personnalisées** (math, text, projet-spécifique)
- **Environnements custom** (`tldr`, `callout`, `finding`)
- **41 figures** avec organisation par chapitre
- **2247 entrées bibliographiques** avec nettoyage automatique
- **Citations** et références croisées
- **Structure MDX** compatible Astro

### 🛠️ Transformations automatiques

#### Commandes LaTeX → Markdown
```latex
\lerobot          → **LeRobot**
\lerobotdataset   → `LeRobotDataset`
\huggingface      → 🤗 **Hugging Face**
\eg               → e.g.,
\X                → \mathcal{X}
```

#### Environnements → Callouts
```latex
\begin{tldr}
Content here
\end{tldr}
```
→
```markdown
> **TL;DR**
> Content here
```

#### Bibliographie
- `{{Title}}` → `Title` (suppression doubles accolades)
- `\&` → `&` (déséchappement)
- Nettoyage général du formatting

## 📊 Statistiques exemple

```
⏱️  Time: 1.02s
📄 Files: 9 sections converties
🖼️  Figures: 41 images copiées
📚 Citations: Detection automatique
🔧 Commands replaced: 34 transformations
📦 Environments processed: 4 environnements
📚 Bibliography: 159 entries, 403 fixes
```

## 🎯 Résultat

Structure finale dans `src/content/`:
```
src/content/
├── article.mdx           # Article principal avec imports
├── bibliography.bib     # Bibliographie nettoyée
├── chapters/            # Sections converties
│   ├── 00_abstract.mdx
│   ├── 01_introduction.mdx
│   └── ...
└── assets/image/        # Figures organisées
    ├── ch1/
    ├── ch2/
    └── ...
```

## ⚠️ Prérequis

- **Pandoc** installé (`brew install pandoc`)
- Node.js avec support ESM

## 🔍 Debugging

Les warnings sont normaux pour les sections avec math complexe non supporté par Pandoc. Le convertisseur continue et produit un résultat utilisable.
