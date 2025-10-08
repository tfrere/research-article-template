import plotly.graph_objects as go
import plotly.io as pio
import numpy as np
import os
import uuid

"""
Interactive line chart example (Baseline / Improved / Target) with a live slider.

Context: research-style training curves for multiple datasets (CIFAR-10, CIFAR-100, ImageNet-1K).
The slider "Augmentation α" blends the Improved curve between the Baseline (α=0)
and an augmented counterpart (α=1) via a simple mixing equation.
Export remains responsive, with no zoom and no mode bar.
"""

# Grid (x) and parameterization
N = 240
x = np.linspace(0, 1, N)

# Logistic helper for smooth learning curves
def logistic(xv: np.ndarray, ymin: float, ymax: float, k: float, x0: float) -> np.ndarray:
    return ymin + (ymax - ymin) / (1.0 + np.exp(-k * (xv - x0)))

# Plausible dataset params (baseline vs augmented) + a constant target line
datasets_params = [
    {
        "name": "CIFAR-10",
        "base": {"ymin": 0.10, "ymax": 0.90, "k": 10.0, "x0": 0.55},
        "aug":  {"ymin": 0.15, "ymax": 0.96, "k": 12.0, "x0": 0.40},
        "target": 0.97,
    },
    {
        "name": "CIFAR-100",
        "base": {"ymin": 0.05, "ymax": 0.70, "k": 9.5, "x0": 0.60},
        "aug":  {"ymin": 0.08, "ymax": 0.80, "k": 11.0, "x0": 0.45},
        "target": 0.85,
    },
    {
        "name": "ImageNet-1K",
        "base": {"ymin": 0.02, "ymax": 0.68, "k": 8.5, "x0": 0.65},
        "aug":  {"ymin": 0.04, "ymax": 0.75, "k": 9.5, "x0": 0.50},
        "target": 0.82,
    },
]

# Initial dataset index and alpha
alpha0 = 0.7
ds0 = datasets_params[0]
base0 = logistic(x, **ds0["base"])
aug0 = logistic(x, **ds0["aug"])
target0 = np.full_like(x, ds0["target"], dtype=float)

# Traces: Baseline (fixed), Improved (blended by α), Target (constant goal)
blend = lambda l, e, a: (1 - a) * l + a * e
y1 = base0
y2 = blend(base0, aug0, alpha0)
y3 = target0

color_base = "#64748b"     # slate-500
color_improved = "#F981D4" # pink
color_target = "#4b5563"   # gray-600 (dash)

fig = go.Figure()
fig.add_trace(
    go.Scatter(
        x=x,
        y=y1,
        name="Baseline",
        mode="lines",
        line=dict(color=color_base, width=2, shape="spline", smoothing=0.6),
        hovertemplate="<b>%{fullData.name}</b><br>x=%{x:.2f}<br>y=%{y:.3f}<extra></extra>",
        showlegend=True,
    )
)
fig.add_trace(
    go.Scatter(
        x=x,
        y=y2,
        name="Improved",
        mode="lines",
        line=dict(color=color_improved, width=2, shape="spline", smoothing=0.6),
        hovertemplate="<b>%{fullData.name}</b><br>x=%{x:.2f}<br>y=%{y:.3f}<extra></extra>",
        showlegend=True,
    )
)
fig.add_trace(
    go.Scatter(
        x=x,
        y=y3,
        name="Target",
        mode="lines",
        line=dict(color=color_target, width=2, dash="dash"),
        hovertemplate="<b>%{fullData.name}</b><br>x=%{x:.2f}<br>y=%{y:.3f}<extra></extra>",
        showlegend=True,
    )
)

fig.update_layout(
    autosize=True,
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    margin=dict(l=40, r=28, t=20, b=40),
    hovermode="x unified",
    legend=dict(
        orientation="v",
        x=1,
        y=0,
        xanchor="right",
        yanchor="bottom",
        bgcolor="rgba(255,255,255,0)",
        borderwidth=0,
    ),
    hoverlabel=dict(
        bgcolor="white",
        font=dict(color="#111827", size=12),
        bordercolor="rgba(0,0,0,0.15)",
        align="left",
        namelength=-1,
    ),
    xaxis=dict(
        showgrid=False,
        zeroline=False,
        showline=True,
        linecolor="rgba(0,0,0,0.25)",
        linewidth=1,
        ticks="outside",
        ticklen=6,
        tickcolor="rgba(0,0,0,0.25)",
        tickfont=dict(size=12, color="rgba(0,0,0,0.55)"),
        title=None,
        automargin=True,
        fixedrange=True,
    ),
    yaxis=dict(
        showgrid=False,
        zeroline=False,
        showline=True,
        linecolor="rgba(0,0,0,0.25)",
        linewidth=1,
        ticks="outside",
        ticklen=6,
        tickcolor="rgba(0,0,0,0.25)",
        tickfont=dict(size=12, color="rgba(0,0,0,0.55)"),
        title=None,
        tickformat=".2f",
        rangemode="tozero",
        automargin=True,
        fixedrange=True,
    ),
)

# Write the fragment next to this file into src/fragments/line.html (robust path)
output_path = os.path.join(os.path.dirname(__file__), "fragments", "line.html")
os.makedirs(os.path.dirname(output_path), exist_ok=True)

# Inject a small post-render script to round the hover box corners
post_script = """
(function(){
  function attach(gd){
    function round(){
      try {
        var root = gd && gd.parentNode ? gd.parentNode : document;
        var rects = root.querySelectorAll('.hoverlayer .hovertext rect');
        rects.forEach(function(r){ r.setAttribute('rx', 8); r.setAttribute('ry', 8); });
      } catch(e) {}
    }
    if (gd && gd.on) {
      gd.on('plotly_hover', round);
      gd.on('plotly_unhover', round);
      gd.on('plotly_relayout', round);
    }
    setTimeout(round, 0);
  }
  var plots = document.querySelectorAll('.js-plotly-plot');
  plots.forEach(attach);
})();
"""

html_plot = pio.to_html(
    fig,
    include_plotlyjs=False,
    full_html=False,
    post_script=post_script,
    config={
        "displayModeBar": False,
        "responsive": True,
        "scrollZoom": False,
        "doubleClick": False,
        "modeBarButtonsToRemove": [
            "zoom2d", "pan2d", "select2d", "lasso2d",
            "zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d",
            "toggleSpikelines"
        ],
    },
)

# Build a self-contained fragment with a live slider (no mouseup required)
uid = uuid.uuid4().hex[:8]
slider_id = f"line-ex-alpha-{uid}"
container_id = f"line-ex-container-{uid}"

slider_tpl = '''
<div id="__CID__">
  __PLOT__
  <div class="plotly_controls" style="margin-top:12px; display:flex; gap:16px; align-items:center;">
    <label style="font-size:12px;color:rgba(0,0,0,.65); display:flex; align-items:center; gap:6px; white-space:nowrap; padding:6px 10px;">
      Dataset
      <select id="__DSID__" style="font-size:12px; padding:2px 6px;">
        <option value="0">CIFAR-10</option>
        <option value="1">CIFAR-100</option>
        <option value="2">ImageNet-1K</option>
      </select>
    </label>
    <label style="font-size:12px;color:rgba(0,0,0,.65);display:flex;align-items:center;gap:10px; flex:1; padding:6px 10px;">
      Augmentation α
      <input id="__SID__" type="range" min="0" max="1" step="0.01" value="__A0__" style="flex:1;">
      <span class="alpha-value">__A0__</span>
    </label>
  </div>
</div>
<script>
(function(){
  var container = document.getElementById('__CID__');
  if(!container) return;
  var gd = container.querySelector('.js-plotly-plot');
  var slider = document.getElementById('__SID__');
  var dsSelect = document.getElementById('__DSID__');
  var valueEl = container.querySelector('.alpha-value');
  var N = __N__;
  var xs = Array.from({length: N}, function(_,i){ return i/(N-1); });
  function logistic(x, ymin, ymax, k, x0){ return ymin + (ymax - ymin) / (1 + Math.exp(-k*(x - x0))); }
  function blend(l,e,a){ return (1-a)*l + a*e; }
  var datasets = [
    { name:'CIFAR-10',  base:{ymin:0.10,ymax:0.90,k:10.0,x0:0.55}, aug:{ymin:0.15,ymax:0.96,k:12.0,x0:0.40}, target:0.97 },
    { name:'CIFAR-100', base:{ymin:0.05,ymax:0.70,k:9.5,x0:0.60},  aug:{ymin:0.08,ymax:0.80,k:11.0,x0:0.45},  target:0.85 },
    { name:'ImageNet-1K', base:{ymin:0.02,ymax:0.68,k:8.5,x0:0.65}, aug:{ymin:0.04,ymax:0.75,k:9.5,x0:0.50},  target:0.82 }
  ];
  var dsi = 0;
  var yb = xs.map(function(x){ return logistic(x, datasets[dsi].base.ymin, datasets[dsi].base.ymax, datasets[dsi].base.k, datasets[dsi].base.x0); });
  var ya = xs.map(function(x){ return logistic(x, datasets[dsi].aug.ymin, datasets[dsi].aug.ymax, datasets[dsi].aug.k, datasets[dsi].aug.x0); });
  var yt = xs.map(function(){ return datasets[dsi].target; });
  function applyAlpha(a){
    var yi = yb.map(function(v,i){ return blend(v, ya[i], a); });
    Plotly.restyle(gd, {y:[yi]}, [1]); // only Improved changes with α
    if(valueEl) valueEl.textContent = a.toFixed(2);
  }
  function applyDataset(){
    var d = datasets[dsi];
    yb = xs.map(function(x){ return logistic(x, d.base.ymin, d.base.ymax, d.base.k, d.base.x0); });
    ya = xs.map(function(x){ return logistic(x, d.aug.ymin, d.aug.ymax, d.aug.k, d.aug.x0); });
    yt = xs.map(function(){ return d.target; });
    var a = parseFloat(slider.value)||0;
    var yi = yb.map(function(v,i){ return blend(v, ya[i], a); });
    Plotly.restyle(gd, {y:[yb]}, [0]); // Baseline
    Plotly.restyle(gd, {y:[yi]}, [1]); // Improved (blended)
    Plotly.restyle(gd, {y:[yt]}, [2]); // Target
  }
  var initA = parseFloat(slider.value)||0;
  slider.addEventListener('input', function(e){ applyAlpha(parseFloat(e.target.value)||0); });
  dsSelect.addEventListener('change', function(e){ dsi = parseInt(e.target.value)||0; applyDataset(); });
  setTimeout(function(){ applyDataset(); applyAlpha(initA); }, 0);
})();
</script>
'''

slider_html = (slider_tpl
    .replace('__CID__', container_id)
    .replace('__SID__', slider_id)
    .replace('__A0__', f"{alpha0:.2f}")
    .replace('__N__', str(N))
    .replace('__PLOT__', html_plot)
)

with open("./plotly-line.html", "w", encoding="utf-8") as f:
    f.write(slider_html)

