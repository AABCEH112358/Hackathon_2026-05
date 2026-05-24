"""STEP 2–3 of the context agent pipeline — LLM analysis of repo data."""

from __future__ import annotations

from typing import Any

import structlog

from services.context_agent.llm import MODEL_FAST, chat_completion
from services.context_agent.prompts import (
    ARCHITECTURE_PATTERNS_PROMPT,
    CORE_ABSTRACTION_PROMPT,
    WHY_CONTRIBUTE_PROMPT,
)

logger = structlog.get_logger(__name__)


def _dependency_section(repo_data: dict[str, Any]) -> str:
    dep = repo_data.get("dependency_file")
    if not dep:
        return "## Dependencies\n(none)"
    return f"## Dependencies ({dep['name']})\n{dep['content']}"


def _build_core_abstraction_user_message(repo_data: dict[str, Any]) -> str:
    readme = (repo_data.get("readme") or "")[:2000]
    paths = [f["path"] for f in repo_data.get("source_files") or []]
    paths_text = "\n".join(paths) if paths else "(none)"
    return "\n\n".join(
        [
            f"## README\n{readme}",
            f"## Source files\n{paths_text}",
            _dependency_section(repo_data),
        ]
    )


def _build_architecture_user_message(repo_data: dict[str, Any]) -> str:
    sections: list[str] = []
    for source_file in repo_data.get("source_files") or []:
        path = source_file["path"]
        excerpt = (source_file.get("content") or "")[:1000]
        sections.append(f"### {path}\n{excerpt}")
    sections.append(_dependency_section(repo_data))
    return "\n\n".join(sections)


def _parse_pattern_lines(text: str) -> list[str]:
    patterns: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("- "):
            line = line[2:]
        elif line.startswith("* "):
            line = line[2:]
        patterns.append(line)
    return patterns


async def identify_core_abstraction(repo_data: dict[str, Any]) -> tuple[str, int]:
    user_message = _build_core_abstraction_user_message(repo_data)
    input_chars = len(user_message)

    result, tokens_used = await chat_completion(
        model=MODEL_FAST,
        system=CORE_ABSTRACTION_PROMPT,
        user_message=user_message,
        max_tokens=100,
    )

    logger.info(
        "analyzer.core_abstraction",
        input_chars=input_chars,
        output_chars=len(result),
        tokens_used=tokens_used,
    )
    return result, tokens_used


async def extract_architecture_patterns(repo_data: dict[str, Any]) -> tuple[list[str], int]:
    user_message = _build_architecture_user_message(repo_data)
    input_chars = len(user_message)

    text, tokens_used = await chat_completion(
        model=MODEL_FAST,
        system=ARCHITECTURE_PATTERNS_PROMPT,
        user_message=user_message,
        max_tokens=300,
    )

    result = _parse_pattern_lines(text)
    output_chars = sum(len(line) for line in result)
    logger.info(
        "analyzer.architecture_patterns",
        input_chars=input_chars,
        output_chars=output_chars,
        tokens_used=tokens_used,
    )
    return result, tokens_used


def _build_why_contribute_user_message(repo_data: dict[str, Any], abstraction: str) -> str:
    metadata = repo_data["metadata"]
    readme = (repo_data.get("readme") or "")[:2500]
    topics = metadata.get("topics") or []
    topics_text = ", ".join(topics) if topics else "(none)"
    return "\n\n".join(
        [
            f"## Core abstraction\n{abstraction}",
            "## Metadata",
            f"Name: {metadata.get('name')}",
            f"Description: {metadata.get('description') or '(none)'}",
            f"Language: {metadata.get('language') or 'unknown'}",
            f"Topics: {topics_text}",
            f"Stars: {metadata.get('stars', 0)}",
            f"License: {metadata.get('license') or 'unknown'}",
            f"## README excerpt\n{readme}",
        ]
    )


async def generate_why_contribute(
    repo_data: dict[str, Any], abstraction: str
) -> tuple[str, int]:
    user_message = _build_why_contribute_user_message(repo_data, abstraction)
    result, tokens_used = await chat_completion(
        model=MODEL_FAST,
        system=WHY_CONTRIBUTE_PROMPT,
        user_message=user_message,
        max_tokens=400,
    )
    logger.info(
        "analyzer.why_contribute",
        input_chars=len(user_message),
        output_chars=len(result),
        tokens_used=tokens_used,
    )
    return result.strip(), tokens_used
