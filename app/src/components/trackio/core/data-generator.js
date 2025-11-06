// Data generation utilities for synthetic training data

// ============================================================================
// RANDOM HELPERS - Make magic numbers explicit and readable
// ============================================================================

/**
 * Random utilities for ML training simulation
 */
export const Random = {
  // Basic random generators
  between: (min, max) => min + Math.random() * (max - min),
  intBetween: (min, max) => Math.floor(Random.between(min, max + 1)),
  
  // ML-specific generators
  learningRate: () => Random.between(0.02, 0.08),
  noiseAmplitude: (baseValue, reduction = 0.8) => (factor) => 
    (Random.between(-1, 1) * baseValue * (1 - reduction * factor)),
  
  // Training quality simulation
  trainingQuality: () => {
    const quality = Math.random();
    return {
      isGood: quality > 0.66,
      isPoor: quality < 0.33,
      isMedium: quality >= 0.33 && quality <= 0.66,
      score: quality
    };
  },
  
  // Learning phases (plateau, improvements, etc.)
  learningPhases: (maxSteps) => {
    const phases = Random.intBetween(1, 3);
    const marks = new Set();
    while (marks.size < phases - 1) {
      marks.add(Math.floor(Random.between(0.25, 0.75) * (maxSteps - 1)));
    }
    return [0, ...Array.from(marks).sort((a, b) => a - b), maxSteps - 1];
  },

  // Training steps count with realistic ML training ranges (with large dataset support)
  trainingSteps: () => {
    const rand = Math.random();
    
    // Distribution basée sur des patterns d'entraînement ML réels
    // Inclut maintenant des datasets plus larges pour tester le sampling
    if (rand < 0.05) {
      // 5% - Très court : Tests rapides, prototypage
      return Random.intBetween(5, 50);
    } else if (rand < 0.15) {
      // 10% - Court : Expérimentations rapides
      return Random.intBetween(50, 200);
    } else if (rand < 0.35) {
      // 20% - Moyen-court : Entraînements standards
      return Random.intBetween(200, 400);
    } else if (rand < 0.55) {
      // 20% - Moyen : La plupart des entraînements
      return Random.intBetween(400, 800);
    } else if (rand < 0.75) {
      // 20% - Long : Entraînements approfondis (déclenche le sampling)
      return Random.intBetween(800, 1500);
    } else if (rand < 0.90) {
      // 15% - Très long : Large-scale training
      return Random.intBetween(1500, 3000);
    } else if (rand < 0.98) {
      // 8% - Extrêmement long : Research-scale
      return Random.intBetween(3000, 5000);
    } else {
      // 2% - Massive : LLMs, très gros datasets (pour tester les limites)
      return Random.intBetween(5000, 10000);
    }
  },

  // Training steps with specific scenario
  trainingStepsForScenario: (scenario = 'mixed') => {
    switch (scenario) {
      case 'prototyping':
        return Random.intBetween(5, 100);
      case 'development':
        return Random.intBetween(100, 400);
      case 'production':
        return Random.intBetween(400, 800);
      case 'research':
        return Random.intBetween(800, 2000);
      case 'llm':
        return Random.intBetween(2000, 5000);
      case 'massive':
        // Nouveau scénario pour tester le sampling avec de très gros datasets
        return Random.intBetween(5000, 15000);
      default:
        return Random.trainingSteps();
    }
  }
};

/**
 * ML Training constants for realistic simulation
 */
export const TrainingConfig = {
  LOSS: {
    INITIAL_MIN: 2.0,
    INITIAL_MAX: 6.5,
    NOISE_FACTOR: 0.08,
    SPIKE_PROBABILITY: 0.02,
    SPIKE_AMPLITUDE: 0.15,
    DECAY_ACCELERATION: 1.6
  },
  
  ACCURACY: {
    INITIAL_MIN: 0.1,
    INITIAL_MAX: 0.45,
    GOOD_FINAL: { min: 0.92, max: 0.99 },
    POOR_FINAL: { min: 0.62, max: 0.76 },
    MEDIUM_FINAL: { min: 0.8, max: 0.9 },
    NOISE_AMPLITUDE: 0.04,
    PHASE_ACCELERATION: 1.4
  },
  
  OVERFITTING: {
    START_RATIO_GOOD: 0.85,
    START_RATIO_POOR: 0.7,
    RANDOMNESS: 0.15,
    ACCURACY_DEGRADATION: 0.03,
    LOSS_INCREASE: 0.12
  },
  
  VALIDATION_GAP: {
    ACCURACY_MIN: 0.02,
    ACCURACY_MAX: 0.06,
    LOSS_MIN: 0.05,
    LOSS_MAX: 0.15,
    FLUCTUATION: 0.06
  }
};

/**
 * Performance optimization helpers
 */
export const Performance = {
  // Smart sampling for large datasets to maintain performance
  smartSample: (totalSteps, maxPoints = 2000) => {
    if (totalSteps <= maxPoints) {
      return Array.from({length: totalSteps}, (_, i) => i + 1);
    }
    
    // For large datasets, sample intelligently:
    // - Always include start and end
    // - Keep more density at the beginning (where learning happens faster)
    // - Sample logarithmically for the middle section
    // - Always include some regular intervals
    
    const samples = new Set([1, totalSteps]); // Always include first and last
    const targetSamples = Math.min(maxPoints, totalSteps);
    
    // Add logarithmic sampling (more points early, fewer later)
    const logSamples = Math.floor(targetSamples * 0.6);
    for (let i = 0; i < logSamples; i++) {
      const progress = i / (logSamples - 1);
      const logProgress = Math.log(1 + progress * (Math.E - 1)) / Math.log(Math.E); // Normalized log
      const step = Math.floor(1 + logProgress * (totalSteps - 1));
      samples.add(step);
    }
    
    // Add regular intervals for the remaining points
    const remainingSamples = targetSamples - samples.size;
    const interval = Math.floor(totalSteps / remainingSamples);
    for (let i = interval; i < totalSteps; i += interval) {
      samples.add(i);
      if (samples.size >= targetSamples) break;
    }
    
    return Array.from(samples).sort((a, b) => a - b);
  }
};

// ============================================================================
// CURVE GENERATION HELPERS - Specific ML training behaviors
// ============================================================================

/**
 * Calculate target final loss based on training quality
 */
function calculateTargetLoss(initialLoss, quality) {
  if (quality.isGood) {
    return initialLoss * Random.between(0.12, 0.24);
  } else if (quality.isPoor) {
    return initialLoss * Random.between(0.35, 0.60);
  } else {
    return initialLoss * Random.between(0.22, 0.38);
  }
}

/**
 * Calculate target final accuracy based on training quality
 */
function calculateTargetAccuracy(quality) {
  if (quality.isGood) {
    return Random.between(TrainingConfig.ACCURACY.GOOD_FINAL.min, TrainingConfig.ACCURACY.GOOD_FINAL.max);
  } else if (quality.isPoor) {
    return Random.between(TrainingConfig.ACCURACY.POOR_FINAL.min, TrainingConfig.ACCURACY.POOR_FINAL.max);
  } else {
    return Random.between(TrainingConfig.ACCURACY.MEDIUM_FINAL.min, TrainingConfig.ACCURACY.MEDIUM_FINAL.max);
  }
}

/**
 * Generate loss curve with realistic ML training dynamics
 */
function generateLossCurve(steps, initialLoss, targetLoss, learningPhases, quality) {
  let learningRate = Random.learningRate();
  const loss = new Array(steps);
  
  for (let phaseIndex = 0; phaseIndex < learningPhases.length - 1; phaseIndex++) {
    const phaseStart = learningPhases[phaseIndex];
    const phaseEnd = learningPhases[phaseIndex + 1] || phaseStart + 1;
    
    for (let step = phaseStart; step <= phaseEnd; step++) {
      const phaseProgress = (step - phaseStart) / Math.max(1, phaseEnd - phaseStart);
      const phaseTarget = targetLoss * Math.pow(0.85, phaseIndex);
      
      // Exponential decay with phase blending
      let value = initialLoss * Math.exp(-learningRate * (step + 1));
      value = 0.6 * value + 0.4 * (initialLoss + (phaseTarget - initialLoss) * (phaseIndex + phaseProgress) / Math.max(1, learningPhases.length - 1));
      
      // Add realistic noise that decreases over time
      const noiseGen = Random.noiseAmplitude(TrainingConfig.LOSS.NOISE_FACTOR * initialLoss);
      value += noiseGen(step / (steps - 1));
      
      // Occasional loss spikes (common in training)
      if (Math.random() < TrainingConfig.LOSS.SPIKE_PROBABILITY) {
        value += TrainingConfig.LOSS.SPIKE_AMPLITUDE * initialLoss;
      }
      
      loss[step] = Math.max(0, value);
    }
    
    // Learning rate changes between phases
    learningRate *= TrainingConfig.LOSS.DECAY_ACCELERATION;
  }
  
  return loss;
}

/**
 * Generate accuracy curve with realistic ML training dynamics
 */
function generateAccuracyCurve(steps, targetAccuracy, learningPhases, quality) {
  const initialAccuracy = Random.between(TrainingConfig.ACCURACY.INITIAL_MIN, TrainingConfig.ACCURACY.INITIAL_MAX);
  let learningRate = Random.learningRate();
  const accuracy = new Array(steps);
  
  for (let step = 0; step < steps; step++) {
    // Asymptotic growth towards target accuracy
    let value = targetAccuracy - (targetAccuracy - initialAccuracy) * Math.exp(-learningRate * (step + 1));
    
    // Add realistic noise that decreases over time
    const noiseGen = Random.noiseAmplitude(TrainingConfig.ACCURACY.NOISE_AMPLITUDE);
    value += noiseGen(step / (steps - 1));
    
    accuracy[step] = Math.max(0, Math.min(1, value));
    
    // Accelerate learning at phase boundaries
    if (learningPhases.includes(step)) {
      learningRate *= TrainingConfig.ACCURACY.PHASE_ACCELERATION;
    }
  }
  
  return accuracy;
}

/**
 * Apply overfitting effects to training curves
 */
function applyOverfitting(trainCurve, steps, quality) {
  const validationCurve = new Array(steps);
  const gapConfig = TrainingConfig.VALIDATION_GAP;
  
  // Calculate when overfitting starts
  const overfittingStart = Math.floor(
    (quality.isGood ? TrainingConfig.OVERFITTING.START_RATIO_GOOD : TrainingConfig.OVERFITTING.START_RATIO_POOR) 
    * (steps - 1) + Random.between(-TrainingConfig.OVERFITTING.RANDOMNESS, TrainingConfig.OVERFITTING.RANDOMNESS) * steps
  );
  
  const clampedStart = Math.max(Math.floor(0.5 * (steps - 1)), Math.min(Math.floor(0.95 * (steps - 1)), overfittingStart));
  
  for (let step = 0; step < steps; step++) {
    const isAccuracy = trainCurve[step] <= 1; // Simple heuristic
    const baseGap = isAccuracy 
      ? Random.between(gapConfig.ACCURACY_MIN, gapConfig.ACCURACY_MAX)
      : Random.between(gapConfig.LOSS_MIN, gapConfig.LOSS_MAX);
    
    let validationValue = isAccuracy 
      ? trainCurve[step] - baseGap + Random.between(-gapConfig.FLUCTUATION/2, gapConfig.FLUCTUATION/2)
      : trainCurve[step] * (1 + baseGap) + Random.between(-0.1, 0.1);
    
    // Apply overfitting effects after the overfitting point
    if (step >= clampedStart && !quality.isPoor) {
      const overfittingProgress = (step - clampedStart) / Math.max(1, steps - 1 - clampedStart);
      
      if (isAccuracy) {
        validationValue -= TrainingConfig.OVERFITTING.ACCURACY_DEGRADATION * overfittingProgress;
      } else {
        validationValue += TrainingConfig.OVERFITTING.LOSS_INCREASE * overfittingProgress * trainCurve[step];
      }
    }
    
    validationCurve[step] = isAccuracy 
      ? Math.max(0, Math.min(1, validationValue))
      : Math.max(0, validationValue);
  }
  
  return validationCurve;
}

export function generateRunNames(count, stepsHint = null) {
  const adjectives = [
    'ancient', 'brave', 'calm', 'clever', 'crimson', 'daring', 'eager', 'fearless', 
    'gentle', 'glossy', 'golden', 'hidden', 'icy', 'jolly', 'lively', 'mighty', 
    'noble', 'proud', 'quick', 'silent', 'swift', 'tiny', 'vivid', 'wild'
  ];
  
  const nouns = [
    'river', 'mountain', 'harbor', 'forest', 'valley', 'ocean', 'meadow', 'desert', 
    'island', 'canyon', 'harbor', 'trail', 'summit', 'delta', 'lagoon', 'ridge', 
    'tundra', 'reef', 'plateau', 'prairie', 'grove', 'bay', 'dune', 'cliff'
  ];
  
  // Ajouter des préfixes selon la longueur de l'entraînement
  const getPrefix = (steps) => {
    if (!steps) return '';
    if (steps < 100) return 'rapid-';
    if (steps < 1000) return 'quick-';
    if (steps < 10000) return 'deep-';
    if (steps < 50000) return 'ultra-';
    return 'mega-';
  };
  
  const used = new Set();
  const names = [];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
  while (names.length < count) {
    const prefix = getPrefix(stepsHint);
    const adjective = pick(adjectives);
    const noun = pick(nouns);
    const suffix = Math.floor(1 + Math.random() * 99);
    const name = `${prefix}${adjective}-${noun}-${suffix}`;
    
    if (!used.has(name)) {
      used.add(name);
      names.push(name);
    }
  }
  return names;
}

/**
 * Generate training scenario description based on steps count
 */
export function getScenarioDescription(steps) {
  if (steps < 25) return '🚀 Rapid Prototyping';
  if (steps < 100) return '⚡ Quick Experiment';
  if (steps < 400) return '🔧 Development Phase';
  if (steps < 800) return '📊 Standard Training';
  if (steps < 1500) return '🎯 Production Training (Sampling Active)';
  if (steps < 3000) return '🏗️ Large-Scale Training (Smart Sampling)';
  if (steps < 5000) return '🌌 Research-Scale Training (Adaptive Sampling)';
  return '🚀 Massive Dataset (Advanced Sampling)';
}

/**
 * Generate a massive dataset for testing sampling performance
 * @param {number} steps - Number of steps (default: random large number)
 * @param {number} runs - Number of runs (default: 3)
 * @returns {Object} Large dataset for testing
 */
export function generateMassiveTestDataset(steps = null, runs = 3) {
  const actualSteps = steps || Random.trainingStepsForScenario('massive');
  const runNames = generateRunNames(runs, actualSteps);
  const dataByMetric = new Map();
  
  console.log(`🧪 Generating massive test dataset: ${actualSteps} steps × ${runs} runs = ${actualSteps * runs} total points`);
  
  const TARGET_METRICS = ['epoch', 'train_accuracy', 'train_loss', 'val_accuracy', 'val_loss'];
  
  // Initialize data structure
  TARGET_METRICS.forEach((metric) => {
    const map = {};
    runNames.forEach((r) => { map[r] = []; });
    dataByMetric.set(metric, map);
  });
  
  // Generate curves for each run
  runNames.forEach((run, runIndex) => {
    console.log(`🔄 Generating curves for run ${runIndex + 1}/${runs}: ${run}`);
    const curves = genCurves(actualSteps);
    
    for (let stepIndex = 0; stepIndex < actualSteps; stepIndex++) {
      const step = stepIndex + 1;
      dataByMetric.get('epoch')[run].push({ step, value: step });
      dataByMetric.get('train_accuracy')[run].push({ step, value: curves.accTrain[stepIndex] });
      dataByMetric.get('val_accuracy')[run].push({ step, value: curves.accVal[stepIndex] });
      dataByMetric.get('train_loss')[run].push({ step, value: curves.lossTrain[stepIndex] });
      dataByMetric.get('val_loss')[run].push({ step, value: curves.lossVal[stepIndex] });
    }
  });
  
  console.log(`✅ Massive dataset generated successfully`);
  
  return {
    dataByMetric,
    runNames,
    stepCount: actualSteps,
    totalPoints: actualSteps * runs * TARGET_METRICS.length,
    description: getScenarioDescription(actualSteps)
  };
}

/**
 * Generate realistic ML training curves with training/validation splits
 * @param {number} totalSteps - Number of training steps to simulate
 * @param {number} maxPoints - Maximum points to generate for performance (default: 2000)
 * @returns {Object} Object containing training and validation curves for accuracy and loss
 */
export function genCurves(totalSteps, maxPoints = 2000) {
  // 1. Smart sampling for performance - get the actual steps we'll compute
  const sampledSteps = Performance.smartSample(totalSteps, maxPoints);
  const actualPointsCount = sampledSteps.length;
  
  // 2. Determine overall training quality and characteristics
  const quality = Random.trainingQuality();
  
  // 3. Generate target metrics based on quality
  const initialLoss = Random.between(TrainingConfig.LOSS.INITIAL_MIN, TrainingConfig.LOSS.INITIAL_MAX);
  const targetLoss = calculateTargetLoss(initialLoss, quality);
  const targetAccuracy = calculateTargetAccuracy(quality);
  
  // 4. Generate learning phases (plateaus, rapid improvements, etc.)
  const learningPhases = Random.learningPhases(totalSteps);
  
  // 5. Generate realistic training curves (using sampled steps for computation)
  const trainLoss = generateLossCurveOptimized(sampledSteps, totalSteps, initialLoss, targetLoss, learningPhases, quality);
  const trainAccuracy = generateAccuracyCurveOptimized(sampledSteps, totalSteps, targetAccuracy, learningPhases, quality);
  
  // 6. Apply overfitting to create validation curves
  const validationLoss = applyOverfittingOptimized(trainLoss, sampledSteps, totalSteps, quality);
  const validationAccuracy = applyOverfittingOptimized(trainAccuracy, sampledSteps, totalSteps, quality);
  
  // Convert back to simple arrays for backward compatibility
  // Create arrays indexed by step position for the original step sequence
  const stepToIndex = new Map();
  sampledSteps.forEach((step, index) => {
    stepToIndex.set(step, index);
  });
  
  // Create full arrays with interpolation for missing steps
  const createCompatibleArray = (sampledData) => {
    const result = new Array(totalSteps);
    let lastValue = sampledData[0]?.value || 0;
    
    // Ensure initial value is valid
    if (!Number.isFinite(lastValue)) {
      lastValue = 0;
    }
    
    for (let i = 0; i < totalSteps; i++) {
      const step = i + 1;
      const sampledIndex = stepToIndex.get(step);
      
      if (sampledIndex !== undefined) {
        // We have data for this step
        const newValue = sampledData[sampledIndex].value;
        lastValue = Number.isFinite(newValue) ? newValue : lastValue;
        result[i] = lastValue;
      } else {
        // Use last known value
        result[i] = lastValue;
      }
    }
    
    return result;
  };

  const result = {
    // Training curves (what the model sees during training) - compatible format
    accTrain: createCompatibleArray(trainAccuracy),
    lossTrain: createCompatibleArray(trainLoss),
    
    // Validation curves (held-out data, shows generalization) - compatible format
    accVal: createCompatibleArray(validationAccuracy),
    lossVal: createCompatibleArray(validationLoss),
    
    // Metadata for debugging
    _meta: {
      totalSteps,
      sampledPoints: actualPointsCount,
      samplingRatio: actualPointsCount / totalSteps,
      quality: quality.score
    }
  };
  
  // Debug: Check for NaN values
  const hasNaN = (arr, name) => {
    const nanCount = arr.filter(v => !Number.isFinite(v)).length;
    if (nanCount > 0) {
      console.warn(`⚠️ Found ${nanCount} NaN values in ${name}`);
    }
  };
  
  if (totalSteps > 1000) { // Only debug large datasets
    hasNaN(result.accTrain, 'accTrain');
    hasNaN(result.lossTrain, 'lossTrain');
    hasNaN(result.accVal, 'accVal');
    hasNaN(result.lossVal, 'lossVal');
  }
  
  return result;
}

// ============================================================================
// OPTIMIZED CURVE GENERATION - For performance with large datasets
// ============================================================================

/**
 * Optimized loss curve generation using sampled steps
 */
function generateLossCurveOptimized(sampledSteps, totalSteps, initialLoss, targetLoss, learningPhases, quality) {
  let learningRate = Random.learningRate();
  const loss = [];
  
  // Create a mapping function from sampled steps to values
  sampledSteps.forEach((step, index) => {
    // Find which learning phase this step belongs to
    let phaseIndex = 0;
    for (let i = 0; i < learningPhases.length - 1; i++) {
      if (step >= learningPhases[i] && step < learningPhases[i + 1]) {
        phaseIndex = i;
        break;
      }
    }
    
    const phaseStart = learningPhases[phaseIndex];
    const phaseEnd = learningPhases[phaseIndex + 1] || totalSteps;
    const phaseProgress = (step - phaseStart) / Math.max(1, phaseEnd - phaseStart);
    const phaseTarget = targetLoss * Math.pow(0.85, phaseIndex);
    
    // Exponential decay with phase blending
    let value = initialLoss * Math.exp(-learningRate * (step / totalSteps) * 100);
    value = 0.6 * value + 0.4 * (initialLoss + (phaseTarget - initialLoss) * (phaseIndex + phaseProgress) / Math.max(1, learningPhases.length - 1));
    
    // Add realistic noise that decreases over time
    const noiseGen = Random.noiseAmplitude(TrainingConfig.LOSS.NOISE_FACTOR * initialLoss);
    value += noiseGen(step / totalSteps);
    
    // Occasional loss spikes (common in training)
    if (Math.random() < TrainingConfig.LOSS.SPIKE_PROBABILITY) {
      value += TrainingConfig.LOSS.SPIKE_AMPLITUDE * initialLoss;
    }
    
    // Ensure no NaN values
    const finalValue = Math.max(0, Number.isFinite(value) ? value : initialLoss * 0.1);
    loss.push({ step, value: finalValue });
  });
  
  return loss;
}

/**
 * Optimized accuracy curve generation using sampled steps
 */
function generateAccuracyCurveOptimized(sampledSteps, totalSteps, targetAccuracy, learningPhases, quality) {
  const initialAccuracy = Random.between(TrainingConfig.ACCURACY.INITIAL_MIN, TrainingConfig.ACCURACY.INITIAL_MAX);
  let learningRate = Random.learningRate();
  const accuracy = [];
  
  sampledSteps.forEach((step, index) => {
    // Asymptotic growth towards target accuracy
    let value = targetAccuracy - (targetAccuracy - initialAccuracy) * Math.exp(-learningRate * (step / totalSteps) * 100);
    
    // Add realistic noise that decreases over time
    const noiseGen = Random.noiseAmplitude(TrainingConfig.ACCURACY.NOISE_AMPLITUDE);
    value += noiseGen(step / totalSteps);
    
    // Ensure no NaN values
    const finalValue = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.1;
    accuracy.push({ step, value: finalValue });
    
    // Accelerate learning at phase boundaries
    if (learningPhases.includes(step)) {
      learningRate *= TrainingConfig.ACCURACY.PHASE_ACCELERATION;
    }
  });
  
  return accuracy;
}

/**
 * Optimized overfitting application using sampled steps
 */
function applyOverfittingOptimized(trainCurve, sampledSteps, totalSteps, quality) {
  const validationCurve = [];
  const gapConfig = TrainingConfig.VALIDATION_GAP;
  
  // Calculate when overfitting starts
  const overfittingStart = Math.floor(
    (quality.isGood ? TrainingConfig.OVERFITTING.START_RATIO_GOOD : TrainingConfig.OVERFITTING.START_RATIO_POOR) 
    * totalSteps + Random.between(-TrainingConfig.OVERFITTING.RANDOMNESS, TrainingConfig.OVERFITTING.RANDOMNESS) * totalSteps
  );
  
  const clampedStart = Math.max(Math.floor(0.5 * totalSteps), Math.min(Math.floor(0.95 * totalSteps), overfittingStart));
  
  trainCurve.forEach((trainPoint, index) => {
    const step = trainPoint.step;
    const isAccuracy = trainPoint.value <= 1; // Simple heuristic
    const baseGap = isAccuracy 
      ? Random.between(gapConfig.ACCURACY_MIN, gapConfig.ACCURACY_MAX)
      : Random.between(gapConfig.LOSS_MIN, gapConfig.LOSS_MAX);
    
    let validationValue = isAccuracy 
      ? trainPoint.value - baseGap + Random.between(-gapConfig.FLUCTUATION/2, gapConfig.FLUCTUATION/2)
      : trainPoint.value * (1 + baseGap) + Random.between(-0.1, 0.1);
    
    // Apply overfitting effects after the overfitting point
    if (step >= clampedStart && !quality.isPoor) {
      const overfittingProgress = (step - clampedStart) / Math.max(1, totalSteps - clampedStart);
      
      if (isAccuracy) {
        validationValue -= TrainingConfig.OVERFITTING.ACCURACY_DEGRADATION * overfittingProgress;
      } else {
        validationValue += TrainingConfig.OVERFITTING.LOSS_INCREASE * overfittingProgress * trainPoint.value;
      }
    }
    
    // Ensure no NaN values in validation curves
    const finalValue = Number.isFinite(validationValue) 
      ? (isAccuracy ? Math.max(0, Math.min(1, validationValue)) : Math.max(0, validationValue))
      : (isAccuracy ? 0.1 : trainPoint.value);
      
    validationCurve.push({
      step,
      value: finalValue
    });
  });
  
  return validationCurve;
}
