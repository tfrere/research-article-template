#!/usr/bin/env python3
"""
Script pour créer un projet avec seulement la métrique loss
Pas de tokens, pas de step, juste loss
"""

import trackio
import pandas as pd
import sys
from pathlib import Path

def log_attention_loss_only():
    """Log attention_loss avec seulement la métrique loss"""
    print("🚀 Logging attention_loss avec SEULEMENT la métrique loss...")
    
    # Chemin vers le fichier de données
    data_file = Path("src/content/assets/data/attention_loss.csv")
    
    if not data_file.exists():
        print(f"❌ Fichier non trouvé: {data_file}")
        return False
    
    try:
        # Charger les données
        df = pd.read_csv(data_file)
        print(f"📁 Données chargées: {len(df)} lignes")
        
        # Obtenir les runs uniques
        runs = df['run_name'].unique()
        print(f"🔍 Runs à créer ({len(runs)}):")
        for run in runs:
            count = len(df[df['run_name'] == run])
            print(f'  - "{run}": {count} points')
        
        # Logger chaque run dans le MÊME projet
        for i, run_name in enumerate(runs):
            print(f"\n🌐 Création du run: \"{run_name}\"")
            
            # Utiliser un projet spécifique pour loss seulement
            project_name = "attention-loss-only"
            
            # Initialiser Trackio avec le même projet
            trackio.init(
                project=project_name, 
                space_id="tfrere/loss-experiment",
                name=run_name,
                resume="allow"
            )
            
            # Filtrer les données pour ce run
            run_data = df[df['run_name'] == run_name]
            print(f"📊 Logging de {len(run_data)} points pour \"{run_name}\"...")
            print(f"🔧 Projet utilisé: {project_name}")
            
            # Logger SEULEMENT la métrique loss
            for j, (_, row) in enumerate(run_data.iterrows()):
                trackio.log({
                    "loss": float(row['loss'])
                    # Pas de tokens, pas de step, juste loss
                })
                
                if j % 100 == 0:
                    print(f"  ✅ Étape {j}: loss={row['loss']:.4f}")
            
            # Finaliser ce run
            trackio.finish()
            print(f"✅ Run \"{run_name}\" terminé!")
        
        print(f"\n🎉 Projet loss-only créé!")
        print(f"📊 {len(runs)} runs loggés avec SEULEMENT la métrique loss")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du logging: {e}")
        return False

def main():
    print("🎯 Création d'un projet avec SEULEMENT la métrique loss")
    print("=" * 60)
    print("🔄 Pas de tokens, pas de step, juste loss")
    print("=" * 60)
    
    # Logger avec seulement loss
    success = log_attention_loss_only()
    
    print("\n📊 Résultat:")
    if success:
        print("✅ Projet loss-only créé!")
        print("📊 Consultez votre dashboard Trackio: https://huggingface.co/spaces/tfrere/loss-experiment")
        print("🔍 Projet: attention-loss-only")
        print("📈 Un seul graphique: loss vs step")
    else:
        print("❌ Échec du logging")
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())
