#!/usr/bin/env python3
"""
Script pour logger les données de loss vers Trackio
Utilise le fichier spike_loss.csv trouvé dans les données
"""

import trackio
import pandas as pd
import sys
from pathlib import Path

def log_spike_loss_data():
    """Log les données de spike_loss.csv vers Trackio"""
    print("🚀 Logging des données de spike_loss vers Trackio...")
    
    # Chemin vers le fichier de données
    data_file = Path("src/content/assets/data/spike_loss.csv")
    
    if not data_file.exists():
        print(f"❌ Fichier non trouvé: {data_file}")
        return False
    
    try:
        # Charger les données
        df = pd.read_csv(data_file)
        print(f"📁 Données chargées: {len(df)} lignes")
        print(f"📊 Colonnes: {list(df.columns)}")
        print(f"🔍 Aperçu des données:")
        print(df.head())
        
        # Initialiser Trackio
        print("\n🌐 Initialisation de Trackio...")
        trackio.init(project="spike-loss-experiment", space_id="tfrere/loss-experiment")
        
        # Logger les données
        print(f"📊 Logging de {len(df)} points de données...")
        
        for i, row in df.iterrows():
            trackio.log({
                "tokens": float(row['tokens']),
                "loss": float(row['loss']),
                "run_name": row['run_name'],
                "step": i  # Utiliser l'index comme step
            })
            
            if i % 100 == 0:
                print(f"  ✅ Étape {i}: tokens={row['tokens']:.0f}, loss={row['loss']:.4f}")
        
        trackio.finish()
        print("✅ Logging terminé avec succès!")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du logging: {e}")
        return False

def log_aggregated_loss_data():
    """Log les données de aggregated-loss-data.csv vers Trackio"""
    print("\n🚀 Logging des données aggregated-loss-data vers Trackio...")
    
    # Chemin vers le fichier de données
    data_file = Path("src/content/assets/data/aggregated-loss-data.csv")
    
    if not data_file.exists():
        print(f"❌ Fichier non trouvé: {data_file}")
        return False
    
    try:
        # Charger les données
        df = pd.read_csv(data_file)
        print(f"📁 Données chargées: {len(df)} lignes")
        print(f"📊 Colonnes: {list(df.columns)}")
        
        # Initialiser Trackio
        print("\n🌐 Initialisation de Trackio...")
        trackio.init(project="aggregated-loss-experiment", space_id="tfrere/loss-experiment")
        
        # Logger les données (limiter à 1000 pour éviter de surcharger)
        sample_df = df.head(1000)
        print(f"📊 Logging de {len(sample_df)} points de données (échantillon)...")
        
        for i, row in sample_df.iterrows():
            trackio.log({
                "tokens": float(row['tokens']),
                "loss": float(row['loss']),
                "run_name": row['run_name'],
                "step": i
            })
            
            if i % 100 == 0:
                print(f"  ✅ Étape {i}: tokens={row['tokens']:.0f}, loss={row['loss']:.4f}")
        
        trackio.finish()
        print("✅ Logging terminé avec succès!")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du logging: {e}")
        return False

def main():
    print("🎯 Logging des données de loss vers Trackio")
    print("=" * 50)
    
    # Logger les données de spike_loss
    success1 = log_spike_loss_data()
    
    # Logger les données aggregated
    success2 = log_aggregated_loss_data()
    
    print("\n📊 Résultats:")
    print(f"  Spike loss: {'✅ Réussi' if success1 else '❌ Échec'}")
    print(f"  Aggregated loss: {'✅ Réussi' if success2 else '❌ Échec'}")
    
    if success1 or success2:
        print("\n🎉 Données loggées avec succès!")
        print("📊 Consultez votre dashboard Trackio: https://huggingface.co/spaces/tfrere/loss-experiment")
    else:
        print("\n⚠️ Aucune donnée n'a pu être loggée.")
    
    return 0 if (success1 or success2) else 1

if __name__ == "__main__":
    exit(main())
