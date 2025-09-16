#!/bin/bash

# 🚀 Script de setup pour collaboration GitHub Codespaces
# Usage: ./scripts/setup-collaboration.sh

echo "🔧 Configuration de l'environnement collaboratif..."

# Aller dans le dossier app
cd app

# Installer les dépendances si pas déjà fait
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

# Démarrer le serveur de développement en arrière-plan
echo "🌟 Démarrage du serveur Astro..."
npm run dev -- --host 0.0.0.0 --port 3000 &
DEV_PID=$!

# Attendre que le serveur démarre
sleep 5

echo "✅ Configuration terminée !"
echo ""
echo "🎯 URLs disponibles :"
echo "   • Développement: http://localhost:3000"
echo "   • Preview: http://localhost:8080"
echo ""
echo "👥 Pour collaborer :"
echo "   1. Ouvrez la palette de commandes (Ctrl+Shift+P)"
echo "   2. Tapez 'Live Share: Start Collaborative Session'"
echo "   3. Partagez le lien généré avec vos collaborateurs"
echo ""
echo "📝 Fichiers principaux à éditer :"
echo "   • src/content/article.mdx"
echo "   • src/content/chapters/*.mdx"
echo "   • src/content/bibliography.bib"
echo ""
echo "🔄 Le serveur se recharge automatiquement à chaque modification !"

# Garder le script en vie pour maintenir le serveur
wait $DEV_PID
