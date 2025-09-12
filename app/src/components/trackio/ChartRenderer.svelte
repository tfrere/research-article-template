<script>
  import * as d3 from 'd3';
  import { onMount, onDestroy } from 'svelte';
  import { formatAbbrev, formatLogTick, generateSmartTicks, generateLogTicks } from './chart-utils.js';
  
  // Props
  export let metricData = {};
  export let rawMetricData = {};
  export let colorForRun = (name) => '#999';
  export let variant = 'classic';
  export let logScaleX = false;
  export let smoothing = false;
  export let normalizeLoss = true;
  export let metricKey = '';
  export let titleText = '';
  export let hostEl = null;
  export let width = 800;
  export let height = 150;
  export let margin = { top: 10, right: 12, bottom: 46, left: 44 };
  export let onHover = null; // Callback for hover events
  export let onLeave = null; // Callback for leave events
  
  // SVG elements
  let container;
  let svg, gRoot, gGrid, gGridDots, gAxes, gAreas, gLines, gPoints, gHover;
  let xScale, yScale, lineGen;
  let cleanup;
  let hoverLine; // Reference to hover line for external control
  
  $: innerHeight = height - margin.top - margin.bottom;
  
  // Reactive re-render when data or any relevant prop changes
  $: {
    if (container) {
      // List all dependencies to trigger render when any change
      void metricData;
      void metricKey;
      void variant;
      void logScaleX;
      void normalizeLoss;
      void smoothing;
      render();
    }
  }
  
  function ensureSvg() {
    if (svg || !container) return;
    
    const d3Container = d3.select(container);
    svg = d3Container.append('svg')
      .attr('width', '100%')
      .style('display', 'block');
      
    gRoot = svg.append('g');
    gGrid = gRoot.append('g').attr('class', 'grid');
    gGridDots = gRoot.append('g').attr('class', 'grid-dots');
    gAxes = gRoot.append('g').attr('class', 'axes');
    gAreas = gRoot.append('g').attr('class', 'areas');
    gLines = gRoot.append('g').attr('class', 'lines');
    gPoints = gRoot.append('g').attr('class', 'points');
    gHover = gRoot.append('g').attr('class', 'hover');
    
    // Initialize scales
    xScale = logScaleX ? d3.scaleLog() : d3.scaleLinear(); 
    yScale = d3.scaleLinear();
    lineGen = d3.line().x(d => xScale(d.step)).y(d => yScale(d.value));
  }
  
  function updateLayout(hoverSteps) {
    if (!svg || !container) return { innerWidth: 0, innerHeight: 0, xTicksForced: [], yTicksForced: [] };
    
    const fontFamily = 'var(--trackio-font-family)';
    
    // Calculate actual container width
    const rect = container.getBoundingClientRect();
    const actualWidth = Math.max(1, Math.round(rect && rect.width ? rect.width : (container.clientWidth || width)));
    
    svg.attr('width', actualWidth)
       .attr('height', height)
       .attr('viewBox', `0 0 ${actualWidth} ${height}`)
       .attr('preserveAspectRatio', 'xMidYMid meet');
       
    const innerWidth = actualWidth - margin.left - margin.right;
    
    gRoot.attr('transform', `translate(${margin.left},${margin.top})`);
    xScale.range([0, innerWidth]); 
    yScale.range([innerHeight, 0]);

    gAxes.selectAll('*').remove();
    
    const minXTicks = 5;
    const maxXTicks = Math.max(minXTicks, Math.min(12, Math.floor(innerWidth / 70)));
    let xTicksForced = [];
    
    let logTickData = null;
    if (logScaleX) {
      logTickData = generateLogTicks(hoverSteps, minXTicks, maxXTicks, innerWidth, xScale);
      xTicksForced = logTickData.major;
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
      xTicksForced = makeTicks(xScale, maxXTicks);
    }
    
    const maxYTicks = Math.max(5, Math.min(6, Math.floor(innerHeight / 60)));
    const yCount = maxYTicks; 
    const yDom = yScale.domain();
    const yTicksForced = (yCount <= 2) ? [yDom[0], yDom[1]] : Array.from({length:yCount}, (_,i)=> yDom[0] + ((yDom[1]-yDom[0])*(i/(yCount-1))));

    // Draw axes
    gAxes.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickValues(xTicksForced).tickFormat((val) => { 
        const displayVal = logScaleX ? val : (Array.isArray(hoverSteps) && hoverSteps[val] != null ? hoverSteps[val] : val); 
        return logScaleX ? formatLogTick(displayVal, true) : formatAbbrev(displayVal); 
      }))
      .call(g => { 
        g.selectAll('path, line').style('stroke', 'var(--trackio-chart-axis-stroke)'); 
        g.selectAll('text').style('fill', 'var(--trackio-chart-axis-text)').style('font-size','11px').style('font-family', fontFamily)
          .style('font-weight', d => {
            if (!logScaleX) return 'normal';
            const log10 = Math.log10(Math.abs(d));
            const isPowerOf10 = Math.abs(log10 % 1) < 0.01;
            return isPowerOf10 ? '600' : 'normal';
          }); 
      });
      
    gAxes.append('g')
      .call(d3.axisLeft(yScale).tickValues(yTicksForced).tickFormat((v) => formatAbbrev(v)))
      .call(g => { 
        g.selectAll('path, line').style('stroke', 'var(--trackio-chart-axis-stroke)'); 
        g.selectAll('text').style('fill', 'var(--trackio-chart-axis-text)').style('font-size','11px').style('font-family', fontFamily); 
      });

    // Add minor ticks for logarithmic scale
    if (logScaleX && logTickData && logTickData.minor.length > 0) {
      gAxes.append('g').attr('class', 'minor-ticks').attr('transform', `translate(0,${innerHeight})`)
        .selectAll('line.minor-tick')
        .data(logTickData.minor)
        .join('line')
        .attr('class', 'minor-tick')
        .attr('x1', d => xScale(d))
        .attr('x2', d => xScale(d))
        .attr('y1', 0)
        .attr('y2', 4)
        .style('stroke', 'var(--trackio-chart-axis-stroke)')
        .style('stroke-opacity', 0.4)
        .style('stroke-width', 0.5);
    }

    // Steps label
    const labelY = innerHeight + Math.max(20, Math.min(36, margin.bottom - 12));
    const stepsText = logScaleX ? 'Steps (log)' : 'Steps';
    
    gAxes.append('text')
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

    return { innerWidth, innerHeight, xTicksForced, yTicksForced };
  }
  
  function renderGrid(xTicksForced, yTicksForced, hoverSteps) {
    const shouldUseDots = variant === 'oblivion';
    
    if (shouldUseDots) {
      // Oblivion-style: Grid as dots
      gGrid.selectAll('*').remove();
      gGridDots.selectAll('*').remove(); 
      const gridPoints = []; 
      const yMin = yScale.domain()[0]; 
      const desiredCols = 24; 
      const xGridStride = Math.max(1, Math.ceil(hoverSteps.length/desiredCols)); 
      const xGridIdx = []; 
      for (let idx = 0; idx < hoverSteps.length; idx += xGridStride) xGridIdx.push(idx); 
      if (xGridIdx[xGridIdx.length-1] !== hoverSteps.length-1) xGridIdx.push(hoverSteps.length-1); 
      xGridIdx.forEach(i => { 
        yTicksForced.forEach(t => { 
          if (i !== 0 && (yMin == null || t !== yMin)) gridPoints.push({ sx: i, ty: t }); 
        }); 
      }); 
      gGridDots.selectAll('circle.grid-dot')
        .data(gridPoints)
        .join('circle')
        .attr('class', 'grid-dot')
        .attr('cx', d => xScale(d.sx))
        .attr('cy', d => yScale(d.ty))
        .attr('r', 1.25)
        .style('fill', 'var(--trackio-chart-grid-stroke)')
        .style('fill-opacity', 'var(--trackio-chart-grid-opacity)');
    } else {
      // Classic-style: Grid as lines
      gGridDots.selectAll('*').remove();
      gGrid.selectAll('*').remove();
      
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
  
  function render() {
    ensureSvg();
    if (!svg || !gRoot) return;
    
    const runs = Object.keys(metricData || {});
    const hasAny = runs.some(r => (metricData[r] || []).length > 0);
    if (!hasAny) { 
      gRoot.style('display', 'none'); 
      return; 
    } 
    gRoot.style('display', null);

    // Data processing
    let minStep = Infinity, maxStep = -Infinity, minVal = Infinity, maxVal = -Infinity;
    runs.forEach(r => { 
      (metricData[r] || []).forEach(pt => { 
        minStep = Math.min(minStep, pt.step); 
        maxStep = Math.max(maxStep, pt.step); 
        minVal = Math.min(minVal, pt.value); 
        maxVal = Math.max(maxVal, pt.value); 
      }); 
    });
    
    const isAccuracy = /accuracy/i.test(metricKey); 
    const isLoss = /loss/i.test(metricKey);
    if (isAccuracy) yScale.domain([0,1]).nice(); 
    else if (isLoss && normalizeLoss) yScale.domain([0,1]).nice(); 
    else yScale.domain([minVal, maxVal]).nice();
    
    const stepSet = new Set(); 
    runs.forEach(r => (metricData[r] || []).forEach(v => stepSet.add(v.step)));
    const hoverSteps = Array.from(stepSet).sort((a,b) => a - b); 
    
    // Update X scale based on logScaleX prop
    xScale = logScaleX ? d3.scaleLog() : d3.scaleLinear();
    
    let stepIndex = null;
    
    if (logScaleX) {
      const minStep = Math.max(1, Math.min(...hoverSteps));
      const maxStep = Math.max(...hoverSteps);
      xScale.domain([minStep, maxStep]);
      lineGen.x(d => xScale(d.step));
    } else {
      stepIndex = new Map(hoverSteps.map((s,i) => [s,i]));
      xScale.domain([0, Math.max(0, hoverSteps.length - 1)]);
      lineGen.x(d => xScale(stepIndex.get(d.step)));
    }
    
    const normalizeY = (v) => (isLoss && normalizeLoss ? ((maxVal > minVal) ? (v - minVal) / (maxVal - minVal) : 0) : v); 
    lineGen.y(d => yScale(normalizeY(d.value)));
    
    const { xTicksForced, yTicksForced } = updateLayout(hoverSteps);
    
    // Render grid
    renderGrid(xTicksForced, yTicksForced, hoverSteps);
    
    // Render data
    const series = runs.map(r => ({ 
      run: r, 
      color: colorForRun(r), 
      values: (metricData[r] || []).slice().sort((a,b) => a.step - b.step) 
    }));
    
    // Draw background lines (original data) when smoothing is enabled
    if (smoothing && rawMetricData && Object.keys(rawMetricData).length > 0) {
      const rawSeries = runs.map(r => ({ 
        run: r, 
        color: colorForRun(r), 
        values: (rawMetricData[r] || []).slice().sort((a,b) => a.step - b.step) 
      }));
      const rawPaths = gLines.selectAll('path.raw-line').data(rawSeries, d => d.run + '-raw'); 
      rawPaths.enter().append('path').attr('class','raw-line').attr('data-run', d => d.run).attr('fill','none').attr('stroke-width',1).attr('opacity',0.2).attr('stroke', d => d.color).style('pointer-events','none').attr('d', d => lineGen(d.values)); 
      rawPaths.attr('stroke', d => d.color).attr('opacity',0.2).attr('d', d => lineGen(d.values));
      rawPaths.exit().remove();
    } else {
      gLines.selectAll('path.raw-line').remove();
    }
    
    // Draw main lines
    const paths = gLines.selectAll('path.run-line').data(series, d => d.run); 
    paths.enter().append('path').attr('class','run-line').attr('data-run', d => d.run).attr('fill','none').attr('stroke-width',1.5).attr('opacity',0.9).attr('stroke', d => d.color).style('pointer-events','none').attr('d', d => lineGen(d.values)); 
    paths.transition().duration(160).attr('stroke', d => d.color).attr('opacity',0.9).attr('d', d => lineGen(d.values));
    paths.exit().remove();
    
    // Draw points
    const allPoints = series.flatMap(s => s.values.map(v => ({ run: s.run, color: s.color, step: v.step, value: v.value })));
    const ptsSel = gPoints.selectAll('circle.pt').data(allPoints, d => `${d.run}-${d.step}`); 
    ptsSel.enter().append('circle').attr('class','pt').attr('data-run', d => d.run).attr('r',0).attr('fill', d => d.color).attr('fill-opacity',0.6).attr('stroke','none').style('pointer-events','none')
      .attr('cx', d => logScaleX ? xScale(d.step) : xScale(stepIndex.get(d.step)))
      .attr('cy', d => yScale(normalizeY(d.value)))
      .merge(ptsSel)
      .attr('cx', d => logScaleX ? xScale(d.step) : xScale(stepIndex.get(d.step)))
      .attr('cy', d => yScale(normalizeY(d.value))); 
    ptsSel.exit().remove();

    // Setup hover interactions
    setupHoverInteractions(hoverSteps, stepIndex, series, normalizeY, isAccuracy, innerWidth);
  }
  
  function setupHoverInteractions(hoverSteps, stepIndex, series, normalizeY, isAccuracy, innerWidth) {
    if (!gHover || !container) return;
    
    gHover.selectAll('*').remove(); 
    
    // Recalculate dimensions to be sure
    const actualWidth = container.getBoundingClientRect().width;
    const currentInnerWidth = innerWidth || (actualWidth - margin.left - margin.right);
    const currentInnerHeight = innerHeight || (height - margin.top - margin.bottom);
    
    const overlay = gHover.append('rect')
      .attr('fill','transparent')
      .style('cursor','crosshair')
      .attr('x',0)
      .attr('y',0)
      .attr('width', currentInnerWidth)
      .attr('height', currentInnerHeight)
      .style('pointer-events','all'); 
      
    hoverLine = gHover.append('line')
      .style('stroke','var(--text-color)')
      .attr('stroke-opacity',0.25)
      .attr('stroke-width',1)
      .attr('y1',0)
      .attr('y2',innerHeight)
      .style('display','none')
      .style('pointer-events','none'); 
      
    let hideTipTimer = null;
    
    function onMove(ev) { 
      console.log('onMove called, checking series...');
      try {
        if (hideTipTimer) { clearTimeout(hideTipTimer); hideTipTimer = null; } 
        const [mx, my] = d3.pointer(ev, overlay.node());
        console.log('Got mouse position:', mx, my);
        
        // Get global mouse coordinates for tooltip positioning
        const globalX = ev.clientX;
        const globalY = ev.clientY; 
      
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
        const idx = Math.round(Math.max(0, Math.min(hoverSteps.length-1, xScale.invert(mx)))); 
        nearest = hoverSteps[idx]; 
        xpx = xScale(idx);
      }
      
      hoverLine.attr('x1',xpx).attr('x2',xpx).style('display',null); 
      
      console.log('About to use series, available?', typeof series);
      const entries = series.map(s => { 
        const m = new Map(s.values.map(v => [v.step, v])); 
        const pt = m.get(nearest); 
        return { run: s.run, color: s.color, pt }; 
      }).filter(e => e.pt && e.pt.value != null).sort((a,b) => a.pt.value - b.pt.value); 
      
      const fmt = (vv) => (isAccuracy ? (+vv).toFixed(4) : (+vv).toFixed(4)); 
      
      // Call parent hover callback
      console.log('About to call onHover:', { hasOnHover: !!onHover, entriesLength: entries.length, step: nearest });
      if (onHover) {
        onHover({
          step: nearest,
          entries: entries.map(e => ({ 
            color: e.color, 
            name: e.run, 
            valueText: fmt(e.pt.value) 
          })),
          position: { x: mx, y: my, globalX, globalY }
        });
        console.log('onHover callback completed');
      } else {
        console.log('onHover is null!');
      }
      
      try { 
        gPoints.selectAll('circle.pt').attr('r', d => (d && d.step === nearest ? 4 : 0)); 
      } catch(_) {} 
      } catch(error) {
        console.error('Error in onMove:', error);
      }
    }
    
    function onMouseLeave() { 
      hideTipTimer = setTimeout(() => { 
        hoverLine.style('display','none'); 
        if (onLeave) onLeave();
        try { 
          gPoints.selectAll('circle.pt').attr('r', 0); 
        } catch(_) {} 
      }, 0); 
    }
    
    overlay.on('mousemove', function() {
      console.log('OVERLAY MOUSEMOVE DETECTED!');
      onMove.apply(this, arguments);
    }).on('mouseleave', onMouseLeave);
  }
  
  onMount(() => {
    render();
    const ro = window.ResizeObserver ? new ResizeObserver(() => render()) : null;
    if (ro && container) ro.observe(container);
    cleanup = () => { ro && ro.disconnect(); };
  });
  
  onDestroy(() => {
    cleanup && cleanup();
  });
  
  // Public methods for external hover control
  export function showHoverLine(step) {
    if (!hoverLine || !xScale || !container) return;
    
    try {
      let xpx;
      if (logScaleX) {
        xpx = xScale(step);
      } else {
        // Find step index in hoverSteps
        const stepSet = new Set();
        Object.keys(metricData || {}).forEach(r => 
          (metricData[r] || []).forEach(v => stepSet.add(v.step))
        );
        const hoverSteps = Array.from(stepSet).sort((a,b) => a - b);
        const stepIndex = hoverSteps.indexOf(step);
        if (stepIndex >= 0) {
          xpx = xScale(stepIndex);
        }
      }
      
      if (xpx !== undefined) {
        hoverLine.attr('x1', xpx).attr('x2', xpx).style('display', null);
      }
    } catch (e) {
      console.warn('Error showing hover line:', e);
    }
  }
  
  export function hideHoverLine() {
    if (hoverLine) {
      hoverLine.style('display', 'none');
    }
  }
</script>

<div bind:this={container} style="width: 100%; height: 100%;"></div>
