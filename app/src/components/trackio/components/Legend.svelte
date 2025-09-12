<script>
  import { createEventDispatcher } from 'svelte';
  
  // Props
  export let items = [];
  export let alignment = 'center'; // 'left', 'center', 'right' - Controls the alignment of the legend
  
  // Events
  const dispatch = createEventDispatcher();
  function enter(name){ dispatch('legend-hover', { name }); }
  function leave(){ dispatch('legend-leave'); }
  
  /**
   * Usage examples:
   * <Legend items={runs} alignment="left" />
   * <Legend items={runs} alignment="center" />
   * <Legend items={runs} alignment="right" />
   */
</script>

<div class="legend-bottom legend-align-{alignment}">
  <div class="legend-title">
    Runs 
    <span class="legend-count">({items.length})</span>
  </div>
  <div class="items">
    {#each items as it}
      <div class="item" role="presentation" data-run={it.name} on:mouseenter={() => enter(it.name)} on:mouseleave={leave}>
        <span class="swatch" style={`background:${it.color}`}></span>
        <span>{it.name}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  /* =========================
     LEGEND STYLES
     ========================= */
  
  .legend-bottom { 
    display: flex; 
    flex-direction: column; 
    gap: 6px; 
    font-size: 12px; 
    width: 80%; 
    color: var(--trackio-legend-text);
    font-family: var(--trackio-font-family);
  }
  
  /* Alignment variations */
  .legend-align-left {
    align-items: flex-start;
    text-align: left;
    margin: 0 auto 0 0;
  }
  
  .legend-align-center {
    align-items: center;
    text-align: center;
    margin: 0 auto;
  }
  
  .legend-align-right {
    align-items: flex-end;
    text-align: right;
    margin: 0 0 0 auto;
  }
  
  /* Force Roboto Mono in Oblivion theme */
  :global(.trackio.theme--oblivion) .legend-bottom,
  :global(.trackio.theme--oblivion) .legend-title,
  :global(.trackio.theme--oblivion) .item {
    font-family: 'Roboto Mono', 'Roboto Mono Fallback', ui-monospace, SFMono-Regular, Menlo, monospace !important;
    letter-spacing: 0.06em;
  }
  
  :global(.trackio.theme--oblivion) .legend-title {
    font-weight: 900 !important;
    letter-spacing: 0.18em !important;
    text-transform: uppercase !important;
  }
  
  :global(.trackio.theme--oblivion) .legend-count {
    font-weight: 500 !important;
    text-transform: none !important;
    letter-spacing: 0.02em !important;
  }
  
  .legend-title { 
    font-size: 12px; 
    font-weight: 700;
    color: var(--trackio-legend-text);
  }
  
  .legend-count {
    font-size: 10px;
    font-weight: 400;
    opacity: 0.6;
    margin-left: 2px;
  }
  
  .items { 
    display: flex; 
    flex-wrap: wrap; 
    gap: 8px 14px; 
    align-items: center; 
  }
  
  /* Items alignment */
  .legend-align-left .items {
    justify-content: flex-start;
  }
  
  .legend-align-center .items {
    justify-content: center;
  }
  
  .legend-align-right .items {
    justify-content: flex-end;
  }
  
  .item { 
    display: inline-flex; 
    align-items: center; 
    gap: 6px; 
    white-space: nowrap; 
    cursor: pointer; 
    padding: 2px 4px; 
    transition: opacity 0.15s ease;
    color: var(--trackio-legend-text);
  }
  
  :global(.trackio.hovering) .item.ghost { 
    opacity: 0.2; 
  }
  
  .swatch { 
    width: 14px; 
    height: 14px; 
    border-radius: 3px; 
    border: 1px solid var(--trackio-legend-swatch-border); 
    display: inline-block; 
  }
</style>


