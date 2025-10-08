<script>
  import { createEventDispatcher } from 'svelte';
  import ChartRenderer from '../renderers/ChartRendererRefactored.svelte';
  import ChartTooltip from '../renderers/ChartTooltip.svelte';
  import Legend from './Legend.svelte';
  import { formatAbbrev } from '../core/chart-utils.js';
  
  // Props
  export let visible = false;
  export let title = '';
  export let metricData = {};
  export let rawMetricData = {};
  export let colorForRun = (name) => '#999';
  export let variant = 'classic';
  export let logScaleX = false;
  export let smoothing = false;
  export let normalizeLoss = true;
  export let metricKey = '';
  export let titleText = '';
  
  // Navigation props
  export let currentIndex = 0;
  export let totalCharts = 1;
  export let onNavigate = null;
  
  const dispatch = createEventDispatcher();
  
  let modalElement;
  
  // Tooltip state (same as Cell.svelte)
  let tooltipVisible = false;
  let tooltipX = -9999;
  let tooltipY = -9999;
  let tooltipTitle = '';
  let tooltipSubtitle = '';
  let tooltipEntries = [];
  
  // Modal management
  $: if (visible && modalElement) {
    document.body.appendChild(modalElement);
    
    // Copy CSS variables from the trackio parent to ensure theme inheritance
    const trackioParent = document.querySelector('.trackio');
    if (trackioParent) {
      const computedStyle = getComputedStyle(trackioParent);
      const cssVars = [
        '--trackio-chart-axis-stroke',
        '--trackio-chart-axis-text', 
        '--trackio-chart-grid-stroke',
        '--trackio-chart-grid-opacity',
        '--trackio-chart-grid-type',
        '--trackio-font-family',
        '--trackio-tooltip-background',
        '--trackio-tooltip-border',
        '--trackio-tooltip-shadow',
        '--trackio-text-primary',
        '--trackio-text-secondary'
      ];
      
      cssVars.forEach(varName => {
        const value = computedStyle.getPropertyValue(varName);
        if (value) {
          modalElement.style.setProperty(varName, value);
        }
      });
    }
    
    requestAnimationFrame(() => {
      modalElement.classList.add('show');
    });
  }
  
  function closeModal() {
    if (modalElement) {
      modalElement.classList.remove('show');
      setTimeout(() => {
        if (modalElement && modalElement.parentNode) {
          modalElement.parentNode.removeChild(modalElement);
        }
        dispatch('close');
      }, 300);
    }
  }
  
  function handleKeydown(e) {
    if (e.key === 'Escape') {
      closeModal();
    } else if (e.key === 'ArrowLeft') {
      navigatePrevious();
    } else if (e.key === 'ArrowRight') {
      navigateNext();
    }
  }
  
  function navigatePrevious() {
    if (onNavigate && totalCharts > 1) {
      const newIndex = currentIndex === 0 ? totalCharts - 1 : currentIndex - 1;
      onNavigate(newIndex);
    }
  }
  
  function navigateNext() {
    if (onNavigate && totalCharts > 1) {
      const newIndex = currentIndex === totalCharts - 1 ? 0 : currentIndex + 1;
      onNavigate(newIndex);
    }
  }
  
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  }
  
  // Prepare legend data
  $: runs = Object.keys(metricData);
  $: legendData = runs.map(run => ({
    name: run,
    color: colorForRun(run)
  }));
  
  // Tooltip handling (same logic as Cell.svelte)
  function handleChartHover(data) {
    const { step, entries, position } = data;
    
    if (entries.length) {
      // Use global mouse coordinates for tooltip positioning
      const modalRect = modalElement.getBoundingClientRect();
      
      // Position tooltip near global cursor with small offset
      const relativeX = (position.globalX || position.x) - modalRect.left + 15;
      const relativeY = (position.globalY || position.y) - modalRect.top + 15;
      
      tooltipVisible = true;
      tooltipX = Math.round(relativeX);
      tooltipY = Math.round(relativeY);
      tooltipTitle = `Step ${formatAbbrev(step)}`;
      tooltipSubtitle = titleText || metricKey;
      tooltipEntries = entries;
    }
  }
  
  function handleChartLeave() {
    tooltipVisible = false;
    tooltipX = -9999;
    tooltipY = -9999;
  }
  
  // Ghost legend functionality
  function handleLegendHover(idx) {
    legendData.forEach((otherItem, otherIdx) => {
      if (otherIdx !== idx) {
        const legendItems = modalElement?.querySelectorAll('.item');
        if (legendItems && legendItems[otherIdx]) {
          legendItems[otherIdx].classList.add('ghost');
        }
        
        const chartElements = modalElement?.querySelectorAll(`[data-run="${otherItem.name}"]`);
        chartElements?.forEach(el => el.classList.add('ghost'));
      }
    });
    
    // Add hovering class to trigger the ghost styles
    const modalChart = modalElement?.querySelector('.trackio-modal-chart-content');
    modalChart?.classList.add('hovering');
  }
  
  function handleLegendLeave() {
    const legendItems = modalElement?.querySelectorAll('.item');
    legendItems?.forEach(item => item.classList.remove('ghost'));
    
    const chartElements = modalElement?.querySelectorAll('[data-run]');
    chartElements?.forEach(el => el.classList.remove('ghost'));
    
    // Remove hovering class
    const modalChart = modalElement?.querySelector('.trackio-modal-chart-content');
    modalChart?.classList.remove('hovering');
  }
</script>

<!-- Modal overlay -->
{#if visible}
  <div 
    bind:this={modalElement}
    class="trackio-modal-overlay trackio {variant === 'oblivion' ? 'theme--oblivion' : 'theme--classic'}"
    on:click={handleOverlayClick}
    on:keydown={handleKeydown}
    role="dialog" 
    aria-modal="true"
    tabindex="-1"
  >
    <div class="trackio-modal">
      <!-- Header with improved layout -->
      <div class="trackio-modal-header">
        <div class="trackio-modal-header-left">
          <h3>{title}</h3>
        </div>
        
        <div class="trackio-modal-header-right">
          <!-- Navigation controls grouped with counter -->
          <div class="trackio-modal-nav-counter-group">
            {#if totalCharts > 1}
              <button 
                class="trackio-modal-nav-inline trackio-modal-nav-inline-left"
                on:click={navigatePrevious}
                title="Previous chart (←)"
                aria-label="Previous chart"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
              </button>
            {/if}
            
            <div class="trackio-modal-counter">
              {currentIndex + 1}/{totalCharts}
            </div>
            
            {#if totalCharts > 1}
              <button 
                class="trackio-modal-nav-inline trackio-modal-nav-inline-right"
                on:click={navigateNext}
                title="Next chart (→)"
                aria-label="Next chart"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </button>
            {/if}
          </div>
          
          <button 
            class="trackio-modal-close" 
            on:click={closeModal}
            title="Close"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
      </div>
      
      <!-- Content -->
      <div class="trackio-modal-content">
        <!-- Legend -->
        {#if legendData.length > 0}
          <div class="trackio-modal-legend">
            <Legend
              items={legendData}
              alignment="left"
              on:legend-hover={(e) => handleLegendHover(legendData.findIndex(item => item.name === e.detail.name))}
              on:legend-leave={handleLegendLeave}
            />
          </div>
        {/if}
        
        <!-- Chart -->
        <div class="trackio-modal-chart-content trackio {variant === 'oblivion' ? 'theme--oblivion' : 'theme--classic'}">
          <ChartRenderer
            {metricData}
            {rawMetricData}
            {colorForRun}
            {variant}
            {logScaleX}
            {smoothing}
            {normalizeLoss}
            {metricKey}
            {titleText}
            height={500}
            margin={{ top: 20, right: 30, bottom: 46, left: 44 }}
            onHover={handleChartHover}
            onLeave={handleChartLeave}
          />
        </div>
      </div>
    </div>
    
    <!-- Tooltip (same as Cell.svelte but with higher z-index) -->
    <ChartTooltip
      visible={tooltipVisible}
      x={tooltipX}
      y={tooltipY}
      title={tooltipTitle}
      subtitle={tooltipSubtitle}
      entries={tooltipEntries}
      parentElement={modalElement}
      zIndex={1000001}
    />
  </div>
{/if}

<style>
  /* Modal styles */
  :global(.trackio-modal-overlay) {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
  
  /* Light mode overlay */
  :global([data-theme="light"]) :global(.trackio-modal-overlay) {
    background: rgba(255, 255, 255, 0.85);
  }
  
  /* Dark mode overlay */
  :global([data-theme="dark"]) :global(.trackio-modal-overlay) {
    background: rgba(0, 0, 0, 0.8);
  }
  
  /* Oblivion theme overlay - light mode */
  :global([data-theme="light"]) :global(.trackio-modal-overlay.theme--oblivion) {
    background: rgba(240, 245, 255, 0.9);
  }
  
  /* Oblivion theme overlay - dark mode */
  :global([data-theme="dark"]) :global(.trackio-modal-overlay.theme--oblivion) {
    background: rgba(15, 20, 30, 0.85);
  }
  
  :global(.trackio-modal-overlay.show) {
    opacity: 1;
    pointer-events: auto;
  }
  
  :global(.trackio-modal) {
    position: relative;
    width: min(95vw, 1200px);
    backdrop-filter: blur(4px);

    background: var(--surface-bg);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
  }
  
  :global(.trackio-modal-header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px 0px 20px;
    background: var(--surface-bg, white);
  }
  
  :global(.trackio-modal-header-left) {
    display: flex;
    align-items: center;
    flex: 1;
  }
  
  :global(.trackio-modal-header-right) {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  :global(.trackio-modal-nav-counter-group) {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  :global(.trackio-modal-counter) {
    font-size: 10px;
    color: var(--muted-color);
    font-family: var(--trackio-font-family);
    font-weight: 500;
    background: none!important;
    border: none!important;
    opacity: 0.6;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
  }
  
  :global(.trackio-modal-header h3) {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color, rgba(0, 0, 0, 0.9));
    flex: 1;
  }
  
  :global(.trackio-modal-close) {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-color, rgba(0, 0, 0, 0.7));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    transition: background-color 0.15s ease;
  }
  
  :global(.trackio-modal-close:hover) {
    background: var(--border-color, rgba(0, 0, 0, 0.1));
  }
  
  /* Inline navigation arrows in header */
  :global(.trackio-modal-nav-inline) {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    padding: 0 !important;
    background: transparent;
    color: var(--text-color, rgba(0, 0, 0, 0.7));
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  
  :global(.trackio-modal-nav-inline:hover) {
    background: var(--border-color, rgba(0, 0, 0, 0.1));
    color: var(--text-color, rgba(0, 0, 0, 0.9));
    transform: scale(1.1);
  }
  
  :global(.trackio-modal-nav-inline:active) {
    transform: scale(0.9);
  }
  
  :global(.trackio-modal-nav-inline svg) {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
  
  :global(.trackio-modal-content) {
    flex: 1;
    padding: 20px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  :global(.trackio-modal-legend) {
    display: flex;
    justify-content: flex-start;
    align-items: center;
  }
  
  :global(.trackio-modal-chart-content) {
    flex: 1;
    position: relative;
    min-height: 0;
  }
  
  /* Ghost hover effect */
  :global(.trackio-modal .ghost) {
    opacity: 0.2;
    transition: opacity 0.15s ease;
  }
  
  /* Specific ghost effect for raw lines when smoothing is active */
  :global(.trackio-modal.hovering path.raw-line.ghost) {
    opacity: 0.1;
  }
  
  /* =========================
     OBLIVION THEME STYLES
     ========================= */
  
  /* Oblivion modal overlay */
  :global(.trackio-modal-overlay.theme--oblivion) {
    background: rgba(15, 17, 21, 0.9);
  }
  
  /* Oblivion modal box - styled like a cell with corners */
  :global(.theme--oblivion .trackio-modal) {
    position: relative;
    background: transparent;
    border: none;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(8px);
    backdrop-filter: saturate(1.1) blur(15px);
  }
  
  /* Modal background layer (like cell-bg) */
  :global(.theme--oblivion .trackio-modal)::before {
    content: "";
    position: absolute;
    pointer-events: none;
    z-index: 1;
    border-radius: 4px;
    background: 
      radial-gradient(1200px 200px at 20% -10%, rgba(0,0,0,.05), transparent 80%),
      radial-gradient(900px 200px at 80% 110%, rgba(0,0,0,.05), transparent 80%);
    backdrop-filter: blur(10px);
  }
  
  /* Dark mode oblivion modal */
  :global([data-theme="dark"]) :global(.theme--oblivion .trackio-modal)::before {
    background:
      radial-gradient(1400px 260px at 20% -10%, color-mix(in srgb, #ffffff 6.5%, transparent), transparent 80%),
      radial-gradient(1100px 240px at 80% 110%, color-mix(in srgb, #ffffff 6%, transparent), transparent 80%);
      /* linear-gradient(180deg, color-mix(in srgb, #ffffff 3.5%, transparent), transparent 45%); */
      backdrop-filter: blur(10px);
    }
  
  /* Dark mode: bright corners */
  :global([data-theme="dark"]) :global(.theme--oblivion .trackio-modal)::after {
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
  
  /* Modal content above pseudo-elements */
  :global(.theme--oblivion .trackio-modal-header),
  :global(.theme--oblivion .trackio-modal-content) {
    position: relative;
    z-index: 5;
  }
  
  /* Oblivion modal header */
  :global(.theme--oblivion .trackio-modal-header) {
    background: transparent;
  }
  
  :global(.theme--oblivion .trackio-modal-header h3) {
    color: var(--trackio-oblivion-primary, #2a2a2a);
    font-family: 'Roboto Mono', 'Roboto Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace !important;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 14px;
  }
  
  :global(.theme--oblivion .trackio-modal-counter) {
    background: var(--trackio-oblivion-dim, rgba(42, 42, 42, 0.3));
    color: var(--trackio-oblivion-primary, #2a2a2a);
    border: 1px solid var(--trackio-oblivion-dim, rgba(42, 42, 42, 0.3));
    font-family: 'Roboto Mono', 'Roboto Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace !important;
    font-weight: 600;
    letter-spacing: 0.08em;
  }
  
  :global(.theme--oblivion .trackio-modal-close) {
    color: var(--trackio-oblivion-primary, #2a2a2a);
    background: transparent;
    border: 1px solid transparent;
    font-family: 'Roboto Mono', 'Roboto Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace !important;
  }
  
  :global(.theme--oblivion .trackio-modal-close:hover) {
    background: var(--trackio-oblivion-dim, rgba(42, 42, 42, 0.3));
    border: 1px solid var(--trackio-oblivion-dim, rgba(42, 42, 42, 0.3));
  }
  
  /* Oblivion inline navigation arrows */
  :global(.theme--oblivion .trackio-modal-nav-inline) {
    background: transparent;
    border: none;
    color: var(--trackio-oblivion-primary, #2a2a2a);
    border-radius: 4px;
  }
  
  :global(.theme--oblivion .trackio-modal-nav-inline:hover) {
    background: var(--trackio-oblivion-dim, rgba(42, 42, 42, 0.3));
    transform: scale(1.1);
  }
  
  /* Dark mode overrides for modal content */
  
  :global([data-theme="dark"]) :global(.theme--oblivion .trackio-modal-header h3) {
    color: #ffffff;
  }
  
  :global([data-theme="dark"]) :global(.theme--oblivion .trackio-modal-counter) {
    background: color-mix(in srgb, #ffffff 25%, transparent);
    color: #ffffff;
    border: 1px solid color-mix(in srgb, #ffffff 25%, transparent);
  }
  
  :global([data-theme="dark"]) :global(.theme--oblivion .trackio-modal-close) {
    color: #ffffff;
  }
  
  :global([data-theme="dark"]) :global(.theme--oblivion .trackio-modal-close:hover) {
    background: color-mix(in srgb, #ffffff 25%, transparent);
    border: 1px solid color-mix(in srgb, #ffffff 25%, transparent);
  }
  
  /* Dark mode inline navigation arrows */
  :global([data-theme="dark"]) :global(.theme--oblivion .trackio-modal-nav-inline) {
    background: transparent;
    border: none;
    color: #ffffff;
  }
  
  :global([data-theme="dark"]) :global(.theme--oblivion .trackio-modal-nav-inline:hover) {
    background: color-mix(in srgb, #ffffff 25%, transparent);
    transform: scale(1.1);
  }
</style>
