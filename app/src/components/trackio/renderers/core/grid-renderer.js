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

    // Use xTicksForced directly instead of generating indices from hoverSteps
    // This works correctly for both linear and logarithmic scales
    const xPositions = xTicksForced || [];

    // Create grid points at intersections
    xPositions.forEach(xVal => {
      yTicksForced.forEach(yVal => {
        // Skip first x position and y minimum to avoid edge dots
        if (xVal !== xPositions[0] && (yMin == null || yVal !== yMin)) {
          gridPoints.push({ sx: xVal, ty: yVal });
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

    // Horizontal grid lines only (vertical lines removed)
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
  }
}
