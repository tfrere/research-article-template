// Chart utilities for axis formatting and tick generation

export const formatAbbrev = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  const abs = Math.abs(num);
  const trim2 = (n) => Number(n).toFixed(2).replace(/\.?0+$/, '');
  if (abs >= 1e9) return `${trim2(num / 1e9)}B`;
  if (abs >= 1e6) return `${trim2(num / 1e6)}M`;
  if (abs >= 1e3) return `${trim2(num / 1e3)}K`;
  return trim2(num);
};

/**
 * Enhanced formatting for logarithmic scale ticks
 * @param {number} value - The tick value
 * @param {boolean} isLogScale - Whether this is for a log scale
 * @returns {string} Formatted tick label
 */
export const formatLogTick = (value, isLogScale = false) => {
  if (!isLogScale) return formatAbbrev(value);
  
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  
  // Check if it's a power of 10
  const log10 = Math.log10(Math.abs(num));
  const isPowerOf10 = Math.abs(log10 % 1) < 0.01;
  
  if (isPowerOf10) {
    // Format powers of 10 more prominently
    const power = Math.round(log10);
    if (power >= 0 && power <= 6) {
      // For small powers, show the actual number
      return formatAbbrev(value);
    } else {
      // For very large/small powers, use scientific notation
      return `10^${power}`;
    }
  }
  
  // For non-powers of 10, use regular formatting
  return formatAbbrev(value);
};

/**
 * Generates optimized tick positions for logarithmic scales
 * @param {Array} stepValues - Array of actual step values (not indices)
 * @param {number} minTicks - Minimum number of ticks desired
 * @param {number} maxTicks - Maximum number of ticks allowed
 * @param {number} width - Chart width in pixels
 * @param {Function} scale - D3 log scale function
 * @returns {Object} Object with major and minor tick positions
 */
export function generateLogTicks(stepValues, minTicks, maxTicks, width, scale) {
  if (!stepValues || stepValues.length === 0 || !scale) return { major: [], minor: [] };
  
  const minPixelSpacing = 50; // Reduced for better density
  const minorPixelSpacing = 25; // Spacing for minor ticks
  const maxTicksFromWidth = Math.max(4, Math.floor(width / minPixelSpacing));
  const targetMaxTicks = Math.min(maxTicks, maxTicksFromWidth);
  
  // Debug logging
  console.log('🎯 generateLogTicks called:', {
    stepCount: stepValues.length,
    stepRange: [Math.min(...stepValues), Math.max(...stepValues)],
    targetTicks: [minTicks, targetMaxTicks],
    width
  });
  
  const domain = scale.domain();
  const [minVal, maxVal] = domain;
  
  // Calculate the range in log space
  const logMin = Math.log10(minVal);
  const logMax = Math.log10(maxVal);
  const logRange = logMax - logMin;
  
  // Generate major ticks (powers of 10)
  const majorCandidates = new Set();
  const minorCandidates = new Set();
  
  // Always add domain boundaries
  majorCandidates.add(minVal);
  majorCandidates.add(maxVal);
  
  const startPower = Math.floor(logMin);
  const endPower = Math.ceil(logMax);
  
  // Major ticks: powers of 10
  for (let power = startPower; power <= endPower; power++) {
    const value = Math.pow(10, power);
    if (value >= minVal && value <= maxVal) {
      majorCandidates.add(value);
    }
  }
  
  // If we have space, add more major ticks (2x, 5x)
  if (logRange > 0.7) {
    for (let power = startPower; power <= endPower; power++) {
      const base = Math.pow(10, power);
      [2, 5].forEach(multiplier => {
        const value = base * multiplier;
        if (value >= minVal && value <= maxVal) {
          majorCandidates.add(value);
        }
      });
    }
  }
  
  // Minor ticks: intermediate values to show log progression
  for (let power = startPower; power <= endPower; power++) {
    const base = Math.pow(10, power);
    // Add 3x, 4x, 6x, 7x, 8x, 9x for visual density
    [3, 4, 6, 7, 8, 9].forEach(multiplier => {
      const value = base * multiplier;
      if (value >= minVal && value <= maxVal && !majorCandidates.has(value)) {
        minorCandidates.add(value);
      }
    });
  }
  
  // Match candidates to actual step values
  const matchToStepValues = (candidates) => {
    return Array.from(candidates).map(candidate => {
      let closest = stepValues[0];
      let minRelativeDistance = Math.abs(stepValues[0] - candidate) / Math.max(stepValues[0], candidate);
      
      stepValues.forEach(step => {
        const relativeDistance = Math.abs(step - candidate) / Math.max(step, candidate);
        if (relativeDistance < minRelativeDistance) {
          minRelativeDistance = relativeDistance;
          closest = step;
        }
      });
      
      // Only include if reasonable match (20% tolerance for minor, 15% for major)
      const isPowerOf10 = Math.abs(Math.log10(candidate) % 1) < 0.01;
      const tolerance = majorCandidates.has(candidate) ? 0.15 : 0.20;
      
      if (minRelativeDistance < tolerance || isPowerOf10) {
        return closest;
      }
      return null;
    }).filter(v => v !== null);
  };
  
  let majorTicks = Array.from(new Set(matchToStepValues(majorCandidates))).sort((a, b) => a - b);
  let minorTicks = Array.from(new Set(matchToStepValues(minorCandidates))).sort((a, b) => a - b);
  
  // Filter major ticks by pixel spacing
  const filteredMajorTicks = [];
  majorTicks.forEach(tick => {
    if (filteredMajorTicks.length === 0) {
      filteredMajorTicks.push(tick);
    } else {
      const prevTick = filteredMajorTicks[filteredMajorTicks.length - 1];
      const pixelDistance = Math.abs(scale(tick) - scale(prevTick));
      if (pixelDistance >= minPixelSpacing) {
        filteredMajorTicks.push(tick);
      }
    }
  });
  
  // Filter minor ticks by pixel spacing and ensure they don't conflict with major ticks
  const filteredMinorTicks = [];
  minorTicks.forEach(tick => {
    // Skip if too close to any major tick
    const tooCloseToMajor = filteredMajorTicks.some(majorTick => {
      const distance = Math.abs(scale(tick) - scale(majorTick));
      return distance < minorPixelSpacing;
    });
    
    if (!tooCloseToMajor) {
      // Check spacing with previous minor tick
      if (filteredMinorTicks.length === 0) {
        filteredMinorTicks.push(tick);
      } else {
        const prevTick = filteredMinorTicks[filteredMinorTicks.length - 1];
        const pixelDistance = Math.abs(scale(tick) - scale(prevTick));
        if (pixelDistance >= minorPixelSpacing) {
          filteredMinorTicks.push(tick);
        }
      }
    }
  });
  
  const result = {
    major: filteredMajorTicks.length >= 2 ? filteredMajorTicks : [minVal, maxVal],
    minor: filteredMinorTicks
  };
  
  // Debug logging
  console.log('🎯 generateLogTicks result:', {
    logRange: logRange.toFixed(2),
    majorCount: result.major.length,
    minorCount: result.minor.length,
    majorTicks: result.major,
    minorTicks: result.minor
  });
  
  return result;
}

/**
 * Generates intelligent tick positions for X-axis with nice intervals
 * @param {Array} steps - Array of step values (e.g., [1, 2, 3, ..., 100])
 * @param {number} minTicks - Minimum number of ticks desired
 * @param {number} maxTicks - Maximum number of ticks allowed
 * @param {number} width - Chart width in pixels
 * @returns {Array} Array of step indices for tick positions
 */
export function generateSmartTicks(steps, minTicks, maxTicks, width) {
  if (!steps || steps.length === 0) return [];
  
  const totalSteps = steps.length;
  const minPixelSpacing = 75; // Slightly reduced minimum spacing to allow more ticks
  const maxTicksFromWidth = Math.max(3, Math.floor(width / minPixelSpacing));
  
  // Function to check if ticks would be too close (minimum step difference)
  const getMinStepDifference = (totalSteps, width) => {
    const pixelsPerStep = width / (totalSteps - 1);
    return Math.ceil(minPixelSpacing / pixelsPerStep);
  };
  
  const minStepDiff = getMinStepDifference(totalSteps, width);
  const maxPossibleTicks = Math.floor((totalSteps - 1) / minStepDiff) + 1;
  
  // Ensure we aim for at least 5 ticks if space permits
  const targetMinTicks = Math.min(Math.max(minTicks, 5), maxPossibleTicks, totalSteps);
  const targetMaxTicks = Math.min(maxTicks, maxTicksFromWidth, maxPossibleTicks);
  
  // Start with first and last
  if (targetMinTicks <= 2 || totalSteps <= 2) {
    return [0, totalSteps - 1];
  }
  
  // Helper to validate spacing
  const hasValidSpacing = (ticks) => {
    for (let i = 1; i < ticks.length; i++) {
      if (ticks[i] - ticks[i-1] < minStepDiff) return false;
    }
    return true;
  };
  
  // Try nice intervals first
  const candidateIntervals = [];
  const niceIntervals = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  
  for (const interval of niceIntervals) {
    if (interval >= totalSteps) continue;
    
    const candidateTicks = [0];
    const firstStepValue = steps[0];
    const lastStepValue = steps[totalSteps - 1];
    const firstNiceValue = Math.ceil(firstStepValue / interval) * interval;
    
    // Add ticks for nice step values
    for (let niceValue = firstNiceValue; niceValue < lastStepValue; niceValue += interval) {
      let closestIndex = 0;
      let minDist = Infinity;
      for (let i = 0; i < steps.length; i++) {
        const dist = Math.abs(steps[i] - niceValue);
        if (dist < minDist) {
          minDist = dist;
          closestIndex = i;
        }
      }
      
      // Be more permissive with matching (15% instead of 10%)
      if (minDist <= interval * 0.15 && closestIndex > 0 && closestIndex < totalSteps - 1) {
        candidateTicks.push(closestIndex);
      }
    }
    
    candidateTicks.push(totalSteps - 1);
    const uniqueTicks = [...new Set(candidateTicks)].sort((a,b) => a-b);
    
    if (hasValidSpacing(uniqueTicks) && uniqueTicks.length >= 3) {
      candidateIntervals.push({
        interval: interval,
        ticks: uniqueTicks,
        count: uniqueTicks.length,
        niceness: (interval <= 10 ? 100 : (interval <= 50 ? 50 : (interval <= 100 ? 25 : 10)))
      });
    }
  }
  
  // Force generation of ticks if we don't have enough nice ones
  if (candidateIntervals.length === 0 || candidateIntervals.every(c => c.count < targetMinTicks)) {
    // Try multiple approaches to get targetMinTicks
    for (let targetCount = Math.min(targetMinTicks, maxPossibleTicks); targetCount >= 3; targetCount--) {
      // Approach 1: Even distribution
      const evenSpacing = Math.floor((totalSteps - 1) / (targetCount - 1));
      const evenTicks = [];
      for (let i = 0; i < targetCount - 1; i++) {
        evenTicks.push(i * evenSpacing);
      }
      evenTicks.push(totalSteps - 1);
      
      if (hasValidSpacing(evenTicks)) {
        candidateIntervals.push({
          interval: evenSpacing,
          ticks: evenTicks,
          count: evenTicks.length,
          niceness: 5 // Medium priority
        });
        break; // Found a good solution
      }
      
      // Approach 2: Try to fit exactly targetCount ticks with optimal spacing
      if (targetCount <= maxPossibleTicks) {
        const optimalSpacing = Math.max(minStepDiff, Math.floor((totalSteps - 1) / (targetCount - 1)));
        const spacedTicks = [0];
        let currentPos = 0;
        
        for (let i = 1; i < targetCount - 1; i++) {
          currentPos += optimalSpacing;
          if (currentPos < totalSteps - 1) {
            spacedTicks.push(Math.min(currentPos, totalSteps - 1 - minStepDiff));
          }
        }
        spacedTicks.push(totalSteps - 1);
        
        const uniqueSpacedTicks = [...new Set(spacedTicks)].sort((a,b) => a-b);
        if (hasValidSpacing(uniqueSpacedTicks) && uniqueSpacedTicks.length >= targetCount - 1) {
          candidateIntervals.push({
            interval: optimalSpacing,
            ticks: uniqueSpacedTicks,
            count: uniqueSpacedTicks.length,
            niceness: 3 // Lower priority than nice intervals
          });
          break;
        }
      }
    }
  }
  
  // Absolute fallback
  if (candidateIntervals.length === 0) {
    const middle = Math.floor(totalSteps / 2);
    if (middle !== 0 && middle !== totalSteps - 1 && 
        middle - 0 >= minStepDiff && totalSteps - 1 - middle >= minStepDiff) {
      return [0, middle, totalSteps - 1];
    }
    return [0, totalSteps - 1];
  }
  
  // Sort: prioritize having enough ticks, then niceness
  candidateIntervals.sort((a, b) => {
    const aHasEnoughTicks = a.count >= targetMinTicks;
    const bHasEnoughTicks = b.count >= targetMinTicks;
    
    // First: prefer solutions with enough ticks
    if (aHasEnoughTicks !== bHasEnoughTicks) {
      return bHasEnoughTicks ? 1 : -1;
    }
    
    // Second: prefer nicer intervals
    if (a.niceness !== b.niceness) {
      return b.niceness - a.niceness;
    }
    
    // Third: prefer more ticks if both are nice
    return b.count - a.count;
  });
  
  return candidateIntervals[0].ticks;
}

/**
 * Applies smoothing to data series using moving average
 * @param {Array} data - Array of {step, value} objects
 * @param {number} windowSize - Size of the smoothing window (default: 5)
 * @returns {Array} Smoothed data series
 */
export function smoothData(data, windowSize = 5) {
  if (!data || data.length === 0) return data;
  if (data.length < windowSize) return data; // Not enough data to smooth
  
  const smoothed = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length - 1, i + halfWindow);
    
    let sum = 0;
    let count = 0;
    
    // Calculate weighted average with more weight to center point
    for (let j = start; j <= end; j++) {
      const distance = Math.abs(j - i);
      const weight = distance === 0 ? 2 : (distance === 1 ? 1.5 : 1); // Center gets more weight
      sum += data[j].value * weight;
      count += weight;
    }
    
    smoothed.push({
      step: data[i].step,
      value: sum / count
    });
  }
  
  return smoothed;
}

/**
 * Applies smoothing to all runs in metric data
 * @param {Object} metricData - Object with run names as keys and data arrays as values
 * @param {number} windowSize - Size of the smoothing window
 * @returns {Object} Smoothed metric data
 */
export function smoothMetricData(metricData, windowSize = 5) {
  if (!metricData) return metricData;
  
  const smoothedData = {};
  Object.keys(metricData).forEach(runName => {
    smoothedData[runName] = smoothData(metricData[runName], windowSize);
  });
  
  return smoothedData;
}
