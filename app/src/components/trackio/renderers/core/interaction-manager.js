// Interaction Management utilities for ChartRenderer
import * as d3 from 'd3';

/**
 * Interaction Manager - Handles mouse interactions, hover effects, and tooltips
 */
export class InteractionManager {
  constructor(svgManager, pathRenderer) {
    this.svgManager = svgManager;
    this.pathRenderer = pathRenderer;
    this.hoverLine = null;
    this.hideTipTimer = null;
  }

  /**
   * Setup hover interactions for the chart
   */
  setupHoverInteractions(hoverSteps, stepIndex, series, normalizeY, isAccuracy, innerWidth, logScaleX, onHover, onLeave) {
    const { hover: gHover } = this.svgManager.getGroups();
    const { x: xScale, y: yScale } = this.svgManager.getScales();
    
    if (!gHover || !this.svgManager.container) return;
    
    gHover.selectAll('*').remove(); 
    
    // Calculate dimensions
    const { innerWidth: currentInnerWidth, innerHeight: currentInnerHeight } = this.svgManager.calculateDimensions();
    const actualInnerWidth = innerWidth || currentInnerWidth;
    const actualInnerHeight = currentInnerHeight;
    
    // Create interaction overlay
    const overlay = gHover.append('rect')
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', actualInnerWidth)
      .attr('height', actualInnerHeight)
      .style('pointer-events', 'all'); 
      
    // Create hover line
    this.hoverLine = gHover.append('line')
      .style('stroke', 'var(--text-color)')
      .attr('stroke-opacity', 0.25)
      .attr('stroke-width', 1)
      .attr('y1', 0)
      .attr('y2', actualInnerHeight)
      .style('display', 'none')
      .style('pointer-events', 'none'); 
    
    // Mouse move handler
    const onMove = (ev) => { 
      try {
        if (this.hideTipTimer) { 
          clearTimeout(this.hideTipTimer); 
          this.hideTipTimer = null; 
        } 
        
        const [mx, my] = d3.pointer(ev, overlay.node());
        const globalX = ev.clientX;
        const globalY = ev.clientY; 
      
        // Find nearest step
        const { nearest, xpx } = this.findNearestStep(mx, hoverSteps, stepIndex, logScaleX, xScale);
        
        // Update hover line
        this.hoverLine.attr('x1', xpx).attr('x2', xpx).style('display', null); 
        
        // Prepare hover data
        const entries = this.prepareHoverData(series, nearest, normalizeY, isAccuracy);
        
        // Call parent hover callback
        if (onHover && entries.length > 0) {
          onHover({
            step: nearest,
            entries,
            position: { x: mx, y: my, globalX, globalY }
          });
        }
        
        // Update point visibility
        this.pathRenderer.updatePointVisibility(nearest);
        
      } catch(error) {
        console.error('Error in hover interaction:', error);
      }
    };
    
    // Mouse leave handler
    const onMouseLeave = () => { 
      this.hideTipTimer = setTimeout(() => { 
        this.hoverLine.style('display', 'none'); 
        if (onLeave) onLeave();
        this.pathRenderer.hideAllPoints();
      }, 0); 
    };
    
    // Attach event listeners
    overlay.on('mousemove', onMove).on('mouseleave', onMouseLeave);
  }

  /**
   * Find the nearest step to mouse position
   */
  findNearestStep(mx, hoverSteps, stepIndex, logScaleX, xScale) {
    let nearest, xpx;
    
    if (logScaleX) {
      const mouseStepValue = xScale.invert(mx);
      let minDist = Infinity;
      let closestStep = hoverSteps[0];
      
      hoverSteps.forEach(step => {
        const dist = Math.abs(Math.log(step) - Math.log(mouseStepValue));
        if (dist < minDist) {
          minDist = dist;
          closestStep = step;
        }
      });
      
      nearest = closestStep;
      xpx = xScale(nearest);
    } else {
      const idx = Math.round(Math.max(0, Math.min(hoverSteps.length - 1, xScale.invert(mx)))); 
      nearest = hoverSteps[idx]; 
      xpx = xScale(idx);
    }
    
    return { nearest, xpx };
  }

  /**
   * Prepare data for hover tooltip
   */
  prepareHoverData(series, nearestStep, normalizeY, isAccuracy) {
    const entries = series.map(s => { 
      const m = new Map(s.values.map(v => [v.step, v])); 
      const pt = m.get(nearestStep); 
      return { run: s.run, color: s.color, pt }; 
    }).filter(e => e.pt && e.pt.value != null)
      .sort((a, b) => a.pt.value - b.pt.value); 
    
    const fmt = (vv) => (isAccuracy ? (+vv).toFixed(4) : (+vv).toFixed(4)); 
    
    return entries.map(e => ({ 
      color: e.color, 
      name: e.run, 
      valueText: fmt(e.pt.value) 
    }));
  }

  /**
   * Programmatically show hover line at specific step
   */
  showHoverLine(step, hoverSteps, stepIndex, logScaleX) {
    if (!this.hoverLine || !this.svgManager.getScales().x) return;
    
    const { x: xScale } = this.svgManager.getScales();
    
    try {
      let xpx;
      if (logScaleX) {
        xpx = xScale(step);
      } else {
        const stepIndexValue = hoverSteps.indexOf(step);
        if (stepIndexValue >= 0) {
          xpx = xScale(stepIndexValue);
        }
      }
      
      if (xpx !== undefined) {
        this.hoverLine.attr('x1', xpx).attr('x2', xpx).style('display', null);
      }
    } catch (e) {
      console.warn('Error showing hover line:', e);
    }
  }

  /**
   * Hide hover line
   */
  hideHoverLine() {
    if (this.hoverLine) {
      this.hoverLine.style('display', 'none');
    }
  }

  /**
   * Clean up interaction elements
   */
  destroy() {
    if (this.hideTipTimer) {
      clearTimeout(this.hideTipTimer);
      this.hideTipTimer = null;
    }
    this.hoverLine = null;
  }
}
