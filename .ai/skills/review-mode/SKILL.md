---
name: review-mode
description: Turn on, use, or read the article's review mode (comments and suggested edits from reviewers). Use when the user asks to collect feedback, invite reviewers, read or apply review comments, or accept suggestions.
---

# Review mode

Reviewers comment on the live article and suggest edits, like Google Docs. The published page is
unaffected: the review layer only loads with `?review`, and only when the Space enables it.

## Turn it on

1. README metadata: `hf_oauth: true` (sign in with Hugging Face).
2. Space settings → Storage Buckets: mount a private bucket at `/data`, read & write. Threads live in
   `/data/review-comments/threads/`, one JSON file each. Without the mount the server refuses to
   save, so nothing is lost silently.
3. Space variables: `REVIEW_MODE=on`, `REVIEWERS=user1,user2`. The Space owner is always a reviewer
   and is the only one who can accept or reject suggestions.
4. Share `https://<user>-<space>.hf.space/?review`. Inside the huggingface.co iframe, the page offers
   to open review mode in a new tab, because sign-in works best on the direct URL.

To publish again, set `REVIEW_MODE=off` (or remove it). Comments stay on disk.

## Read and apply the feedback

```bash
uv run --with huggingface_hub python review/pull_comments.py --url https://<user>-<space>.hf.space        # open threads
uv run --with huggingface_hub python review/pull_comments.py --url https://<user>-<space>.hf.space --all  # include resolved
```

This writes `review/.pulled/comments.md` (git-ignored), grouped by chapter and section, with the
quoted text each comment points at and every accepted suggestion as "replace X with Y". Apply them
in the MDX sources, then resolve the threads in the page. `/api/review/import` takes threads back in
the export format (owner only, with an `Authorization: Bearer <hf token>` header).

## Local development

Run the API next to `npm run dev`; the dev server proxies `/api/review` and `/oauth` to port 7861,
and sign-in is mocked with your local Hugging Face login:

```bash
pip install -r review/requirements.txt
REVIEW_MODE=on REVIEW_OWNER=<your-username> COMMENTS_DIR=/tmp/review-comments \
  uvicorn --app-dir review server:app --port 7861
```

Then open `http://localhost:4321/?review`.

## How it works

- `review/server.py`: FastAPI, started by `entrypoint.sh` next to nginx, which proxies
  `/api/review/` and `/oauth/`. Threads are anchored by the quoted text plus 40 characters of context
  on each side, so small edits elsewhere never move them; a thread whose text is gone shows as
  detached, with its quote.
- `app/public/review/review.js` and `review.css`: the margin cards, highlights, suggestions and
  panel. Loaded by a small inline script in `src/pages/index.astro` only when the URL has `?review`.
