<script>
  import * as d3 from 'd3';
  import { onMount, onDestroy } from 'svelte';
  import Tooltip from './Tooltip.svelte';
  import { formatAbbrev, formatLogTick, generateSmartTicks, generateLogTicks } from './chart-utils.js';
  export let metricKey;
  export let titleText;
  export let wide = false;
  export let variant = 'classic';
  export let normalizeLoss = true;
  export let logScaleX = false;
  export let smoothing = false;
  export let metricData = {}; // { run -> [{step,value}] } - smoothed data
  export let rawMetricData = {}; // { run -> [{step,value}] } - original data for background when smoothing
  export let colorForRun = (name)=> '#999';
  export let hostEl = null;

  let root; let body;
  let svg, gRoot, gGrid, gGridDots, gAxes, gAreas, gLines, gPoints, gHover;
  let xScale, yScale, lineGen;
  let tooltip, tipTarget;
  let cleanup;
  const MARGIN = { top: 10, right: 20, bottom: 46, left: 44 };

  // Reactive rendering when variant or metricData changes
  $: {
    if (variant || metricData) {
      // Add a small delay to ensure CSS variables are updated
      setTimeout(() => render(), 10);
    }
  }

  // Utility function to get transition duration based on fullscreen state
  function getTransitionDuration(normalDuration = 160) {
    const fullscreenOverlay = root?.closest('.trackio-fullscreen-overlay');
    return (fullscreenOverlay && fullscreenOverlay.classList.contains('transitioning')) ? 0 : normalDuration;
  }

  function ensureSvg(){
    if (svg || !body) return;
    const d3body = d3.select(body);
    svg = d3body.append('svg').attr('width','100%').style('display','block');
    gRoot = svg.append('g');
    gGrid = gRoot.append('g').attr('class','grid');
    gGridDots = gRoot.append('g').attr('class','grid-dots');
    gAxes = gRoot.append('g').attr('class','axes');
    gAreas = gRoot.append('g').attr('class','areas');
    gLines = gRoot.append('g').attr('class','lines');
    gPoints = gRoot.append('g').attr('class','points');
    gHover = gRoot.append('g').attr('class','hover');
    // Initialize scales - X scale will be updated based on logScaleX prop
    xScale = logScaleX ? d3.scaleLog() : d3.scaleLinear(); 
    yScale = d3.scaleLinear();
    lineGen = d3.line().x(d => xScale(d.step)).y(d => yScale(d.value));
    // Create tooltip container in the trackio parent to inherit CSS variables
    const trackioEl = root.closest('.trackio') || root;
    tipTarget = document.createElement('div'); 
    tipTarget.className = 'tip-host'; 
    trackioEl.appendChild(tipTarget);
    tooltip = new Tooltip({ target: tipTarget, props: { visible:false, x:-9999, y:-9999, title:'', subtitle:'', entries:[] } });
  }


  function updateLayout(hoverSteps, themeVars = {}){
    const { axisStroke = 'var(--trackio-chart-axis-stroke)', axisText = 'var(--trackio-chart-axis-text)', gridStroke = 'var(--trackio-chart-grid-stroke)' } = themeVars;
    
    // Get font-family from computed style  
    const computedStyle = getComputedStyle(root);
    const fontFamily = computedStyle.getPropertyValue('--trackio-font-family').trim() || 'ui-monospace, SFMono-Regular, Menlo, monospace';
    const rect = root.getBoundingClientRect(); 
    let width = Math.max(1, Math.round(rect && rect.width ? rect.width : (root.clientWidth || 800)));
    
    // Check if we're in fullscreen mode
    const isFullscreen = root.closest('.trackio-fullscreen-modal');
    let height;
    
    if (isFullscreen) {
      // Use available height minus header in fullscreen
      // Use the body element's actual size
      const bodyElement = body.parentElement; // cell-body
      if (bodyElement) {
        const bodyRect = bodyElement.getBoundingClientRect();
        height = Math.max(400, Math.floor(bodyRect.height - 20)); // Small margin
      } else {
        height = 600; // Fallback
      }
    } else {
      height = Number(root.getAttribute('data-height')) || 180;
    }
    if (isFullscreen) {
      // In fullscreen, stretch to fill completely (no aspect ratio preservation)
      svg.attr('width', '100%').attr('height', '100%').attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio','none');
    } else {
      // Normal mode, preserve aspect ratio
    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio','xMidYMid meet');
    }
    const innerWidth = width - MARGIN.left - MARGIN.right; const innerHeight = height - MARGIN.top - MARGIN.bottom;
    gRoot.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);
    xScale.range([0, innerWidth]); yScale.range([innerHeight, 0]);

    gAxes.selectAll('*').remove();
    
    const minXTicks = 5;
    const maxXTicks = Math.max(minXTicks, Math.min(12, Math.floor(innerWidth / 70)));
    let xTicksForced = [];
    
    let logTickData = null;
    if (logScaleX) {
      // Use improved logarithmic tick generation
      logTickData = generateLogTicks(hoverSteps, minXTicks, maxXTicks, innerWidth, xScale);
      xTicksForced = logTickData.major;
    } else if (Array.isArray(hoverSteps) && hoverSteps.length) {
      const tickIndices = generateSmartTicks(hoverSteps, minXTicks, maxXTicks, innerWidth);
      xTicksForced = tickIndices;
    } else {
      // Fallback for continuous scales
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
    const yCount = maxYTicks; const yDom = yScale.domain();
    const yTicksForced = (yCount <= 2) ? [yDom[0], yDom[1]] : Array.from({length:yCount}, (_,i)=> yDom[0] + ((yDom[1]-yDom[0])*(i/(yCount-1))));

    gAxes.append('g').attr('transform', `translate(0,${innerHeight})`).call(d3.axisBottom(xScale).tickValues(xTicksForced).tickFormat((val)=>{ 
      // For log scale, val is the actual step value; for linear scale, val might be an index
      const displayVal = logScaleX ? val : (Array.isArray(hoverSteps) && hoverSteps[val] != null ? hoverSteps[val] : val); 
      return logScaleX ? formatLogTick(displayVal, true) : formatAbbrev(displayVal); 
    }))
      .call(g=>{ 
        g.selectAll('path, line').style('stroke', 'var(--trackio-chart-axis-stroke)'); 
        g.selectAll('text').style('fill', 'var(--trackio-chart-axis-text)').style('font-size','11px').style('font-family', fontFamily)
          .style('font-weight', d => {
            // Make powers of 10 bolder in log scale
            if (!logScaleX) return 'normal';
            const log10 = Math.log10(Math.abs(d));
            const isPowerOf10 = Math.abs(log10 % 1) < 0.01;
            return isPowerOf10 ? '600' : 'normal';
          }); 
      });
    gAxes.append('g').call(d3.axisLeft(yScale).tickValues(yTicksForced).tickFormat((v)=>formatAbbrev(v)))
      .call(g=>{ 
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
        .attr('y2', 4) // Smaller than major ticks
        .style('stroke', 'var(--trackio-chart-axis-stroke)')
        .style('stroke-opacity', 0.4)
        .style('stroke-width', 0.5);
    }


    // Grid rendering is now handled in render() function based on theme
    const labelY = innerHeight + Math.max(20, Math.min(36, MARGIN.bottom - 12));
    
    // Main "Steps" label (normal text)
    // Add (log) to Steps text when log scale is enabled
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

  function render(){
    ensureSvg();
    if (!svg || !gRoot) return; // Wait for SVG to be ready
    const runs = Object.keys(metricData||{});
    const hasAny = runs.some(r => (metricData[r]||[]).length > 0);
    if (!hasAny) { gRoot.style('display','none'); return; } gRoot.style('display', null);

    // Get theme variables from CSS - try parent element if root doesn't have the variables
    let computedStyle = getComputedStyle(root);
    let gridType = computedStyle.getPropertyValue('--trackio-chart-grid-type').trim().replace(/['"]/g, '');
    
    // If not found on root, try parent trackio element
    if (!gridType) {
      const trackioEl = root?.closest('.trackio');
      if (trackioEl) {
        computedStyle = getComputedStyle(trackioEl);
        gridType = computedStyle.getPropertyValue('--trackio-chart-grid-type').trim().replace(/['"]/g, '');
      }
    }
    
    const axisStroke = computedStyle.getPropertyValue('--trackio-chart-axis-stroke').trim();
    const axisText = computedStyle.getPropertyValue('--trackio-chart-axis-text').trim();
    const gridStroke = computedStyle.getPropertyValue('--trackio-chart-grid-stroke').trim();
    const gridOpacity = computedStyle.getPropertyValue('--trackio-chart-grid-opacity').trim();

    console.log('🎯 Cell render - variant:', variant, 'gridType:', gridType, 'trackio classes:', root?.closest('.trackio')?.className);

    let minStep=Infinity, maxStep=-Infinity, minVal=Infinity, maxVal=-Infinity;
    runs.forEach(r => { (metricData[r]||[]).forEach(pt => { minStep=Math.min(minStep, pt.step); maxStep=Math.max(maxStep, pt.step); minVal=Math.min(minVal, pt.value); maxVal=Math.max(maxVal, pt.value); }); });
    const isAccuracy = /accuracy/i.test(metricKey); const isLoss = /loss/i.test(metricKey);
    if (isAccuracy) yScale.domain([0,1]).nice(); else if (isLoss && normalizeLoss) yScale.domain([0,1]).nice(); else yScale.domain([minVal, maxVal]).nice();
    const stepSet = new Set(); runs.forEach(r => (metricData[r]||[]).forEach(v => stepSet.add(v.step)));
    const hoverSteps = Array.from(stepSet).sort((a,b)=>a-b); 
    
    // Update X scale based on logScaleX prop
    xScale = logScaleX ? d3.scaleLog() : d3.scaleLinear();
    
    let stepIndex = null; // Declare stepIndex in the proper scope
    
    if (logScaleX) {
      // For log scale, use actual step values (must be > 0)
      const minStep = Math.max(1, Math.min(...hoverSteps));
      const maxStep = Math.max(...hoverSteps);
      xScale.domain([minStep, maxStep]);
      lineGen.x(d => xScale(d.step));
    } else {
      // For linear scale, use indices as before
      stepIndex = new Map(hoverSteps.map((s,i)=>[s,i]));
      xScale.domain([0, Math.max(0, hoverSteps.length - 1)]);
      lineGen.x(d => xScale(stepIndex.get(d.step)));
    }
    const normalizeY = (v) => (isLoss && normalizeLoss ? ((maxVal > minVal) ? (v - minVal) / (maxVal - minVal) : 0) : v); lineGen.y(d => yScale(normalizeY(d.value)));
    const { innerWidth, innerHeight, xTicksForced, yTicksForced } = updateLayout(hoverSteps, { axisStroke, axisText, gridStroke });

    // Conditional grid rendering based on theme
    // Force detection based on variant prop if CSS variables fail
    const shouldUseDots = (gridType === 'dots') || (variant === 'oblivion');
    
    if (shouldUseDots) {
      // Oblivion-style: Grid as dots at intersections
      gGrid.selectAll('*').remove(); // Clear line grid
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
      gGridDots.selectAll('*').remove(); // Clear dot grid
      gGrid.selectAll('*').remove();
      // Horizontal grid lines
      gGrid.selectAll('line.horizontal')
        .data(yTicksForced)
        .join('line')
        .attr('class', 'horizontal')
        .attr('x1', 0).attr('x2', innerWidth)
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

    const series = runs.map(r => ({ run:r, color: colorForRun(r), values: (metricData[r]||[]).slice().sort((a,b)=>a.step-b.step) }));
    
    // Draw background lines (original data) when smoothing is enabled
    if (smoothing && rawMetricData && Object.keys(rawMetricData).length > 0) {
      const rawSeries = runs.map(r => ({ run:r, color: colorForRun(r), values: (rawMetricData[r]||[]).slice().sort((a,b)=>a.step-b.step) }));
      const rawPaths = gLines.selectAll('path.raw-line').data(rawSeries, d=>d.run + '-raw'); 
      rawPaths.enter().append('path').attr('class','raw-line').attr('data-run', d=>d.run).attr('fill','none').attr('stroke-width',1).attr('opacity',0.9).attr('stroke', d=>d.color).style('pointer-events','none').attr('d', d=> lineGen(d.values)); 
      rawPaths.transition().duration(getTransitionDuration(160)).attr('stroke', d=>d.color).attr('opacity',0.4).attr('d', d=> lineGen(d.values));
      rawPaths.exit().remove();
    } else {
      // Remove raw lines when smoothing is disabled
      gLines.selectAll('path.raw-line').remove();
    }
    
    // Draw main lines (smoothed or normal data)
    const paths = gLines.selectAll('path.run-line').data(series, d=>d.run); 
    paths.enter().append('path').attr('class','run-line').attr('data-run', d=>d.run).attr('fill','none').attr('stroke-width',1.5).attr('opacity',0.9).attr('stroke', d=>d.color).style('pointer-events','none').attr('d', d=> lineGen(d.values)); 
    paths.transition().duration(getTransitionDuration(160)).attr('stroke', d=>d.color).attr('opacity',0.9).attr('d', d=> lineGen(d.values));
    paths.exit().remove();
    const allPoints = series.flatMap(s => s.values.map(v => ({ run:s.run, color:s.color, step:v.step, value:v.value })));
    const ptsSel = gPoints.selectAll('circle.pt').data(allPoints, d=> `${d.run}-${d.step}`); 
    ptsSel.enter().append('circle').attr('class','pt').attr('data-run', d=>d.run).attr('r',0).attr('fill', d=>d.color).attr('fill-opacity',0.6).attr('stroke','none').style('pointer-events','none')
      .attr('cx', d=> logScaleX ? xScale(d.step) : xScale(stepIndex.get(d.step)))
      .attr('cy', d=> yScale(normalizeY(d.value)))
      .merge(ptsSel)
      .attr('cx', d=> logScaleX ? xScale(d.step) : xScale(stepIndex.get(d.step)))
      .attr('cy', d=> yScale(normalizeY(d.value))); 
    ptsSel.exit().remove();

    gHover.selectAll('*').remove(); const overlay = gHover.append('rect').attr('fill','transparent').style('cursor','crosshair').attr('x',0).attr('y',0).attr('width', innerWidth).attr('height', innerHeight).style('pointer-events','all'); const hoverLine = gHover.append('line').style('stroke','var(--text-color)').attr('stroke-opacity',0.25).attr('stroke-width',1).attr('y1',0).attr('y2',innerHeight).style('display','none').style('pointer-events','none'); let hideTipTimer=null;
    function onMove(ev){ 
      if (hideTipTimer) { clearTimeout(hideTipTimer); hideTipTimer=null; } 
      const [mx,my]=d3.pointer(ev, overlay.node()); 
      
      let nearest, xpx;
      if (logScaleX) {
        // For log scale, find the closest actual step value
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
        // For linear scale, use index-based approach as before
        const idx = Math.round(Math.max(0, Math.min(hoverSteps.length-1, xScale.invert(mx)))); 
        nearest = hoverSteps[idx]; 
        xpx = xScale(idx);
      }
      
      hoverLine.attr('x1',xpx).attr('x2',xpx).style('display',null); 
      try { hostEl && hostEl.dispatchEvent(new CustomEvent('trackio-hover-step', { detail: { step: nearest } })); } catch(_) {} 
      const entries = series.map(s=>{ const m = new Map(s.values.map(v=>[v.step, v])); const pt = m.get(nearest); return { run:s.run, color:s.color, pt }; }).filter(e => e.pt && e.pt.value!=null).sort((a,b)=> a.pt.value - b.pt.value); 
      const fmt=(vv)=> (isAccuracy? (+vv).toFixed(4) : (+vv).toFixed(4)); 
      
      // Calculate position relative to trackio container
      const trackioEl = root.closest('.trackio') || root;
      const rootRect = root.getBoundingClientRect();
      const trackioRect = trackioEl.getBoundingClientRect();
      const relativeX = rootRect.left - trackioRect.left + mx + 12 + MARGIN.left;
      const relativeY = rootRect.top - trackioRect.top + my + 12 + MARGIN.top;
      tooltip.$set({ visible:true, x: Math.round(relativeX), y: Math.round(relativeY), title:`Step ${formatAbbrev(nearest)}`, subtitle: titleText, entries: entries.map(e=> ({ color:e.color, name:e.run, valueText: fmt(e.pt.value) })) }); 
      try { gPoints.selectAll('circle.pt').transition().duration(getTransitionDuration(120)).ease(d3.easeCubicOut).attr('r', d => (d && d.step === nearest ? 4 : 0)); } catch(_) {} 
    }
    function onLeave(){ hideTipTimer = setTimeout(()=>{ tooltip.$set({ visible:false, x:-9999, y:-9999 }); hoverLine.style('display','none'); try { hostEl && hostEl.dispatchEvent(new CustomEvent('trackio-hover-clear')); } catch(_) {} try { gPoints.selectAll('circle.pt').transition().duration(getTransitionDuration(120)).ease(d3.easeCubicOut).attr('r', 0); } catch(_) {} }, 80); }
    overlay.on('mousemove', onMove).on('mouseleave', onLeave);

    // External hover
    root.__showExternalStep = (stepVal) => { 
      if (stepVal==null) { 
        hoverLine.style('display','none'); 
        try { gPoints.selectAll('circle.pt').attr('r',0); } catch(_) {} 
        return; 
      } 
      let xpx;
      if (logScaleX) {
        xpx = xScale(stepVal);
      } else {
        const idx = stepIndex ? stepIndex.get(stepVal) : null;
        if (idx == null) { hoverLine.style('display','none'); return; }
        xpx = xScale(idx);
      }
      hoverLine.attr('x1',xpx).attr('x2',xpx).style('display',null); 
      try { gPoints.selectAll('circle.pt').attr('r', d => (d && d.step === stepVal ? 4 : 0)); } catch(_) {} 
    };
    root.__clearExternalStep = () => { hoverLine.style('display','none'); try { gPoints.selectAll('circle.pt').attr('r',0); } catch(_) {} };
    if (!root.__syncAttached && hostEl) { hostEl.addEventListener('trackio-hover-step', (ev)=>{ const d=ev&&ev.detail; if (!d) return; root.__showExternalStep && root.__showExternalStep(d.step); }); hostEl.addEventListener('trackio-hover-clear', ()=>{ root.__clearExternalStep && root.__clearExternalStep(); }); root.__syncAttached = true; }
  }

  function schedule(){ try { render(); } catch(_) {} }
  onMount(()=>{ schedule(); const ro = (window.ResizeObserver ? new ResizeObserver(()=> schedule()) : null); ro && ro.observe(root); cleanup = ()=>{ ro && ro.disconnect(); }; });
  onDestroy(()=>{ cleanup && cleanup(); });

  // Re-render when inputs change so tooltip/overlay are available once data arrives
  $: { 
    metricData; 
    rawMetricData;
    normalizeLoss; 
    variant; 
    logScaleX;
    smoothing;
    colorForRun; 
    // Debug log
    if (typeof window !== 'undefined') {
      console.log(`Cell re-rendering for ${metricKey}, variant: ${variant}, logScaleX: ${logScaleX}, smoothing: ${smoothing}`);
    }
    schedule(); 
  }

  // Fullscreen functionality
  function openFullscreen() {
    if (!root) return;
    
    // Create overlay if it doesn't exist
    let overlay = document.querySelector('.trackio-fullscreen-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'trackio-fullscreen-overlay';
      
      const modal = document.createElement('div');
      modal.className = 'trackio-fullscreen-modal';
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'trackio-fullscreen-close';
      closeBtn.innerHTML = '×';
      closeBtn.title = 'Fermer';
      
      overlay.appendChild(modal);
      overlay.appendChild(closeBtn);
      document.body.appendChild(overlay);
      
      // Close handlers
      const closeModal = () => {
        const cellInModal = modal.querySelector('.cell');
        if (!cellInModal || !cellInModal.__originalParent) {
          overlay.classList.remove('is-open');
          return;
        }
        
        // FLIP animation: animate back to original position
        const currentRect = cellInModal.getBoundingClientRect();
        const targetRect = cellInModal.__placeholder.getBoundingClientRect();
        
        const deltaX = targetRect.left - currentRect.left;
        const deltaY = targetRect.top - currentRect.top;
        const scaleX = targetRect.width / currentRect.width;
        const scaleY = targetRect.height / currentRect.height;
        
        // Animate back
        overlay.classList.add('transitioning'); // Disable D3 animations during close
        cellInModal.style.transformOrigin = 'top left';
        cellInModal.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        cellInModal.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
        
        overlay.classList.remove('is-open');
        
        setTimeout(() => {
          // Move cell back to original position
          if (cellInModal.__placeholder && cellInModal.__originalParent) {
            cellInModal.__originalParent.insertBefore(cellInModal, cellInModal.__placeholder);
            cellInModal.__placeholder.remove();
          }
          
          // Reset styles
          cellInModal.style.transform = '';
          cellInModal.style.transition = '';
          cellInModal.style.transformOrigin = '';
          
          // Clean up references
          delete cellInModal.__originalParent;
          delete cellInModal.__placeholder;
          
          // Re-render to fix any layout issues
          overlay.classList.remove('transitioning'); // Re-enable animations
          schedule();
        }, 300);
      };
      
      closeBtn.addEventListener('click', closeModal);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
      
      // ESC key handler
      const handleEsc = (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
          closeModal();
        }
      };
      document.addEventListener('keydown', handleEsc);
      
      overlay.__closeModal = closeModal;
      overlay.__handleEsc = handleEsc;
    }
    
    const modal = overlay.querySelector('.trackio-fullscreen-modal');
    
    // Close any existing modal
    if (overlay.classList.contains('is-open')) {
      overlay.__closeModal();
      return;
    }
    
    // FLIP animation: First - record initial position
    const initialRect = root.getBoundingClientRect();
    
    // Create placeholder
    const placeholder = document.createElement('div');
    placeholder.style.width = root.offsetWidth + 'px';
    placeholder.style.height = root.offsetHeight + 'px';
    placeholder.style.visibility = 'hidden';
    
    // Store references
    root.__originalParent = root.parentNode;
    root.__placeholder = placeholder;
    
    // Move cell to modal
    root.parentNode.insertBefore(placeholder, root);
    modal.appendChild(root);
    
    // Last - record final position  
    overlay.classList.add('is-open');
    const finalRect = root.getBoundingClientRect();
    
    // Invert - calculate the difference
    const deltaX = initialRect.left - finalRect.left;
    const deltaY = initialRect.top - finalRect.top;
    const scaleX = initialRect.width / finalRect.width;
    const scaleY = initialRect.height / finalRect.height;
    
    // Set initial transform (inverted)
    root.style.transformOrigin = 'top left';
    root.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
    
    // Play - animate to final position
    overlay.classList.add('transitioning'); // Add class to suppress animations
    requestAnimationFrame(() => {
      root.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
      root.style.transform = 'translate(0, 0) scale(1, 1)';
      
      setTimeout(() => {
        root.style.transition = '';
        root.style.transform = '';
        root.style.transformOrigin = '';
        
        // Re-render chart at new size with a small delay to ensure layout is settled
        setTimeout(() => {
          overlay.classList.remove('transitioning'); // Re-enable animations
          schedule();
        }, 50);
      }, 300);
    });
  }
</script>

<style>
  /* =========================
     CELL BASE STYLES
     ========================= */
     
  :global(.trackio .cell) {
    border: 1px solid var(--trackio-cell-border);
    border-radius: 10px;
    background: var(--trackio-cell-background);
    display: flex;
    flex-direction: column;
    position: relative;
  }
  
  /* Default cell background - hidden */
  :global(.trackio .cell-bg) {
    position: absolute;
    inset: 10px;
    pointer-events: none;
    z-index: 1;
    border-radius: 4px;
    display: none;
  }
  
  /* Default cell corners - hidden */
  :global(.trackio .cell-corners) {
    position: absolute;
    inset: 6px;
    pointer-events: none;
    z-index: 3;
    display: none;
    opacity: 0.85;
  }
  
  :global(.trackio .cell-inner) {
    position: relative;
    z-index: 2;
    padding: 8px 12px 10px 10px;
    display: flex;
    flex-direction: column;
  }
  
  /* Oblivion theme: adjust inner padding to account for corners and gap */
  :global(.trackio.theme--oblivion .cell-inner) {
    padding: var(--trackio-oblivion-hud-corner-size, 8px) 12px 10px var(--trackio-oblivion-hud-gap, 10px);
  }
  
  /* Oblivion theme: show background and corners with proper styling */
  :global(.trackio.theme--oblivion .cell-bg) {
    display: block !important;
    background: 
      radial-gradient(1200px 200px at 20% -10%, rgba(0,0,0,.05), transparent 80%),
      radial-gradient(900px 200px at 80% 110%, rgba(0,0,0,.05), transparent 80%);
  }
  
  /* Dark mode: richer gradient for Oblivion */
  :global([data-theme="dark"]) :global(.trackio.theme--oblivion .cell-bg) {
    background:
      radial-gradient(1400px 260px at 20% -10%, color-mix(in srgb, #ffffff 6.5%, transparent), transparent 80%),
      radial-gradient(1100px 240px at 80% 110%, color-mix(in srgb, #ffffff 6%, transparent), transparent 80%),
      linear-gradient(180deg, color-mix(in srgb, #ffffff 3.5%, transparent), transparent 45%);
  }
  
  :global(.trackio.theme--oblivion .cell-corners) {
    display: block !important;
    inset: 6px;
    background:
      linear-gradient(#000000, #000000) top left / 8px 1px no-repeat,
      linear-gradient(#000000, #000000) top left / 1px 8px no-repeat,
      linear-gradient(#000000, #000000) top right / 8px 1px no-repeat,
      linear-gradient(#000000, #000000) top right / 1px 8px no-repeat,
      linear-gradient(#000000, #000000) bottom left / 8px 1px no-repeat,
      linear-gradient(#000000, #000000) bottom left / 1px 8px no-repeat,
      linear-gradient(#000000, #000000) bottom right / 8px 1px no-repeat,
      linear-gradient(#000000, #000000) bottom right / 1px 8px no-repeat;
    opacity: 1;
    z-index: 3;
  }
  
  /* Dark mode: bright corners for Oblivion */
  :global([data-theme="dark"]) :global(.trackio.theme--oblivion .cell-corners) {
    background:
      linear-gradient(#ffffff, #ffffff) top left / 8px 1px no-repeat,
      linear-gradient(#ffffff, #ffffff) top left / 1px 8px no-repeat,
      linear-gradient(#ffffff, #ffffff) top right / 8px 1px no-repeat,
      linear-gradient(#ffffff, #ffffff) top right / 1px 8px no-repeat,
      linear-gradient(#ffffff, #ffffff) bottom left / 8px 1px no-repeat,
      linear-gradient(#ffffff, #ffffff) bottom left / 1px 8px no-repeat,
      linear-gradient(#ffffff, #ffffff) bottom right / 8px 1px no-repeat,
      linear-gradient(#ffffff, #ffffff) bottom right / 1px 8px no-repeat;
  }
  
  /* Dark mode corners are handled automatically by CSS variables */
  
  /* Oblivion theme: cell title with indicator dot */
  :global(.trackio.theme--oblivion .cell-title) {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--trackio-oblivion-primary);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .cell-indicator {
    width: 6px;
    height: 6px;
    background: var(--trackio-chart-axis-text);
    border: 1px solid var(--trackio-chart-axis-stroke);
    opacity: 0.6;
    flex-shrink: 0;
  }

  /* Oblivion theme: adjust cell styling to remove default border only in Oblivion */
  :global(.trackio.theme--oblivion .cell) {
    border: none !important;
    background: transparent !important;
  }
  
  /* Classic theme: ensure borders are visible (redundant but explicit) */
  :global(.trackio.theme--classic .cell) {
    border: 1px solid var(--trackio-cell-border) !important;
    background: var(--trackio-cell-background) !important;
    border-radius: 10px !important;
  }
  
  :global(.trackio .cell-header) {
    padding: 8px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  
  /* Oblivion theme: adjust header padding */
  :global(.trackio.theme--oblivion .cell-header) {
    padding: 5px 0px 18px 12px;
  }
  
  :global(.trackio .cell-title) {
    font-size: 13px;
    font-weight: 700;
    color: var(--trackio-text-primary);
    font-family: var(--trackio-font-family);
  }
  
  :global(.trackio .cell-body) {
    position: relative;
    width: 100%;
    overflow: hidden;
  }
  
  :global(.trackio .cell-body svg) {
    max-width: 100%;
    height: auto;
    display: block;
  }

  /* Theme: Oblivion overrides for cell layers - styles defined above */
  
  /* Force Roboto Mono in Oblivion theme for cell elements */
  :global(.trackio.theme--oblivion .cell-title) {
    font-family: 'Roboto Mono', 'Roboto Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
    font-weight: 800 !important;
    font-size: 12px !important;
    position: relative;
    padding-left: 0;
  }
  
  /* Oblivion theme: add indicator dot before title */
  :global(.trackio.theme--oblivion .cell-title)::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 6px;
    height: 6px;
    background: var(--trackio-oblivion-primary);
    border: 1px solid var(--trackio-oblivion-dim);
    box-shadow: 0 0 10px color-mix(in srgb, var(--trackio-oblivion-base) 25%, transparent) inset;
    opacity: 0.5;
  }

  /* Ghost hover effect */
  :global(.trackio.hovering .ghost) {
    opacity: 0.2;
    transition: opacity 0.15s ease;
  }

  /* Wide cell spans full width */
  :global(.trackio__grid .cell--wide) {
    grid-column: 1 / -1;
  }

  /* Fullscreen button */
  .cell-fullscreen-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 0;
    background: transparent;
    color: var(--trackio-chart-axis-text);
    opacity: 0.6;
    cursor: pointer;
    border-radius: 6px;
    transition: opacity 0.15s ease;
  }
  .cell-fullscreen-btn:hover {
    opacity: 1;
    /* No background on hover - just opacity change */
  }
  .cell-fullscreen-btn svg {
    width: 18px;
    height: 18px;
    fill: var(--trackio-chart-axis-text);
  }

  /* Fullscreen modal */
  :global(.trackio-fullscreen-overlay) {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
  :global(.trackio-fullscreen-overlay.is-open) {
    opacity: 1;
    pointer-events: auto;
  }
  :global(.trackio-fullscreen-modal) {
    position: relative;
    width: min(95vw, 1400px);
    height: min(95vh, 900px);
    background: var(--surface-bg);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }
  :global(.trackio-fullscreen-close) {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 40px;
    height: 40px;
    border: 0;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    font-size: 20px;
    transition: background-color 0.15s ease;
  }
  :global(.trackio-fullscreen-close:hover) {
    background: rgba(0, 0, 0, 0.7);
  }
  
  /* Hide fullscreen button when in modal */
  :global(.trackio-fullscreen-modal .cell-fullscreen-btn) {
    display: none;
  }
  
  /* Minor ticks styling for logarithmic scales */
  :global(.trackio .minor-ticks line.minor-tick) {
    stroke: var(--trackio-chart-axis-stroke);
    stroke-opacity: 0.4;
    stroke-width: 0.5px;
  }
  
  /* Oblivion theme: enhanced minor ticks */
  :global(.trackio.theme--oblivion .minor-ticks line.minor-tick) {
    stroke: var(--trackio-oblivion-dim);
    stroke-opacity: 0.6;
    stroke-width: 0.8px;
  }
  

  /* Fullscreen cell takes full modal space */
  :global(.trackio-fullscreen-modal .cell) {
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 0;
  }
  
  :global(.trackio-fullscreen-modal .cell-inner) {
    height: 100%;
  }
  
  :global(.trackio-fullscreen-modal .cell-body) {
    flex: 1;
    height: calc(100% - 50px); /* Minus header height */
  }
  
  :global(.trackio-fullscreen-modal .cell-body svg) {
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    max-height: none !important;
  }
</style>

<div class="cell {wide ? 'cell--wide' : ''}" bind:this={root} data-metric={metricKey} data-title={titleText} data-variant={variant}>
  <div class="cell-bg"></div>
  <div class="cell-corners"></div>
  <div class="cell-inner">
    <div class="cell-header">
      <div class="cell-title">
        {#if variant === 'oblivion'}
          <span class="cell-indicator"></span>
        {/if}
        {titleText}
      </div>
      <button class="cell-fullscreen-btn" type="button" on:click={openFullscreen} title="Fullscreen">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 9V4h5v2H6v3H4zm10-5h5v5h-2V6h-3V4zM6 18h3v2H4v-5h2v3zm12-3h2v5h-5v-2h3v-3z"/>
        </svg>
      </button>
    </div>
    <div class="cell-body"><div bind:this={body}></div></div>
  </div>
</div>


