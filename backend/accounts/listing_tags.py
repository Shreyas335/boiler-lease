"""Preset and validation helpers for property listing tags (subleaser-defined labels)."""

from typing import Any

# Shown in the editor as quick picks; subleasers may add custom tags as well.
LISTING_TAG_PRESETS: tuple[str, ...] = (
    "Furnished",
    "Pet-Friendly",
    "Utilities Included",
    "In-Unit Laundry",
    "Gym Access",
    "Parking Included",
    "Near Campus",
    "Quiet Building",
    "Roommates OK",
    "Sublease",
)

MAX_TAGS = 20
MAX_TAG_LENGTH = 40


def normalize_listing_tags(value: Any) -> list[str]:
    """Strip, cap length, dedupe case-insensitively, preserve first-seen order."""
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("tags must be a list of strings")
    seen_lower: set[str] = set()
    out: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise ValueError("each tag must be a string")
        s = " ".join(item.split()).strip()
        if not s:
            continue
        if len(s) > MAX_TAG_LENGTH:
            s = s[:MAX_TAG_LENGTH]
        key = s.lower()
        if key in seen_lower:
            continue
        seen_lower.add(key)
        out.append(s)
        if len(out) >= MAX_TAGS:
            break
    return out
