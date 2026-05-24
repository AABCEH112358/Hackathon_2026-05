"""Blocklist for repositories that should not appear in the public map."""

from __future__ import annotations

# Normalized ids / names we never surface (case-insensitive substring match).
_BLOCKED_FRAGMENTS = (
    "fucking-algorithm",
    "fucking algorithm",
)


def repo_block_key(owner: str | None, name: str | None, repo_id: str | None = None) -> str:
    if repo_id:
        return repo_id.lower().replace("_", "-")
    owner_part = (owner or "").strip().lower()
    name_part = (name or "").strip().lower()
    return f"{owner_part}/{name_part}" if owner_part and name_part else name_part


def is_repo_blocked(
    *,
    owner: str | None = None,
    name: str | None = None,
    repo_id: str | None = None,
    description: str | None = None,
) -> bool:
    haystack = " ".join(
        filter(
            None,
            [
                repo_id or "",
                repo_block_key(owner, name, repo_id),
                name or "",
                description or "",
            ],
        )
    ).lower()

    if any(fragment in haystack for fragment in _BLOCKED_FRAGMENTS):
        return True

    # Explicit match for the known offensive repo title variant.
    normalized_name = (name or "").lower().replace("-", " ").replace("_", " ")
    return normalized_name == "fucking algorithm"
