# duplicated-spaces

Small Poetry project to list public Spaces created in the last N days that were duplicated from a given source Space.

## Setup

```bash
cd tools/duplicated-spaces
poetry install --no-root
```

Optionally export your token:

```bash
export HF_TOKEN=hf_xxx
```

## Usage

```bash
poetry run find-duplicated-spaces --source owner/space-name --days 14
```

Options:
- `--source`: required. The source Space in the form `owner/space-name`.
- `--days`: optional. Time window in days (default: 14).
- `--token`: optional. Your HF token. Defaults to `HF_TOKEN` env var if set.
- `--no-deep`: optional. Disable README/frontmatter fallback detection.

The tool checks card metadata and may fallback to README frontmatter parsing for robustness.


