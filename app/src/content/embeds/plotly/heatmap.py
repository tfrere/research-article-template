import plotly.graph_objects as go
import plotly.io as pio
import numpy as np
import datetime as dt
import os

"""
Calendar-like heatmap (GitHub-style) over the last 52 weeks.
Minimal, responsive, transparent background; suitable for Distill.
"""

# Parameters
NUM_WEEKS = 52
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

# Build dates matrix (7 rows x NUM_WEEKS columns)
today = dt.date.today()
# Align to start of current week (Monday)
start = today - dt.timedelta(days=(today.weekday()))  # Monday of current week
weeks = [start - dt.timedelta(weeks=w) for w in range(NUM_WEEKS-1, -1, -1)]
dates = [[weeks[c] + dt.timedelta(days=r) for c in range(NUM_WEEKS)] for r in range(7)]

# Generate values (synthetic) — smooth seasonal pattern + noise
def gen_value(d: dt.date) -> float:
    day_of_year = d.timetuple().tm_yday
    base = 0.5 + 0.45 * np.sin(2 * np.pi * (day_of_year / 365.0))
    noise = np.random.default_rng(hash(d) % 2**32).uniform(-0.15, 0.15)
    return max(0.0, min(1.0, base + noise))

z = [[gen_value(d) for d in row] for row in dates]
custom = [[d.isoformat() for d in row] for row in dates]

# Colors aligned with other charts (slate / blue / gray)
colorscale = [
    [0.00, "#e5e7eb"],   # light gray background for low
    [0.40, "#64748b"],   # slate-500
    [0.75, "#2563eb"],   # blue-600
    [1.00, "#4b5563"],   # gray-600 (high end accent)
]

fig = go.Figure(
    data=go.Heatmap(
        z=z,
        x=[w.isoformat() for w in weeks],
        y=DAYS,
        colorscale=colorscale,
        showscale=False,
        hovertemplate="Date: %{customdata}<br>Value: %{z:.2f}<extra></extra>",
        customdata=custom,
        xgap=2,
        ygap=2,
    )
)

fig.update_layout(
    autosize=True,
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    margin=dict(l=28, r=12, t=8, b=28),
    xaxis=dict(
        showgrid=False,
        zeroline=False,
        showline=False,
        ticks="",
        showticklabels=False,
        fixedrange=True,
    ),
    yaxis=dict(
        showgrid=False,
        zeroline=False,
        showline=False,
        ticks="",
        tickfont=dict(size=12, color="rgba(0,0,0,0.65)"),
        fixedrange=True,
    ),
)

post_script = """
(function(){
  var plots = document.querySelectorAll('.js-plotly-plot');
  plots.forEach(function(gd){
    function round(){
      try {
        var root = gd && gd.parentNode ? gd.parentNode : document;
        var rects = root.querySelectorAll('.hoverlayer .hovertext rect');
        rects.forEach(function(r){ r.setAttribute('rx', 8); r.setAttribute('ry', 8); });
      } catch(e) {}
    }
    if (gd && gd.on){
      gd.on('plotly_hover', round);
      gd.on('plotly_unhover', round);
      gd.on('plotly_relayout', round);
    }
    setTimeout(round, 0);
  });
})();
"""

html = pio.to_html(
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

fig.write_html("./plotly-heatmap.html", 
               include_plotlyjs=False, 
               full_html=False, 
               config={
                   'displayModeBar': False,
                   'responsive': True, 
                   'scrollZoom': False,
               })

