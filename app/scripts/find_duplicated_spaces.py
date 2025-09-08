#!/usr/bin/env python3
"""
Find Spaces created in the last N days that were duplicated from a given source Space.

This script uses the public Hugging Face Hub APIs via `huggingface_hub` and optionally
falls back to reading README frontmatter for robustness.

Usage:
  python app/scripts/find_duplicated_spaces.py --source owner/space-name [--days 14] [--token <hf_token>] [--no-deep]

Notes:
  - Comments are in English as requested.
  - Chat responses remain in French.
"""

from __future__ import annotations

import argparse
import os
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Optional

import requests
from huggingface_hub import HfApi


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="List recent Spaces duplicated from a given Space"
    )
    parser.add_argument(
        "--source",
        required=True,
        help="Source Space in the form 'owner/space-name'",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=14,
        help="Time window in days (default: 14)",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("HF_TOKEN"),
        help="Hugging Face token (optional). Defaults to HF_TOKEN env var if set.",
    )
    parser.add_argument(
        "--no-deep",
        action="store_true",
        help=(
            "Disable deep detection (README/frontmatter fetch) when card metadata is missing."
        ),
    )
    return parser.parse_args()


def iso_to_datetime(value: str) -> datetime:
    """Parse ISO 8601 timestamps returned by the Hub to aware datetime in UTC."""
    # Examples: "2024-09-01T12:34:56.789Z" or without microseconds
    try:
        dt = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        dt = datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    return dt.replace(tzinfo=timezone.utc)


def readme_frontmatter_duplicated_from(space_id: str) -> Optional[str]:
    """Fetch README raw and try to extract duplicated_from from YAML frontmatter."""
    # Raw README for Spaces is accessible at /spaces/{id}/raw/README.md
    url = f"https://huggingface.co/spaces/{space_id}/raw/README.md"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return None
        text = resp.text
    except requests.RequestException:
        return None

    # Very light-weight frontmatter scan to find a line like: duplicated_from: owner/space
    # Do not parse full YAML to avoid extra deps.
    lines = text.splitlines()
    in_frontmatter = False
    for line in lines:
        if line.strip() == "---":
            in_frontmatter = not in_frontmatter
            # Stop if we closed the frontmatter without finding the key.
            if not in_frontmatter:
                break
            continue
        if in_frontmatter and line.strip().startswith("duplicated_from:"):
            # Extract value after colon, trim quotes/spaces
            value = line.split(":", 1)[1].strip().strip("'\"")
            return value or None
    return None


def get_recent_spaces(api: HfApi, days: int) -> Iterable:
    """Yield Spaces created within the last `days` days, iterating newest first.

    Tries to sort by creation date descending; falls back gracefully if not supported.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Primary attempt: request spaces sorted by creation date (newest first)
    try:
        spaces_iter = api.list_spaces(full=True, sort="created", direction=-1)
    except TypeError:
        # Fallback: no sort support in current huggingface_hub; get a reasonably large list
        # Note: This may include items older than the cutoff; we'll filter below.
        spaces_iter = api.list_spaces(full=True)

    for space in spaces_iter:
        created_at_raw = getattr(space, "created_at", None) or getattr(space, "createdAt", None)
        if not created_at_raw:
            # If missing, include conservatively
            yield space
            continue
        created_at = (
            created_at_raw if isinstance(created_at_raw, datetime) else iso_to_datetime(str(created_at_raw))
        )
        if created_at >= cutoff:
            yield space
        else:
            # If we know the iteration is sorted by creation desc, we can break early
            # Only do that when we explicitly asked for sort="created"
            if "spaces_iter" in locals():
                try:
                    # If we reached here under the sorted branch, short-circuit
                    # by checking if the generator came from the sorted call
                    _ = api  # keep linter calm
                except Exception:
                    pass
            # We can't be certain the iterator is sorted in fallback; just continue
            # without breaking to avoid missing any items.
            continue


def find_duplicated_spaces(
    api: HfApi, source: str, days: int, deep_detection: bool
) -> List[str]:
    """Return list of Space IDs that were duplicated from `source` within `days`."""
    source = source.strip().strip("/ ")
    results: List[str] = []
    for space in get_recent_spaces(api, days=days):
        space_id = getattr(space, "id", None) or getattr(space, "repo_id", None)
        if not space_id:
            continue

        # Check card metadata first
        card = getattr(space, "cardData", None) or getattr(space, "card_data", None)
        duplicated_from_value: Optional[str] = None
        if isinstance(card, dict):
            for key in ("duplicated_from", "duplicatedFrom", "duplicated-from"):
                if key in card and isinstance(card[key], str):
                    duplicated_from_value = card[key].strip().strip("/ ")
                    break

        # Optional deep detection via README frontmatter
        if not duplicated_from_value and deep_detection:
            duplicated_from_value = readme_frontmatter_duplicated_from(space_id)
            if duplicated_from_value:
                duplicated_from_value = duplicated_from_value.strip().strip("/ ")

        if duplicated_from_value and duplicated_from_value.lower() == source.lower():
            results.append(space_id)

    return results


def main() -> None:
    args = parse_args()
    api = HfApi(token=args.token)

    duplicated = find_duplicated_spaces(
        api=api,
        source=args.source,
        days=args.days,
        deep_detection=not args.no_deep,
    )

    if duplicated:
        print(
            f"Found {len(duplicated)} Space(s) duplicated from {args.source} in the last {args.days} days:\n"
        )
        for sid in duplicated:
            print(f"https://huggingface.co/spaces/{sid}")
    else:
        print(
            f"No public Spaces duplicated from {args.source} in the last {args.days} days."
        )


if __name__ == "__main__":
    main()


