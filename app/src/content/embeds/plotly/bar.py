import plotly.graph_objects as go
import plotly.io as pio
import numpy as np

"""
Stacked bar chart: GPU memory breakdown vs sequence length, with menus for Model Size and Recomputation.
Responsive, no zoom/pan, clean hover; styled to match the minimal theme.
"""

# Axes
seq_labels = ["1024", "2048", "4096", "8192"]
seq_scale = np.array([1, 2, 4, 8], dtype=float)

# Components and colors (aligned with the provided example)
components = [
    ("parameters", "rgb(78, 165, 183)"),
    ("gradients",  "rgb(227, 138, 66)"),
    ("optimizer",  "rgb(232, 137, 171)"),
    ("activations", "rgb(206, 192, 250)"),
]

# Model sizes and base memory (GB) for params/grad/opt (constant vs seq), by size
model_sizes = ["1B", "3B", "8B", "70B", "405B"]
params_mem = {
    "1B": 4.0,
    "3B": 13.3,
    "8B": 26.0,
    "70B": 244.0,
    "405B": 1520.0,
}
# Optimizer ~= 2x params; gradients ~= params (illustrative)

# Activations base coefficient per size (growth ~ coeff * (seq/1024)^2)
act_coeff = {
    "1B": 3.6,
    "3B": 9.3,
    "8B": 46.2,
    "70B": 145.7,
    "405B": 1519.9,
}

def activations_curve(size_key: str, recompute: str) -> np.ndarray:
    base = act_coeff[size_key] * (seq_scale ** 2)
    if recompute == "selective":
        return base * 0.25
    if recompute == "full":
        return base * (1.0/16.0)
    return base

def stack_for(size_key: str, recompute: str):
    p = np.full_like(seq_scale, params_mem[size_key], dtype=float)
    g = np.full_like(seq_scale, params_mem[size_key], dtype=float)
    o = np.full_like(seq_scale, 2.0 * params_mem[size_key], dtype=float)
    a = activations_curve(size_key, recompute)
    return {
        "parameters": p,
        "gradients": g,
        "optimizer": o,
        "activations": a,
    }

# Precompute all combinations
recomp_modes = ["none", "selective", "full"]
Y = {mode: {size: stack_for(size, mode) for size in model_sizes} for mode in recomp_modes}

# Build traces: 4 traces per size (20 total). Start with size index 0 visible
fig = go.Figure()
for size in model_sizes:
    for comp_name, color in components:
        fig.add_bar(
            x=seq_labels,
            y=Y["none"][size][comp_name],
            name=comp_name,
            marker=dict(color=color),
            hovertemplate="Seq len=%{x}<br>Mem=%{y:.1f}GB<br>%{data.name}<extra></extra>",
            showlegend=True,
            visible=(size == model_sizes[0]),
        )

# Compute y-axis ranges per size and recomputation
def max_total(size: str, mode: str) -> float:
    stacks = Y[mode][size]
    totals = stacks["parameters"] + stacks["gradients"] + stacks["optimizer"] + stacks["activations"]
    return float(np.max(totals))

layout_y_ranges = {mode: {size: 1.05 * max_total(size, mode) for size in model_sizes} for mode in recomp_modes}

# Layout
fig.update_layout(
    barmode="stack",
    autosize=True,
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    margin=dict(l=40, r=28, t=20, b=40),
    hovermode="x unified",
    legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0),
    xaxis=dict(title=dict(text="Sequence Length"), fixedrange=True),
    yaxis=dict(title=dict(text="Memory (GB)"), fixedrange=True),
)

# Updatemenus: Model Size (toggle visibility)
buttons_sizes = []
for i, size in enumerate(model_sizes):
    visible = [False] * (len(model_sizes) * len(components))
    start = i * len(components)
    for j in range(len(components)):
        visible[start + j] = True
    buttons_sizes.append(dict(
        label=size,
        method="update",
        args=[
            {"visible": visible},
            {"yaxis": {"range": [0, layout_y_ranges["none"][size]]}},
        ],
    ))

# Updatemenus: Recomputation (restyle y across all traces)
def y_for_mode(mode: str):
    ys = []
    for size in model_sizes:
        stacks = Y[mode][size]
        for comp_name, _ in components:
            ys.append(stacks[comp_name])
    return ys

buttons_recomp = []
for mode, label in [("none", "None"), ("selective", "selective"), ("full", "full")]:
    ys = y_for_mode(mode)
    # Flatten into the format expected by Plotly for multiple traces
    buttons_recomp.append(dict(
        label=label,
        method="update",
        args=[
            {"y": ys},
            {"yaxis": {"range": [0, max(layout_y_ranges[mode].values())]}},
        ],
    ))

fig.update_layout(
    updatemenus=[
        dict(
            type="dropdown",
            x=1.03, xanchor="left",
            y=0.60, yanchor="top",
            showactive=True,
            active=0,
            buttons=buttons_sizes,
        ),
        dict(
            type="dropdown",
            x=1.03, xanchor="left",
            y=0.40, yanchor="top",
            showactive=True,
            active=0,
            buttons=buttons_recomp,
        ),
    ],
    annotations=[
        dict(text="Model Size:", x=1.03, xanchor="left", xref="paper", y=0.60, yanchor="bottom", yref="paper", showarrow=False),
        dict(text="Recomputation:", x=1.03, xanchor="left", xref="paper", y=0.40, yanchor="bottom", yref="paper", showarrow=False),
    ],
)

# Write fragment
fig.write_html("./plotly-bar.html",
               include_plotlyjs=False,
               full_html=False,
               config={
                   'displayModeBar': False,
                   'responsive': True,
                   'scrollZoom': False,
               })

