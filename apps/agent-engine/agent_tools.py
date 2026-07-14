"""
AgentNet — real-rejim (Claude) uchun tool (function-calling) registri.

Nega kerak: `streaming.py`ning HAQIQIY-API yo'li ilgari faqat matn oqimi edi —
ANTHROPIC_API_KEY qo'yilgach ham namoz-vaqti/ob-havo/valyuta/qidiruv toollari
UMUMAN ishlatilmasdi (faqat DEMO rejim keyword bilan tool chaqirardi). Endi
model haqiqatan bu jonli manbalarni chaqira oladi.

FAQAT o'qiydigan (yon-ta'sirsiz) info-toollar shu yerda: ular foydalanuvchi
konteksti/sirlarini talab qilmaydi va bepul, kalitsiz ochiq API'larga uradi.
messaging.telegram_send / connector.invoke / web.automate kabi YON-TA'SIRLI
amallar ATAYLAB bu yerda YO'Q — ular alohida, aniq-ruxsatli oqim orqali bo'ladi.
"""

from __future__ import annotations

import json
from typing import Any, Awaitable, Callable

import knowledge_sync
from tools.islam_tools import prayer_times, quran_surah
from tools.utility_tools import currency_rates, weather

# Claude tool nomi ^[a-zA-Z0-9_-]{1,64}$ ga bo'ysunadi — tool_id'dagi nuqta
# yaroqsiz, shuning uchun API nomi sifatida "_" bilan almashtiriladi va
# ijro paytida orqaga xaritalanadi.

ToolRunner = Callable[[dict[str, Any], str, str], Awaitable[dict[str, Any]]]


def _prayer(args: dict[str, Any], language: str, city: str) -> Awaitable[dict[str, Any]]:
    return prayer_times(city=args.get("city") or city or "Tashkent", country=args.get("country", "UZ"))


def _quran(args: dict[str, Any], language: str, city: str) -> Awaitable[dict[str, Any]]:
    try:
        num = int(args.get("surah_number", 1))
    except (TypeError, ValueError):
        num = 1
    return quran_surah(surah_number=max(1, min(114, num)))


def _weather(args: dict[str, Any], language: str, city: str) -> Awaitable[dict[str, Any]]:
    return weather(city=args.get("city") or city or "Tashkent")


def _currency(args: dict[str, Any], language: str, city: str) -> Awaitable[dict[str, Any]]:
    return currency_rates(base=args.get("base", "USD"), symbols=args.get("symbols", "UZS,EUR,RUB"))


def _knowledge(args: dict[str, Any], language: str, city: str) -> Awaitable[dict[str, Any]]:
    return knowledge_sync.search(str(args.get("query", "")), language=language, city=city or "Tashkent")


# tool_id -> (Claude api nomi, tavsif, input_schema, runner)
_INFO_TOOLS: dict[str, dict[str, Any]] = {
    "islam.prayer_times": {
        "api_name": "islam_prayer_times",
        "description": "Berilgan shahar uchun bugungi besh vaqt namoz vaqtlarini (Aladhan API) qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "Shahar nomi (masalan Tashkent, Samarkand)."},
                "country": {"type": "string", "description": "Davlat ISO kodi, standart UZ."},
            },
        },
        "run": _prayer,
    },
    "islam.quran_surah": {
        "api_name": "islam_quran_surah",
        "description": "Qur'on surasining birinchi oyatlarini (AlQuran.cloud) qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {"surah_number": {"type": "integer", "description": "Sura raqami 1-114."}},
            "required": ["surah_number"],
        },
        "run": _quran,
    },
    "utility.weather": {
        "api_name": "utility_weather",
        "description": "Berilgan shahar uchun joriy ob-havoni (Open-Meteo) qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {"city": {"type": "string", "description": "Shahar nomi."}},
        },
        "run": _weather,
    },
    "finance.currency_rates": {
        "api_name": "finance_currency_rates",
        "description": "Valyuta kurslarini (open.er-api.com) qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {
                "base": {"type": "string", "description": "Asos valyuta, standart USD."},
                "symbols": {"type": "string", "description": "Vergul bilan ajratilgan valyutalar, masalan UZS,EUR,RUB."},
            },
        },
        "run": _currency,
    },
    "knowledge.search": {
        "api_name": "knowledge_search",
        "description": "Jonli manbalardan (yangiliklar, Wikipedia, kurslar) qidiradi va atributsiya bilan qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Qidiruv so'rovi."}},
            "required": ["query"],
        },
        "run": _knowledge,
    },
}

_API_NAME_TO_ID = {v["api_name"]: k for k, v in _INFO_TOOLS.items()}


def build_tools(tool_ids: list[str]) -> list[dict[str, Any]]:
    """Agent tool_id'laridan Claude uchun tool-ta'riflari (faqat qo'llab-quvvatlanadigan info-toollar)."""
    defs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for tid in tool_ids:
        spec = _INFO_TOOLS.get(tid)
        if not spec or spec["api_name"] in seen:
            continue
        seen.add(spec["api_name"])
        defs.append(
            {
                "name": spec["api_name"],
                "description": spec["description"],
                "input_schema": spec["input_schema"],
            }
        )
    return defs


async def run_tool(api_name: str, args: dict[str, Any], language: str, city: str) -> dict[str, Any]:
    """Claude so'ragan toolni ijro etadi (api nomi -> tool_id -> runner)."""
    tid = _API_NAME_TO_ID.get(api_name)
    if not tid:
        return {"xato": f"Noma'lum tool: {api_name}"}
    try:
        return await _INFO_TOOLS[tid]["run"](args or {}, language, city)
    except Exception as e:  # tool ijrosi hech qachon oqimni yiqitmasin
        return {"xato": str(e)}


def to_tool_result_content(result: dict[str, Any]) -> str:
    """Tool natijasini Claude'ga qaytariladigan matn (JSON) ko'rinishiga keltiradi."""
    return json.dumps(result, ensure_ascii=False)
