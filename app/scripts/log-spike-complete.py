#!/usr/bin/env python3
"""
Script pour logger TOUS les runs de spike_loss.csv vers Trackio
Reset complet et logging de toutes les données
"""

import trackio
import pandas as pd
import sys
from pathlib import Path

def log_all_spike_loss_data():
    """Log TOUTES les données de spike_loss.csv vers Trackio"""
    print("🚀 Logging de TOUTES les données spike_loss vers Trackio...")
    
    # Chemin vers le fichier de données
    data_file = Path("src/content/assets/data/spike_loss.csv")
    
    if not data_file.exists():
        print(f"❌ Fichier non trouvé: {data_file}")
        return False
    
    try:
        # Charger TOUTES les données
        df = pd.read_csv(data_file)
        print(f"📁 Données chargées: {len(df)} lignes")
        print(f"📊 Colonnes: {list(df.columns)}")
        
        # Afficher les runs disponibles
        runs = df['run_name'].unique()
        print(f"🔍 Runs disponibles ({len(runs)}):")
        for run in runs:
            count = len(df[df['run_name'] == run])
            print(f"  - {run}: {count} points")
        
        print(f"\n🔍 Aperçu des données:")
        print(df.head(10))
        
        # Initialiser Trackio avec un nouveau projet
        print(f"\n🌐 Initialisation de Trackio...")
        trackio.init(project="spike-loss-complete", space_id="tfrere/loss-experiment")
        
        # Logger TOUTES les données
        print(f"📊 Logging de {len(df)} points de données...")
        
        for i, row in df.iterrows():
            trackio.log({
                "tokens": float(row['tokens']),
                "loss": float(row['loss']),
                "run_name": row['run_name'],
                "step": i  # Utiliser l'index comme step
            })
            
            if i % 100 == 0:
                print(f"  ✅ Étape {i}: tokens={row['tokens']:.0f}, loss={row['loss']:.4f}, run={row['run_name']}")
        
        trackio.finish()
        print("✅ Logging terminé avec succès!")
        print(f"📊 {len(df)} points loggés pour {len(runs)} runs différents")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du logging: {e}")
        return False

def main():
    print("🎯 Logging COMPLET des données spike_loss vers Trackio")
    print("=" * 60)
    print("🔄 Reset et logging de TOUTES les données du fichier")
    print("=" * 60)
    
    # Logger toutes les données de spike_loss
    success = log_all_spike_loss_data()
    
    print("\n📊 Résultat:")
    if success:
        print("✅ TOUTES les données spike_loss ont été loggées!")
        print("📊 Consultez votre dashboard Trackio: https://huggingface.co/spaces/tfrere/loss-experiment")
        print("🔍 Vous devriez voir 2 courbes:")
        print("   - Non recoverable spikes (500 points)")
        print("   - Recoverable spikes (500 points)")
    else:
        print("❌ Échec du logging")
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())
