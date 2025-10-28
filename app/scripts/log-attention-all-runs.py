#!/usr/bin/env python3
"""
Script pour logger tous les runs d'attention_loss.csv dans un seul projet
Comparaison des différentes architectures d'attention
"""

import trackio
import pandas as pd
import sys
from pathlib import Path

def log_attention_loss_all_runs():
    """Log attention_loss avec tous les runs dans le même projet"""
    print("🚀 Logging attention_loss avec TOUS les runs dans le même projet...")
    
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
        print(f"🔍 Runs à créer dans le même projet ({len(runs)}):")
        for run in runs:
            count = len(df[df['run_name'] == run])
            print(f'  - "{run}": {count} points')
        
        # Logger chaque run dans le MÊME projet
        for i, run_name in enumerate(runs):
            print(f"\n🌐 Création du run: \"{run_name}\"")
            
            # Utiliser le même projet pour tous les runs
            project_name = "attention-loss-comparison"
            
            # Initialiser Trackio avec le même projet
            trackio.init(
                project=project_name, 
                space_id="tfrere/loss-experiment",
                name=run_name,
                resume="allow"  # Permettre de reprendre ou créer un nouveau run
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
        
        print(f"\n🎉 Tous les runs d'attention créés dans le même projet!")
        print(f"📊 {len(runs)} runs loggés dans le projet: {project_name}")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du logging: {e}")
        return False

def main():
    print("🎯 Création de TOUS les runs d'attention dans le MÊME projet")
    print("=" * 60)
    print("🔄 Comparaison des architectures d'attention")
    print("=" * 60)
    
    # Logger avec le même projet
    success = log_attention_loss_all_runs()
    
    print("\n📊 Résultat:")
    if success:
        print("✅ Tous les runs d'attention créés dans le même projet!")
        print("📊 Consultez votre dashboard Trackio: https://huggingface.co/spaces/tfrere/loss-experiment")
        print("🔍 Vous devriez voir 1 projet avec 6 runs:")
        print('   - "GQA 8 groups (baseline)"')
        print('   - "MHA"')
        print('   - "GQA 4 groups"')
        print('   - "MQA"')
        print('   - "GQA 2 groups"')
        print('   - "GQA 16 groups"')
        print("📈 Les 6 courbes devraient être dans le même graphique!")
        print("🔬 Comparaison des architectures d'attention: GQA vs MHA vs MQA")
    else:
        print("❌ Échec du logging")
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())
