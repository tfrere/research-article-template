#!/bin/bash
# Script de démarrage rapide pour Trackio

echo "🚀 Démarrage rapide Trackio"
echo "=========================="

# Vérifier si Python est installé
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 n'est pas installé"
    exit 1
fi

# Vérifier si pip est installé
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 n'est pas installé"
    exit 1
fi

# Installer les dépendances
echo "📦 Installation des dépendances..."
pip3 install -r requirements-trackio.txt

# Demander le space_id
echo ""
echo "🌐 Entrez votre Space ID Hugging Face (ex: tfrere/loss-experiment):"
read -p "Space ID: " SPACE_ID

if [ -z "$SPACE_ID" ]; then
    echo "⚠️ Aucun Space ID fourni, utilisation de l'exemple par défaut"
    SPACE_ID="tfrere/loss-experiment"
fi

echo ""
echo "🎯 Choisissez une option:"
echo "1) Test simple avec données générées"
echo "2) Test avec les données de baseline"
echo "3) Démonstration complète"
echo "4) Logging personnalisé"
echo ""
read -p "Votre choix (1-4): " CHOICE

case $CHOICE in
    1)
        echo "🧪 Lancement du test simple..."
        python3 simple-trackio-logger.py --space-id "$SPACE_ID"
        ;;
    2)
        echo "🧪 Lancement du test baseline..."
        python3 trackio-logger.py --space-id "$SPACE_ID" --skip-vision --skip-model
        ;;
    3)
        echo "🎭 Lancement de la démonstration..."
        python3 demo-trackio.py
        ;;
    4)
        echo "📊 Lancement du logging complet..."
        python3 trackio-logger.py --space-id "$SPACE_ID"
        ;;
    *)
        echo "❌ Choix invalide"
        exit 1
        ;;
esac

echo ""
echo "✅ Terminé! Consultez votre dashboard Trackio:"
echo "🔗 https://huggingface.co/spaces/$SPACE_ID"
