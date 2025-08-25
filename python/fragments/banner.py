import plotly.graph_objects as go
import numpy as np
import pandas as pd

# Paramètres de la scène (mêmes ranges que l'intégration Astro)
cx, cy = 1.5, 0.5                 # centre
a, b = 1.3, 0.45                  # étendue max en x/y (ellipse pour l'anisotropie)

# Paramètres de la galaxie en spirale
num_points = 3000                 # plus de dots
num_arms = 3                      # nombre de bras spiraux
num_turns = 2.1                   # nombre de tours par bras
angle_jitter = 0.12               # écart angulaire pour évaser les bras
pos_noise = 0.015                 # bruit de position global

# Génération des points sur des bras spiraux (spirale d'Archimède)
t = np.random.rand(num_points) * (2 * np.pi * num_turns)  # progression le long du bras
arm_indices = np.random.randint(0, num_arms, size=num_points)
arm_offsets = arm_indices * (2 * np.pi / num_arms)

theta = t + arm_offsets + np.random.randn(num_points) * angle_jitter

# Rayon normalisé (0->centre, 1->bord). Puissance <1 pour densifier le centre
r_norm = (t / (2 * np.pi * num_turns)) ** 0.9

# Bruit radial/lateral qui augmente légèrement avec le rayon
noise_x = pos_noise * (0.8 + 0.6 * r_norm) * np.random.randn(num_points)
noise_y = pos_noise * (0.8 + 0.6 * r_norm) * np.random.randn(num_points)

# Projection elliptique
x_spiral = cx + a * r_norm * np.cos(theta) + noise_x
y_spiral = cy + b * r_norm * np.sin(theta) + noise_y

# Bulbe central (points supplémentaires très proches du centre)
bulge_points = int(0.18 * num_points)
phi_b = 2 * np.pi * np.random.rand(bulge_points)
r_b = (np.random.rand(bulge_points) ** 2.2) * 0.22  # bulbe compact
noise_x_b = (pos_noise * 0.6) * np.random.randn(bulge_points)
noise_y_b = (pos_noise * 0.6) * np.random.randn(bulge_points)
x_bulge = cx + a * r_b * np.cos(phi_b) + noise_x_b
y_bulge = cy + b * r_b * np.sin(phi_b) + noise_y_b

# Concaténation
x = np.concatenate([x_spiral, x_bulge])
y = np.concatenate([y_spiral, y_bulge])

# Intensité centrale (pour tailles/couleurs). 1 au centre, ~0 au bord
z_spiral = 1 - r_norm
z_bulge = 1 - (r_b / max(r_b.max(), 1e-6))  # bulbe très lumineux
z_raw = np.concatenate([z_spiral, z_bulge])

# Tailles: conserver l'échelle 5..10 pour cohérence
sizes = (z_raw + 1) * 5

# Filtrer les petits points proches du centre (esthétique du bulbe)
# - on calcule le rayon elliptique normalisé
# - on retire les points de petite taille situés trop près du centre
central_radius_cut = 0.18
min_size_center = 7.5
r_total = np.sqrt(((x - cx) / a) ** 2 + ((y - cy) / b) ** 2)
mask = ~((r_total <= central_radius_cut) & (sizes < min_size_center))

# Appliquer le masque
x = x[mask]
y = y[mask]
z_raw = z_raw[mask]
sizes = sizes[mask]

df = pd.DataFrame({
    "x": x,
    "y": y,
    "z": sizes,  # réutilisé pour size+color comme avant
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

# Labels basés sur l'intensité centrale
df["label"] = pd.Series(z_raw).apply(get_label)

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
    "../app/src/fragments/banner.html",
    include_plotlyjs=False,
    full_html=False,
    config={
        'displayModeBar': False,
        'responsive': True,
        'scrollZoom': False,
    }
)