#!/usr/bin/env python3
"""
Script pour logger spike_loss avec les run names exacts
Utilise un seul projet Trackio pour regrouper les runs
"""

import trackio
import pandas as pd
import sys
from pathlib import Path

def log_spike_loss_exact_names():
    """Log spike_loss avec les run names exacts du CSV"""
    print("🚀 Logging spike_loss avec run names exacts...")
    
    # Chemin vers le fichier de données
    data_file = Path("src/content/assets/data/spike_loss.csv")
    
    if not data_file.exists():
        print(f"❌ Fichier non trouvé: {data_file}")
        return False
    
    try:
        # Charger les données
        df = pd.read_csv(data_file)
        print(f"📁 Données chargées: {len(df)} lignes")
        
        # Afficher les run names exacts
        runs = df['run_name'].unique()
        print(f"🔍 Run names exacts ({len(runs)}):")
        for run in runs:
            count = len(df[df['run_name'] == run])
            print(f'  - "{run}": {count} points')
        
        # Initialiser Trackio avec un projet unique
        print(f"\n🌐 Initialisation de Trackio...")
        trackio.init(project="spike-loss-analysis", space_id="tfrere/loss-experiment")
        
        # Logger les données en préservant les run names exacts
        print(f"📊 Logging de {len(df)} points de données...")
        
        for i, row in df.iterrows():
            # Utiliser le run_name exact du CSV
            trackio.log({
                "tokens": float(row['tokens']),
                "loss": float(row['loss']),
                "run_name": str(row['run_name']),  # Convertir en string pour être sûr
                "step": i
            })
            
            if i % 200 == 0:
                print(f"  ✅ Étape {i}: tokens={row['tokens']:.0f}, loss={row['loss']:.4f}, run=\"{row['run_name']}\"")
        
        trackio.finish()
        print("✅ Logging terminé avec succès!")
        print(f"📊 {len(df)} points loggés avec run names exacts")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du logging: {e}")
        return False

def main():
    print("🎯 Logging spike_loss avec run names EXACTS")
    print("=" * 50)
    print("🔄 Utilisation des run names exacts du CSV")
    print("=" * 50)
    
    # Logger avec les run names exacts
    success = log_spike_loss_exact_names()
    
    print("\n📊 Résultat:")
    if success:
        print("✅ Données loggées avec run names exacts!")
        print("📊 Consultez votre dashboard Trackio: https://huggingface.co/spaces/tfrere/loss-experiment")
        print("🔍 Vous devriez voir 2 courbes avec les noms exacts:")
        print('   - "Non recoverable spikes"')
        print('   - "Recoverable spikes"')
    else:
        print("❌ Échec du logging")
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())
