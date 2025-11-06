<script>
  import { onMount, onDestroy } from "svelte";
  import * as d3 from "d3";
  import { SVGManager } from "./core/svg-manager.js";
  import { GridRenderer } from "./core/grid-renderer.js";
  import { PathRenderer } from "./core/path-renderer.js";
  import { InteractionManager } from "./core/interaction-manager.js";
  import { ZoomManager } from "./core/zoom-manager.js";
  import { ChartTransforms } from "./utils/chart-transforms.js";
  import { trackioSampler } from "../core/adaptive-sampler.js";

  // Props - same as original ChartRenderer
  export let metricData = {};
  export let rawMetricData = {};
  export let colorForRun = (name) => "#999";
  export let variant = "classic";
  export let logScaleX = false;
  export let smoothing = false;
  export let normalizeLoss = true;
  export let metricKey = "";
  export let titleText = "";
  export let hostEl = null;
  export let width = 800;
  export let height = 150;
  export let margin = { top: 10, right: 12, bottom: 46, left: 44 };
  export let onHover = null;
  export let onLeave = null;
  export let enableZoom = true; // NEW: Enable zoom/pan
  export let onZoomChange = null; // NEW: Callback when zoom state changes

  // Internal state
  let container;
  let svgManager;
  let gridRenderer;
  let pathRenderer;
  let interactionManager;
  let zoomManager; // NEW
  let cleanup;

  // Sampling state
  let sampledData = {};
  let samplingInfo = {};
  let needsSampling = false;

  // Computed values
  $: innerHeight = height - margin.top - margin.bottom;

  // Reactive rendering when data or props change
  $: {
    if (container && svgManager) {
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

  /**
   * Initialize all managers and renderers
   */
  function initializeManagers() {
    if (!container) return;

    // Create SVG manager with configuration
    svgManager = new SVGManager(container, { width, height, margin });
    svgManager.ensureSvg();
    svgManager.initializeScales(logScaleX);

    // Create specialized renderers
    gridRenderer = new GridRenderer(svgManager);
    pathRenderer = new PathRenderer(svgManager);
    interactionManager = new InteractionManager(svgManager, pathRenderer);

    // Create zoom manager
    if (enableZoom) {
      zoomManager = new ZoomManager(svgManager, {
        zoomExtent: [1.0, 8.0],
        enableX: true,
        enableY: true,
      });

      zoomManager.initialize();

      // Share zoom overlay with interaction manager
      interactionManager.setExternalOverlay(zoomManager.getOverlay());

      // Setup zoom callback
      zoomManager.on("zoom", ({ xScale, yScale, hasMoved }) => {
        renderWithZoomedScales(xScale, yScale);

        if (onZoomChange) {
          onZoomChange({ hasMoved, state: zoomManager.getState() });
        }
      });

      // Hide tooltips during zoom start
      zoomManager.on("zoomStart", () => {
        if (interactionManager) {
          interactionManager.hideHoverLine();
        }
        if (onLeave) {
          onLeave();
        }
      });

      console.log("🔍 ZoomManager initialized");
    }

    console.log("📊 Chart managers initialized");
  }

  /**
   * Apply adaptive sampling to large datasets
   */
  function applySampling() {
    // Check if any run has more than 400 points
    const runSizes = Object.keys(metricData).map(
      (run) => (metricData[run] || []).length,
    );
    const maxSize = Math.max(0, ...runSizes);
    needsSampling = maxSize > 400;

    if (needsSampling) {
      console.log(
        `🎯 Large dataset detected (${maxSize} points), applying adaptive sampling`,
      );
      const result = trackioSampler.sampleMetricData(metricData, "smart");
      sampledData = result.sampledData;
      samplingInfo = result.samplingInfo;

      // Log sampling stats
      Object.keys(samplingInfo).forEach((run) => {
        const info = samplingInfo[run];
        console.log(
          `📊 ${run}: ${info.originalLength} → ${info.sampledLength} points (${(info.compressionRatio * 100).toFixed(1)}% retained)`,
        );
      });
    } else {
      sampledData = metricData;
      samplingInfo = {};
    }
  }

  /**
   * Render with zoomed scales (called by ZoomManager)
   */
  function renderWithZoomedScales(zoomedXScale, zoomedYScale) {
    if (!svgManager || !gridRenderer || !pathRenderer) return;

    const dataToRender = needsSampling ? sampledData : metricData;
    const cleanedData = ChartTransforms.validateData(dataToRender);
    const processedData = ChartTransforms.processMetricData(
      cleanedData,
      metricKey,
      normalizeLoss,
    );

    if (!processedData.hasData) return;

    const { stepIndex } = ChartTransforms.setupScales(
      svgManager,
      processedData,
      logScaleX,
    );
    const normalizeY = ChartTransforms.createNormalizeFunction(
      processedData,
      normalizeLoss,
    );

    // Get original scales for comparison
    const { x: originalXScale, y: originalYScale } = svgManager.getScales();
    const { innerWidth } = svgManager.calculateDimensions();

    // Update axes with zoomed scales
    const { axes: gAxes, grid: gGrid } = svgManager.getGroups();
    const xTicksForced = zoomedXScale.ticks(Math.min(6, 10));
    const yTicksForced = zoomedYScale.ticks(Math.min(6, 10));

    // Redraw grid with zoomed Y scale
    gGrid
      .selectAll("line")
      .data(yTicksForced)
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", (d) => zoomedYScale(d))
      .attr("y2", (d) => zoomedYScale(d))
      .attr("stroke", "var(--trackio-chart-grid-stroke)")
      .attr("stroke-opacity", "var(--trackio-chart-grid-opacity)");

    // Update axes
    const formatAbbrev = (v) => {
      if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1) + "B";
      if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + "M";
      if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + "k";
      return v.toFixed(2);
    };

    gAxes
      .select(".x-axis")
      .call(
        d3
          .axisBottom(zoomedXScale)
          .tickValues(xTicksForced)
          .tickFormat(formatAbbrev),
      );

    gAxes
      .select(".y-axis")
      .call(
        d3
          .axisLeft(zoomedYScale)
          .tickValues(yTicksForced)
          .tickFormat(formatAbbrev),
      );

    // Redraw paths with zoomed scales
    pathRenderer.renderSeriesWithCustomScales(
      processedData.runs,
      cleanedData,
      rawMetricData,
      colorForRun,
      smoothing,
      logScaleX,
      stepIndex,
      normalizeY,
      zoomedXScale,
      zoomedYScale,
    );
  }

  /**
   * Main render function - orchestrates all rendering
   */
  function render() {
    if (!svgManager) return;

    // Apply sampling if needed
    applySampling();

    // Use sampled data for rendering
    const dataToRender = needsSampling ? sampledData : metricData;

    // Validate and clean data
    const cleanedData = ChartTransforms.validateData(dataToRender);
    const processedData = ChartTransforms.processMetricData(
      cleanedData,
      metricKey,
      normalizeLoss,
    );

    if (!processedData.hasData) {
      const { root } = svgManager.getGroups();
      root.style("display", "none");
      return;
    }

    const { root } = svgManager.getGroups();
    root.style("display", null);

    // Update scales based on log scale setting
    svgManager.initializeScales(logScaleX);

    // Setup scales and domains
    const { stepIndex } = ChartTransforms.setupScales(
      svgManager,
      processedData,
      logScaleX,
    );
    const normalizeY = ChartTransforms.createNormalizeFunction(
      processedData,
      normalizeLoss,
    );

    // Update lineGen with normalization
    const { line: lineGen, y: yScale } = svgManager.getScales();
    lineGen.y((d) => yScale(normalizeY(d.value)));

    // Update layout and render axes
    const { innerWidth, xTicksForced, yTicksForced } = svgManager.updateLayout(
      processedData.hoverSteps,
      logScaleX,
    );

    // Update zoom layout if enabled
    if (zoomManager) {
      const { innerHeight } = svgManager.calculateDimensions();
      zoomManager.updateLayout(innerWidth, innerHeight);
    }

    // Render grid
    gridRenderer.renderGrid(
      xTicksForced,
      yTicksForced,
      processedData.hoverSteps,
      variant,
    );

    // Render data series
    pathRenderer.renderSeries(
      processedData.runs,
      cleanedData,
      rawMetricData,
      colorForRun,
      smoothing,
      logScaleX,
      stepIndex,
      normalizeY,
    );

    // Setup interactions
    interactionManager.setupHoverInteractions(
      processedData.hoverSteps,
      stepIndex,
      processedData.runs.map((r) => ({
        run: r,
        color: colorForRun(r),
        values: (cleanedData[r] || []).slice().sort((a, b) => a.step - b.step),
      })),
      normalizeY,
      processedData.isAccuracy,
      innerWidth,
      logScaleX,
      onHover,
      onLeave,
    );
  }

  /**
   * Public API: Show hover line at specific step
   */
  export function showHoverLine(step) {
    if (!interactionManager) return;

    // Use sampled data for interactions as well
    const dataToRender = needsSampling ? sampledData : metricData;
    const cleanedData = ChartTransforms.validateData(dataToRender);
    const processedData = ChartTransforms.processMetricData(
      cleanedData,
      metricKey,
      normalizeLoss,
    );
    const { stepIndex } = ChartTransforms.setupScales(
      svgManager,
      processedData,
      logScaleX,
    );

    interactionManager.showHoverLine(
      step,
      processedData.hoverSteps,
      stepIndex,
      logScaleX,
    );
  }

  /**
   * Public API: Hide hover line
   */
  export function hideHoverLine() {
    if (interactionManager) {
      interactionManager.hideHoverLine();
    }
  }

  /**
   * Public API: Reset zoom to initial state
   */
  export function resetZoom(animated = true) {
    if (zoomManager) {
      zoomManager.reset(animated);
    }
  }

  /**
   * Public API: Get zoom state
   */
  export function getZoomState() {
    return zoomManager ? zoomManager.getState() : null;
  }

  /**
   * Setup resize observer and lifecycle
   */
  onMount(() => {
    initializeManagers();
    render();

    // Debounced resize handling for better mobile performance
    let resizeTimeout;
    const debouncedRender = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        render();
      }, 100);
    };

    const ro = window.ResizeObserver
      ? new ResizeObserver(debouncedRender)
      : null;
    if (ro && container) ro.observe(container);

    // Listen for orientation changes on mobile
    const handleOrientationChange = () => {
      setTimeout(() => {
        render();
      }, 300);
    };

    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("resize", debouncedRender);

    cleanup = () => {
      if (ro) ro.disconnect();
      if (resizeTimeout) clearTimeout(resizeTimeout);
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("resize", debouncedRender);
      if (svgManager) svgManager.destroy();
      if (interactionManager) interactionManager.destroy();
      if (zoomManager) zoomManager.destroy();
    };
  });

  onDestroy(() => {
    cleanup && cleanup();
  });
</script>

<div
  bind:this={container}
  style="width: 100%; height: 100%; min-width: 200px; overflow: hidden;"
></div>
