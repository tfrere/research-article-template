from __future__ import annotations

import argparse
import os
from typing import Optional

from huggingface_hub import HfApi

from .finder import find_duplicated_spaces


def build_parser() -> argparse.ArgumentParser:
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
    return parser


def main(argv: Optional[list[str]] = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

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


