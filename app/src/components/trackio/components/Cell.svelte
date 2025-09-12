<script>
  import ChartRenderer from '../renderers/ChartRendererRefactored.svelte';
  import ChartTooltip from '../renderers/ChartTooltip.svelte';
  import { formatAbbrev } from '../core/chart-utils.js';
  
  // Props
  export let metricKey;
  export let titleText;
  export let wide = false;
  export let variant = 'classic';
  export let normalizeLoss = true;
  export let logScaleX = false;
  export let smoothing = false;
  export let metricData = {}; // { run -> [{step,value}] } - smoothed data
  export let rawMetricData = {}; // { run -> [{step,value}] } - original data for background when smoothing
  export let colorForRun = (name) => '#999';
  export let hostEl = null;

  // Navigation props
  export let currentIndex = 0;
  export let onOpenModal = null;

  // Component state
  let root;
  let chartRenderer; // Reference to ChartRenderer component
  
  // Tooltip state
  let tooltipVisible = false;
  let tooltipX = -9999;
  let tooltipY = -9999;
  let tooltipTitle = '';
  let tooltipSubtitle = '';
  let tooltipEntries = [];
  
  // Handlers
  function openFullscreen() {
    if (onOpenModal) {
      onOpenModal(currentIndex);
    }
  }
  
  function handleChartHover(data) {
    console.log('🎯 Cell.svelte handleChartHover called with:', data);
    const { step, entries, position } = data;
    
    if (entries.length) {
      // Use global mouse coordinates for tooltip positioning
      const trackioEl = hostEl.closest('.trackio');
      const trackioRect = trackioEl.getBoundingClientRect();
      
      // Position tooltip near global cursor with small offset
      const relativeX = (position.globalX || position.x) - trackioRect.left + 15;
      const relativeY = (position.globalY || position.y) - trackioRect.top + 15;
      
      tooltipVisible = true;
      tooltipX = Math.round(relativeX);
      tooltipY = Math.round(relativeY);
      tooltipTitle = `Step ${formatAbbrev(step)}`;
      tooltipSubtitle = titleText;
      tooltipEntries = entries;
      
      console.log('📍 Tooltip state updated:', { tooltipVisible, tooltipX, tooltipY, tooltipTitle, entriesCount: tooltipEntries.length });
      
      // Dispatch to host for cross-cell synchronization
      try { 
        hostEl && hostEl.dispatchEvent(new CustomEvent('trackio-hover-step', { 
          detail: { step, sourceMetric: metricKey } 
        })); 
      } catch(_) {}
    }
  }
  
  function handleChartLeave() {
    tooltipVisible = false;
    tooltipX = -9999;
    tooltipY = -9999;
    
    // Dispatch leave event
    try { 
      hostEl && hostEl.dispatchEvent(new CustomEvent('trackio-hover-clear', {
        detail: { sourceMetric: metricKey }
      })); 
    } catch(_) {} 
  }
  
  // External hover synchronization
  function setupExternalHover() {
    if (!root || root.__syncAttached || !hostEl) return;
    
    hostEl.addEventListener('trackio-hover-step', (ev) => {
      const d = ev && ev.detail;
      if (!d || !chartRenderer) return;
      
      // Don't sync to self - avoid infinite loops
      if (d.sourceMetric === metricKey) return;
      
      // Show hover line at the specified step
      chartRenderer.showHoverLine(d.step);
    });
    
    hostEl.addEventListener('trackio-hover-clear', (ev) => {
      if (!chartRenderer) return;
      
      // Don't sync to self
      const d = ev && ev.detail;
      if (d && d.sourceMetric === metricKey) return;
      
      // Hide hover line
      chartRenderer.hideHoverLine();
    });
    
    root.__syncAttached = true;
  }
  
  $: if (root && hostEl) {
    setupExternalHover();
  }
</script>

<div 
  class="cell {wide ? 'cell--wide' : ''}" 
  bind:this={root} 
  data-metric={metricKey} 
  data-title={titleText} 
  data-variant={variant}
>
  <div class="cell-bg"></div>
  <div class="cell-corners"></div>
  <div class="cell-inner">
    <div class="cell-header">
      <div class="cell-title">
        {titleText}
      </div>
      <button 
        class="cell-fullscreen-btn" 
        type="button" 
        on:click={openFullscreen} 
        title="Fullscreen"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 9V4h5v2H6v3H4zm10-5h5v5h-2V6h-3V4zM6 18h3v2H4v-5h2v3zm12-3h2v5h-5v-2h3v-3z"/>
        </svg>
      </button>
    </div>
    
    <div class="cell-body">
      <ChartRenderer
        bind:this={chartRenderer}
        {metricData}
        {rawMetricData}
        {colorForRun}
        {variant}
        {logScaleX}
        {smoothing}
        {normalizeLoss}
        {metricKey}
        {titleText}
        {hostEl}
        width={800}
        height={150}
        onHover={handleChartHover}
        onLeave={handleChartLeave}
      />
    </div>
  </div>
</div>

<!-- Tooltip -->
<ChartTooltip
  visible={tooltipVisible}
  x={tooltipX}
  y={tooltipY}
  title={tooltipTitle}
  subtitle={tooltipSubtitle}
  entries={tooltipEntries}
  parentElement={root}
/>



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
  
  :global(.trackio .cell-header) {
    padding: 0 0px 10px 10px; 
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
  
  /* Oblivion theme overrides */
  :global(.trackio.theme--oblivion .cell) {
    border: none !important;
    background: transparent !important;
  }
  
  :global(.trackio.theme--classic .cell) {
    border: 1px solid var(--trackio-cell-border) !important;
    background: var(--trackio-cell-background) !important;
    border-radius: 10px !important;
  }
  
  :global(.trackio.theme--oblivion .cell-title) {
    font-family: 'Roboto Mono', 'Roboto Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace !important;
    letter-spacing: 0.12em !important;
    text-transform: uppercase !important;
    font-weight: 800 !important;
    font-size: 12px !important;
    position: relative;
    padding-left: 14px;
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
    background: var(--trackio-chart-axis-text);
    border: 1px solid var(--trackio-chart-axis-stroke);
    border-radius: 1px;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.1) inset;
    opacity: 0.6;
  }


  /* Ghost hover effect */
  :global(.trackio.hovering .ghost) {
    opacity: 0.2;
    transition: opacity 0.15s ease;
  }
  
  /* Specific ghost effect for raw lines when smoothing is active */
  :global(.trackio.hovering path.raw-line.ghost) {
    opacity: 0.1;
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
  }
  
  .cell-fullscreen-btn svg {
    width: 18px;
    height: 18px;
    fill: var(--trackio-chart-axis-text);
  }
</style>
