import plotly.graph_objects as go
import plotly.io as pio
import numpy as np
import os
import uuid

"""
Interactive line chart example (3 curves + live slider)

The slider blends each curve from linear to exponential in real time (no mouseup required).
This fragment is safe to insert multiple times on the page (unique IDs per instance).
"""

# Grid (x) and parameterization
N = 240
x = np.linspace(0, 1, N)

# Linear baselines (increasing)
lin1 = 0.20 + 0.60 * x
lin2 = 0.15 + 0.70 * x
lin3 = 0.10 + 0.80 * x

# Helper: normalized exponential on [0,1]
def exp_norm(xv: np.ndarray, k: float) -> np.ndarray:
    return (np.exp(k * xv) - 1.0) / (np.exp(k) - 1.0)

# Exponential counterparts (similar ranges)
exp1 = 0.20 + 0.60 * exp_norm(x, 3.0)
exp2 = 0.15 + 0.70 * exp_norm(x, 3.5)
exp3 = 0.10 + 0.80 * exp_norm(x, 2.8)

# Initial blend (alpha=0 ⇒ pure linear)
alpha0 = 0.0
blend = lambda l, e, a: (1 - a) * l + a * e
y1 = blend(lin1, exp1, alpha0)
y2 = blend(lin2, exp2, alpha0)
y3 = blend(lin3, exp3, alpha0)

color_base = "#64748b"     # slate-500
color_improved = "#2563eb" # blue-600
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
    margin=dict(l=28, r=12, t=8, b=28),
    hovermode="x unified",
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
  <div class="plotly_controls" style="margin-top:10px; display:flex; gap:14px; align-items:center;">
    <label style="font-size:12px;color:rgba(0,0,0,.65); display:flex; align-items:center; gap:6px; white-space:nowrap;">
      Dataset
      <select id="__DSID__" style="font-size:12px; padding:2px 6px;">
        <option value="0">Dataset A</option>
        <option value="1">Dataset B</option>
        <option value="2">Dataset C</option>
      </select>
    </label>
    <label style="font-size:12px;color:rgba(0,0,0,.65);display:flex;align-items:center;gap:8px; flex:1;">
      Nonlinearity
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
  function expNorm(x,k){ return (Math.exp(k*x)-1)/(Math.exp(k)-1); }
  function blend(l,e,a){ return (1-a)*l + a*e; }
  var datasets = [
    { curves: [ {o:0.20,s:0.60,k:3.0}, {o:0.15,s:0.70,k:3.5}, {o:0.10,s:0.80,k:2.8} ] },
    { curves: [ {o:0.30,s:0.55,k:2.2}, {o:0.18,s:0.65,k:2.8}, {o:0.12,s:0.70,k:2.0} ] },
    { curves: [ {o:0.10,s:0.85,k:3.8}, {o:0.12,s:0.80,k:3.2}, {o:0.08,s:0.90,k:3.0} ] }
  ];
  var dsi = 0;
  function makeY(a){
    var cs = datasets[dsi].curves;
    var y1 = xs.map(function(x){ return blend(cs[0].o + cs[0].s*x, cs[0].o + cs[0].s*expNorm(x,cs[0].k), a); });
    var y2 = xs.map(function(x){ return blend(cs[1].o + cs[1].s*x, cs[1].o + cs[1].s*expNorm(x,cs[1].k), a); });
    var y3 = xs.map(function(x){ return blend(cs[2].o + cs[2].s*x, cs[2].o + cs[2].s*expNorm(x,cs[2].k), a); });
    return [y1,y2,y3];
  }
  function apply(a){
    var ys = makeY(a);
    Plotly.restyle(gd, {y:[ys[0]]}, [0]);
    Plotly.restyle(gd, {y:[ys[1]]}, [1]);
    Plotly.restyle(gd, {y:[ys[2]]}, [2]);
    if(valueEl) valueEl.textContent = a.toFixed(2);
  }
  var initA = parseFloat(slider.value)||0;
  slider.addEventListener('input', function(e){ apply(parseFloat(e.target.value)||0); });
  dsSelect.addEventListener('change', function(e){ dsi = parseInt(e.target.value)||0; apply(parseFloat(slider.value)||0); });
  setTimeout(function(){ apply(initA); }, 0);
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

fig.write_html("../app/src/fragments/line.html", 
               include_plotlyjs=False, 
               full_html=False, 
               config={
                   'displayModeBar': False,
                   'responsive': True, 
                   'scrollZoom': False,
               })

