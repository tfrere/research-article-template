# 📖 Guide d'importation depuis Notion

Ce guide explique comment configurer l'importation automatique depuis Notion lors du build de votre Space HuggingFace.

## 🎯 Principe de fonctionnement

Lors du build Docker sur HuggingFace Spaces, si les variables d'environnement sont configurées :
1. Le script va chercher votre page Notion
2. Extrait automatiquement le titre et génère le slug
3. Convertit le contenu en MDX
4. Build l'application avec le nouveau contenu

**Avantage :** Vous modifiez votre article dans Notion, puis vous cliquez sur "Factory Reboot" dans HF Spaces → le site est automatiquement mis à jour !

## ⚙️ Configuration sur HuggingFace Spaces

### 1. Créer une intégration Notion

1. Allez sur https://www.notion.so/my-integrations
2. Cliquez sur "New integration"
3. Donnez un nom (ex: "HF Article Importer")
4. Sélectionnez votre workspace
5. Cliquez sur "Submit"
6. **Copiez le token** (format: `secret_xxxxx...`)

### 2. Partager votre page Notion avec l'intégration

1. Ouvrez votre page Notion
2. Cliquez sur "Share" (en haut à droite)
3. Cliquez sur "Invite"
4. Recherchez le nom de votre intégration
5. Sélectionnez-la et donnez la permission "Can read content"
6. Cliquez sur "Invite"

### 3. Récupérer l'ID de votre page Notion

L'ID se trouve dans l'URL de votre page :
```
https://www.notion.so/Mon-Article-27877f1c9c9d804d9c82f7b3905578ff
                                └─────────────────┬─────────────────┘
                                           C'est cet ID !
```

Exemple : `27877f1c9c9d804d9c82f7b3905578ff`

### 4. Configurer les variables d'environnement sur HF Spaces

1. Allez dans les Settings de votre Space
2. Section "Repository secrets"
3. Ajoutez ces 3 variables :

| Variable | Valeur | Secret ? |
|----------|--------|----------|
| `ENABLE_NOTION_IMPORT` | `true` | Non |
| `NOTION_TOKEN` | `secret_xxx...` | **Oui** ✅ |
| `NOTION_PAGE_ID` | `27877f1c...` | Non |

**Important :** Cochez la case "Secret" pour `NOTION_TOKEN` uniquement !

### 5. Rebuild votre Space

1. Allez dans l'onglet "Settings"
2. Cliquez sur "Factory reboot"
3. Attendez le rebuild (~5-10 minutes)
4. Votre article Notion est maintenant publié ! 🎉

## 🔄 Workflow de mise à jour

```
┌─────────────────────────┐
│ 1. Éditez dans Notion   │
│    (brouillon privé)    │
└───────────┬─────────────┘
            │
            ↓
┌─────────────────────────┐
│ 2. Vérifiez le contenu  │
│    (preview Notion)     │
└───────────┬─────────────┘
            │
            ↓
┌─────────────────────────┐
│ 3. HF Spaces →          │
│    "Factory Reboot"     │
└───────────┬─────────────┘
            │
            ↓
┌─────────────────────────┐
│ 4. Attendez 5-10 min    │
│    (build Docker)       │
└───────────┬─────────────┘
            │
            ↓
┌─────────────────────────┐
│ 5. Site mis à jour ! ✅ │
│    (zéro downtime)      │
└─────────────────────────┘
```

## 🧪 Test en local

Avant de publier, vous pouvez tester en local :

```bash
# 1. Créer un fichier .env dans app/scripts/notion-importer/
cd app/scripts/notion-importer
cp env.example .env

# 2. Éditer .env avec vos credentials
# NOTION_TOKEN=secret_xxx
# NOTION_PAGE_ID=abc123

# 3. Installer les dépendances
npm install

# 4. Lancer l'import
node index.mjs

# 5. Le contenu est copié dans app/src/content/article.mdx
# Les images dans app/src/content/assets/image/

# 6. Lancer le serveur de dev Astro
cd ../..  # Retour à app/
npm run dev

# 7. Ouvrir http://localhost:4321
```

## 📋 Fonctionnalités supportées

### ✅ Supporté automatiquement
- Texte formaté (gras, italique, code inline)
- Titres (h1, h2, h3, etc.)
- Listes (ordonnées, non-ordonnées)
- Images (téléchargées et converties)
- Liens externes
- Blocs de code avec syntaxe
- Callouts → Composant `Note`
- Tables → Composant stylisé
- Citations
- Équations LaTeX (inline et bloc)

### ⚠️ Conversion manuelle requise
- Bases de données Notion → Créer en MDX
- Toggles → Utiliser `Accordion`
- Embeds complexes → Utiliser `HtmlEmbed`
- Graphiques → Utiliser `Trackio` ou d3.js

## 🔧 Désactiver l'import Notion

Pour revenir à l'édition manuelle du MDX :

1. HF Spaces → Settings → Repository secrets
2. Changez `ENABLE_NOTION_IMPORT` à `false`
3. Ou supprimez les variables d'env

Le site continuera de fonctionner avec le dernier contenu importé.

## 🆘 Dépannage

### Erreur "❌ NOTION_TOKEN not found"
→ Vérifiez que vous avez bien créé la variable `NOTION_TOKEN` dans les secrets HF

### Erreur "❌ Could not find Notion page"
→ Vérifiez que vous avez bien partagé la page avec votre intégration Notion

### L'import ne se lance pas au build
→ Vérifiez que `ENABLE_NOTION_IMPORT=true` (sans guillemets)

### Le build échoue pendant l'import
→ Regardez les logs du build dans HF Spaces pour voir l'erreur exacte

## 💡 Conseils

1. **Testez en local d'abord** : Évitez les surprises en prod
2. **Structure claire** : Utilisez bien les titres h1, h2, h3 dans Notion
3. **Images optimisées** : Les images sont téléchargées et intégrées
4. **Commits Git** : Pour un vrai versioning, committez aussi les MDX générés
5. **Brouillons** : Gardez des pages privées pour vos brouillons Notion

## 📚 Pour aller plus loin

- [Documentation Notion API](https://developers.notion.com/)
- [Documentation HuggingFace Spaces](https://huggingface.co/docs/hub/spaces)
- [README du Notion Importer](./app/scripts/notion-importer/README.md)

