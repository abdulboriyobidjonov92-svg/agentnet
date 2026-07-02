"""
AgentNet — umumiy LLM yordamchisi.
Barcha aqlli modullar (life_twin, goal_engine, fusion, ethics, supermode)
bitta naqshda ishlaydi: LLM-first, API kaliti bo'lmasa None qaytadi va
chaqiruvchi modul o'zining heuristik fallback'ini ishlatadi.
"""

from __future__ import annotations

import json
import re
from typing import Any

from anthropic import AsyncAnthropic

_client = AsyncAnthropic()  # ANTHROPIC_API_KEY env'dan

DEFAULT_MODEL = "claude-sonnet-4-6"


async def llm_json(
    system: str,
    user_content: str,
    *,
    max_tokens: int = 1500,
    model: str = DEFAULT_MODEL,
) -> dict[str, Any] | None:
    """Claude'dan qat'iy JSON javob oladi. API yo'q/xato bo'lsa None."""
    try:
        response = await _client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        )
        raw = response.content[0].text.strip()
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            return None
        return json.loads(m.group(0))
    except Exception:
        return None


LANG_NAMES = {"en": "English", "ru": "Russian", "uz": "Uzbek"}


def lang_instruction(language: str) -> str:
    return f"Write all human-readable text in {LANG_NAMES.get(language, 'English')}."
