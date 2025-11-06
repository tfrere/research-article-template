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
    this.externalOverlay = null; // For using zoom overlay

    // Performance optimization for large datasets
    this.lastHoverTime = 0;
    this.hoverThrottleMs = 16; // ~60fps max hover rate
    this.lastNearestStep = null;
  }

  /**
   * Set an external overlay to use instead of creating our own
   * This is used when zoom is enabled to share the same overlay
   */
  setExternalOverlay(overlay) {
    this.externalOverlay = overlay;
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

    // Use external overlay if provided (zoom overlay), otherwise create our own
    let overlay;
    if (this.externalOverlay) {
      overlay = this.externalOverlay;
      // Keep cursor as grab when using zoom overlay
    } else {
      // Create interaction overlay
      overlay = gHover.append('rect')
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', actualInnerWidth)
        .attr('height', actualInnerHeight)
        .style('pointer-events', 'all');
    }

    // Create hover line
    this.hoverLine = gHover.append('line')
      .style('stroke', 'var(--text-color)')
      .attr('stroke-opacity', 0.25)
      .attr('stroke-width', 1)
      .attr('y1', 0)
      .attr('y2', actualInnerHeight)
      .style('display', 'none')
      .style('pointer-events', 'none');

    // Mouse move handler with throttling for performance
    const onMove = (ev) => {
      try {
        // Throttle hover events for large datasets
        const now = performance.now();
        const isLargeDataset = hoverSteps.length > 400;

        if (isLargeDataset && (now - this.lastHoverTime) < this.hoverThrottleMs) {
          return; // Skip this hover event
        }
        this.lastHoverTime = now;

        if (this.hideTipTimer) {
          clearTimeout(this.hideTipTimer);
          this.hideTipTimer = null;
        }

        const [mx, my] = d3.pointer(ev, overlay.node());
        const globalX = ev.clientX;
        const globalY = ev.clientY;

        // Find nearest step
        const { nearest, xpx } = this.findNearestStep(mx, hoverSteps, stepIndex, logScaleX, xScale);

        // Skip if same step as last time (avoid redundant updates)
        if (this.lastNearestStep === nearest) {
          return;
        }
        this.lastNearestStep = nearest;

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

      } catch (error) {
        console.error('Error in hover interaction:', error);
      }
    };

    // Mouse leave handler
    const onMouseLeave = () => {
      this.lastNearestStep = null; // Reset cache
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
   * Find the nearest step to mouse position (optimized for large datasets)
   */
  findNearestStep(mx, hoverSteps, stepIndex, logScaleX, xScale) {
    let nearest, xpx;

    if (logScaleX) {
      const mouseStepValue = xScale.invert(mx);

      // For large datasets, use binary search instead of linear search
      if (hoverSteps.length > 400) {
        nearest = this.binarySearchClosest(hoverSteps, mouseStepValue);
      } else {
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
      }

      xpx = xScale(nearest);
    } else {
      const idx = Math.round(Math.max(0, Math.min(hoverSteps.length - 1, xScale.invert(mx))));
      nearest = hoverSteps[idx];
      xpx = xScale(idx);
    }

    return { nearest, xpx };
  }

  /**
   * Binary search for closest value in sorted array (O(log n) instead of O(n))
   */
  binarySearchClosest(sortedArray, target) {
    let left = 0;
    let right = sortedArray.length - 1;

    if (target <= sortedArray[left]) return sortedArray[left];
    if (target >= sortedArray[right]) return sortedArray[right];

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midVal = sortedArray[mid];

      if (midVal === target) return midVal;

      if (midVal < target) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // At this point, left > right
    // sortedArray[right] < target < sortedArray[left]
    const leftDist = Math.abs(sortedArray[left] - target);
    const rightDist = Math.abs(sortedArray[right] - target);

    return leftDist < rightDist ? sortedArray[left] : sortedArray[right];
  }

  /**
   * Prepare data for hover tooltip with interpolation for missing points
   */
  prepareHoverData(series, nearestStep, normalizeY, isAccuracy) {
    const entries = series.map(s => {
      const values = s.values.sort((a, b) => a.step - b.step);
      const m = new Map(values.map(v => [v.step, v]));
      let pt = m.get(nearestStep);

      // If no exact point, interpolate from surrounding points
      if (!pt) {
        // Find the two closest points (one before, one after)
        let before = null;
        let after = null;

        for (let i = 0; i < values.length; i++) {
          if (values[i].step < nearestStep) {
            before = values[i];
          } else if (values[i].step > nearestStep && !after) {
            after = values[i];
            break;
          }
        }

        // Interpolate if we have both surrounding points
        if (before && after) {
          const ratio = (nearestStep - before.step) / (after.step - before.step);
          const interpolatedValue = before.value + ratio * (after.value - before.value);
          pt = { step: nearestStep, value: interpolatedValue };
        } else if (before) {
          // Use the last known value
          pt = before;
        } else if (after) {
          // Use the first known value
          pt = after;
        }
      }

      return { run: s.run, color: s.color, pt, hasExactPoint: !!m.get(nearestStep) };
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
