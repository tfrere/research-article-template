import plotly.graph_objects as go
import numpy as np
import pandas as pd

# Scene parameters (same ranges as the Astro integration)
cx, cy = 1.5, 0.5                 # center
a, b = 1.3, 0.45                  # max extent in x/y (ellipse for anisotropy)

# Spiral galaxy parameters
num_points = 3000                 # more dots
num_arms = 3                      # number of spiral arms
num_turns = 2.1                   # number of turns per arm
angle_jitter = 0.12               # angular jitter to fan out the arms
pos_noise = 0.015                 # global position noise

# Generate points along spiral arms (Archimedean spiral)
t = np.random.rand(num_points) * (2 * np.pi * num_turns)  # progression along the arm
arm_indices = np.random.randint(0, num_arms, size=num_points)
arm_offsets = arm_indices * (2 * np.pi / num_arms)

theta = t + arm_offsets + np.random.randn(num_points) * angle_jitter

# Normalized radius (0->center, 1->edge). Power <1 to densify the core
r_norm = (t / (2 * np.pi * num_turns)) ** 0.9

# Radial/lateral noise that slightly increases with radius
noise_x = pos_noise * (0.8 + 0.6 * r_norm) * np.random.randn(num_points)
noise_y = pos_noise * (0.8 + 0.6 * r_norm) * np.random.randn(num_points)

# Elliptic projection
x_spiral = cx + a * r_norm * np.cos(theta) + noise_x
y_spiral = cy + b * r_norm * np.sin(theta) + noise_y

# Central bulge (additional points very close to the core)
bulge_points = int(0.18 * num_points)
phi_b = 2 * np.pi * np.random.rand(bulge_points)
r_b = (np.random.rand(bulge_points) ** 2.2) * 0.22  # compact bulge
noise_x_b = (pos_noise * 0.6) * np.random.randn(bulge_points)
noise_y_b = (pos_noise * 0.6) * np.random.randn(bulge_points)
x_bulge = cx + a * r_b * np.cos(phi_b) + noise_x_b
y_bulge = cy + b * r_b * np.sin(phi_b) + noise_y_b

# Concatenation
x = np.concatenate([x_spiral, x_bulge])
y = np.concatenate([y_spiral, y_bulge])

# Central intensity (for sizes/colors). 1 at center, ~0 at edge
z_spiral = 1 - r_norm
z_bulge = 1 - (r_b / max(r_b.max(), 1e-6))  # very bright bulge
z_raw = np.concatenate([z_spiral, z_bulge])

# Sizes: keep the 5..10 scale for consistency
sizes = (z_raw + 1) * 5

# Remove intermediate filtering: keep all placed points, filter at the very end

df = pd.DataFrame({
    "x": x,
    "y": y,
    "z": sizes,  # reused for size+color as before
})

def get_label(z):
    if z < 0.25:
        return "smol dot"
    if z < 0.5:
        return "ok-ish dot"
    if z < 0.75:
        return "a dot"
    else:
        return "biiig dot"

# Labels based on central intensity
df["label"] = pd.Series(z_raw).apply(get_label)

# Rendering order: small points first, big ones after (on top)
df = df.sort_values(by="z", ascending=True).reset_index(drop=True)

fig = go.Figure()

fig.add_trace(go.Scattergl(
    x=df['x'],
    y=df['y'],
    mode='markers',
    marker=dict(
        size=df['z'],
        color=df['z'],
        colorscale=[
            [0, 'rgb(78, 165, 183)'],
            [0.5, 'rgb(206, 192, 250)'],
            [1, 'rgb(232, 137, 171)']
        ],
        opacity=0.9,
    ),
    customdata=df[["label"]],
    hovertemplate="Dot category: %{customdata[0]}",
    hoverlabel=dict(namelength=0),
    showlegend=False
))

fig.update_layout(
    autosize=True,
    paper_bgcolor='rgba(0,0,0,0)',
    plot_bgcolor='rgba(0,0,0,0)',
    showlegend=False,
    margin=dict(l=0, r=0, t=0, b=0),
    xaxis=dict(
        showgrid=False,
        zeroline=False,
        showticklabels=False,
        range=[0, 3]
    ),
    yaxis=dict(
        showgrid=False,
        zeroline=False,
        showticklabels=False,
        scaleanchor="x",
        scaleratio=1,
        range=[0, 1]
    )
)

# fig.show()

fig.write_html(
    "../app/src/content/fragments/banner.html",
    include_plotlyjs=False,
    full_html=False,
    config={
        'displayModeBar': False,
        'responsive': True,
        'scrollZoom': False,
    }
)