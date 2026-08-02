"""
AgentNet — umumiy LLM yordamchisi.
Barcha aqlli modullar (life_twin, goal_engine, fusion, ethics, supermode,
automation_planner) bitta naqshda ishlaydi: LLM-first, API kaliti bo'lmasa None
qaytadi va chaqiruvchi modul o'zining heuristik fallback'ini ishlatadi.

IKKI PROVAYDER (bitta chokepoint — `llm_json`):
  - ANTHROPIC_API_KEY bo'lsa → Claude (ustuvor).
  - aks holda GEMINI_API_KEY / GOOGLE_API_KEY bo'lsa → Google Gemini.
  - hech biri bo'lmasa → None (skriptli fallback).
Anthropic keyin qo'shilsa, o'zi ustuvor bo'ladi — kodni o'zgartirish shart emas.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

# --- Provayderni import vaqtida bir marta tanlaymiz ---
_PROVIDER: str | None = None
_anthropic = None
_gemini = None
_gemini_types = None

DEFAULT_MODEL = "claude-sonnet-5"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

if os.getenv("ANTHROPIC_API_KEY"):
    try:
        from anthropic import AsyncAnthropic

        _anthropic = AsyncAnthropic()  # ANTHROPIC_API_KEY env'dan
        _PROVIDER = "anthropic"
    except Exception:
        _PROVIDER = None

if _PROVIDER is None and (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")):
    try:
        from google import genai
        from google.genai import types as _types

        _gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
        _gemini_types = _types
        _PROVIDER = "gemini"
    except Exception:
        _PROVIDER = None


def active_provider() -> str | None:
    """Joriy LLM provayderi (diagnostika/tekshiruv uchun): 'anthropic'|'gemini'|None."""
    return _PROVIDER


def gemini_client():
    """Joriy Gemini client (yoki None). Vision kabi to'g'ridan-to'g'ri SDK
    chaqiruvi kerak bo'lgan modullar (masalan computer_use_planner) shu orqali
    o'qiydi — modul-xususiy `_gemini` o'zgaruvchisini to'g'ridan-to'g'ri import
    qilish o'rniga (boshqa faylning xususiy holatiga bevosita tegish)."""
    return _gemini


def gemini_types():
    """`google.genai.types` moduli (yoki None) — yuqoridagi bilan bir xil sabab."""
    return _gemini_types


async def llm_json(
    system: str,
    user_content: str,
    *,
    max_tokens: int = 1500,
    model: str = DEFAULT_MODEL,
) -> dict[str, Any] | None:
    """LLM'dan qat'iy JSON javob oladi. Kalit yo'q / xato bo'lsa None."""
    if _PROVIDER == "anthropic":
        return await _anthropic_json(system, user_content, max_tokens, model)
    if _PROVIDER == "gemini":
        return await _gemini_json(system, user_content, max_tokens)
    return None


async def _anthropic_json(system: str, user_content: str, max_tokens: int, model: str) -> dict[str, Any] | None:
    try:
        response = await _anthropic.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_content}],
            # Sonnet 5'da `thinking` berilmasa adaptiv fikrlash SUKUT BO'YICHA yoqiladi
            # (Sonnet 4.6'da o'chiq edi) — har chaqiruvda qo'shimcha token sarflaydi va
            # past max_tokens'da JSON javobni kesib qo'yishi mumkin. Xulqni bir xil
            # saqlash uchun ochiq o'chiramiz (extra_body — eski SDK 0.43 ham qo'llaydi).
            extra_body={"thinking": {"type": "disabled"}},
        )
        raw = getattr(response.content[0], "text", "").strip()
        return extract_json(raw)
    except Exception:
        return None


async def _gemini_json(system: str, user_content: str, max_tokens: int) -> dict[str, Any] | None:
    try:
        # response_mime_type=application/json → model TOZA JSON qaytaradi (regex
        # zaxira sifatida qoladi). system_instruction Anthropic'dagi `system` roli.
        response = await _gemini.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_content,
            config=_gemini_types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=max_tokens,
                response_mime_type="application/json",
            ),
        )
        raw = (getattr(response, "text", "") or "").strip()
        return extract_json(raw)
    except Exception:
        return None


def extract_json(raw: str) -> dict[str, Any] | None:
    """Xom LLM javobidan birinchi JSON obyektni ajratib oladi. Public — boshqa
    modullar (masalan computer_use_planner) o'z LLM chaqiruvlarida qayta
    ishlatishi mumkin, shuning uchun underscore-prefiks yo'q."""
    if not raw:
        return None
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


LANG_NAMES = {"en": "English", "ru": "Russian", "uz": "Uzbek"}


def lang_instruction(language: str) -> str:
    return f"Write all human-readable text in {LANG_NAMES.get(language, 'English')}."
