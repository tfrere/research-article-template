import plotly.graph_objects as go
import numpy as np
import pandas as pd

# Paramètres de l'ellipse (galaxie) et échantillonnage
num_points = 512
cx, cy = 1.5, 0.5           # centre (au milieu des ranges actuels)
a, b = 1.3, 0.45            # demi‑axes (ellipse horizontale)

# Échantillonnage en coordonnées polaires puis transformation elliptique
# r concentré vers le centre (alpha>1) pour densité centrale façon galaxie
theta = 2*np.pi*np.random.rand(num_points)
r_base = np.random.rand(num_points)**2

# Légère irrégularité pour un aspect plus naturel
noise_x = 0.015*np.random.randn(num_points)
noise_y = 0.015*np.random.randn(num_points)

x = cx + a * r_base * np.cos(theta) + noise_x
y = cy + b * r_base * np.sin(theta) + noise_y

# Taille plus grande au centre, plus petite en périphérie
# On conserve la même échelle finale qu'avant: (valeur in [0,1]) -> (val+1)*5
z_raw = 1 - r_base                 # 1 au centre, 0 au bord
sizes = (z_raw + 1) * 5            # 5..10, comme précédemment

df = pd.DataFrame({
    "x": x,
    "y": y,
    "z": sizes,                   # réutilisé pour size+color comme avant
})

def get_label(z):
    if z<0.25:
        return "smol dot"
    if z<0.5:
        return "ok-ish dot"
    if z<0.75:
        return "a dot"
    else:
        return "biiig dot"

# Les labels sont fondés sur l'intensité centrale (z_raw en [0,1])
df["label"] = pd.Series(z_raw).apply(get_label)

fig = go.Figure()

fig.add_trace(go.Scatter(
    x=df['x'],
    y=df['y'],
    mode='markers',
    marker=dict(
        size=df['z'],
        color=df['z'],
        colorscale=[
            [0, 'rgb(78, 165, 183)'],      # Light blue
            [0.5, 'rgb(206, 192, 250)'],    # Purple
            [1, 'rgb(232, 137, 171)']       # Pink
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

fig.show()

fig.write_html("../../src/fragments/banner.html", 
               include_plotlyjs=False, 
               full_html=False, 
               config={
                   'displayModeBar': False,
                   'responsive': True, 
                   'scrollZoom': False,
               })