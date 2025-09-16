# 👥 Guide de Collaboration - Research Article Template

## 🚀 Démarrage rapide

### **Pour l'organisateur (host)**

1. **Créer un Codespace** :
   ```bash
   # Via GitHub web : bouton "Code" → "Codespaces" → "Create codespace"
   # Ou via CLI :
   gh codespace create --repo YOUR_USERNAME/research-article-template
   ```

2. **Lancer l'environnement collaboratif** :
   ```bash
   ./scripts/setup-collaboration.sh
   ```

3. **Démarrer Live Share** :
   - `Ctrl+Shift+P` → `Live Share: Start Collaborative Session`
   - Copier le lien généré et l'envoyer aux collaborateurs

### **Pour les collaborateurs (guests)**

1. **Rejoindre via le lien Live Share** :
   - Cliquer sur le lien reçu
   - Se connecter avec GitHub/Microsoft
   - VS Code s'ouvre automatiquement dans le navigateur

2. **Ou via VS Code local** :
   - Installer l'extension "Live Share"
   - `Ctrl+Shift+P` → `Live Share: Join Collaborative Session`
   - Coller le lien

## 🎯 Workflow collaboratif

### **Organisation des tâches**
```
📝 Rédaction:
├── Alice → chapters/introduction.mdx
├── Bob → chapters/methodology.mdx  
└── Carol → chapters/results.mdx

🎨 Visualisations:
├── David → embeds/d3-charts.html
└── Eve → src/content/assets/data/

📚 Références:
└── Frank → bibliography.bib
```

### **Bonnes pratiques**

✅ **Coordination** :
- Utiliser le chat intégré Live Share
- Annoncer sur quel fichier vous travaillez
- Faire des pauses pour synchroniser

✅ **Sauvegarde** :
- Auto-save activé par défaut
- Commits fréquents par l'host
- Branches pour les gros changements

✅ **Prévisualisation** :
- Serveur dev sur `localhost:3000`
- Rechargement automatique
- Build final avec `npm run build`

## 🔧 Commandes utiles

```bash
# Démarrer le serveur de dev
npm run dev

# Build pour production
npm run build

# Exporter en PDF
npm run export:pdf

# Exporter en LaTeX
npm run export:latex

# Voir la preview
npm run preview
```

## 🛠️ Résolution de problèmes

### **Live Share ne fonctionne pas ?**
```bash
# Redémarrer l'extension
Ctrl+Shift+P → "Developer: Reload Window"

# Vérifier la connexion
Ctrl+Shift+P → "Live Share: Show Session Details"
```

### **Serveur Astro planté ?**
```bash
# Redémarrer le serveur
Ctrl+C  # Arrêter
npm run dev  # Relancer
```

### **Conflits Git ?**
```bash
# L'host gère les commits
git status
git add .
git commit -m "Collaboration session: [description]"
git push
```

## 📱 URLs importantes

- **Développement** : `http://localhost:3000`
- **Preview** : `http://localhost:8080` 
- **Repository** : `https://github.com/YOUR_USERNAME/research-article-template`
- **Live Space** : `https://huggingface.co/spaces/YOUR_USERNAME/research-template`

## 🎉 Après la session

1. **Host** : Commit et push les changements
2. **Tous** : Sync avec `git pull`
3. **Deploy** : Push vers HF Space pour mise à jour

---

**💡 Astuce** : Gardez le chat Live Share ouvert pour la coordination en temps réel !
