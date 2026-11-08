# Claude Code Instructions

See `AGENTS.md` for full project context and conventions.

## Key rules

- When writing or editing article content, read `.ai/skills/write-mdx-content/SKILL.md` first
- When creating chart embeds, read `.ai/skills/create-html-embed/SKILL.md` and `.ai/skills/design-dataviz/SKILL.md` first
- Embeds use the shared runtime: `Embed.mount('d3-name', setup)`; verify with `npm run check:embed`
- Use CSS variables for theming (`--text-color`, `--surface-bg`, `--border-color`)
- Colors from `ctx.colors()` (backed by `window.ColorPalettes`), never hardcoded
- Embeds go in `app/src/content/embeds/`, data in `app/src/content/assets/data/`
- Follow Conventional Commits for commit messages
