// Adaptive Sampling System for Large Datasets
// Inspired by Weights & Biases approach to handle massive time series

/**
 * Adaptive Sampler - Intelligently reduces data points while preserving visual fidelity
 */
export class AdaptiveSampler {
  constructor(options = {}) {
    this.options = {
      maxPoints: 400,           // Threshold to trigger sampling
      targetPoints: 200,        // Target number of points after sampling
      preserveFeatures: true,   // Preserve important peaks/valleys
      adaptiveStrategy: 'smart', // 'uniform', 'smart', 'lod'
      smoothingWindow: 3,       // Window for feature detection
      ...options
    };
  }

  /**
   * Determine if sampling is necessary
   */
  needsSampling(dataLength) {
    return dataLength > this.options.maxPoints;
  }

  /**
   * Main entry point for sampling
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
   * Smart sampling - preserves important features
   * Inspired by Douglas-Peucker algorithm adapted for time series
   */
  smartSampling(data) {
    const targetPoints = this.options.targetPoints;
    const features = this.detectFeatures(data);

    // Step 1: Critical points (start, end, important features)
    const criticalPoints = new Set([0, data.length - 1]);

    // Add detected features
    features.peaks.forEach(idx => criticalPoints.add(idx));
    features.valleys.forEach(idx => criticalPoints.add(idx));
    features.inflectionPoints.forEach(idx => criticalPoints.add(idx));

    // Step 2: Logarithmic distribution to preserve density
    const remaining = targetPoints - criticalPoints.size;
    if (remaining > 0) {
      const logSamples = this.generateLogSpacing(data.length, remaining);
      logSamples.forEach(idx => criticalPoints.add(idx));
    }

    // Step 3: Adaptive density in zones of change
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
   * Level-of-Detail sampling - adaptive based on zoom/context
   */
  lodSampling(data, viewportStart = 0, viewportEnd = 1, zoomLevel = 1) {
    const viewStart = Math.floor(viewportStart * data.length);
    const viewEnd = Math.ceil(viewportEnd * data.length);
    const viewData = data.slice(viewStart, viewEnd);

    // More detail in the visible area
    const visibleTargetPoints = Math.floor(this.options.targetPoints * 0.7);
    const contextTargetPoints = this.options.targetPoints - visibleTargetPoints;

    // Dense sampling in the visible area
    const visibleSample = this.smartSampling(viewData);

    // Sparse sampling in the context
    const beforeContext = data.slice(0, viewStart);
    const afterContext = data.slice(viewEnd);

    const beforeSample = beforeContext.length > 0 ?
      this.uniformSampling(beforeContext) : { data: [], sampledIndices: [] };
    const afterSample = afterContext.length > 0 ?
      this.uniformSampling(afterContext) : { data: [], sampledIndices: [] };

    // Combine results
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
   * Detect important features in the series
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

      // Detect local peaks
      if (current > prev && current > next) {
        // Check if it's a significant peak
        const localMax = Math.max(
          ...data.slice(i - window, i + window + 1).map(d => d.value)
        );
        if (current === localMax) {
          peaks.push(i);
        }
      }

      // Detect local valleys
      if (current < prev && current < next) {
        const localMin = Math.min(
          ...data.slice(i - window, i + window + 1).map(d => d.value)
        );
        if (current === localMin) {
          valleys.push(i);
        }
      }

      // Detect inflection points (curvature change)
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
   * Generate indices with logarithmic spacing
   */
  generateLogSpacing(totalLength, count) {
    const indices = [];
    for (let i = 1; i <= count; i++) {
      const progress = i / (count + 1);
      // Logarithmic function for more density at the beginning
      const logProgress = Math.log(1 + progress * (Math.E - 1)) / Math.log(Math.E);
      const index = Math.floor(logProgress * (totalLength - 1));
      indices.push(Math.max(1, Math.min(totalLength - 2, index)));
    }
    return [...new Set(indices)]; // Remove duplicates
  }

  /**
   * Sampling based on local variation
   */
  sampleByVariation(data, targetPoints) {
    const variations = [];

    // Calculate local variation for each point
    for (let i = 1; i < data.length - 1; i++) {
      const prev = data[i - 1].value;
      const curr = data[i].value;
      const next = data[i + 1].value;

      // Variation = difference from the average of neighbors
      const avgNeighbors = (prev + next) / 2;
      const variation = Math.abs(curr - avgNeighbors);

      variations.push({ index: i, variation });
    }

    // Sort by decreasing variation and take the most important ones
    variations.sort((a, b) => b.variation - a.variation);

    return variations.slice(0, targetPoints).map(v => v.index);
  }

  /**
   * Apply sampling on a complete data object (multi-run)
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
   * Rebuild full data for a specific range (for zoom)
   */
  getFullDataForRange(originalData, samplingInfo, startStep, endStep) {
    // This method would allow recovering more details
    // when the user zooms on a specific area
    const startIdx = originalData.findIndex(d => d.step >= startStep);
    const endIdx = originalData.findIndex(d => d.step > endStep);

    return originalData.slice(startIdx, endIdx === -1 ? undefined : endIdx);
  }
}

/**
 * Global instance configured for TrackIO
 */
export const trackioSampler = new AdaptiveSampler({
  maxPoints: 400,
  targetPoints: 200,
  preserveFeatures: true,
  adaptiveStrategy: 'smart'
});

/**
 * Utility function for direct usage
 */
export function sampleLargeDataset(metricData, options = {}) {
  const sampler = new AdaptiveSampler(options);
  return sampler.sampleMetricData(metricData);
}
