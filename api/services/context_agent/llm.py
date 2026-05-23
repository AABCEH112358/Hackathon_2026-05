"""OpenAI client and chat helpers for the context agent pipeline."""

from __future__ import annotations

from typing import Any

from openai import APIStatusError, AsyncOpenAI, RateLimitError
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from config import get_settings

MODEL_FAST = "gpt-4o-mini"
MODEL_QUALITY = "gpt-4o"

_settings = get_settings()
_client = AsyncOpenAI(api_key=_settings.openai_api_key)


def _should_retry(exc: BaseException) -> bool:
    if isinstance(exc, RateLimitError):
        return True
    if isinstance(exc, APIStatusError):
        return exc.status_code >= 500
    return False


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(3),
    retry=retry_if_exception(_should_retry),
    reraise=True,
)
async def chat_completion(
    *,
    model: str,
    system: str,
    user_message: str,
    max_tokens: int,
) -> str:
    response = await _client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ],
    )
    content = response.choices[0].message.content
    return (content or "").strip()
