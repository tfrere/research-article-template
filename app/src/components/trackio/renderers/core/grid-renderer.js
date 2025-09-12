// Grid Rendering utilities for ChartRenderer
import * as d3 from 'd3';

/**
 * Grid Renderer - Handles grid line and dot rendering for different themes
 */
export class GridRenderer {
  constructor(svgManager) {
    this.svgManager = svgManager;
  }

  /**
   * Render grid based on variant (classic lines vs oblivion dots)
   */
  renderGrid(xTicksForced, yTicksForced, hoverSteps, variant = 'classic') {
    const { grid: gGrid, gridDots: gGridDots } = this.svgManager.getGroups();
    const { x: xScale, y: yScale } = this.svgManager.getScales();
    const shouldUseDots = variant === 'oblivion';
    
    if (shouldUseDots) {
      this.renderDotsGrid(gGrid, gGridDots, xTicksForced, yTicksForced, hoverSteps, xScale, yScale);
    } else {
      this.renderLinesGrid(gGrid, gGridDots, xTicksForced, yTicksForced, xScale, yScale);
    }
  }

  /**
   * Render grid as dots (Oblivion theme)
   */
  renderDotsGrid(gGrid, gGridDots, xTicksForced, yTicksForced, hoverSteps, xScale, yScale) {
    // Clear previous grid
    gGrid.selectAll('*').remove();
    gGridDots.selectAll('*').remove(); 
    
    const gridPoints = []; 
    const yMin = yScale.domain()[0]; 
    const desiredCols = 24; 
    const xGridStride = Math.max(1, Math.ceil(hoverSteps.length / desiredCols)); 
    const xGridIdx = []; 
    
    // Generate grid column positions
    for (let idx = 0; idx < hoverSteps.length; idx += xGridStride) {
      xGridIdx.push(idx); 
    }
    if (xGridIdx[xGridIdx.length - 1] !== hoverSteps.length - 1) {
      xGridIdx.push(hoverSteps.length - 1); 
    }
    
    // Create grid points at intersections
    xGridIdx.forEach(i => { 
      yTicksForced.forEach(t => { 
        if (i !== 0 && (yMin == null || t !== yMin)) {
          gridPoints.push({ sx: i, ty: t }); 
        }
      }); 
    }); 
    
    // Render dots
    gGridDots.selectAll('circle.grid-dot')
      .data(gridPoints)
      .join('circle')
      .attr('class', 'grid-dot')
      .attr('cx', d => xScale(d.sx))
      .attr('cy', d => yScale(d.ty))
      .attr('r', 1.25)
      .style('fill', 'var(--trackio-chart-grid-stroke)')
      .style('fill-opacity', 'var(--trackio-chart-grid-opacity)');
  }

  /**
   * Render grid as lines (Classic theme)
   */
  renderLinesGrid(gGrid, gGridDots, xTicksForced, yTicksForced, xScale, yScale) {
    // Clear previous grid
    gGridDots.selectAll('*').remove();
    gGrid.selectAll('*').remove();
    
    const innerHeight = this.svgManager.config.height - this.svgManager.config.margin.top - this.svgManager.config.margin.bottom;
    
    // Horizontal grid lines
    const xRange = xScale.range();
    const maxX = Math.max(...xRange);
    
    gGrid.selectAll('line.horizontal')
      .data(yTicksForced)
      .join('line')
      .attr('class', 'horizontal')
      .attr('x1', 0).attr('x2', maxX)
      .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
      .style('stroke', 'var(--trackio-chart-grid-stroke)')
      .style('stroke-opacity', 'var(--trackio-chart-grid-opacity)')
      .attr('stroke-width', 1);
      
    // Vertical grid lines
    gGrid.selectAll('line.vertical')
      .data(xTicksForced)
      .join('line')
      .attr('class', 'vertical')
      .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
      .attr('y1', 0).attr('y2', innerHeight)
      .style('stroke', 'var(--trackio-chart-grid-stroke)')
      .style('stroke-opacity', 'var(--trackio-chart-grid-opacity)')
      .attr('stroke-width', 1);
  }
}
