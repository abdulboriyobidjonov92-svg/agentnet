"""
AgentNet — umumiy LLM yordamchisi.
Barcha aqlli modullar (life_twin, goal_engine, fusion, ethics, supermode,
automation_planner) bitta naqshda ishlaydi: LLM-first, API kaliti bo'lmasa None
qaytadi va chaqiruvchi modul o'zining heuristik fallback'ini ishlatadi.

UCH PROVAYDER (bitta chokepoint — `llm_json`):
  - OPENROUTER_API_KEY bo'lsa → OpenRouter (ustuvor).
  - aks holda ANTHROPIC_API_KEY bo'lsa → Claude.
  - hech biri bo'lmasa → None (skriptli fallback).

GEMINI_API_KEY bu chokepoint'da ENDI ISHLATILMAYDI — u faqat
`computer_use_planner.py`dagi skrinshot-vision yo'lida (`gemini_client()`/
`gemini_types()` orqali) alohida ishlatiladi, chunki hozircha boshqa
provayderlar uchun vision yo'li yozilmagan. Shu sababli Gemini SDK
ishga tushirish kodi pastda saqlanadi.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx

# --- Provayderni import vaqtida bir marta tanlaymiz ---
_PROVIDER: str | None = None
_anthropic = None
_gemini = None
_gemini_types = None

DEFAULT_MODEL = "claude-sonnet-5"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if OPENROUTER_API_KEY:
    _PROVIDER = "openrouter"

if _PROVIDER is None and os.getenv("ANTHROPIC_API_KEY"):
    try:
        from anthropic import AsyncAnthropic

        _anthropic = AsyncAnthropic()  # ANTHROPIC_API_KEY env'dan
        _PROVIDER = "anthropic"
    except Exception:
        _PROVIDER = None

# Gemini SDK — chokepoint ustuvorligidan TASHQARI, faqat vision uchun
# (computer_use_planner). `_PROVIDER` shu tekshiruv orqali o'rnatilmaydi.
if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
    try:
        from google import genai
        from google.genai import types as _types

        _gemini = genai.Client(api_key=os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
        _gemini_types = _types
    except Exception:
        _gemini = None
        _gemini_types = None


def active_provider() -> str | None:
    """Joriy LLM provayderi (diagnostika/tekshiruv uchun): 'openrouter'|'anthropic'|None.
    Gemini bu yerga KIRMAYDI — u endi faqat vision uchun (`gemini_client()`),
    umumiy matn-JSON ustuvorlik zanjirining bir qismi emas."""
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
    if _PROVIDER == "openrouter":
        return await _openrouter_json(system, user_content, max_tokens)
    if _PROVIDER == "anthropic":
        return await _anthropic_json(system, user_content, max_tokens, model)
    return None


async def _openrouter_json(system: str, user_content: str, max_tokens: int) -> dict[str, Any] | None:
    # OpenRouter — OpenAI-mos REST API (`response_format: json_object`
    # so'ralgan modelga bog'liq holda toza JSON qaytaradi, `extract_json`
    # baribir zaxira sifatida qoladi, xuddi boshqa ikki provayderdagidek).
    if not OPENROUTER_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
                json={
                    "model": OPENROUTER_MODEL,
                    "max_tokens": max_tokens,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user_content},
                    ],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            raw = (data["choices"][0]["message"]["content"] or "").strip()
            return extract_json(raw)
    except Exception:
        return None


async def _anthropic_json(system: str, user_content: str, max_tokens: int, model: str) -> dict[str, Any] | None:
    # `_PROVIDER == "anthropic"` bo'lsa `_anthropic` albatta o'rnatilgan, lekin bu
    # invariant FUNKSIYALAR ORASIDA — mypy uni ko'ra olmaydi (`Any | None`).
    # `type: ignore` o'rniga HAQIQIY qorovul: modulning e'lon qilingan shartnomasi
    # ("kalit yo'q -> None") shundoq ham aynan shuni talab qiladi.
    if _anthropic is None:
        return None
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
    # `_anthropic_json` dagi bilan bir xil sabab. Bu yerda IKKALA global ham
    # kerak: `_gemini` (client) va `_gemini_types` (config klassi) — ikkalasi
    # ham AYNAN bitta `try` blokida birga o'rnatiladi.
    if _gemini is None or _gemini_types is None:
        return None
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
