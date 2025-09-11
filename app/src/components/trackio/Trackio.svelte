<script>
  import * as d3 from 'd3';
  import { formatAbbrev, smoothMetricData } from './chart-utils.js';
  import { generateRunNames, genCurves } from './data-generator.js';
  import Legend from './Legend.svelte';
  import Cell from './Cell.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { jitterTrigger } from './store.js';

  export let variant = 'classic'; // 'classic' | 'oblivion'
  export let normalizeLoss = true;
  export let logScaleX = false;
  export let smoothing = false;

  let hostEl;
  let gridEl;
  let legendItems = [];
  const cellsDef = [
    { metric:'epoch', title:'Epoch' },
    { metric:'train_accuracy', title:'Train accuracy' },
    { metric:'train_loss', title:'Train loss' },
    { metric:'val_accuracy', title:'Val accuracy' },
    { metric:'val_loss', title:'Val loss', wide:true }
  ];
  let preparedData = {};
  let colorsByRun = {};
  
  // Variables for data management (will be initialized in onMount)
  let dataByMetric = new Map();
  let metricsToDraw = [];
  let currentRunList = [];
  let cycleIdx = 2;
  
  // Dynamic color palette using color-palettes.js helper
  let dynamicPalette = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#f97316', '#3b82f6', '#8b5ad6']; // fallback
  
  const updateDynamicPalette = () => {
    if (typeof window !== 'undefined' && window.ColorPalettes && currentRunList.length > 0) {
      try {
        dynamicPalette = window.ColorPalettes.getColors('categorical', currentRunList.length);
      } catch (e) {
        console.warn('Failed to generate dynamic palette:', e);
        // Keep fallback palette
      }
    }
  };
  
  const colorForRun = (name) => {
    const idx = currentRunList.indexOf(name);
    return idx >= 0 ? dynamicPalette[idx % dynamicPalette.length] : '#999';
  };
  

  // Jitter function - generates completely new data with new runs
  function jitterData(){
    console.log('jitterData called - generating new data with random number of runs'); // Debug log
    
    // Generate new random data with weighted probability for fewer runs
    // Higher probability for 2-3 runs, lower for 4-5-6 runs
    const rand = Math.random();
    let wantRuns;
    if (rand < 0.4) wantRuns = 2;        // 40% chance
    else if (rand < 0.7) wantRuns = 3;   // 30% chance  
    else if (rand < 0.85) wantRuns = 4;  // 15% chance
    else if (rand < 0.95) wantRuns = 5;  // 10% chance
    else wantRuns = 6;                   // 5% chance
    const runsSim = generateRunNames(wantRuns);
    const rnd = (min,max)=> Math.floor(min + Math.random()*(max-min+1));
    let stepsCount = rnd(80, 240); // Random number of steps
    const steps = Array.from({length: stepsCount}, (_,i)=> i+1);
    const nextByMetric = new Map();
    const TARGET_METRICS = ['epoch', 'train_accuracy', 'train_loss', 'val_accuracy', 'val_loss'];
    
    // Initialize data structure
    TARGET_METRICS.forEach((tgt) => {
      const map = {};
      runsSim.forEach((r) => { map[r] = []; });
      nextByMetric.set(tgt, map);
    });
    
    // Generate curves for each run
    runsSim.forEach(run => {
      const curves = genCurves(stepsCount);
      steps.forEach((s,i)=>{
        nextByMetric.get('epoch')[run].push({ step:s, value:s });
        nextByMetric.get('train_accuracy')[run].push({ step:s, value: curves.accTrain[i] });
        nextByMetric.get('val_accuracy')[run].push({ step:s, value: curves.accVal[i] });
        nextByMetric.get('train_loss')[run].push({ step:s, value: curves.lossTrain[i] });
        nextByMetric.get('val_loss')[run].push({ step:s, value: curves.lossVal[i] });
      });
    });
    
    // Update all reactive data
    nextByMetric.forEach((v,k)=> dataByMetric.set(k,v));
    metricsToDraw = TARGET_METRICS;
    currentRunList = runsSim.slice();
    updateDynamicPalette(); // Generate new colors based on run count
    legendItems = currentRunList.map((name) => ({ name, color: colorForRun(name) }));
    updatePreparedData();
    colorsByRun = Object.fromEntries(currentRunList.map((name) => [name, colorForRun(name)]));
    
    console.log(`jitterData completed - generated ${wantRuns} runs with ${stepsCount} steps`); // Debug log
  }

  // Public API: allow external theme switch
  function setTheme(name){
    variant = name === 'oblivion' ? 'oblivion' : 'classic';
    updateThemeClass();
    
    // Debug log for font application
    if (typeof window !== 'undefined') {
      console.log(`Theme switched to: ${variant}`);
      if (hostEl) {
        const computedStyle = getComputedStyle(hostEl);
        const appliedFont = computedStyle.fontFamily;
        console.log(`Applied font-family: ${appliedFont}`);
      }
    }
  }

  // Public API: allow external log scale X toggle
  function setLogScaleX(enabled) {
    logScaleX = enabled;
    console.log(`Log scale X set to: ${logScaleX}`);
  }

  // Public API: allow external smoothing toggle
  function setSmoothing(enabled) {
    smoothing = enabled;
    console.log(`Smoothing set to: ${smoothing}`);
    // Re-prepare data with smoothing applied
    updatePreparedData();
  }

  // Update prepared data with optional smoothing
  let preparedRawData = {}; // Store original data for background display
  
  function updatePreparedData() {
    const TARGET_METRICS = ['epoch', 'train_accuracy', 'train_loss', 'val_accuracy', 'val_loss'];
    let dataToUse = {};
    let rawDataToStore = {};
    
    TARGET_METRICS.forEach(metric => {
      const rawData = dataByMetric.get(metric);
      if (rawData) {
        // Store original data
        rawDataToStore[metric] = rawData;
        
        // Apply smoothing if enabled (except for epoch which should stay exact)
        dataToUse[metric] = (smoothing && metric !== 'epoch') 
          ? smoothMetricData(rawData, 5) // Window size of 5
          : rawData;
      }
    });
    
    preparedData = dataToUse;
    preparedRawData = rawDataToStore;
    console.log(`Prepared data updated, smoothing: ${smoothing}`);
  }

  function updateThemeClass(){
    if (!hostEl) return;
    hostEl.classList.toggle('theme--classic', variant === 'classic');
    hostEl.classList.toggle('theme--oblivion', variant === 'oblivion');
    hostEl.setAttribute('data-variant', variant);
  }

  $: updateThemeClass();


  // Chart logic now handled by Cell.svelte

  let cleanup = null;
  onMount(() => {
    if (!hostEl || !gridEl) return;
    hostEl.__setTheme = setTheme;

    // Jitter & Simulate functions
    function rebuildLegend(){ 
      updateDynamicPalette(); // Update colors when adding new data
      legendItems = currentRunList.map((name) => ({ name, color: colorForRun(name) })); 
    }
    
    function simulateData(){
      // Generate new random data with weighted probability for fewer runs
      // Higher probability for 2-3 runs, lower for 4-5-6 runs
      const rand = Math.random();
      let wantRuns;
      if (rand < 0.4) wantRuns = 2;        // 40% chance
      else if (rand < 0.7) wantRuns = 3;   // 30% chance  
      else if (rand < 0.85) wantRuns = 4;  // 15% chance
      else if (rand < 0.95) wantRuns = 5;  // 10% chance
      else wantRuns = 6;                   // 5% chance
      const runsSim = generateRunNames(wantRuns);
      const rnd = (min,max)=> Math.floor(min + Math.random()*(max-min+1));
      let stepsCount = 16;
      if (cycleIdx === 0) stepsCount = rnd(4, 12); else if (cycleIdx === 1) stepsCount = rnd(16, 48); else stepsCount = rnd(80, 240);
      cycleIdx = (cycleIdx + 1) % 3;
      const steps = Array.from({length: stepsCount}, (_,i)=> i+1);
      const nextByMetric = new Map();
      const TARGET_METRICS = ['epoch', 'train_accuracy', 'train_loss', 'val_accuracy', 'val_loss'];
      const mList = (metricsToDraw && metricsToDraw.length) ? metricsToDraw : TARGET_METRICS;
      mList.forEach((tgt) => {
        const map = {};
        runsSim.forEach((r) => { map[r] = []; });
        nextByMetric.set(tgt, map);
      });
      runsSim.forEach(run => {
        const curves = genCurves(stepsCount);
        steps.forEach((s,i)=>{
          if (mList.includes('epoch')) nextByMetric.get('epoch')[run].push({ step:s, value:s });
          if (mList.includes('train_accuracy')) nextByMetric.get('train_accuracy')[run].push({ step:s, value: curves.accTrain[i] });
          if (mList.includes('val_accuracy')) nextByMetric.get('val_accuracy')[run].push({ step:s, value: curves.accVal[i] });
          if (mList.includes('train_loss')) nextByMetric.get('train_loss')[run].push({ step:s, value: curves.lossTrain[i] });
          if (mList.includes('val_loss')) nextByMetric.get('val_loss')[run].push({ step:s, value: curves.lossVal[i] });
        });
      });
      nextByMetric.forEach((v,k)=> dataByMetric.set(k,v));
      currentRunList = runsSim.slice();
      rebuildLegend();
      updatePreparedData();
      updateDynamicPalette(); // Update colors when rebuilding
      colorsByRun = Object.fromEntries(currentRunList.map((name) => [name, colorForRun(name)]));
    }
    // No need for event listeners anymore - we'll use reactive statement

    // Start with level 3 long synthetic data for consistency
    simulateData();
    // Svelte Cells will react to preparedData/colorsByRun updates

    cleanup = () => { 
      // No cleanup needed for reactive statements
    };
  });

  onDestroy(() => { if (cleanup) cleanup(); });

  // Expose instance for debugging and external theme control
  onMount(() => {
    window.trackioInstance = { jitterData };
    if (hostEl) {
      hostEl.__trackioInstance = { setTheme, setLogScaleX, setSmoothing, jitterData };
    }
    
    // Initialize dynamic palette
    updateDynamicPalette();
    
    // Listen for palette updates from color-palettes.js
    const handlePaletteUpdate = () => {
      updateDynamicPalette();
      // Rebuild legend and colors if needed
      if (currentRunList.length > 0) {
        legendItems = currentRunList.map((name) => ({ name, color: colorForRun(name) }));
        colorsByRun = Object.fromEntries(currentRunList.map((name) => [name, colorForRun(name)]));
      }
    };
    
    document.addEventListener('palettes:updated', handlePaletteUpdate);
    
    // Cleanup listener on destroy
    return () => {
      document.removeEventListener('palettes:updated', handlePaletteUpdate);
    };
  });

  // React to jitter trigger from store
  $: {
    console.log('Reactive statement triggered, jitterTrigger value:', $jitterTrigger);
    if ($jitterTrigger > 0) {
      console.log('Jitter trigger activated:', $jitterTrigger, 'calling jitterData()');
      jitterData();
    }
  }

  // Legend ghost helpers (hover effects)
  function ghostRun(run){
    try {
      hostEl.classList.add('hovering');
      
      // Ghost the chart lines and points
      hostEl.querySelectorAll('.cell').forEach(cell => {
        cell.querySelectorAll('svg .lines path.run-line').forEach(p => p.classList.toggle('ghost', p.getAttribute('data-run') !== run));
        cell.querySelectorAll('svg .points circle.pt').forEach(c => c.classList.toggle('ghost', c.getAttribute('data-run') !== run));
      });
      
      // Ghost the legend items
      hostEl.querySelectorAll('.legend-bottom .item').forEach(item => {
        const itemRun = item.getAttribute('data-run');
        item.classList.toggle('ghost', itemRun !== run);
      });
    } catch(_) {}
  }
  function clearGhost(){
    try {
      hostEl.classList.remove('hovering');
      
      // Clear ghost from chart lines and points
      hostEl.querySelectorAll('.cell').forEach(cell => {
        cell.querySelectorAll('svg .lines path.run-line').forEach(p => p.classList.remove('ghost'));
        cell.querySelectorAll('svg .points circle.pt').forEach(c => c.classList.remove('ghost'));
      });
      
      // Clear ghost from legend items
      hostEl.querySelectorAll('.legend-bottom .item').forEach(item => {
        item.classList.remove('ghost');
      });
    } catch(_) {}
  }
</script>

<div class="trackio theme--classic" bind:this={hostEl} data-variant={variant}>
  <div class="trackio__header">
    <Legend items={legendItems} on:legend-hover={(e) => { const run = e?.detail?.name; if (!run) return; ghostRun(run); }} on:legend-leave={() => { clearGhost(); }} />
  </div>
  <div class="trackio__grid" bind:this={gridEl}>
    {#each cellsDef as c}
      <Cell metricKey={c.metric} titleText={c.title} wide={c.wide} variant={variant} normalizeLoss={normalizeLoss} logScaleX={logScaleX} smoothing={smoothing} metricData={(preparedData && preparedData[c.metric]) || {}} rawMetricData={(preparedRawData && preparedRawData[c.metric]) || {}} colorForRun={(name)=> colorsByRun[name] || '#999'} hostEl={hostEl} />
    {/each}
  </div>
</div>

<style>
  /* =========================
     TRACKIO THEME SYSTEM
     ========================= */

  /* Font imports for themes - ensure Roboto Mono is loaded for Oblivion theme */
  @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;600;700&display=swap');
  
  /* Fallback font-face declaration */
  @font-face {
    font-family: 'Roboto Mono Fallback';
    src: url('https://fonts.gstatic.com/s/robotomono/v23/L0xuDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_3vq_ROW4AJi8SJQt.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  /* Base variables - all themes inherit these */
  .trackio {
    position: relative;
    --z-tooltip: 50;
    --z-overlay: 99999999;
    
    /* Typography */
    --trackio-font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    --trackio-font-weight-normal: 400;
    --trackio-font-weight-medium: 600;
    --trackio-font-weight-bold: 700;
    
    /* Apply font-family to root element */
    font-family: var(--trackio-font-family);
    
    /* Base color system for Classic theme */
    --trackio-base: #323232;
    --trackio-primary: var(--trackio-base);
    --trackio-dim: color-mix(in srgb, var(--trackio-base) 28%, transparent);
    --trackio-text: color-mix(in srgb, var(--trackio-base) 60%, transparent);
    --trackio-subtle: color-mix(in srgb, var(--trackio-base) 8%, transparent);
    
    /* Chart rendering */
    --trackio-chart-grid-type: 'lines'; /* 'lines' | 'dots' */
    --trackio-chart-axis-stroke: var(--trackio-dim);
    --trackio-chart-axis-text: var(--trackio-text);
    --trackio-chart-grid-stroke: var(--trackio-subtle);
    --trackio-chart-grid-opacity: 1;
  }
  
  /* Dark mode overrides for Classic theme */
  :global([data-theme="dark"]) .trackio.theme--classic {
    --trackio-base: #ffffff;
    --trackio-primary: var(--trackio-base);
    --trackio-dim: color-mix(in srgb, var(--trackio-base) 25%, transparent);
    --trackio-text: color-mix(in srgb, var(--trackio-base) 60%, transparent);
    --trackio-subtle: color-mix(in srgb, var(--trackio-base) 8%, transparent);
    
    /* Cell background for dark mode */
    --trackio-cell-background: rgba(255, 255, 255, 0.03);
  }
  
  .trackio.theme--classic {
    /* Cell styling */
    --trackio-cell-background: rgba(0, 0, 0, 0.02);
    --trackio-cell-border: var(--border-color, rgba(0, 0, 0, 0.1));
    --trackio-cell-corner-inset: 0px;
    --trackio-cell-gap: 12px;
    
    /* Typography */
    --trackio-text-primary: var(--text-color, rgba(0, 0, 0, 0.9));
    --trackio-text-secondary: var(--muted-color, rgba(0, 0, 0, 0.6));
    --trackio-text-accent: var(--primary-color, #E889AB);
    
    /* Tooltip */
    --trackio-tooltip-background: var(--surface-bg, white);
    --trackio-tooltip-border: var(--border-color, rgba(0, 0, 0, 0.1));
    --trackio-tooltip-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    
    /* Legend */
    --trackio-legend-text: var(--text-color, rgba(0, 0, 0, 0.9));
    --trackio-legend-swatch-border: var(--border-color, rgba(0, 0, 0, 0.1));
  }

  /* Dark mode adjustments */
  :global([data-theme="dark"]) .trackio {
    --trackio-chart-axis-stroke: rgba(255, 255, 255, 0.18);
    --trackio-chart-axis-text: rgba(255, 255, 255, 0.60);
    --trackio-chart-grid-stroke: rgba(255, 255, 255, 0.08);
  }

  /* =========================
     THEME: CLASSIC (Default)
     ========================= */
  
  .trackio.theme--classic {
    /* Keep default values - no overrides needed */
  }

  /* =========================
     THEME: OBLIVION
     ========================= */
  
  .trackio.theme--oblivion {
    /* Core oblivion color system - Light mode: darker colors for visibility */
    --trackio-oblivion-base: #2a2a2a;
    --trackio-oblivion-primary: var(--trackio-oblivion-base);
    --trackio-oblivion-dim: color-mix(in srgb, var(--trackio-oblivion-base) 30%, transparent);
    --trackio-oblivion-subtle: color-mix(in srgb, var(--trackio-oblivion-base) 8%, transparent);
    --trackio-oblivion-ghost: color-mix(in srgb, var(--trackio-oblivion-base) 4%, transparent);
    
    /* Chart rendering overrides */
    --trackio-chart-grid-type: 'dots';
    --trackio-chart-axis-stroke: var(--trackio-oblivion-dim);
    --trackio-chart-axis-text: var(--trackio-oblivion-primary);
    --trackio-chart-grid-stroke: var(--trackio-oblivion-dim);
    --trackio-chart-grid-opacity: 0.6;
  }
  
  /* Dark mode overrides for Oblivion theme */
  :global([data-theme="dark"]) .trackio.theme--oblivion {
    --trackio-oblivion-base: #ffffff;
    --trackio-oblivion-primary: var(--trackio-oblivion-base);
    --trackio-oblivion-dim: color-mix(in srgb, var(--trackio-oblivion-base) 25%, transparent);
    --trackio-oblivion-subtle: color-mix(in srgb, var(--trackio-oblivion-base) 8%, transparent);
    --trackio-oblivion-ghost: color-mix(in srgb, var(--trackio-oblivion-base) 4%, transparent);
  }
  
  .trackio.theme--oblivion {
    /* Cell styling overrides */
    --trackio-cell-background: var(--trackio-oblivion-subtle);
    --trackio-cell-border: var(--trackio-oblivion-dim);
    --trackio-cell-corner-inset: 6px;
    --trackio-cell-gap: 0px;
    
    /* HUD-specific variables */
    --trackio-oblivion-hud-gap: 10px;
    --trackio-oblivion-hud-corner-size: 8px;
    --trackio-oblivion-hud-bg-gradient: 
      radial-gradient(1200px 200px at 20% -10%, var(--trackio-oblivion-ghost), transparent 80%),
      radial-gradient(900px 200px at 80% 110%, var(--trackio-oblivion-ghost), transparent 80%);
    
    /* Typography overrides */
    --trackio-text-primary: var(--trackio-oblivion-primary);
    --trackio-text-secondary: var(--trackio-oblivion-dim);
    --trackio-text-accent: var(--trackio-oblivion-primary);
    
    /* Tooltip overrides */
    --trackio-tooltip-background: var(--trackio-oblivion-subtle);
    --trackio-tooltip-border: var(--trackio-oblivion-dim);
    --trackio-tooltip-shadow: 
      0 8px 32px color-mix(in srgb, var(--trackio-oblivion-base) 8%, transparent),
      0 2px 8px color-mix(in srgb, var(--trackio-oblivion-base) 6%, transparent);
    
    /* Legend overrides */
    --trackio-legend-text: var(--trackio-oblivion-primary);
    --trackio-legend-swatch-border: var(--trackio-oblivion-dim);
    
    /* Font styling overrides */
    --trackio-font-family: 'Roboto Mono', 'Roboto Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-family: var(--trackio-font-family) !important;
    color: var(--trackio-text-primary);
  }

  /* Force Roboto Mono application in Oblivion theme */
  .trackio.theme--oblivion,
  .trackio.theme--oblivion * {
    font-family: 'Roboto Mono', 'Roboto Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace !important;
  }
  
  /* Specific overrides for different elements in Oblivion */
  .trackio.theme--oblivion .cell-title,
  .trackio.theme--oblivion .legend-bottom,
  .trackio.theme--oblivion .legend-title,
  .trackio.theme--oblivion .item {
    font-family: 'Roboto Mono', 'Roboto Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace !important;
  }

  /* Dark mode adjustments for Oblivion */
  :global([data-theme="dark"]) .trackio.theme--oblivion {
    --trackio-oblivion-base: #ffffff;
    --trackio-oblivion-hud-bg-gradient: 
      radial-gradient(1400px 260px at 20% -10%, color-mix(in srgb, var(--trackio-oblivion-base) 6.5%, transparent), transparent 80%),
      radial-gradient(1100px 240px at 80% 110%, color-mix(in srgb, var(--trackio-oblivion-base) 6%, transparent), transparent 80%),
      linear-gradient(180deg, color-mix(in srgb, var(--trackio-oblivion-base) 3.5%, transparent), transparent 45%);
    
    --trackio-tooltip-shadow: 
      0 8px 32px color-mix(in srgb, var(--trackio-oblivion-base) 5%, transparent),
      0 2px 8px color-mix(in srgb, black 10%, transparent);
    
    background: #0f1115;
  }

  /* =========================
     LAYOUT & COMPONENTS
     ========================= */

  .trackio__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--trackio-cell-gap);
  }
  
  @media (max-width: 980px) {
    .trackio__grid { grid-template-columns: 1fr; }
  }

  .trackio__header {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 12px;
    margin: 0 0 10px 0;
    flex-wrap: wrap;
    width: 100%;
  }

  /* Legacy axis/grid selectors - for compatibility with Cell.svelte */
  .trackio .axes path,
  .trackio .axes line {
    stroke: var(--trackio-chart-axis-stroke);
  }
  
  .trackio .axes text {
    fill: var(--trackio-chart-axis-text);
    font-family: var(--trackio-font-family);
  }
  
  /* Force font-family for SVG text in Oblivion */
  .trackio.theme--oblivion .axes text {
    font-family: 'Roboto Mono', 'Roboto Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace !important;
  }
  
  .trackio .grid line {
    stroke: var(--trackio-chart-grid-stroke);
    opacity: var(--trackio-chart-grid-opacity);
  }

  /* Grid type switching */
  .trackio .grid-dots { display: none; }
  .trackio.theme--oblivion .grid { display: none; }
  .trackio.theme--oblivion .grid-dots { display: block; }
  .trackio.theme--oblivion .cell-bg,
  .trackio.theme--oblivion .cell-corners { display: block; }
</style>


