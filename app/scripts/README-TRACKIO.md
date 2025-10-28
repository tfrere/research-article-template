# Intégration Trackio 🤗

Ce dossier contient les scripts pour intégrer [Trackio](https://huggingface.co/docs/trackio) dans votre article de recherche, permettant de logger et visualiser vos métriques d'entraînement et d'évaluation.

## 🚀 Installation

```bash
pip install trackio
```

## 📁 Fichiers disponibles

- `trackio-logger.py` - Script complet pour logger toutes les données
- `simple-trackio-logger.py` - Script simple pour les données de perte
- `demo-trackio.py` - Script de démonstration
- `trackio-config.json` - Configuration des projets Trackio

## 🎯 Utilisation rapide

### 1. Logging simple de données de perte

```bash
# Avec votre space_id
python simple-trackio-logger.py --space-id "tfrere/loss-experiment"

# Avec vos propres données
python simple-trackio-logger.py --space-id "tfrere/loss-experiment" --data-file "mon_fichier_loss.csv"
```

### 2. Logging complet des données de l'article

```bash
# Logger toutes les données
python trackio-logger.py --space-id "tfrere/loss-experiment"

# Logger seulement les métriques de baseline
python trackio-logger.py --space-id "tfrere/loss-experiment" --skip-vision --skip-model

# Logger avec un nom de projet personnalisé
python trackio-logger.py --project "mon-article" --space-id "tfrere/loss-experiment"
```

### 3. Démonstration

```bash
python demo-trackio.py
```

## 📊 Types de données supportées

### Métriques de baseline (`against_baselines.csv`)
- **Métriques**: `ai2d_exact_match`, `average`, `chartqa_relaxed_overall`, `docvqa_val_anls`, etc.
- **Structure**: `run`, `step`, `metric`, `value`, `stderr`
- **Visualisation**: Courbes d'évolution des métriques par run et par étape

### Métriques de vision (`vision.csv`)
- **Métriques**: `total_images`, `total_samples`, `total_turns`, `question_tokens`, `answer_tokens`
- **Structure**: `subset_name`, `eagle_cathegory`
- **Visualisation**: Comparaison des subsets de données

### Métriques du modèle (`mnist-variant-model.json`)
- **Métriques**: Configuration d'entraînement, architecture, optimiseur
- **Structure**: Configuration Keras/TensorFlow
- **Visualisation**: Paramètres du modèle

## 🔧 Configuration

Modifiez `trackio-config.json` pour personnaliser :

```json
{
  "projects": {
    "baseline_metrics": {
      "name": "research-article-baseline",
      "description": "Métriques de baseline pour l'article de recherche",
      "data_file": "against_baselines.csv"
    }
  },
  "default_space_id": "tfrere/loss-experiment",
  "data_directory": "dist/data"
}
```

## 📈 Exemples de visualisations

### Données de perte
```python
import trackio
trackio.init(project="loss-experiment", space_id="tfrere/loss-experiment")

for i in range(100):
    trackio.log({
        "step": i,
        "loss": 1/(i+1),
        "accuracy": 1 - 1/(i+1)
    })

trackio.finish()
```

### Métriques d'évaluation
```python
import trackio
import pandas as pd

df = pd.read_csv("dist/data/against_baselines.csv")
trackio.init(project="evaluation", space_id="tfrere/loss-experiment")

for _, row in df.iterrows():
    trackio.log({
        "step": row['step'],
        "metric": row['metric'],
        "value": row['value'],
        "run": row['run']
    })

trackio.finish()
```

## 🎨 Intégration dans l'article

### 1. Ajouter un composant Trackio dans l'article

Créez un composant Astro pour afficher le dashboard :

```astro
---
// components/TrackioDashboard.astro
---

<div class="trackio-dashboard">
  <iframe 
    src="https://huggingface.co/spaces/tfrere/loss-experiment" 
    width="100%" 
    height="600px"
    frameborder="0">
  </iframe>
</div>
```

### 2. Utiliser dans un chapitre

```mdx
import TrackioDashboard from '../components/TrackioDashboard.astro'

## Résultats d'entraînement

<TrackioDashboard />
```

## 🚨 Dépannage

### Erreur d'authentification
```bash
# Vérifiez que vous êtes connecté à Hugging Face
huggingface-cli login
```

### Erreur de space_id
```bash
# Vérifiez que l'espace existe
# Format: "username/space-name"
python simple-trackio-logger.py --space-id "votre-username/votre-space"
```

### Données non trouvées
```bash
# Vérifiez le chemin des données
python trackio-logger.py --data-dir "chemin/vers/vos/donnees"
```

## 📚 Ressources

- [Documentation Trackio](https://huggingface.co/docs/trackio)
- [Hugging Face Spaces](https://huggingface.co/spaces)
- [Exemples Trackio](https://huggingface.co/docs/trackio/en/examples)

## 🤝 Contribution

Pour ajouter de nouveaux types de données :

1. Modifiez `trackio-logger.py` pour ajouter une nouvelle fonction de logging
2. Ajoutez la configuration dans `trackio-config.json`
3. Testez avec `demo-trackio.py`
4. Mettez à jour ce README

---

**Note**: Assurez-vous d'avoir les permissions appropriées sur l'espace Hugging Face avant de logger des données.
