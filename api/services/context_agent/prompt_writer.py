"""STEP 4 of the context agent pipeline — generate the rebuild prompt."""

from __future__ import annotations

from typing import Any

import structlog

from services.context_agent.llm import MODEL_QUALITY, chat_completion
from services.context_agent.prompts import REBUILD_PROMPT_WRITER_PROMPT

logger = structlog.get_logger(__name__)


def _build_rebuild_user_message(
    repo_data: dict[str, Any],
    abstraction: str,
    patterns: list[str],
) -> str:
    metadata = repo_data["metadata"]
    language = metadata.get("language") or "unknown"
    topics = metadata.get("topics") or []
    stars = metadata.get("stars", 0)
    topics_text = ", ".join(topics) if topics else "(none)"

    patterns_text = "\n".join(f"- {pattern}" for pattern in patterns) if patterns else "(none)"

    sections = [
        f"## Core abstraction\n{abstraction}",
        f"## Architecture patterns\n{patterns_text}",
        "## Metadata",
        f"Language: {language}",
        f"Topics: {topics_text}",
        f"Stars: {stars}",
    ]

    dep = repo_data.get("dependency_file")
    if dep:
        sections.append(f"## Dependencies ({dep['name']})\n{dep['content']}")
    else:
        sections.append("## Dependencies\n(none)")

    source_sections: list[str] = ["## Source files"]
    for source_file in repo_data.get("source_files") or []:
        path = source_file["path"]
        excerpt = (source_file.get("content") or "")[:500]
        source_sections.append(f"### {path}\n{excerpt}")
    if len(source_sections) == 1:
        source_sections.append("(none)")
    sections.append("\n".join(source_sections))

    return "\n\n".join(sections)


async def generate_rebuild_prompt(
    repo_data: dict[str, Any],
    abstraction: str,
    patterns: list[str],
) -> tuple[str, int]:
    repo_name = repo_data["metadata"]["name"]
    system = REBUILD_PROMPT_WRITER_PROMPT.format(repo_name=repo_name)
    user_message = _build_rebuild_user_message(repo_data, abstraction, patterns)
    input_chars = len(user_message)

    result, tokens_used = await chat_completion(
        model=MODEL_QUALITY,
        system=system,
        user_message=user_message,
        max_tokens=1500,
    )

    logger.info(
        "prompt_writer.rebuild_prompt",
        repo_name=repo_name,
        input_chars=input_chars,
        output_chars=len(result),
        tokens_used=tokens_used,
    )
    return result, tokens_used
