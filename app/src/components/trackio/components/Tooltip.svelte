<script>
  export let visible = false;
  export let x = -9999;
  export let y = -9999;
  export let title = '';
  export let subtitle = '';
  export let entries = []; // [{ color, name, valueText }]
</script>

<div class="d3-tooltip {visible ? 'is-visible' : ''}" style={`transform: translate(${x}px, ${y}px);`}>
  <div class="d3-tooltip__inner">
    <div>{@html title}</div>
    <div>{subtitle}</div>
    {#each entries as e}
      <div class="row">
        <span class="dot" style={`background:${e.color}`}></span>
        <strong>{e.name}</strong>
        <span class="val">{e.valueText}</span>
      </div>
    {/each}
  </div>
  
</div>

<style>
  /* Tooltip variables for Oblivion theme */
  :global(.trackio.theme--oblivion) .d3-tooltip {
    /* Light mode variables */
    --tooltip-oblivion-base: #2a2a2a;
    --tooltip-oblivion-bg-primary: color-mix(in srgb, var(--tooltip-oblivion-base) 15%, transparent);
    --tooltip-oblivion-bg-secondary: color-mix(in srgb, var(--tooltip-oblivion-base) 10%, transparent);
    --tooltip-oblivion-bg-base: color-mix(in srgb, var(--tooltip-oblivion-base) 5%, transparent);
    --tooltip-oblivion-border: color-mix(in srgb, var(--tooltip-oblivion-base) 5%, transparent);
    --tooltip-oblivion-shadow: color-mix(in srgb, var(--tooltip-oblivion-base) 8%, transparent);
    --tooltip-oblivion-text: color-mix(in srgb, var(--tooltip-oblivion-base) 90%, transparent);
    --tooltip-oblivion-line-dark: rgba(0, 0, 0, 0.08);
    --tooltip-oblivion-line-light: rgba(255, 255, 255, 0.15);
  }
  
  /* Dark mode variables */
  :global([data-theme="dark"]) :global(.trackio.theme--oblivion) .d3-tooltip {
    --tooltip-oblivion-base: #ffffff;
    --tooltip-oblivion-bg-primary: color-mix(in srgb, var(--tooltip-oblivion-base) 15%, transparent);
    --tooltip-oblivion-bg-secondary: color-mix(in srgb, var(--tooltip-oblivion-base) 10%, transparent);
    --tooltip-oblivion-bg-base: color-mix(in srgb, var(--tooltip-oblivion-base) 5%, transparent);
    --tooltip-oblivion-border: color-mix(in srgb, var(--tooltip-oblivion-base) 5%, transparent);
    --tooltip-oblivion-shadow: color-mix(in srgb, var(--tooltip-oblivion-base)8%, transparent);
    --tooltip-oblivion-text: color-mix(in srgb, var(--tooltip-oblivion-base) 90%, transparent);
    --tooltip-oblivion-line-dark: rgba(0, 0, 0, 0.15);
    --tooltip-oblivion-line-light: rgba(255, 255, 255, 0.08);
  }

  /* Classic tooltip styling */
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
  .d3-tooltip.is-visible { opacity: 1; }
  .d3-tooltip__inner { display: flex; flex-direction: column; gap: 6px; min-width: 220px; }
  .d3-tooltip__inner > div:first-child { font-weight: 800; letter-spacing: 0.1px; margin-bottom: 0; }
  .d3-tooltip__inner > div:nth-child(2) { font-size: 11px; color: var(--muted-color); display: block; margin-top: -4px; margin-bottom: 2px; letter-spacing: 0.1px; }
  .d3-tooltip__inner > div.row { padding-top: 6px; border-top: 1px solid var(--border-color); display:flex; align-items:center; gap:8px; white-space:nowrap; }
  .dot { display:inline-block; width:12px; height:12px; border-radius:3px; border:1px solid var(--border-color); }
  .val { margin-left:auto; text-align:right; }


  /* Oblivion tooltip styling */
  :global(.trackio.theme--oblivion) .d3-tooltip {
    border-radius: 8px;
    border: none;
    background: 
      radial-gradient(400px 100px at 30% 0%, var(--tooltip-oblivion-bg-primary), transparent 70%),
      radial-gradient(300px 80px at 70% 100%, var(--tooltip-oblivion-bg-secondary), transparent 70%),
      var(--tooltip-oblivion-bg-base);
    color: var(--tooltip-oblivion-text);
    box-shadow: 
      0 0 0 1px var(--tooltip-oblivion-border),
      0 8px 40px var(--tooltip-oblivion-shadow),
      0 2px 8px rgba(0, 0, 0, 0.05);
    backdrop-filter: saturate(1.1) blur(10px);
    opacity: 0.5;
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip.is-visible {
    opacity: 1;
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip__inner > div:first-child {
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--tooltip-oblivion-text);
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip__inner > div:nth-child(2) {
    color: var(--tooltip-oblivion-text);
    opacity: 0.4;
    letter-spacing: 0.06em;
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip__inner > div.row {
    position: relative;
    padding-top: 10px;
    margin-top: 6px;
    border-top: none;
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip__inner > div.row::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 1px;
    background: var(--tooltip-oblivion-line-dark);
  }
  
  :global(.trackio.theme--oblivion) .d3-tooltip__inner > div.row::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 1px;
    height: 1px;
    background: var(--tooltip-oblivion-line-light);
  }
  
  :global(.trackio.theme--oblivion) .dot {
    border-radius: 2px;
    border: 1px solid var(--trackio-chart-axis-stroke);
    box-shadow: 0 0 10px color-mix(in srgb, var(--trackio-oblivion-base) 20%, transparent) inset;
  }
</style>


