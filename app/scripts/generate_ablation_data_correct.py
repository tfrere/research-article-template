#!/usr/bin/env python3
"""
Generate ablation study data for D3 line chart embeds.

This script generates CSV files for:
1. From scratch ablation - single learning rate schedule
2. Annealing ablation - comparison between main pretraining and ablation decay
"""

import pandas as pd
import numpy as np
import os

# Parameters
max_lr = 2e-4

def generate_from_scratch_schedule():
    """Generate from scratch learning rate schedule - goes to 100B tokens"""
    total_tokens = 100e9  # 100B tokens
    warmup_end = 0.05  # 5% of total tokens
    decay_start = 0.85  # 85% of total tokens
    
    schedule = []
    for i in range(1000):  # 1000 points for smooth curve
        progress = i / 999  # 0 to 1
        
        if progress < warmup_end:
            # Linear warmup
            lr = max_lr * (progress / warmup_end)
        elif progress < decay_start:
            # Plateau at max LR
            lr = max_lr
        else:
            # Linear decay to 0
            decay_progress = (progress - decay_start) / (1 - decay_start)
            lr = max_lr * (1 - decay_progress)
        
        tokens = progress * total_tokens
        schedule.append({
            'run_name': 'From scratch',
            'tokens': tokens,
            'learning_rate': lr
        })
        
        # Stop adding points once learning rate reaches 0 (but include the 0 point)
        if lr == 0:
            break
    
    # Add the final 0 point if not already added
    if schedule[-1]['learning_rate'] != 0:
        schedule.append({
            'run_name': 'From scratch',
            'tokens': total_tokens,
            'learning_rate': 0
        })
    
    return schedule

def generate_annealing_schedules():
    """Generate annealing ablation schedules - goes to 11T tokens"""
    total_tokens = 11e12  # 11T tokens
    main_warmup_end = 0.012  # 1.2% of total tokens
    main_decay_start = 0.80  # 80% of total tokens
    main_end = 0.95  # 95% of total tokens
    
    # Ablation run parameters - start earlier so it reaches 0 at 7.1T
    ablation_start = 0.55  # Start earlier
    ablation_end = 0.645  # End at 7.1T (64.5% of 11T)
    
    schedules = []
    
    # Main pretraining run
    for i in range(1000):
        progress = i / 999
        
        if progress < main_warmup_end:
            lr = max_lr * (progress / main_warmup_end)
        elif progress < main_decay_start:
            lr = max_lr
        elif progress < main_end:
            # Linear decay
            decay_progress = (progress - main_decay_start) / (main_end - main_decay_start)
            lr = max_lr * (1 - decay_progress)
        else:
            lr = 0
        
        tokens = progress * total_tokens
        schedules.append({
            'run_name': 'Main pretraining',
            'tokens': tokens,
            'learning_rate': lr
        })
        
        # Stop adding points once learning rate reaches 0
        if lr == 0:
            break
    
    # Ablation run (starts from plateau and decays)
    for i in range(1000):
        progress = i / 999
        
        if progress < ablation_start:
            lr = max_lr  # Plateau
        elif progress < ablation_end:
            # Linear decay during ablation period
            decay_progress = (progress - ablation_start) / (ablation_end - ablation_start)
            lr = max_lr * (1 - decay_progress)
        else:
            lr = 0
        
        tokens = progress * total_tokens
        schedules.append({
            'run_name': 'Ablation decay',
            'tokens': tokens,
            'learning_rate': lr
        })
        
        # Stop adding points once learning rate reaches 0
        if lr == 0:
            break
    
    # Add the final 0 point for ablation decay if not already added
    if schedules[-1]['learning_rate'] != 0:
        schedules.append({
            'run_name': 'Ablation decay',
            'tokens': total_tokens,
            'learning_rate': 0
        })
    
    return schedules

def main():
    # Create output directory if it doesn't exist
    output_dir = "src/content/assets/data"
    os.makedirs(output_dir, exist_ok=True)
    
    print("Generating ablation study data...")
    
    # Generate from scratch schedule
    from_scratch_data = generate_from_scratch_schedule()
    df_from_scratch = pd.DataFrame(from_scratch_data)
    df_from_scratch.to_csv(f'{output_dir}/from_scratch_ablation.csv', index=False)
    print(f"✓ Saved {output_dir}/from_scratch_ablation.csv with {len(df_from_scratch)} rows")
    
    # Generate annealing schedules
    annealing_data = generate_annealing_schedules()
    df_annealing = pd.DataFrame(annealing_data)
    df_annealing.to_csv(f'{output_dir}/annealing_ablation.csv', index=False)
    print(f"✓ Saved {output_dir}/annealing_ablation.csv with {len(df_annealing)} rows")
    
    print("\n✓ Done! CSV files generated successfully.")
    print("\nNext steps:")
    print("1. Use from_scratch_ablation.csv for the first plot")
    print("2. Use annealing_ablation.csv for the second plot")

if __name__ == "__main__":
    main()
