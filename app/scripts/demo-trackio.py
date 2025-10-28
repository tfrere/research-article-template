#!/usr/bin/env python3
"""
Démonstration de l'intégration Trackio avec les données de l'article
"""

import trackio
import pandas as pd
import numpy as np
import json
from pathlib import Path

def demo_simple_loss():
    """Démonstration simple avec des données de perte générées"""
    print("🎯 Démonstration: Logging de données de perte simples")
    
    # Initialiser Trackio
    trackio.init(project="demo-loss", space_id="tfrere/loss-experiment")
    
    # Générer des données de perte réalistes
    steps = np.arange(0, 100, 1)
    loss_values = 1.0 / (1 + steps * 0.1) + np.random.normal(0, 0.01, len(steps))
    accuracy_values = 1 - loss_values + np.random.normal(0, 0.05, len(steps))
    
    print(f"📊 Logging de {len(steps)} points de données...")
    
    for i, (step, loss, acc) in enumerate(zip(steps, loss_values, accuracy_values)):
        trackio.log({
            "step": int(step),
            "loss": float(loss),
            "accuracy": float(acc)
        })
        
        if i % 20 == 0:
            print(f"  ✅ Étape {step}: loss={loss:.4f}, accuracy={acc:.4f}")
    
    trackio.finish()
    print("✅ Démonstration terminée!")

def demo_baseline_metrics():
    """Démonstration avec les vraies données de baseline"""
    print("\n🎯 Démonstration: Logging des métriques de baseline")
    
    # Charger les données
    data_file = Path("dist/data/against_baselines.csv")
    if not data_file.exists():
        print("❌ Fichier de données non trouvé. Exécutez depuis la racine du projet.")
        return
    
    df = pd.read_csv(data_file)
    print(f"📁 Données chargées: {len(df)} lignes")
    
    # Initialiser Trackio
    trackio.init(project="demo-baseline", space_id="tfrere/loss-experiment")
    
    # Logger seulement les 50 premières lignes pour la démo
    demo_df = df.head(50)
    
    for _, row in demo_df.iterrows():
        log_data = {
            "step": int(row['step']),
            "metric": row['metric'],
            "value": float(row['value']),
            "run": row['run']
        }
        
        if pd.notna(row['stderr']) and row['stderr'] != '':
            log_data["stderr"] = float(row['stderr'])
        
        trackio.log(log_data)
    
    trackio.finish()
    print(f"✅ {len(demo_df)} métriques loggées!")

def demo_vision_metrics():
    """Démonstration avec les données de vision"""
    print("\n🎯 Démonstration: Logging des métriques de vision")
    
    # Charger les données
    data_file = Path("dist/data/vision.csv")
    if not data_file.exists():
        print("❌ Fichier de données non trouvé. Exécutez depuis la racine du projet.")
        return
    
    df = pd.read_csv(data_file)
    print(f"📁 Données chargées: {len(df)} subsets")
    
    # Initialiser Trackio
    trackio.init(project="demo-vision", space_id="tfrere/loss-experiment")
    
    # Logger les 10 premiers subsets
    demo_df = df.head(10)
    
    for _, row in demo_df.iterrows():
        trackio.log({
            "subset": row['subset_name'],
            "total_images": int(row['total_images']),
            "total_samples": int(row['total_samples']),
            "total_turns": int(row['total_turns']),
            "question_tokens": int(row['question_total_tokens']),
            "answer_tokens": int(row['answer_total_tokens']),
            "category": row['eagle_cathegory']
        })
    
    trackio.finish()
    print(f"✅ {len(demo_df)} subsets loggés!")

def main():
    print("🚀 Démonstration de l'intégration Trackio")
    print("=" * 50)
    
    try:
        # Démonstration 1: Données de perte simples
        demo_simple_loss()
        
        # Démonstration 2: Métriques de baseline
        demo_baseline_metrics()
        
        # Démonstration 3: Métriques de vision
        demo_vision_metrics()
        
        print("\n🎉 Toutes les démonstrations terminées!")
        print("📊 Consultez votre dashboard Trackio pour voir les données")
        
    except Exception as e:
        print(f"❌ Erreur lors de la démonstration: {e}")

if __name__ == "__main__":
    main()
