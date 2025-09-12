// SVG Management and Layout utilities for ChartRenderer
import * as d3 from 'd3';
import { formatAbbrev, formatLogTick, generateSmartTicks, generateLogTicks } from '../../core/chart-utils.js';

/**
 * SVG Manager - Handles SVG creation, layout, and axis rendering
 */
export class SVGManager {
  constructor(container, config = {}) {
    this.container = container;
    this.config = {
      width: 800,
      height: 150,
      margin: { top: 10, right: 12, bottom: 46, left: 44 },
      ...config
    };
    
    // SVG elements
    this.svg = null;
    this.gRoot = null;
    this.gGrid = null;
    this.gGridDots = null;
    this.gAxes = null;
    this.gAreas = null;
    this.gLines = null;
    this.gPoints = null;
    this.gHover = null;
    
    // Scales
    this.xScale = null;
    this.yScale = null;
    this.lineGen = null;
  }

  /**
   * Initialize SVG structure if not already created
   */
  ensureSvg() {
    if (this.svg || !this.container) return;
    
    const d3Container = d3.select(this.container);
    this.svg = d3Container.append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('display', 'block')
      .style('overflow', 'visible')
      .style('max-width', '100%');
      
    this.gRoot = this.svg.append('g');
    this.gGrid = this.gRoot.append('g').attr('class', 'grid');
    this.gGridDots = this.gRoot.append('g').attr('class', 'grid-dots');
    this.gAxes = this.gRoot.append('g').attr('class', 'axes');
    this.gAreas = this.gRoot.append('g').attr('class', 'areas');
    this.gLines = this.gRoot.append('g').attr('class', 'lines');
    this.gPoints = this.gRoot.append('g').attr('class', 'points');
    this.gHover = this.gRoot.append('g').attr('class', 'hover');
    
    return this.svg;
  }

  /**
   * Initialize or update scales based on chart type
   */
  initializeScales(logScaleX = false) {
    this.xScale = logScaleX ? d3.scaleLog() : d3.scaleLinear(); 
    this.yScale = d3.scaleLinear();
    this.lineGen = d3.line().x(d => this.xScale(d.step)).y(d => this.yScale(d.value));
  }

  /**
   * Calculate layout dimensions with mobile-friendly fallbacks
   */
  calculateDimensions() {
    if (!this.container) return { actualWidth: this.config.width, innerWidth: 0, innerHeight: 0 };
    
    // Mobile-friendly width calculation
    const rect = this.container.getBoundingClientRect();
    let actualWidth = 0;
    
    if (rect && rect.width > 0) {
      actualWidth = rect.width;
    } else if (this.container.clientWidth > 0) {
      actualWidth = this.container.clientWidth;
    } else if (this.container.offsetWidth > 0) {
      actualWidth = this.container.offsetWidth;
    } else {
      const parent = this.container.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        actualWidth = parentRect.width > 0 ? parentRect.width : this.config.width;
      } else {
        actualWidth = this.config.width;
      }
    }
    
    actualWidth = Math.max(200, Math.round(actualWidth));
    const innerWidth = actualWidth - this.config.margin.left - this.config.margin.right;
    const innerHeight = this.config.height - this.config.margin.top - this.config.margin.bottom;
    
    return { actualWidth, innerWidth, innerHeight };
  }

  /**
   * Update SVG layout and render axes
   */
  updateLayout(hoverSteps, logScaleX = false) {
    if (!this.svg || !this.container) return { innerWidth: 0, innerHeight: 0, xTicksForced: [], yTicksForced: [] };
    
    const fontFamily = 'var(--trackio-font-family)';
    const { actualWidth, innerWidth, innerHeight } = this.calculateDimensions();
    
    // Update SVG dimensions
    this.svg
      .attr('width', actualWidth)
      .attr('height', this.config.height)
      .attr('viewBox', `0 0 ${actualWidth} ${this.config.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');
       
    this.gRoot.attr('transform', `translate(${this.config.margin.left},${this.config.margin.top})`);
    this.xScale.range([0, innerWidth]); 
    this.yScale.range([innerHeight, 0]);

    // Clear previous axes
    this.gAxes.selectAll('*').remove();
    
    const { xTicksForced, yTicksForced } = this.generateTicks(hoverSteps, innerWidth, innerHeight, logScaleX);
    this.renderAxes(xTicksForced, yTicksForced, innerWidth, innerHeight, fontFamily, logScaleX, hoverSteps);
    
    return { innerWidth, innerHeight, xTicksForced, yTicksForced };
  }

  /**
   * Generate intelligent tick positions
   */
  generateTicks(hoverSteps, innerWidth, innerHeight, logScaleX) {
    const minXTicks = 5;
    const maxXTicks = Math.max(minXTicks, Math.min(12, Math.floor(innerWidth / 70)));
    let xTicksForced = [];
    
    if (logScaleX) {
      const logTickData = generateLogTicks(hoverSteps, minXTicks, maxXTicks, innerWidth, this.xScale);
      xTicksForced = logTickData.major;
      this.logTickData = logTickData; // Store for minor ticks
    } else if (Array.isArray(hoverSteps) && hoverSteps.length) {
      const tickIndices = generateSmartTicks(hoverSteps, minXTicks, maxXTicks, innerWidth);
      xTicksForced = tickIndices;
    } else {
      const makeTicks = (scale, approx) => { 
        const arr = scale.ticks(approx); 
        const dom = scale.domain(); 
        if (arr.length === 0 || arr[0] !== dom[0]) arr.unshift(dom[0]); 
        if (arr[arr.length-1] !== dom[dom.length-1]) arr.push(dom[dom.length-1]); 
        return Array.from(new Set(arr)); 
      };
      xTicksForced = makeTicks(this.xScale, maxXTicks);
    }
    
    const maxYTicks = Math.max(5, Math.min(6, Math.floor(innerHeight / 60)));
    const yDom = this.yScale.domain();
    const yTicksForced = (maxYTicks <= 2) ? [yDom[0], yDom[1]] : 
      Array.from({length: maxYTicks}, (_, i) => yDom[0] + ((yDom[1] - yDom[0]) * (i / (maxYTicks - 1))));

    return { xTicksForced, yTicksForced };
  }

  /**
   * Render X and Y axes with ticks and labels
   */
  renderAxes(xTicksForced, yTicksForced, innerWidth, innerHeight, fontFamily, logScaleX, hoverSteps) {
    // X-axis
    this.gAxes.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(this.xScale).tickValues(xTicksForced).tickFormat((val) => { 
        const displayVal = logScaleX ? val : (Array.isArray(hoverSteps) && hoverSteps[val] != null ? hoverSteps[val] : val); 
        return logScaleX ? formatLogTick(displayVal, true) : formatAbbrev(displayVal); 
      }))
      .call(g => { 
        g.selectAll('path, line').style('stroke', 'var(--trackio-chart-axis-stroke)'); 
        g.selectAll('text').style('fill', 'var(--trackio-chart-axis-text)')
          .style('font-size','11px').style('font-family', fontFamily)
          .style('font-weight', d => {
            if (!logScaleX) return 'normal';
            const log10 = Math.log10(Math.abs(d));
            const isPowerOf10 = Math.abs(log10 % 1) < 0.01;
            return isPowerOf10 ? '600' : 'normal';
          }); 
      });
      
    // Y-axis
    this.gAxes.append('g')
      .call(d3.axisLeft(this.yScale).tickValues(yTicksForced).tickFormat((v) => formatAbbrev(v)))
      .call(g => { 
        g.selectAll('path, line').style('stroke', 'var(--trackio-chart-axis-stroke)'); 
        g.selectAll('text').style('fill', 'var(--trackio-chart-axis-text)')
          .style('font-size','11px').style('font-family', fontFamily); 
      });

    // Minor ticks for logarithmic scale
    if (logScaleX && this.logTickData && this.logTickData.minor.length > 0) {
      this.gAxes.append('g').attr('class', 'minor-ticks')
        .attr('transform', `translate(0,${innerHeight})`)
        .selectAll('line.minor-tick')
        .data(this.logTickData.minor)
        .join('line')
        .attr('class', 'minor-tick')
        .attr('x1', d => this.xScale(d))
        .attr('x2', d => this.xScale(d))
        .attr('y1', 0)
        .attr('y2', 4)
        .style('stroke', 'var(--trackio-chart-axis-stroke)')
        .style('stroke-opacity', 0.4)
        .style('stroke-width', 0.5);
    }

    // X-axis label
    const labelY = innerHeight + Math.max(20, Math.min(36, this.config.margin.bottom - 12));
    const stepsText = logScaleX ? 'Steps (log)' : 'Steps';
    
    this.gAxes.append('text')
      .attr('class','x-axis-label')
      .attr('x', innerWidth/2)
      .attr('y', labelY)
      .style('fill', 'var(--trackio-chart-axis-text)')
      .attr('text-anchor','middle')
      .style('font-size','9px')
      .style('opacity','.9')
      .style('letter-spacing','.5px')
      .style('text-transform','uppercase')
      .style('font-weight','500')
      .style('font-family', fontFamily)
      .text(stepsText);
  }

  /**
   * Get SVG group elements for external rendering
   */
  getGroups() {
    return {
      root: this.gRoot,
      grid: this.gGrid,
      gridDots: this.gGridDots,
      axes: this.gAxes,
      areas: this.gAreas,
      lines: this.gLines,
      points: this.gPoints,
      hover: this.gHover
    };
  }

  /**
   * Get current scales
   */
  getScales() {
    return {
      x: this.xScale,
      y: this.yScale,
      line: this.lineGen
    };
  }

  /**
   * Clean up SVG elements
   */
  destroy() {
    if (this.svg) {
      this.svg.remove();
      this.svg = null;
    }
  }
}
