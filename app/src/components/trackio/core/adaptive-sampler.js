// Adaptive Sampling System for Large Datasets
// Inspired by Weights & Biases approach to handle massive time series

/**
 * Adaptive Sampler - Intelligently reduces data points while preserving visual fidelity
 */
export class AdaptiveSampler {
  constructor(options = {}) {
    this.options = {
      maxPoints: 400,           // Seuil pour déclencher le sampling
      targetPoints: 200,        // Nombre cible de points après sampling
      preserveFeatures: true,   // Préserver les pics/vallées importantes
      adaptiveStrategy: 'smart', // 'uniform', 'smart', 'lod'
      smoothingWindow: 3,       // Fenêtre pour détection des features
      ...options
    };
  }

  /**
   * Détermine si le sampling est nécessaire
   */
  needsSampling(dataLength) {
    return dataLength > this.options.maxPoints;
  }

  /**
   * Point d'entrée principal pour le sampling
   */
  sampleSeries(data, strategy = null) {
    if (!Array.isArray(data) || data.length === 0) {
      return { data: [], sampledIndices: [], compressionRatio: 1 };
    }

    const actualStrategy = strategy || this.options.adaptiveStrategy;
    
    if (!this.needsSampling(data.length)) {
      return { 
        data: data.slice(), 
        sampledIndices: data.map((_, i) => i),
        compressionRatio: 1,
        strategy: 'none'
      };
    }

    console.log(`🎯 Sampling ${data.length} points with strategy: ${actualStrategy}`);

    switch (actualStrategy) {
      case 'uniform':
        return this.uniformSampling(data);
      case 'smart':
        return this.smartSampling(data);
      case 'lod':
        return this.lodSampling(data);
      default:
        return this.smartSampling(data);
    }
  }

  /**
   * Sampling uniforme - simple mais pas optimal
   */
  uniformSampling(data) {
    const step = Math.ceil(data.length / this.options.targetPoints);
    const sampledData = [];
    const sampledIndices = [];

    // Toujours inclure le premier et dernier point
    sampledData.push(data[0]);
    sampledIndices.push(0);

    for (let i = step; i < data.length - 1; i += step) {
      sampledData.push(data[i]);
      sampledIndices.push(i);
    }

    // Toujours inclure le dernier point
    if (data.length > 1) {
      sampledData.push(data[data.length - 1]);
      sampledIndices.push(data.length - 1);
    }

    return {
      data: sampledData,
      sampledIndices,
      compressionRatio: sampledData.length / data.length,
      strategy: 'uniform'
    };
  }

  /**
   * Smart sampling - préserve les features importantes
   * Inspiré de l'algorithme de Douglas-Peucker adapté pour les time series
   */
  smartSampling(data) {
    const targetPoints = this.options.targetPoints;
    const features = this.detectFeatures(data);
    
    // Étape 1: Points critiques (début, fin, features importantes)
    const criticalPoints = new Set([0, data.length - 1]);
    
    // Ajouter les features détectés
    features.peaks.forEach(idx => criticalPoints.add(idx));
    features.valleys.forEach(idx => criticalPoints.add(idx));
    features.inflectionPoints.forEach(idx => criticalPoints.add(idx));

    // Étape 2: Répartition logarithmique pour préserver la densité
    const remaining = targetPoints - criticalPoints.size;
    if (remaining > 0) {
      const logSamples = this.generateLogSpacing(data.length, remaining);
      logSamples.forEach(idx => criticalPoints.add(idx));
    }

    // Étape 3: Densité adaptive dans les zones de changement
    if (criticalPoints.size < targetPoints) {
      const variationSamples = this.sampleByVariation(data, targetPoints - criticalPoints.size);
      variationSamples.forEach(idx => criticalPoints.add(idx));
    }

    const sampledIndices = Array.from(criticalPoints).sort((a, b) => a - b);
    const sampledData = sampledIndices.map(idx => data[idx]);

    return {
      data: sampledData,
      sampledIndices,
      compressionRatio: sampledData.length / data.length,
      strategy: 'smart',
      features
    };
  }

  /**
   * Level-of-Detail sampling - adaptatif selon le zoom/contexte
   */
  lodSampling(data, viewportStart = 0, viewportEnd = 1, zoomLevel = 1) {
    const viewStart = Math.floor(viewportStart * data.length);
    const viewEnd = Math.ceil(viewportEnd * data.length);
    const viewData = data.slice(viewStart, viewEnd);
    
    // Plus de détails dans la zone visible
    const visibleTargetPoints = Math.floor(this.options.targetPoints * 0.7);
    const contextTargetPoints = this.options.targetPoints - visibleTargetPoints;
    
    // Sampling dense dans la zone visible
    const visibleSample = this.smartSampling(viewData);
    
    // Sampling sparse dans le contexte
    const beforeContext = data.slice(0, viewStart);
    const afterContext = data.slice(viewEnd);
    
    const beforeSample = beforeContext.length > 0 ? 
      this.uniformSampling(beforeContext) : { data: [], sampledIndices: [] };
    const afterSample = afterContext.length > 0 ? 
      this.uniformSampling(afterContext) : { data: [], sampledIndices: [] };

    // Combiner les résultats
    const combinedData = [
      ...beforeSample.data,
      ...visibleSample.data,
      ...afterSample.data
    ];

    const combinedIndices = [
      ...beforeSample.sampledIndices,
      ...visibleSample.sampledIndices.map(idx => idx + viewStart),
      ...afterSample.sampledIndices.map(idx => idx + viewEnd)
    ];

    return {
      data: combinedData,
      sampledIndices: combinedIndices,
      compressionRatio: combinedData.length / data.length,
      strategy: 'lod'
    };
  }

  /**
   * Détection des features importantes dans la série
   */
  detectFeatures(data) {
    const peaks = [];
    const valleys = [];
    const inflectionPoints = [];
    const window = this.options.smoothingWindow;

    for (let i = window; i < data.length - window; i++) {
      const current = data[i].value;
      const prev = data[i - 1].value;
      const next = data[i + 1].value;
      
      // Détection des pics locaux
      if (current > prev && current > next) {
        // Vérifier si c'est un pic significatif
        const localMax = Math.max(
          ...data.slice(i - window, i + window + 1).map(d => d.value)
        );
        if (current === localMax) {
          peaks.push(i);
        }
      }
      
      // Détection des vallées locales
      if (current < prev && current < next) {
        const localMin = Math.min(
          ...data.slice(i - window, i + window + 1).map(d => d.value)
        );
        if (current === localMin) {
          valleys.push(i);
        }
      }
      
      // Détection des points d'inflection (changement de courbure)
      if (i >= 2 && i < data.length - 2) {
        const trend1 = data[i].value - data[i - 2].value;
        const trend2 = data[i + 2].value - data[i].value;
        
        if (Math.sign(trend1) !== Math.sign(trend2) && Math.abs(trend1) > 0.01 && Math.abs(trend2) > 0.01) {
          inflectionPoints.push(i);
        }
      }
    }

    return { peaks, valleys, inflectionPoints };
  }

  /**
   * Génère des indices avec espacement logarithmique
   */
  generateLogSpacing(totalLength, count) {
    const indices = [];
    for (let i = 1; i <= count; i++) {
      const progress = i / (count + 1);
      // Fonction logarithmique pour plus de densité au début
      const logProgress = Math.log(1 + progress * (Math.E - 1)) / Math.log(Math.E);
      const index = Math.floor(logProgress * (totalLength - 1));
      indices.push(Math.max(1, Math.min(totalLength - 2, index)));
    }
    return [...new Set(indices)]; // Supprimer les doublons
  }

  /**
   * Échantillonnage basé sur la variation locale
   */
  sampleByVariation(data, targetPoints) {
    const variations = [];
    
    // Calculer la variation locale pour chaque point
    for (let i = 1; i < data.length - 1; i++) {
      const prev = data[i - 1].value;
      const curr = data[i].value;
      const next = data[i + 1].value;
      
      // Variation = différence avec la moyenne des voisins
      const avgNeighbors = (prev + next) / 2;
      const variation = Math.abs(curr - avgNeighbors);
      
      variations.push({ index: i, variation });
    }
    
    // Trier par variation décroissante et prendre les plus importantes
    variations.sort((a, b) => b.variation - a.variation);
    
    return variations.slice(0, targetPoints).map(v => v.index);
  }

  /**
   * Applique le sampling sur un objet de données complètes (multi-run)
   */
  sampleMetricData(metricData, strategy = null) {
    const sampledData = {};
    const samplingInfo = {};

    Object.keys(metricData).forEach(runName => {
      const runData = metricData[runName] || [];
      const result = this.sampleSeries(runData, strategy);
      
      sampledData[runName] = result.data;
      samplingInfo[runName] = {
        originalLength: runData.length,
        sampledLength: result.data.length,
        compressionRatio: result.compressionRatio,
        strategy: result.strategy,
        sampledIndices: result.sampledIndices
      };
    });

    return { sampledData, samplingInfo };
  }

  /**
   * Reconstruit les données complètes pour une zone spécifique (pour le zoom)
   */
  getFullDataForRange(originalData, samplingInfo, startStep, endStep) {
    // Cette méthode permettrait de récupérer plus de détails
    // quand l'utilisateur zoom sur une zone spécifique
    const startIdx = originalData.findIndex(d => d.step >= startStep);
    const endIdx = originalData.findIndex(d => d.step > endStep);
    
    return originalData.slice(startIdx, endIdx === -1 ? undefined : endIdx);
  }
}

/**
 * Instance globale configurée pour TrackIO
 */
export const trackioSampler = new AdaptiveSampler({
  maxPoints: 400,
  targetPoints: 200,
  preserveFeatures: true,
  adaptiveStrategy: 'smart'
});

/**
 * Fonction utilitaire pour usage direct
 */
export function sampleLargeDataset(metricData, options = {}) {
  const sampler = new AdaptiveSampler(options);
  return sampler.sampleMetricData(metricData);
}
