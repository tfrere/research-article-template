// Path Rendering utilities for ChartRenderer
import * as d3 from 'd3';

/**
 * Path Renderer - Handles rendering of training curves (lines and points)
 */
export class PathRenderer {
  constructor(svgManager) {
    this.svgManager = svgManager;
  }

  /**
   * Render all data series (lines and points)
   */
  renderSeries(runs, metricData, rawMetricData, colorForRun, smoothing, logScaleX, stepIndex, normalizeY) {
    const { lines: gLines, points: gPoints } = this.svgManager.getGroups();
    const { line: lineGen } = this.svgManager.getScales();
    
    // Prepare series data
    const series = runs.map(r => ({ 
      run: r, 
      color: colorForRun(r), 
      values: (metricData[r] || []).slice().sort((a, b) => a.step - b.step) 
    }));

    // Render background lines for smoothing
    if (smoothing && rawMetricData && Object.keys(rawMetricData).length > 0) {
      this.renderRawLines(gLines, runs, rawMetricData, colorForRun, lineGen);
    } else {
      gLines.selectAll('path.raw-line').remove();
    }

    // Render main lines
    this.renderMainLines(gLines, series, lineGen);

    // Render points
    this.renderPoints(gPoints, series, logScaleX, stepIndex, normalizeY);
  }

  /**
   * Render raw data lines (background when smoothing is enabled)
   */
  renderRawLines(gLines, runs, rawMetricData, colorForRun, lineGen) {
    const rawSeries = runs.map(r => ({ 
      run: r, 
      color: colorForRun(r), 
      values: (rawMetricData[r] || []).slice().sort((a, b) => a.step - b.step) 
    }));
    
    const rawPaths = gLines.selectAll('path.raw-line')
      .data(rawSeries, d => d.run + '-raw'); 
    
    // Enter
    rawPaths.enter()
      .append('path')
      .attr('class', 'raw-line')
      .attr('data-run', d => d.run)
      .attr('fill', 'none')
      .attr('stroke-width', 1)
      .attr('opacity', 0.2)
      .attr('stroke', d => d.color)
      .style('pointer-events', 'none')
      .attr('d', d => lineGen(d.values)); 
    
    // Update
    rawPaths
      .attr('stroke', d => d.color)
      .attr('opacity', 0.2)
      .attr('d', d => lineGen(d.values));
    
    // Exit
    rawPaths.exit().remove();
  }

  /**
   * Render main data lines
   */
  renderMainLines(gLines, series, lineGen) {
    const paths = gLines.selectAll('path.run-line')
      .data(series, d => d.run); 
    
    // Enter
    paths.enter()
      .append('path')
      .attr('class', 'run-line')
      .attr('data-run', d => d.run)
      .attr('fill', 'none')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.9)
      .attr('stroke', d => d.color)
      .style('pointer-events', 'none')
      .attr('d', d => lineGen(d.values)); 
    
    // Update with transition
    paths.transition()
      .duration(160)
      .attr('stroke', d => d.color)
      .attr('opacity', 0.9)
      .attr('d', d => lineGen(d.values));
    
    // Exit
    paths.exit().remove();
  }

  /**
   * Render data points
   */
  renderPoints(gPoints, series, logScaleX, stepIndex, normalizeY) {
    const { x: xScale, y: yScale } = this.svgManager.getScales();
    
    const allPoints = series.flatMap(s => 
      s.values.map(v => ({ 
        run: s.run, 
        color: s.color, 
        step: v.step, 
        value: v.value 
      }))
    );
    
    const ptsSel = gPoints.selectAll('circle.pt')
      .data(allPoints, d => `${d.run}-${d.step}`); 
    
    // Enter
    ptsSel.enter()
      .append('circle')
      .attr('class', 'pt')
      .attr('data-run', d => d.run)
      .attr('r', 0)
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.6)
      .attr('stroke', 'none')
      .style('pointer-events', 'none')
      .attr('cx', d => logScaleX ? xScale(d.step) : xScale(stepIndex.get(d.step)))
      .attr('cy', d => yScale(normalizeY(d.value)))
      .merge(ptsSel)
      .attr('cx', d => logScaleX ? xScale(d.step) : xScale(stepIndex.get(d.step)))
      .attr('cy', d => yScale(normalizeY(d.value))); 
    
    // Exit
    ptsSel.exit().remove();
  }

  /**
   * Update point visibility based on hover state
   */
  updatePointVisibility(nearestStep) {
    const { points: gPoints } = this.svgManager.getGroups();
    
    try { 
      gPoints.selectAll('circle.pt')
        .attr('r', d => (d && d.step === nearestStep ? 4 : 0)); 
    } catch(_) {} 
  }

  /**
   * Reset all points to hidden state
   */
  hideAllPoints() {
    const { points: gPoints } = this.svgManager.getGroups();
    
    try { 
      gPoints.selectAll('circle.pt').attr('r', 0); 
    } catch(_) {} 
  }
}
