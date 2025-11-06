// Zoom & Pan Manager for TrackIO Charts
// Inspired by the d3-line-chart implementation

import * as d3 from 'd3';

/**
 * ZoomManager - Handles zoom and pan interactions for charts
 * 
 * Key principles:
 * - Uses rescaleX/rescaleY instead of transforming the group
 * - Redraws paths with new scales instead of CSS transforms
 * - Keeps axes and grid outside the zoomed content
 * - Uses clip-path to constrain the plot area
 */
export class ZoomManager {
    constructor(svgManager, options = {}) {
        this.svgManager = svgManager;
        this.options = {
            zoomExtent: [1.0, 8.0],     // Min and max zoom levels
            enableX: true,               // Enable X-axis zoom
            enableY: true,               // Enable Y-axis zoom
            transitionDuration: 750,     // Reset transition duration
            ...options
        };

        // State
        this.hasMoved = false;
        this.currentTransform = d3.zoomIdentity;
        this.zoom = null;
        this.overlay = null;
        this.clipPath = null;
        this.clipRect = null;
        this.callbacks = {
            onZoom: null,
            onReset: null,
            onZoomStart: null,
            onZoomEnd: null
        };
    }

    /**
     * Initialize zoom behavior and setup overlay
     */
    initialize() {
        const { root } = this.svgManager.getGroups();
        const svg = this.svgManager.svg;

        if (!root || !svg) {
            console.warn('⚠️ Cannot initialize zoom: SVG or root group not found');
            return;
        }

        // Create unique clip path ID
        const clipId = 'trackio-clip-' + Math.random().toString(36).slice(2, 11);

        // Setup clip path in SVG defs
        let defs = svg.select('defs');
        if (defs.empty()) {
            defs = svg.append('defs');
        }

        this.clipPath = defs.append('clipPath')
            .attr('id', clipId);

        this.clipRect = this.clipPath.append('rect');

        // Apply clip-path to plot groups
        const { lines: gLines, points: gPoints } = this.svgManager.getGroups();
        if (gLines) gLines.attr('clip-path', `url(#${clipId})`);
        if (gPoints) gPoints.attr('clip-path', `url(#${clipId})`);

        // Create transparent overlay for capturing zoom events
        this.overlay = root.append('rect')
            .attr('class', 'zoom-overlay')
            .attr('fill', 'none')
            .attr('pointer-events', 'all')
            .style('cursor', 'grab');

        // Create zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent(this.options.zoomExtent)
            .on('start', (event) => this.onZoomStart(event))
            .on('zoom', (event) => this.onZoom(event))
            .on('end', (event) => this.onZoomEnd(event));

        // Apply zoom to overlay
        this.overlay.call(this.zoom);

        // Handle cursor changes
        this.overlay
            .on('mousedown.cursor', () => {
                this.overlay.style('cursor', 'grabbing');
            })
            .on('mouseup.cursor', () => {
                this.overlay.style('cursor', 'grab');
            });

        console.log('✅ ZoomManager initialized with clip-path:', clipId);
    }

    /**
     * Update layout (call this on resize or redraw)
     */
    updateLayout(innerWidth, innerHeight) {
        if (!this.clipRect || !this.overlay || !this.zoom) return;

        // Update clip rect dimensions
        this.clipRect
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', innerWidth)
            .attr('height', innerHeight);

        // Update overlay dimensions
        this.overlay
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', innerWidth)
            .attr('height', innerHeight);

        // Update zoom extent and translate extent
        this.zoom
            .extent([[0, 0], [innerWidth, innerHeight]])
            .translateExtent([[0, 0], [innerWidth, innerHeight]]);
    }

    /**
     * Zoom start handler
     */
    onZoomStart(event) {
        if (this.callbacks.onZoomStart) {
            this.callbacks.onZoomStart(event);
        }
    }

    /**
     * Main zoom handler - rescales axes and redraws
     */
    onZoom(event) {
        const transform = event.transform;
        this.currentTransform = transform;

        // Update moved state
        this.hasMoved = transform.k !== 1 || transform.x !== 0 || transform.y !== 0;

        // Get original scales
        const { x: xScale, y: yScale } = this.svgManager.getScales();

        // Rescale based on enabled axes
        const newXScale = this.options.enableX ? transform.rescaleX(xScale) : xScale;
        const newYScale = this.options.enableY ? transform.rescaleY(yScale) : yScale;

        // Call external callback with new scales
        if (this.callbacks.onZoom) {
            this.callbacks.onZoom({
                transform,
                xScale: newXScale,
                yScale: newYScale,
                hasMoved: this.hasMoved
            });
        }
    }

    /**
     * Zoom end handler
     */
    onZoomEnd(event) {
        if (this.callbacks.onZoomEnd) {
            this.callbacks.onZoomEnd(event);
        }
    }

    /**
     * Reset zoom to initial state
     */
    reset(animated = true) {
        if (!this.overlay || !this.zoom) return;

        if (animated) {
            this.overlay.transition()
                .duration(this.options.transitionDuration)
                .call(this.zoom.transform, d3.zoomIdentity);
        } else {
            this.overlay.call(this.zoom.transform, d3.zoomIdentity);
        }

        if (this.callbacks.onReset) {
            this.callbacks.onReset();
        }
    }

    /**
     * Set zoom level programmatically
     */
    setZoom(k, x = 0, y = 0, animated = true) {
        if (!this.overlay || !this.zoom) return;

        const transform = d3.zoomIdentity.translate(x, y).scale(k);

        if (animated) {
            this.overlay.transition()
                .duration(this.options.transitionDuration)
                .call(this.zoom.transform, transform);
        } else {
            this.overlay.call(this.zoom.transform, transform);
        }
    }

    /**
     * Enable/disable zoom
     */
    setEnabled(enabled) {
        if (!this.overlay || !this.zoom) return;

        if (enabled) {
            this.overlay.call(this.zoom);
            this.overlay.style('cursor', 'grab');
        } else {
            this.overlay.on('.zoom', null);
            this.overlay.style('cursor', 'default');
        }
    }

    /**
     * Register callbacks
     */
    on(event, callback) {
        if (this.callbacks.hasOwnProperty('on' + event.charAt(0).toUpperCase() + event.slice(1))) {
            this.callbacks['on' + event.charAt(0).toUpperCase() + event.slice(1)] = callback;
        } else {
            console.warn(`⚠️ Unknown zoom event: ${event}`);
        }
        return this;
    }

    /**
     * Get current zoom state
     */
    getState() {
        return {
            hasMoved: this.hasMoved,
            transform: this.currentTransform,
            scale: this.currentTransform.k,
            translateX: this.currentTransform.x,
            translateY: this.currentTransform.y
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.overlay) {
            this.overlay.on('.zoom', null);
            this.overlay.on('.cursor', null);
            this.overlay.remove();
        }

        if (this.clipPath) {
            this.clipPath.remove();
        }

        this.zoom = null;
        this.overlay = null;
        this.clipPath = null;
        this.clipRect = null;
    }
}

