from __future__ import annotations

"""
Core logic to find Spaces duplicated from a given source within a time window.
Comments are in English (per user preference for code comments).
"""

from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Optional

import requests
from huggingface_hub import HfApi


def iso_to_datetime(value: str) -> datetime:
    """Parse ISO 8601 timestamps returned by the Hub to aware datetime in UTC."""
    try:
        dt = datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        dt = datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    return dt.replace(tzinfo=timezone.utc)


def readme_frontmatter_duplicated_from(space_id: str) -> Optional[str]:
    """Fetch README raw and try to extract duplicated_from from YAML frontmatter."""
    url = f"https://huggingface.co/spaces/{space_id}/raw/README.md"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return None
        text = resp.text
    except requests.RequestException:
        return None

    lines = text.splitlines()
    in_frontmatter = False
    for line in lines:
        if line.strip() == "---":
            in_frontmatter = not in_frontmatter
            if not in_frontmatter:
                break
            continue
        if in_frontmatter and line.strip().startswith("duplicated_from:"):
            value = line.split(":", 1)[1].strip().strip("'\"")
            return value or None
    return None


def get_recent_spaces(api: HfApi, days: int) -> Iterable:
    """Yield Spaces created within the last `days` days, iterating newest first if possible."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    try:
        spaces_iter = api.list_spaces(full=True, sort="created", direction=-1)
    except TypeError:
        spaces_iter = api.list_spaces(full=True)

    for space in spaces_iter:
        created_at_raw = getattr(space, "created_at", None) or getattr(space, "createdAt", None)
        if not created_at_raw:
            yield space
            continue
        created_at = (
            created_at_raw if isinstance(created_at_raw, datetime) else iso_to_datetime(str(created_at_raw))
        )
        if created_at >= cutoff:
            yield space
        else:
            # We cannot guarantee sort order when falling back; continue to be safe.
            continue


def find_duplicated_spaces(api: HfApi, source: str, days: int, deep_detection: bool) -> List[str]:
    """Return list of Space IDs that were duplicated from `source` within `days`."""
    source = source.strip().strip("/ ")
    results: List[str] = []
    for space in get_recent_spaces(api, days=days):
        space_id = getattr(space, "id", None) or getattr(space, "repo_id", None)
        if not space_id:
            continue

        card = getattr(space, "cardData", None) or getattr(space, "card_data", None)
        duplicated_from_value: Optional[str] = None
        if isinstance(card, dict):
            for key in ("duplicated_from", "duplicatedFrom", "duplicated-from"):
                if key in card and isinstance(card[key], str):
                    duplicated_from_value = card[key].strip().strip("/ ")
                    break

        if not duplicated_from_value and deep_detection:
            duplicated_from_value = readme_frontmatter_duplicated_from(space_id)
            if duplicated_from_value:
                duplicated_from_value = duplicated_from_value.strip().strip("/ ")

        if duplicated_from_value and duplicated_from_value.lower() == source.lower():
            results.append(space_id)

    return results


