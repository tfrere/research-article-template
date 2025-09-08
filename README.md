---
title: 'Bringing paper to life: A modern template for scientific writing'
emoji: 📝
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
header: mini
app_port: 8080
thumbnail: https://huggingface.co/spaces/tfrere/research-paper-template/thumb.jpg
---

## Find recent duplicated Spaces

This repository includes a small utility to list public Spaces created in the last N days that were duplicated from a given source Space.

Prerequisites:

```bash
pip install huggingface_hub requests
```

Usage:

```bash
python app/scripts/find_duplicated_spaces.py --source owner/space-name --days 14
```

Options:

- `--source`: required. The source Space in the form `owner/space-name`.
- `--days`: optional. Time window in days (default: 14).
- `--token`: optional. Your HF token. Defaults to `HF_TOKEN` env var if set.
- `--no-deep`: optional. Disable README/frontmatter fallback detection.

Examples:

```bash
# Using env var for the token (optional)
export HF_TOKEN=hf_xxx

# Find Spaces duplicated from tfrere/my-space in the last 14 days
python app/scripts/find_duplicated_spaces.py --source tfrere/my-space

# Use a 7-day window and explicit token
python app/scripts/find_duplicated_spaces.py --source tfrere/my-space --days 7 --token $HF_TOKEN
```

The script first checks card metadata (e.g., `duplicated_from`) and optionally falls back to parsing the README frontmatter for robustness.

