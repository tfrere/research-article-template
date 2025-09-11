<script>
  import { createEventDispatcher } from 'svelte';
  export let items = [];
  const dispatch = createEventDispatcher();
  function enter(name){ dispatch('legend-hover', { name }); }
  function leave(){ dispatch('legend-leave'); }
</script>

<div class="legend-bottom">
  <div class="legend-title">Runs</div>
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
    align-items: center; 
    gap: 6px; 
    font-size: 12px; 
    text-align: center; 
    width: 80%; 
    margin: 0 auto; 
    color: var(--trackio-legend-text);
    font-family: var(--trackio-font-family);
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
  
  .legend-title { 
    font-size: 12px; 
    font-weight: 700;
    color: var(--trackio-legend-text);
  }
  
  .items { 
    display: flex; 
    flex-wrap: wrap; 
    gap: 8px 14px; 
    justify-content: center; 
    align-items: center; 
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


