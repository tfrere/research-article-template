#!/usr/bin/env python3
"""
Script simple pour logger les données de perte vers Trackio
Usage: python simple-trackio-logger.py --space-id "tfrere/loss-experiment"
"""

import trackio
import pandas as pd
import argparse
import numpy as np

def create_sample_loss_data():
    """Crée des données de perte d'exemple basées sur les données existantes"""
    # Générer des données de perte réalistes
    steps = np.arange(0, 1000, 10)
    loss_values = 1.0 / (1 + steps * 0.1) + np.random.normal(0, 0.01, len(steps))
    
    return pd.DataFrame({
        'step': steps,
        'loss': loss_values,
        'accuracy': 1 - loss_values + np.random.normal(0, 0.05, len(steps))
    })

def log_loss_data(df, space_id=None):
    """Log les données de perte vers Trackio"""
    print(f"🚀 Initialisation de Trackio...")
    
    if space_id:
        trackio.init(project="loss-experiment", space_id=space_id)
    else:
        trackio.init(project="loss-experiment")
    
    print(f"📊 Logging de {len(df)} points de données...")
    
    for _, row in df.iterrows():
        trackio.log({
            "step": int(row['step']),
            "loss": float(row['loss']),
            "accuracy": float(row['accuracy'])
        })
    
    trackio.finish()
    print("✅ Logging terminé!")

def main():
    parser = argparse.ArgumentParser(description="Logger des données de perte vers Trackio")
    parser.add_argument("--space-id", help="ID de l'espace Hugging Face (ex: tfrere/loss-experiment)")
    parser.add_argument("--data-file", help="Fichier CSV avec les données de perte (optionnel)")
    
    args = parser.parse_args()
    
    if args.data_file:
        try:
            df = pd.read_csv(args.data_file)
            print(f"📁 Données chargées depuis {args.data_file}")
        except Exception as e:
            print(f"❌ Erreur lors du chargement: {e}")
            return 1
    else:
        print("📊 Génération de données de perte d'exemple...")
        df = create_sample_loss_data()
    
    log_loss_data(df, args.space_id)
    return 0

if __name__ == "__main__":
    exit(main())
