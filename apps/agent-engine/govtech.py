"""
AgentNet — GovTech engine (S7): mahalla/tuman raqamlashtirish
--------------------------------------------------------------
Ikki qobiliyat:
  1. classify_request — fuqaro murojaatini erkin matndan tasniflab, mas'ul
     xizmatga yo'naltiradi (kategoriya, idora, ustuvorlik, qadamlar).
     LLM-first + 3 tilli keyword-fallback. Chalkash matnda ham yiqilmaydi.
  2. process_guide — ko'p bosqichli davlat jarayonlari bo'yicha navigator
     (pasport, propiska, YaTT, tug'ilganlik, pensiya...). To'liq bosqich,
     hujjat, idora/portal, muddat va (taxminiy) to'lov bilan.

HALOL CHEGARA: jonli davlat tizimlariga topshirish/holat olish uchun rasmiy
data-sharing shartnomasi va API kerak (my.gov.uz). Hozircha har javobda
live=false ko'rsatiladi; tizim ichki marshrutlangan tiket sifatida ishlaydi.
"""

from __future__ import annotations

import json
from typing import Any

from llm_utils import lang_instruction, llm_json
from govtech_services import SERVICES, URGENT_HINTS
from govtech_guides import PROCESS_GUIDES

_CLASSIFY_SYSTEM = """\
You are a citizen-request intake specialist for a district (tuman) / mahalla
digital office in Uzbekistan. You receive a citizen's request in free text
(Uzbek, Russian or English, often messy). Classify and route it.

Categories: utilities | roads | documents | social | sanitation | dispute | business | other

Reply ONLY with JSON:
{"category":"...","priority":"low|normal|high|urgent",
 "summary":"one-line neutral summary of the request",
 "service":"name of the responsible service",
 "office":"specific office/portal to route to",
 "steps":["concrete next step 1","step 2","step 3"],
 "needs_documents":["document the citizen should prepare, if any"],
 "reasoning":"why routed this way"}
"""


async def classify_request(text: str, language: str = "uz") -> dict[str, Any]:
    parsed = await llm_json(
        _CLASSIFY_SYSTEM + "\n" + lang_instruction(language),
        f"CITIZEN REQUEST: {text}",
        max_tokens=900,
    )
    if parsed and parsed.get("category") in SERVICES:
        parsed["live"] = False
        parsed["live_note"] = _live_note(language)
        parsed["method"] = "llm"
        return parsed
    return _heuristic_classify(text, language)


def _heuristic_classify(text: str, language: str) -> dict[str, Any]:
    lower = text.lower()
    lang = language if language in ("en", "ru", "uz") else "en"

    best_cat, best_hits = "other", 0
    for cat, cfg in SERVICES.items():
        hits = sum(1 for k in cfg["keywords"] if k in lower)
        if hits > best_hits:
            best_cat, best_hits = cat, hits

    cfg = SERVICES[best_cat]
    priority = "urgent" if any(h in lower for h in URGENT_HINTS) else cfg["priority"]

    steps_by_lang = {
        "en": [
            f"Request registered and routed to: {cfg['office']['en']}",
            "Operator confirms details with the citizen (phone/visit)",
            "Responsible service resolves and the status is updated here",
        ],
        "ru": [
            f"Обращение зарегистрировано и направлено: {cfg['office']['ru']}",
            "Оператор уточняет детали у гражданина",
            "Ответственная служба решает вопрос, статус обновляется здесь",
        ],
        "uz": [
            f"Murojaat ro'yxatga olindi va yo'naltirildi: {cfg['office']['uz']}",
            "Operator fuqaro bilan tafsilotlarni aniqlaydi (telefon/tashrif)",
            "Mas'ul xizmat hal qiladi, holat shu yerda yangilanadi",
        ],
    }
    return {
        "category": best_cat,
        "priority": priority,
        "summary": text.strip()[:140],
        "service": cfg["label"][lang],
        "office": cfg["office"][lang],
        "steps": steps_by_lang[lang],
        "needs_documents": [],
        "reasoning": (
            f"Keyword routing ({best_hits} match(es)) to '{best_cat}'."
            if best_hits else "No category keywords matched — routed to the general single-window desk for manual triage."
        ),
        "live": False,
        "live_note": _live_note(lang),
        "method": "heuristic",
    }


def _live_note(language: str) -> str:
    notes = {
        "en": "Internal routed ticket. Direct submission into government systems requires an official data-sharing agreement + my.gov.uz API access.",
        "ru": "Внутренний маршрутизированный тикет. Прямая подача в госсистемы требует официального соглашения об обмене данными + API my.gov.uz.",
        "uz": "Ichki marshrutlangan tiket. To'g'ridan-to'g'ri davlat tizimlariga topshirish rasmiy data-sharing shartnomasi + my.gov.uz API'sini talab qiladi.",
    }
    return notes.get(language, notes["en"])


# ------------------------------------------------------------------
# Ko'p bosqichli jarayon navigatorlari
# ------------------------------------------------------------------


_GUIDE_SYSTEM = """\
You are a government-service navigator for Uzbekistan. The user asks about a
bureaucratic process. You get a matched reference guide (steps, documents, offices).
Adapt it to the user's exact situation, answer their specific question, and keep
every claim procedural (cite the office/portal). If their situation may differ,
say what to verify. Reply ONLY with JSON:
{"title":"...","steps":["..."],"documents":["..."],"where":"...","duration":"...",
 "fee_note":"...","personalized_answer":"direct answer to their exact question",
 "verify":["thing to double-check with the office"]}
"""


async def process_guide(query: str, language: str = "uz") -> dict[str, Any]:
    lower = query.lower()
    lang = language if language in ("en", "ru", "uz") else "en"

    best_key, best_hits = None, 0
    for key, g in PROCESS_GUIDES.items():
        hits = sum(1 for k in g["keywords"] if k in lower)
        if hits > best_hits:
            best_key, best_hits = key, hits

    guide = PROCESS_GUIDES.get(best_key) if best_key else None

    parsed = await llm_json(
        _GUIDE_SYSTEM + "\n" + lang_instruction(language),
        f"USER QUESTION: {query}\n\nMATCHED REFERENCE GUIDE: "
        + (json.dumps(guide, ensure_ascii=False) if guide else "(no close match — answer from general Uzbekistan public-service procedure, conservatively)"),
        max_tokens=1200,
    )
    if parsed and parsed.get("steps"):
        parsed["matched_guide"] = best_key
        parsed["live"] = False
        parsed["live_note"] = _live_note(lang)
        parsed["method"] = "llm"
        return parsed

    if guide:
        return {
            "title": guide["label"][lang],
            "steps": guide["steps"],
            "documents": guide["documents"],
            "where": guide["where"],
            "duration": guide["duration"],
            "fee_note": guide["fee_note"],
            "personalized_answer": "",
            "verify": ["Joriy boj stavkasi va ish tartibini my.gov.uz yoki idoraning o'zida tekshiring"],
            "matched_guide": best_key,
            "live": False,
            "live_note": _live_note(lang),
            "method": "heuristic",
        }
    return {
        "title": {"en": "No matching process guide", "ru": "Подходящий процесс не найден", "uz": "Mos jarayon topilmadi"}[lang],
        "steps": [],
        "documents": [],
        "where": {"en": "District public service center (single window) can triage any request", "ru": "Центр госуслуг примет любой запрос", "uz": "Davlat xizmatlari markazi (yagona darcha) istalgan so'rovni qabul qiladi"}[lang],
        "duration": "",
        "fee_note": "",
        "personalized_answer": "",
        "verify": [],
        "matched_guide": None,
        "live": False,
        "live_note": _live_note(lang),
        "method": "heuristic",
    }


def guides_catalog(language: str = "uz") -> list[dict[str, str]]:
    lang = language if language in ("en", "ru", "uz") else "en"
    return [{"id": key, "label": g["label"][lang], "duration": g["duration"]} for key, g in PROCESS_GUIDES.items()]


def services_catalog(language: str = "uz") -> list[dict[str, str]]:
    lang = language if language in ("en", "ru", "uz") else "en"
    return [
        {"id": key, "label": cfg["label"][lang], "office": cfg["office"][lang]}
        for key, cfg in SERVICES.items()
    ]
