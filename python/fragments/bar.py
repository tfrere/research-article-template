import plotly.graph_objects as go
import plotly.io as pio
import os

"""
Simple grouped bar chart (Baseline / Improved / Target), minimal Distill-like style.
Responsive, no zoom/pan, clean hover (rounded tooltip corners via post_script).
"""

# Data (five categories)
categories = ["A", "B", "C", "D", "E"]
baseline = [0.52, 0.61, 0.67, 0.73, 0.78]
improved = [0.58, 0.66, 0.72, 0.79, 0.86]
target   = [0.60, 0.68, 0.75, 0.82, 0.90]

color_base = "#64748b"     # slate-500
color_improved = "#2563eb" # blue-600
color_target = "#4b5563"   # gray-600

fig = go.Figure()
fig.add_bar(
    x=categories,
    y=baseline,
    name="Baseline",
    marker=dict(color=color_base),
    offsetgroup="grp",
    hovertemplate="<b>%{x}</b><br>%{fullData.name}: %{y:.3f}<extra></extra>",
)

fig.add_bar(
    x=categories,
    y=improved,
    name="Improved",
    marker=dict(color=color_improved),
    offsetgroup="grp",
    hovertemplate="<b>%{x}</b><br>%{fullData.name}: %{y:.3f}<extra></extra>",
)

fig.add_bar(
    x=categories,
    y=target,
    name="Target",
    marker=dict(color=color_target, opacity=0.65, line=dict(color=color_target, width=1)),
    offsetgroup="grp",
    hovertemplate="<b>%{x}</b><br>%{fullData.name}: %{y:.3f}<extra></extra>",
)

fig.update_layout(
    barmode="group",
    autosize=True,
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    margin=dict(l=28, r=12, t=8, b=28),
    hovermode="x unified",
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0),
    xaxis=dict(
        showgrid=False,
        zeroline=False,
        showline=True,
        linecolor="rgba(0,0,0,0.25)",
        linewidth=1,
        ticks="outside",
        ticklen=6,
        tickcolor="rgba(0,0,0,0.25)",
        tickfont=dict(size=12, color="rgba(0,0,0,0.65)"),
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
        tickfont=dict(size=12, color="rgba(0,0,0,0.65)"),
        title=None,
        tickformat=".2f",
        automargin=True,
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

output_path = os.path.join(os.path.dirname(__file__), "fragments", "bar.html")
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    f.write(html)


