#!/usr/bin/env python3
"""
Script pour créer des runs séparés dans Trackio
Un run par type de spike avec le bon nom
"""

import trackio
import pandas as pd
import sys
from pathlib import Path

def log_spike_loss_separate_runs():
    """Log spike_loss en créant des runs séparés"""
    print("🚀 Logging spike_loss avec runs séparés...")
    
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
        
        # Logger chaque run séparément
        for run_name in runs:
            print(f"\n🌐 Création du run: \"{run_name}\"")
            
            # Initialiser Trackio avec le nom du run
            trackio.init(
                project="spike-loss-separate", 
                space_id="tfrere/loss-experiment",
                name=run_name  # Utiliser le nom exact du CSV
            )
            
            # Filtrer les données pour ce run
            run_data = df[df['run_name'] == run_name]
            print(f"📊 Logging de {len(run_data)} points pour \"{run_name}\"...")
            
            # Logger les données de ce run
            for i, (_, row) in enumerate(run_data.iterrows()):
                trackio.log({
                    "tokens": float(row['tokens']),
                    "loss": float(row['loss']),
                    "step": i
                })
                
                if i % 100 == 0:
                    print(f"  ✅ Étape {i}: tokens={row['tokens']:.0f}, loss={row['loss']:.4f}")
            
            # Finaliser ce run
            trackio.finish()
            print(f"✅ Run \"{run_name}\" terminé!")
        
        print(f"\n🎉 Tous les runs créés avec succès!")
        print(f"📊 {len(runs)} runs séparés loggés")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du logging: {e}")
        return False

def main():
    print("🎯 Création de runs SÉPARÉS dans Trackio")
    print("=" * 50)
    print("🔄 Un run par type de spike")
    print("=" * 50)
    
    # Logger avec des runs séparés
    success = log_spike_loss_separate_runs()
    
    print("\n📊 Résultat:")
    if success:
        print("✅ Runs séparés créés avec succès!")
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
