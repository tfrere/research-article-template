#!/usr/bin/env python3
"""
Script pour logger les données de l'article vers Trackio
Ce script lit les fichiers CSV de données et les envoie vers un dashboard Trackio
"""

import pandas as pd
import trackio
import json
import os
from pathlib import Path
import argparse
from typing import Dict, Any, Optional

def load_csv_data(file_path: str) -> pd.DataFrame:
    """Charge les données depuis un fichier CSV"""
    try:
        df = pd.read_csv(file_path)
        print(f"✅ Données chargées depuis {file_path}: {len(df)} lignes")
        return df
    except Exception as e:
        print(f"❌ Erreur lors du chargement de {file_path}: {e}")
        return pd.DataFrame()

def load_json_data(file_path: str) -> Dict[str, Any]:
    """Charge les données depuis un fichier JSON"""
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        print(f"✅ Données JSON chargées depuis {file_path}")
        return data
    except Exception as e:
        print(f"❌ Erreur lors du chargement de {file_path}: {e}")
        return {}

def log_baseline_metrics(df: pd.DataFrame, project_name: str, space_id: Optional[str] = None):
    """Log les métriques de baseline vers Trackio"""
    print(f"\n📊 Logging des métriques de baseline...")
    
    # Initialiser Trackio
    if space_id:
        trackio.init(project=project_name, space_id=space_id)
    else:
        trackio.init(project=project_name)
    
    # Grouper par run pour logger chaque expérience séparément
    for run_name in df['run'].unique():
        print(f"  🔄 Logging du run: {run_name}")
        run_data = df[df['run'] == run_name]
        
        # Logger chaque métrique par étape
        for _, row in run_data.iterrows():
            step = int(row['step'])
            metric_name = row['metric']
            value = float(row['value'])
            
            # Préparer les données à logger
            log_data = {
                "step": step,
                "metric": metric_name,
                "value": value
            }
            
            # Ajouter l'erreur standard si disponible
            if pd.notna(row['stderr']) and row['stderr'] != '':
                log_data["stderr"] = float(row['stderr'])
            
            # Logger vers Trackio
            trackio.log(log_data)
        
        print(f"    ✅ {len(run_data)} métriques loggées pour {run_name}")
    
    print("✅ Toutes les métriques de baseline ont été loggées")

def log_vision_metrics(df: pd.DataFrame, project_name: str, space_id: Optional[str] = None):
    """Log les métriques de vision vers Trackio"""
    print(f"\n👁️ Logging des métriques de vision...")
    
    # Initialiser Trackio pour les métriques de vision
    if space_id:
        trackio.init(project=f"{project_name}-vision", space_id=space_id)
    else:
        trackio.init(project=f"{project_name}-vision")
    
    # Logger les statistiques de chaque subset
    for _, row in df.iterrows():
        subset_name = row['subset_name']
        
        # Logger les métriques principales
        trackio.log({
            "subset": subset_name,
            "total_images": int(row['total_images']),
            "total_samples": int(row['total_samples']),
            "total_turns": int(row['total_turns']),
            "question_tokens": int(row['question_total_tokens']),
            "answer_tokens": int(row['answer_total_tokens']),
            "category": row['eagle_cathegory']
        })
    
    print(f"✅ {len(df)} subsets de vision loggés")

def log_model_metrics(model_data: Dict[str, Any], project_name: str, space_id: Optional[str] = None):
    """Log les métriques du modèle vers Trackio"""
    print(f"\n🤖 Logging des métriques du modèle...")
    
    # Initialiser Trackio pour le modèle
    if space_id:
        trackio.init(project=f"{project_name}-model", space_id=space_id)
    else:
        trackio.init(project=f"{project_name}-model")
    
    # Extraire les informations de configuration
    if 'modelTopology' in model_data:
        topology = model_data['modelTopology']
        
        # Logger la configuration d'entraînement
        if 'training_config' in topology:
            config = topology['training_config']
            trackio.log({
                "metric_type": "training_config",
                "loss": config.get('loss', 'unknown'),
                "metrics": config.get('metrics', []),
                "keras_version": topology.get('keras_version', 'unknown')
            })
            
            # Logger la configuration de l'optimiseur
            if 'optimizer_config' in config:
                opt_config = config['optimizer_config']
                trackio.log({
                    "metric_type": "optimizer_config",
                    "class_name": opt_config.get('class_name', 'unknown'),
                    "learning_rate": opt_config.get('config', {}).get('lr', 0),
                    "beta_1": opt_config.get('config', {}).get('beta_1', 0),
                    "beta_2": opt_config.get('config', {}).get('beta_2', 0)
                })
        
        # Logger l'architecture du modèle
        if 'model_config' in topology:
            model_config = topology['model_config']
            trackio.log({
                "metric_type": "model_architecture",
                "class_name": model_config.get('class_name', 'unknown'),
                "num_layers": len(model_config.get('config', []))
            })
    
    print("✅ Métriques du modèle loggées")

def main():
    parser = argparse.ArgumentParser(description="Logger les données de l'article vers Trackio")
    parser.add_argument("--project", default="research-article", help="Nom du projet Trackio")
    parser.add_argument("--space-id", help="ID de l'espace Hugging Face (optionnel)")
    parser.add_argument("--data-dir", default="dist/data", help="Répertoire contenant les données")
    parser.add_argument("--baseline-file", default="against_baselines.csv", help="Fichier CSV des métriques de baseline")
    parser.add_argument("--vision-file", default="vision.csv", help="Fichier CSV des métriques de vision")
    parser.add_argument("--model-file", default="mnist-variant-model.json", help="Fichier JSON du modèle")
    parser.add_argument("--skip-baseline", action="store_true", help="Ignorer le logging des métriques de baseline")
    parser.add_argument("--skip-vision", action="store_true", help="Ignorer le logging des métriques de vision")
    parser.add_argument("--skip-model", action="store_true", help="Ignorer le logging des métriques du modèle")
    
    args = parser.parse_args()
    
    print("🚀 Démarrage du logging Trackio...")
    print(f"📁 Répertoire des données: {args.data_dir}")
    print(f"🎯 Projet: {args.project}")
    if args.space_id:
        print(f"🌐 Space ID: {args.space_id}")
    
    # Chemin vers les fichiers de données
    data_dir = Path(args.data_dir)
    
    try:
        # Logger les métriques de baseline
        if not args.skip_baseline:
            baseline_file = data_dir / args.baseline_file
            if baseline_file.exists():
                baseline_df = load_csv_data(str(baseline_file))
                if not baseline_df.empty:
                    log_baseline_metrics(baseline_df, args.project, args.space_id)
                    trackio.finish()
            else:
                print(f"⚠️ Fichier de baseline non trouvé: {baseline_file}")
        
        # Logger les métriques de vision
        if not args.skip_vision:
            vision_file = data_dir / args.vision_file
            if vision_file.exists():
                vision_df = load_csv_data(str(vision_file))
                if not vision_df.empty:
                    log_vision_metrics(vision_df, args.project, args.space_id)
                    trackio.finish()
            else:
                print(f"⚠️ Fichier de vision non trouvé: {vision_file}")
        
        # Logger les métriques du modèle
        if not args.skip_model:
            model_file = data_dir / args.model_file
            if model_file.exists():
                model_data = load_json_data(str(model_file))
                if model_data:
                    log_model_metrics(model_data, args.project, args.space_id)
                    trackio.finish()
            else:
                print(f"⚠️ Fichier du modèle non trouvé: {model_file}")
        
        print("\n🎉 Logging terminé avec succès!")
        print("📊 Consultez votre dashboard Trackio pour voir les données")
        
    except Exception as e:
        print(f"❌ Erreur lors du logging: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
