---
name: design-dataviz
description: Design guidance for scientific data visualization in research articles - choosing the chart, encodings, scales, number formats, color, direct labels, annotation, uncertainty, density and interaction, plus a review checklist. Use when designing, critiquing or improving a chart or figure, choosing how to visualize data, or when the user asks to make a chart clearer, more readable or more convincing.
---

# Design data visualizations

This skill is about what makes a figure clear and honest. How to build it
as an embed (runtime, theming, sizing, verification) lives in
[`../create-html-embed/SKILL.md`](../create-html-embed/SKILL.md). Use both
when creating a chart.

## 1. Start from the claim

- Write down the one sentence the figure must prove ("Longer context
  lowers loss after 20B tokens"). If you cannot, ask the user. Every
  design decision below serves that sentence.
- The HtmlEmbed `title` states the finding or the question, not the chart
  type ("Longer context wins after 20B tokens", not "Loss chart").
  `desc` says how to read it: units, what bands mean, how many seeds.
- One figure, one message. Split a figure that argues two things.
- The default view, without any interaction, must already show the claim.

## 2. Choose the chart

| Question | Default chart | Avoid |
|---|---|---|
| How does a metric evolve (steps, tokens, time)? | Line chart, x = progress | Bars per step |
| Compare one value across categories | Horizontal bars, sorted by value | Pie with more than 3 slices, 3D |
| Compare a few values across 2 groupings | Grouped bars or dot plot | Stacked bars when parts must be compared |
| Part of a whole | Stacked bar (one per group) or a single 100% bar | Donut for precise reading |
| Relationship between two measures | Scatter, optionally with a fit | Two lines on dual axes |
| Distribution | Histogram, box, or strip/beeswarm for small n | Mean bar without spread |
| Ranking across many models and benchmarks | Heatmap or table with inline bars | Radar chart |
| Before / after, two conditions | Slope chart or dumbbell | Two separate bar charts |
| Flows between stages | Sankey | Chord for few categories |
| Many series that tangle | Small multiples with shared axes | One chart with 12 colored lines |

When precise values matter more than shape, a well-formatted table with
inline bars often beats any chart.

## 3. Encode in order of accuracy

People read position best, then length, then angle and area, then color
intensity. Put the comparison that carries the claim on a shared position
axis.

- Bars and areas start at zero. If zero hides the effect, use a dot plot
  or a line instead of truncating bars.
- Line charts can start elsewhere, but show the axis values clearly.
- Use a log scale when values span more than two orders of magnitude or
  when ratios matter (scaling laws, compute, parameters). Label it as log.
- No dual y-axes. Use two aligned panels, or normalize.
- Shared scales across small multiples, unless the point is shape and
  you say so.
- Sort categories by value unless they have a natural order (sizes,
  dates, stages).

## 4. Axes and numbers

- 4 to 6 ticks per axis is plenty; scale tick count with the width.
- Format numbers for humans: `d3.format('.2s')` for 1.2B tokens,
  `'.1%'` for rates, a fixed precision that matches the measurement
  (`'.3f'` for loss, not 7 decimals).
- Units go in the axis title once ("Throughput (tokens/s)"), not on every
  tick.
- Axis titles in sentence case, spelled out, no internal variable names
  (`val_loss_ema` becomes "Validation loss (EMA)").
- Light gridlines along the value axis only, no chart borders, no tick
  marks on categorical axes.

## 5. Label directly, annotate the story

- Label lines at their end and bars at their tip, in the series color
  (darkened for contrast). A legend makes readers bounce between key and
  marks; keep it for narrow screens or many series.
- Highlight the subject, mute the context: the model the article is
  about gets the accent color and full opacity, baselines get a neutral
  gray or lower opacity.
- Annotate what the text talks about: the step where a run diverged, the
  crossover point, the best score. A short label with a thin leader line
  is enough.
- Reference lines (human baseline, random chance, previous SOTA) are
  dashed, muted and labeled.
- Labels must never overlap each other or the marks. Nudge them apart,
  or drop the least important.

## 6. Color

- Color is for identity or magnitude, not decoration. If one color
  works, use one color.
- Categorical: at most 6 to 8 distinct hues. Beyond that, group into
  "Other", facet, or highlight a few and gray the rest.
- Sequential (one hue, light to dark) for ordered magnitude. Diverging
  only when the midpoint means something (zero, a baseline, 50%).
- Keep color meaning consistent across the article: the same model has
  the same color in every figure (pass a mapping through `config`).
- Colorblind safety: never rely on red vs green alone; add labels,
  shapes, or position. Check that the categorical colors differ in
  lightness as well as hue.
- Gray means "context" and the accent means "look here". Do not spend the
  accent color on everything.

## 7. Uncertainty

- Show the variability the claim depends on: bands for min/max or
  standard deviation across seeds, error bars or intervals for estimates,
  raw points when n is small.
- Say what the band or bar represents in `desc` (std over 3 seeds, 95%
  bootstrap CI).
- When differences are within noise, the figure must make that visible,
  not hide it.
- Smoothing (EMA) is fine for noisy training curves; show the raw curve
  faintly behind it, and say so.

## 8. Density and overplotting

- Fewer than about 5,000 marks: SVG. More: canvas. More than about
  50,000: aggregate first (binning, hexbin, downsampling with min/max per
  pixel for curves).
- Overplotting: lower opacity, smaller marks, jitter for discrete values,
  or switch to a density view.
- Long series: decimate to about 2 points per pixel; it looks identical
  and renders fast.

## 9. Interaction

- Interaction reveals detail; it never hides the main message. The
  default state is the one that makes the point.
- Tooltips give exact values and context (series, step, unit), formatted
  like the axes.
- Controls only for genuine alternative views (metric, model size, log
  vs linear). Defaults come from `config` so the author picks the view
  the text refers to.
- Hover highlights: emphasize the hovered series, mute the others.
- Everything must still read in print and PDF, where nothing is
  hovered.

## 10. Text and density of ink

- Sentence case everywhere, no all caps except short acronyms.
- Remove what does not carry information: chart borders, background
  fills, redundant legends, repeated units, 3D, shadows, gradients on
  data marks.
- Font sizes: 12px for labels and ticks, 11px minimum for secondary
  text. Never scale text down with the chart width.

## 11. Anti-patterns to refuse or flag

- Truncated bar axes, dual y-axes, 3D charts, pies with many slices,
  radar charts for model comparison, rainbow color scales for ordered
  data, red/green-only encodings, legends with 12 entries, smoothed
  curves without the raw signal, averages without spread, cherry-picked
  axis ranges, animation required to understand the figure.

If the user explicitly asks for one of these, build it, and mention the
tradeoff in one sentence.

## 12. Review checklist

Run the embed checker, open the screenshots (light, dark, 360px), and
check:

- [ ] The title states the claim and the default view proves it.
- [ ] A reader can tell what every mark and color means without the
  article text.
- [ ] Axes have readable titles with units and formatted ticks.
- [ ] Series are labeled directly, or a compact legend is present.
- [ ] The subject is highlighted and the context is muted.
- [ ] Uncertainty is shown and explained when the claim depends on it.
- [ ] No overlapping labels, no clipped text, nothing unreadable in dark
  mode.
- [ ] At 360px wide the figure still makes its point.
- [ ] Color is not the only carrier of meaning.
- [ ] `ctx.describe()` states the takeaway in words.
