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

# Important file names to pick when drilling into package subdirs
IMPORTANT_FILENAMES = (
    "__init__.py",
    "api.py",
    "main.py",
    "core.py",
    "models.py",
    "client.py",
    "server.py",
    "app.py",
    "router.py",
    "index.ts",
    "index.js",
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


async def _list_contents(
    client: httpx.AsyncClient, owner: str, repo: str, path: str = ""
) -> list[dict[str, Any]]:
    """List contents of a directory using the contents API (more reliable than git/trees)."""
    url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}"
    data = await _get_json(client, url, not_found_ok=True)
    if not data or not isinstance(data, list):
        return []
    return data


async def _collect_source_paths(
    client: httpx.AsyncClient, owner: str, repo: str
) -> list[str]:
    # Use contents API — more reliable than git/trees/HEAD across repos
    root_items = await _list_contents(client, owner, repo)
    candidates: list[str] = []

    # Match root-level files against heuristics
    for item in root_items:
        if item.get("type") == "file" and _matches_source_heuristic(item.get("name", "")):
            candidates.append(item["name"])

    # Drill into src/ and lib/
    for item in root_items:
        if item.get("type") != "dir" or item.get("name") not in ("src", "lib"):
            continue
        sub_items = await _list_contents(client, owner, repo, item["name"])
        for sub in sub_items:
            sub_path = f"{item['name']}/{sub['name']}"
            if sub.get("type") == "file" and _matches_source_heuristic(sub_path):
                candidates.append(sub_path)
            elif sub.get("type") == "dir":
                # Go one level deeper (e.g. src/requests/*.py)
                deep_items = await _list_contents(client, owner, repo, sub_path)
                for deep in deep_items:
                    if deep.get("type") == "file" and deep.get("name") in IMPORTANT_FILENAMES:
                        candidates.append(f"{sub_path}/{deep['name']}")

    seen: set[str] = set()
    unique: list[str] = []
    for path in sorted(candidates, key=lambda p: (
        # prefer shallower paths and important filenames
        p.count("/"),
        next((i for i, f in enumerate(IMPORTANT_FILENAMES) if p.endswith(f)), 99),
        p,
    )):
        if path not in seen:
            seen.add(path)
            unique.append(path)

    return unique[:MAX_SOURCE_FILES]


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
