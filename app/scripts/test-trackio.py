#!/usr/bin/env python3
"""
Script de test pour vérifier l'intégration Trackio
"""

import trackio
import pandas as pd
import numpy as np
import time

def test_simple_logging():
    """Test simple de logging vers Trackio"""
    print("🧪 Test de logging simple vers Trackio...")
    
    try:
        # Initialiser Trackio
        trackio.init(project="test-integration", space_id="tfrere/loss-experiment")
        
        # Générer des données de test réalistes
        steps = np.arange(0, 50, 1)
        loss_values = 1.0 / (1 + steps * 0.1) + np.random.normal(0, 0.01, len(steps))
        accuracy_values = 1 - loss_values + np.random.normal(0, 0.05, len(steps))
        
        print(f"📊 Logging de {len(steps)} points de données...")
        
        for i, (step, loss, acc) in enumerate(zip(steps, loss_values, accuracy_values)):
            trackio.log({
                "step": int(step),
                "loss": float(loss),
                "accuracy": float(acc),
                "test_run": True
            })
            
            if i % 10 == 0:
                print(f"  ✅ Étape {step}: loss={loss:.4f}, accuracy={acc:.4f}")
            
            # Petite pause pour éviter de surcharger
            time.sleep(0.1)
        
        trackio.finish()
        print("✅ Test de logging terminé avec succès!")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
        return False

def test_baseline_data():
    """Test avec les vraies données de baseline"""
    print("\n🧪 Test avec les données de baseline...")
    
    try:
        # Charger les données
        data_file = "dist/data/against_baselines.csv"
        df = pd.read_csv(data_file)
        print(f"📁 Données chargées: {len(df)} lignes")
        
        # Initialiser Trackio
        trackio.init(project="test-baseline", space_id="tfrere/loss-experiment")
        
        # Logger seulement les 20 premières lignes pour le test
        test_df = df.head(20)
        
        for _, row in test_df.iterrows():
            log_data = {
                "step": int(row['step']),
                "metric": row['metric'],
                "value": float(row['value']),
                "run": row['run'],
                "test_run": True
            }
            
            if pd.notna(row['stderr']) and row['stderr'] != '':
                log_data["stderr"] = float(row['stderr'])
            
            trackio.log(log_data)
        
        trackio.finish()
        print(f"✅ {len(test_df)} métriques de baseline loggées!")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du test baseline: {e}")
        return False

def main():
    print("🚀 Test de l'intégration Trackio")
    print("=" * 50)
    
    # Test 1: Logging simple
    success1 = test_simple_logging()
    
    # Test 2: Données de baseline
    success2 = test_baseline_data()
    
    print("\n📊 Résultats des tests:")
    print(f"  Test simple: {'✅ Réussi' if success1 else '❌ Échec'}")
    print(f"  Test baseline: {'✅ Réussi' if success2 else '❌ Échec'}")
    
    if success1 and success2:
        print("\n🎉 Tous les tests sont passés!")
        print("📊 Consultez votre dashboard Trackio pour voir les données de test")
    else:
        print("\n⚠️ Certains tests ont échoué. Vérifiez la configuration.")
    
    return 0 if (success1 and success2) else 1

if __name__ == "__main__":
    exit(main())
