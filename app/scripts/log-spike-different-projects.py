#!/usr/bin/env python3
"""
Script pour créer des runs séparés avec des projets différents
Approche alternative pour éviter l'écrasement des runs
"""

import trackio
import pandas as pd
import sys
from pathlib import Path

def log_spike_loss_different_projects():
    """Log spike_loss avec des projets différents pour chaque run"""
    print("🚀 Logging spike_loss avec projets différents...")
    
    # Chemin vers le fichier de données
    data_file = Path("src/content/assets/data/spike_loss.csv")
    
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
        
        # Logger chaque run avec un projet différent
        for i, run_name in enumerate(runs):
            print(f"\n🌐 Création du run: \"{run_name}\"")
            
            # Créer un nom de projet unique pour chaque run
            project_name = f"spike-loss-{i+1}-{run_name.lower().replace(' ', '-')}"
            
            # Initialiser Trackio avec un projet différent
            trackio.init(
                project=project_name, 
                space_id="tfrere/loss-experiment",
                name=run_name,
                resume="never"  # Forcer la création d'un nouveau run
            )
            
            # Filtrer les données pour ce run
            run_data = df[df['run_name'] == run_name]
            print(f"📊 Logging de {len(run_data)} points pour \"{run_name}\"...")
            print(f"🔧 Projet utilisé: {project_name}")
            
            # Logger les données de ce run
            for j, (_, row) in enumerate(run_data.iterrows()):
                trackio.log({
                    "tokens": float(row['tokens']),
                    "loss": float(row['loss']),
                    "step": j
                })
                
                if j % 100 == 0:
                    print(f"  ✅ Étape {j}: tokens={row['tokens']:.0f}, loss={row['loss']:.4f}")
            
            # Finaliser ce run
            trackio.finish()
            print(f"✅ Run \"{run_name}\" terminé!")
        
        print(f"\n🎉 Tous les runs créés avec succès!")
        print(f"📊 {len(runs)} runs séparés loggés avec projets différents")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du logging: {e}")
        return False

def main():
    print("🎯 Création de runs avec PROJETS DIFFÉRENTS")
    print("=" * 50)
    print("🔄 Un projet par run pour éviter l'écrasement")
    print("=" * 50)
    
    # Logger avec des projets différents
    success = log_spike_loss_different_projects()
    
    print("\n📊 Résultat:")
    if success:
        print("✅ Runs créés avec projets différents!")
        print("📊 Consultez votre dashboard Trackio: https://huggingface.co/spaces/tfrere/loss-experiment")
        print("🔍 Vous devriez voir 2 runs séparés:")
        print('   - "Non recoverable spikes"')
        print('   - "Recoverable spikes"')
        print("📈 Chaque run devrait avoir sa propre courbe!")
    else:
        print("❌ Échec du logging")
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())
