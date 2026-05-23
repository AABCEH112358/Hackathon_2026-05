"""STEP 2–3 of the context agent pipeline — Claude analysis of repo data."""

from __future__ import annotations

from typing import Any

import anthropic
import structlog
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from services.context_agent.prompts import (
    ARCHITECTURE_PATTERNS_PROMPT,
    CORE_ABSTRACTION_PROMPT,
)

logger = structlog.get_logger(__name__)

MODEL = "claude-sonnet-4-5"
_client = anthropic.AsyncAnthropic()


def _should_retry(exc: BaseException) -> bool:
    if isinstance(exc, anthropic.RateLimitError):
        return True
    if isinstance(exc, anthropic.APIStatusError):
        return exc.status_code >= 500
    return False


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(3),
    retry=retry_if_exception(_should_retry),
    reraise=True,
)
async def _create_message(**kwargs: Any) -> anthropic.types.Message:
    return await _client.messages.create(**kwargs)


def _text_from_response(response: anthropic.types.Message) -> str:
    block = response.content[0]
    if not hasattr(block, "text"):
        return ""
    return block.text.strip()


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


async def identify_core_abstraction(repo_data: dict[str, Any]) -> str:
    user_message = _build_core_abstraction_user_message(repo_data)
    input_chars = len(user_message)

    response = await _create_message(
        model=MODEL,
        max_tokens=100,
        system=CORE_ABSTRACTION_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    result = _text_from_response(response)
    logger.info(
        "analyzer.core_abstraction",
        input_chars=input_chars,
        output_chars=len(result),
    )
    return result


async def extract_architecture_patterns(repo_data: dict[str, Any]) -> list[str]:
    user_message = _build_architecture_user_message(repo_data)
    input_chars = len(user_message)

    response = await _create_message(
        model=MODEL,
        max_tokens=300,
        system=ARCHITECTURE_PATTERNS_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    result = _parse_pattern_lines(_text_from_response(response))
    output_chars = sum(len(line) for line in result)
    logger.info(
        "analyzer.architecture_patterns",
        input_chars=input_chars,
        output_chars=output_chars,
    )
    return result
