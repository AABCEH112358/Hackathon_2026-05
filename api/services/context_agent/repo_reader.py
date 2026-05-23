"""STEP 1 of the context agent pipeline — fetch repo content from GitHub."""

from __future__ import annotations

import base64
import fnmatch
from typing import Any, TypedDict

import httpx
import structlog

from config import get_settings

logger = structlog.get_logger(__name__)

GITHUB_API = "https://api.github.com"

DEPENDENCY_FILENAMES = ("package.json", "requirements.txt", "pyproject.toml", "Cargo.toml")

SOURCE_PATTERNS: tuple[str, ...] = (
    "src/index.*",
    "src/main.*",
    "src/core.*",
    "lib/*.*",
    "index.py",
    "main.py",
    "app.py",
    "server.py",
    "cli.py",
    "index.ts",
    "index.js",
    "main.go",
    "main.rs",
)

MAX_SOURCE_FILES = 10
README_MAX_CHARS = 5000
SOURCE_FILE_MAX_CHARS = 2000


class RepoMetadata(TypedDict):
    name: str
    owner: str
    description: str | None
    language: str | None
    topics: list[str]
    stars: int
    license: str | None


class DependencyFile(TypedDict):
    name: str
    content: str


class SourceFile(TypedDict):
    path: str
    content: str


class RepoData(TypedDict):
    metadata: RepoMetadata
    readme: str
    dependency_file: DependencyFile | None
    source_files: list[SourceFile]


def _headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = get_settings().github_token
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _decode_base64_content(encoded: str) -> str:
    cleaned = encoded.replace("\n", "")
    return base64.b64decode(cleaned).decode("utf-8", errors="replace")


def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars]


def _pattern_priority(path: str) -> int:
    for index, pattern in enumerate(SOURCE_PATTERNS):
        if fnmatch.fnmatch(path, pattern):
            return index
    return len(SOURCE_PATTERNS)


def _matches_source_heuristic(path: str) -> bool:
    return _pattern_priority(path) < len(SOURCE_PATTERNS)


async def _get_json(
    client: httpx.AsyncClient,
    url: str,
    *,
    params: dict[str, str] | None = None,
    not_found_ok: bool = False,
) -> dict[str, Any] | None:
    response = await client.get(url, headers=_headers(), params=params, timeout=30.0)
    if not_found_ok and response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json()


async def _fetch_metadata(
    client: httpx.AsyncClient, owner: str, repo: str
) -> RepoMetadata:
    data = await _get_json(client, f"{GITHUB_API}/repos/{owner}/{repo}")
    assert data is not None
    license_obj = data.get("license")
    return {
        "name": data["name"],
        "owner": data["owner"]["login"],
        "description": data.get("description"),
        "language": data.get("language"),
        "topics": list(data.get("topics") or []),
        "stars": int(data.get("stargazers_count", 0)),
        "license": license_obj.get("name") if license_obj else None,
    }


async def _fetch_readme(client: httpx.AsyncClient, owner: str, repo: str) -> str:
    data = await _get_json(
        client,
        f"{GITHUB_API}/repos/{owner}/{repo}/readme",
        not_found_ok=True,
    )
    if not data or not data.get("content"):
        return ""
    decoded = _decode_base64_content(data["content"])
    return _truncate(decoded, README_MAX_CHARS)


async def _fetch_dependency_file(
    client: httpx.AsyncClient, owner: str, repo: str
) -> DependencyFile | None:
    for filename in DEPENDENCY_FILENAMES:
        data = await _get_json(
            client,
            f"{GITHUB_API}/repos/{owner}/{repo}/contents/{filename}",
            not_found_ok=True,
        )
        if not data or not data.get("content"):
            continue
        content = _decode_base64_content(data["content"])
        return {"name": filename, "content": content}
    return None


async def _list_tree_items(
    client: httpx.AsyncClient, owner: str, repo: str, tree_sha: str
) -> list[dict[str, Any]]:
    """List direct children of a tree (no recursive param — GitHub treats any value as true)."""
    data = await _get_json(
        client,
        f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{tree_sha}",
    )
    assert data is not None
    return list(data.get("tree", []))


def _blob_paths_matching_heuristics(tree_items: list[dict[str, Any]]) -> list[str]:
    return [
        item["path"]
        for item in tree_items
        if item.get("type") == "blob" and _matches_source_heuristic(item.get("path", ""))
    ]


async def _collect_source_paths(
    client: httpx.AsyncClient, owner: str, repo: str
) -> list[str]:
    # GitHub treats any `recursive` query value as true; `recursive=0` still
    # returns a full tree on many repos. When the response is shallow, drill
    # one level into `src/` and `lib/`.
    root = await _get_json(
        client,
        f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/HEAD",
        params={"recursive": "0"},
    )
    assert root is not None

    tree_items = list(root.get("tree", []))
    candidates = _blob_paths_matching_heuristics(tree_items)

    # Full recursive trees already include nested paths; only drill when shallow.
    tree_is_flat_recursive = any("/" in item.get("path", "") for item in tree_items)

    if not tree_is_flat_recursive and len(candidates) < MAX_SOURCE_FILES:
        for item in tree_items:
            path = item.get("path", "")
            if item.get("type") != "tree" or path not in ("src", "lib"):
                continue
            subtree = await _list_tree_items(client, owner, repo, item["sha"])
            for child_path in _blob_paths_matching_heuristics(
                [
                    {
                        "type": "blob",
                        "path": f"{path}/{child['path']}",
                    }
                    for child in subtree
                    if child.get("type") == "blob"
                ]
            ):
                candidates.append(child_path)

    seen: set[str] = set()
    unique: list[str] = []
    for path in sorted(candidates, key=_pattern_priority):
        if path not in seen:
            seen.add(path)
            unique.append(path)

    if len(unique) > MAX_SOURCE_FILES:
        return unique[:MAX_SOURCE_FILES]
    return unique


async def _fetch_file_content(
    client: httpx.AsyncClient, owner: str, repo: str, path: str
) -> str | None:
    data = await _get_json(
        client,
        f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
        not_found_ok=True,
    )
    if not data or not data.get("content"):
        return None
    return _decode_base64_content(data["content"])


async def _fetch_source_files(
    client: httpx.AsyncClient, owner: str, repo: str
) -> list[SourceFile]:
    paths = await _collect_source_paths(client, owner, repo)
    source_files: list[SourceFile] = []

    for path in paths:
        content = await _fetch_file_content(client, owner, repo, path)
        if content is None:
            continue
        source_files.append(
            {
                "path": path,
                "content": _truncate(content, SOURCE_FILE_MAX_CHARS),
            }
        )
        if len(source_files) >= MAX_SOURCE_FILES:
            break

    return source_files


async def fetch_repo_data(owner: str, repo: str) -> RepoData:
    """Fetch repo metadata, README, dependency file, and key source files from GitHub."""
    async with httpx.AsyncClient(follow_redirects=True) as client:
        metadata = await _fetch_metadata(client, owner, repo)
        readme = await _fetch_readme(client, owner, repo)
        dependency_file = await _fetch_dependency_file(client, owner, repo)
        source_files = await _fetch_source_files(client, owner, repo)

    dep_chars = len(dependency_file["content"]) if dependency_file else 0
    source_chars = sum(len(item["content"]) for item in source_files)
    total_chars = len(readme) + dep_chars + source_chars

    logger.info(
        "repo_reader.fetched",
        owner=owner,
        repo=repo,
        source_file_count=len(source_files),
        total_chars=total_chars,
    )

    return {
        "metadata": metadata,
        "readme": readme,
        "dependency_file": dependency_file,
        "source_files": source_files,
    }
