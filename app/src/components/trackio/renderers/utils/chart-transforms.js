// Data transformation utilities for ChartRenderer

/**
 * Chart data transformations and calculations
 */
export class ChartTransforms {
  
  /**
   * Process metric data and calculate domains
   */
  static processMetricData(metricData, metricKey, normalizeLoss) {
    const runs = Object.keys(metricData || {});
    const hasAny = runs.some(r => (metricData[r] || []).length > 0);
    
    if (!hasAny) {
      return { 
        runs: [], 
        hasData: false, 
        minStep: 0, 
        maxStep: 0, 
        minVal: 0, 
        maxVal: 1,
        yDomain: [0, 1],
        stepSet: new Set(),
        hoverSteps: []
      };
    }

    // Calculate data bounds
    let minStep = Infinity, maxStep = -Infinity, minVal = Infinity, maxVal = -Infinity;
    runs.forEach(r => { 
      (metricData[r] || []).forEach(pt => { 
        minStep = Math.min(minStep, pt.step); 
        maxStep = Math.max(maxStep, pt.step); 
        minVal = Math.min(minVal, pt.value); 
        maxVal = Math.max(maxVal, pt.value); 
      }); 
    });
    
    // Determine Y domain based on metric type
    const isAccuracy = /accuracy/i.test(metricKey); 
    const isLoss = /loss/i.test(metricKey);
    let yDomain;
    
    if (isAccuracy) {
      yDomain = [0, 1];
    } else if (isLoss && normalizeLoss) {
      yDomain = [0, 1];
    } else {
      yDomain = [minVal, maxVal];
    }
    
    // Collect all steps for hover interactions
    const stepSet = new Set(); 
    runs.forEach(r => (metricData[r] || []).forEach(v => stepSet.add(v.step)));
    const hoverSteps = Array.from(stepSet).sort((a, b) => a - b); 
    
    return {
      runs,
      hasData: true,
      minStep,
      maxStep,
      minVal,
      maxVal,
      yDomain,
      stepSet,
      hoverSteps,
      isAccuracy,
      isLoss
    };
  }

  /**
   * Setup scales based on data and scale type
   */
  static setupScales(svgManager, processedData, logScaleX) {
    const { hoverSteps, yDomain } = processedData;
    const { x: xScale, y: yScale, line: lineGen } = svgManager.getScales();
    
    // Update scales
    yScale.domain(yDomain).nice();
    
    let stepIndex = null;
    
    if (logScaleX) {
      const minStep = Math.max(1, Math.min(...hoverSteps));
      const maxStep = Math.max(...hoverSteps);
      xScale.domain([minStep, maxStep]);
      lineGen.x(d => xScale(d.step));
    } else {
      stepIndex = new Map(hoverSteps.map((s, i) => [s, i]));
      xScale.domain([0, Math.max(0, hoverSteps.length - 1)]);
      lineGen.x(d => xScale(stepIndex.get(d.step)));
    }
    
    return { stepIndex };
  }

  /**
   * Create normalization function for Y values
   */
  static createNormalizeFunction(processedData, normalizeLoss) {
    const { isLoss, minVal, maxVal } = processedData;
    
    return (v) => {
      if (isLoss && normalizeLoss) {
        return ((maxVal > minVal) ? (v - minVal) / (maxVal - minVal) : 0);
      }
      return v;
    };
  }

  /**
   * Validate and clean data values
   */
  static validateData(metricData) {
    const cleanedData = {};
    
    Object.keys(metricData || {}).forEach(run => {
      const values = metricData[run] || [];
      cleanedData[run] = values.filter(pt => 
        pt && 
        typeof pt.step === 'number' && 
        typeof pt.value === 'number' &&
        Number.isFinite(pt.step) && 
        Number.isFinite(pt.value)
      );
    });
    
    return cleanedData;
  }

  /**
   * Calculate chart dimensions based on content
   */
  static calculateOptimalDimensions(dataCount, containerWidth) {
    // Suggest optimal dimensions based on data density
    const minHeight = 120;
    const maxHeight = 300;
    const baseHeight = 150;
    
    // More data points = slightly taller chart for better readability
    const heightMultiplier = Math.min(1.5, 1 + (dataCount / 1000) * 0.5);
    const suggestedHeight = Math.min(maxHeight, Math.max(minHeight, baseHeight * heightMultiplier));
    
    return {
      width: containerWidth || 800,
      height: suggestedHeight
    };
  }

  /**
   * Prepare hover step data for interactions
   */
  static prepareHoverSteps(processedData, logScaleX) {
    const { hoverSteps } = processedData;
    
    if (!hoverSteps.length) return { hoverSteps: [], stepIndex: null };
    
    let stepIndex = null;
    
    if (!logScaleX) {
      stepIndex = new Map(hoverSteps.map((s, i) => [s, i]));
    }
    
    return { hoverSteps, stepIndex };
  }
}
