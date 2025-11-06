<script>
  import { onMount } from 'svelte';
  
  // Props
  export let visible = false;
  export let x = -9999;
  export let y = -9999;
  export let title = '';
  export let subtitle = '';
  export let entries = []; // Array of { color, name, valueText }
  export let parentElement = null; // Element to append tooltip to
  export let zIndex = 1000; // Default z-index
  
  let tooltipElement;
  let tipHost;
  
  onMount(() => {
    // Find trackio parent for positioning context
    console.log('ChartTooltip onMount - parentElement:', parentElement);
    console.log('ChartTooltip onMount - parentElement classes:', parentElement?.className);
    
    const trackioEl = parentElement?.closest?.('.trackio') || (parentElement?.classList?.contains('trackio') ? parentElement : null);
    
    console.log('ChartTooltip onMount - trackioEl found:', trackioEl);
    
    if (trackioEl) {
      // Create tooltip host positioned relative to trackio container
      tipHost = document.createElement('div');
      tipHost.className = 'tip-host';
      tipHost.style.position = 'absolute';
      tipHost.style.top = '0';
      tipHost.style.left = '0';
      tipHost.style.width = '100%';
      tipHost.style.height = '100%';
      tipHost.style.pointerEvents = 'none';
      tipHost.style.zIndex = String(zIndex);
      tipHost.style.overflow = 'visible';
      trackioEl.appendChild(tipHost);
      
      // Move tooltip element to host
      if (tooltipElement && tipHost) {
        tipHost.appendChild(tooltipElement);
      }
    }
    
    return () => {
      if (tipHost && tipHost.parentNode) {
        tipHost.parentNode.removeChild(tipHost);
      }
    };
  });
  
  $: tooltipStyle = `
    transform: translate(${x}px, ${y}px);
    pointer-events: none;
    z-index: ${zIndex};
  `;
  
  $: tooltipClass = `d3-tooltip ${visible ? 'is-visible' : ''}`;
</script>

<div 
  bind:this={tooltipElement}
  class={tooltipClass}
  style={tooltipStyle}
>
  <div class="d3-tooltip__inner">
    {#if title}
      <div class="d3-tooltip__title">{@html title}</div>
    {/if}
    
    {#if subtitle}
      <div class="d3-tooltip__subtitle">{subtitle}</div>
    {/if}
    
    {#each entries as entry}
        <div class="d3-tooltip__entry">
          <span class="d3-tooltip__color-dot" style="background:{entry.color}"></span>
          <strong class="d3-tooltip__entry-name">{entry.name}</strong>
          <span class="d3-tooltip__entry-value">{entry.valueText}</span>
        </div>
    {/each}
  </div>
</div>

<style>
  /* Classic tooltip styling - based on original d3-trackio.html */
  .d3-tooltip {
    position: absolute;
    top: 0;
    left: 0;
    transform: translate(-9999px, -9999px);
    pointer-events: none;
    padding: 10px 12px;
    border-radius: 12px;
    font-size: 12px;
    line-height: 1.35;
    border: 1px solid var(--border-color);
    background: var(--surface-bg);
    color: var(--text-color);
    box-shadow: 0 8px 32px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06);
    opacity: 0;
    transition: none;
    z-index: var(--z-tooltip, 50);
    backdrop-filter: saturate(1.12) blur(8px);
  }
  
  .d3-tooltip.is-visible {
    opacity: 1;
  }
  
  .d3-tooltip__inner {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 220px;
  }
  
  .d3-tooltip__title {
    font-weight: 800;
    letter-spacing: 0.1px;
    margin-bottom: 0;
    color: var(--text-color);
  }
  
  .d3-tooltip__subtitle {
    font-size: 11px;
    color: var(--muted-color);
    display: block;
    margin-top: -4px;
    margin-bottom: 2px;
    letter-spacing: 0.1px;
  }
  
  .d3-tooltip__entry {
    padding-top: 6px;
    border-top: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }
  
  .d3-tooltip__entry-name {
    flex: 1;
    font-weight: 500;
  }
  
  .d3-tooltip__entry-value {
    margin-left: auto;
    text-align: right;
    font-weight: 900;
  }
  
  .d3-tooltip__color-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid var(--border-color);
    flex-shrink: 0;
  }
  
  /* Oblivion tooltip styling - based on original d3-trackio-oblivion.html */
  :global(.trackio.theme--oblivion) .d3-tooltip {
    border-radius: 8px;
    border: none;
    background: 
      radial-gradient(1200px 200px at 20% -10%, rgba(0,0,0,.05), transparent 80%),
      radial-gradient(900px 200px at 80% 110%, rgba(0,0,0,.05), transparent 80%);
    color: var(--trackio-text-primary);
    box-shadow: 0 8px 32px rgba(127,241,255,.05), 0 2px 8px rgba(0,0,0,.10);
    opacity: 0;
    backdrop-filter: saturate(1.1) blur(10px);
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip.is-visible {
    opacity: 1;
  }
  
  /* Dark mode oblivion tooltip */
  :global([data-theme="dark"]) :global(.trackio.theme--oblivion) .d3-tooltip {
    background:
      radial-gradient(1400px 260px at 20% -10%, color-mix(in srgb, #ffffff 6.5%, transparent), transparent 80%),
      radial-gradient(1100px 240px at 80% 110%, color-mix(in srgb, #ffffff 6%, transparent), transparent 80%),
      linear-gradient(180deg, color-mix(in srgb, #ffffff 3.5%, transparent), transparent 45%);
    color: var(--trackio-text-primary);
    box-shadow: 0 8px 32px color-mix(in srgb, #ffffff 5%, transparent), 0 2px 8px color-mix(in srgb, black 10%, transparent);
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip__title {
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--trackio-oblivion-primary);
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip__subtitle {
    color: var(--trackio-oblivion-primary);
    opacity: 0.4;
    letter-spacing: 0.06em;
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip__entry {
    position: relative;
    padding-top: 10px;
    margin-top: 6px;
    border-top: none;
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip__entry::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 1px;
    background: color-mix(in srgb, #000000 10%, transparent);
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip__entry::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 1px;
    height: 1px;
    background: color-mix(in srgb, #ffffff 15%, transparent);
  }
  
  /* Dark mode separator adjustments */
  :global([data-theme="dark"]) :global(.trackio.theme--oblivion) .d3-tooltip__entry::before {
    background: color-mix(in srgb, #ffffff 5%, transparent);
  }
  
  :global([data-theme="dark"]) :global(.trackio.theme--oblivion) .d3-tooltip__entry::after {
    background: color-mix(in srgb, #000000 10%, transparent);
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip__color-dot {
    border-radius: 2px;
    border: 1px solid var(--obl-border, rgba(50, 50, 50, 0.22));
    box-shadow: 0 0 10px color-mix(in srgb, var(--obl-base, #323232) 20%, transparent) inset;
  }
</style>
