"""
AgentNet — Agent Composer (Y9: "Bir klik bilan agent yaratish")
----------------------------------------------------------------
Platformaning eng katta ustunligi: foydalanuvchi TABIIY TILDA (yoki ovoz →
matn) nima kerakligini yozadi — tizim bitta tayyor, moslashtirilgan agentni
taklif qiladi (nom, system-prompt, kerakli tool'lar, domain, murakkablik).
Hech qanday texnik sozlash (API, kod, JSON) talab qilinmaydi.

Ikki qatlam (kod bazasidagi umumiy naqsh):
  1. LLM-first — Claude foydalanuvchi so'roviga aynan mos agent quradi.
  2. Heuristik fallback — API kaliti bo'lmasa role_detection'dagi 16 domenli
     taksonomiyadan eng mos tavsiya-agent olinadi (demo rejimda ham ishlaydi).

Bu MODUL agentni YARATMAYDI — faqat TAKLIF qaytaradi. NestJS narxni qo'shadi,
foydalanuvchi tasdiqlagach mavjud POST /api/agents orqali yaratiladi.
"""

from __future__ import annotations

from typing import Any

from llm_utils import lang_instruction, llm_json
from role_detection import DOMAINS, detect_role

# Ruxsat etilgan tool'lar (main.py'da registratsiya qilinganlar) va qisqa maqsadi.
TOOL_PURPOSE: dict[str, str] = {
    "knowledge.search": "live web/news/reference lookup with attribution",
    "utility.weather": "current weather for a city",
    "finance.currency_rates": "live currency exchange rates",
    "finance.get_transactions": "read the user's financial transactions",
    "calendar.get_events": "read the user's calendar/schedule",
    "messaging.telegram_send": "send a Telegram message on the user's behalf",
    "health.symptom_check": "non-diagnostic symptom reference",
    "health.calorie_estimate": "estimate calories/nutrition of food",
    "islam.prayer_times": "daily prayer times for a city",
    "islam.quran_surah": "fetch a Quran surah with translation",
    "web.automate": "operate a real browser (open sites, read data, fill forms)",
    "connector.invoke": "call a connected external service (CRM, shop, SMS...)",
}
ALLOWED_TOOLS = list(TOOL_PURPOSE.keys())

DOMAIN_SLUGS = list(DOMAINS.keys())
# Vertical compliance pack'lar (streaming.py system_addendum ular bilan ishlaydi)
VERTICALS = {"healthcare", "finance", "government", "legal", "retail", "trade"}
# Domain → vertical (compliance-sezgir sohalar)
_DOMAIN_TO_VERTICAL = {
    "healthcare": "healthcare",
    "finance": "finance",
    "government": "government",
    "law": "legal",
    "retail": "retail",
}

_TOOLS_HELP = "\n".join(f"  - {tid}: {purpose}" for tid, purpose in TOOL_PURPOSE.items())

_COMPOSE_SYSTEM = f"""\
You are the Agent Composer of AgentNet. A non-technical user describes, in plain
language (Uzbek, Russian, English or mixed), what they want an AI assistant to do.
Produce exactly ONE ready-to-use agent tailored to THAT request.

Available tools (choose only ids that genuinely help this task — 0 to 4 of them):
{_TOOLS_HELP}

Domain slugs (pick the single best fit): {", ".join(DOMAIN_SLUGS)}
Compliance verticals (pick one only if the task is safety/legally sensitive,
else null): healthcare, finance, government, legal, retail, trade

Rules:
- "name": short, human, in the user's language (e.g. "Do'kon hisobchisi").
- "system_prompt": a focused, production-quality system prompt for THIS specific
  task — concrete about what the agent does and its limits. It MUST end with the
  sentence: "Always reply in the language the user writes in."
- "tools": array of tool ids from the list above (only genuinely useful ones).
- "domain": one slug. "vertical": one vertical or null.
- "complexity": integer 1-5 (1 = simple Q&A, 3 = a couple of tools + light
  analysis, 5 = multi-tool autonomous with prediction/decisions).
- "reasoning": ONE sentence, in the user's language, why this agent fits.

Reply with ONLY this JSON, nothing else:
{{"name": "...", "system_prompt": "...", "tools": ["..."], "domain": "...",
  "vertical": null, "complexity": 3, "reasoning": "..."}}
"""


def _clamp_complexity(v: Any) -> int:
    try:
        return max(1, min(5, int(v)))
    except (TypeError, ValueError):
        return 3


def _clean_tools(tools: Any) -> list[str]:
    """Faqat ruxsat etilgan tool id'larini saqlaydi, takrorlarni olib tashlaydi (maks 4)."""
    if not isinstance(tools, list):
        return []
    seen: list[str] = []
    for t in tools:
        tid = t.get("tool_id") if isinstance(t, dict) else t
        if isinstance(tid, str) and tid in TOOL_PURPOSE and tid not in seen:
            seen.append(tid)
    return seen[:4]


def _ensure_lang_clause(prompt: str) -> str:
    clause = "Always reply in the language the user writes in."
    return prompt if clause.lower() in prompt.lower() else f"{prompt.strip()} {clause}"


def _normalize(parsed: dict[str, Any], method: str, matched: str | None) -> dict[str, Any]:
    domain = parsed.get("domain")
    if domain not in DOMAINS:
        domain = "general"
    vertical = parsed.get("vertical")
    if vertical not in VERTICALS:
        vertical = _DOMAIN_TO_VERTICAL.get(domain)  # domendan xulosa (yoki None)
    tools = _clean_tools(parsed.get("tools"))
    name = str(parsed.get("name") or "").strip()[:100] or "AI yordamchi"
    system_prompt = _ensure_lang_clause(str(parsed.get("system_prompt") or "").strip())

    return {
        "name": name,
        "system_prompt": system_prompt,
        "model": "claude-sonnet-4-6",
        "tools": [{"tool_id": t, "config": {}} for t in tools],
        "domain": domain,
        "vertical": vertical,
        "complexity": _clamp_complexity(parsed.get("complexity")),
        "reasoning": str(parsed.get("reasoning") or "").strip(),
        "method": method,
        "matched": matched,  # "custom_llm" | "domain_template" | None
    }


async def _fallback(description: str, language: str) -> dict[str, Any]:
    """API kaliti yo'q: role_detection'dan mos domain-tavsiya agentini olamiz."""
    role = await detect_role(description, language)
    domain = role.get("domain", "general")
    recommended = role.get("recommended_agents") or []

    if recommended:
        a = recommended[0]  # eng mos tavsiya agent
        tools = [t.get("tool_id") for t in (a.get("tools") or [])]
        parsed = {
            "name": _localized(a.get("name"), language),
            "system_prompt": a.get("system_prompt", ""),
            "tools": [t for t in tools if isinstance(t, str)],
            "domain": domain,
            "vertical": _DOMAIN_TO_VERTICAL.get(domain),
            # murakkablik ~ tool soniga bog'liq (heuristik)
            "complexity": 1 + min(3, len(tools)),
            "reasoning": role.get("reasoning", ""),
        }
        return _normalize(parsed, method="heuristic", matched="domain_template")

    # Umuman moslik yo'q — umumiy shaxsiy assistent
    return _normalize(
        {
            "name": "AI yordamchi",
            "system_prompt": (
                "You are a helpful, general-purpose AI assistant. Understand the user's goal "
                "and help with tasks, drafting, planning and answering questions."
            ),
            "tools": ["knowledge.search"],
            "domain": "general",
            "vertical": None,
            "complexity": 2,
            "reasoning": role.get("reasoning", ""),
        },
        method="heuristic",
        matched=None,
    )


def _localized(val: Any, language: str) -> str:
    """role_detection nomlari {en,ru,uz} dict — tilga qarab tanlaymiz."""
    if isinstance(val, dict):
        return str(val.get(language) or val.get("en") or next(iter(val.values()), ""))
    return str(val or "")


async def compose(description: str, language: str = "en", profession: str = "") -> dict[str, Any]:
    """Tabiiy til tavsifidan bitta tayyor agent taklifini quradi."""
    parsed = await llm_json(
        _COMPOSE_SYSTEM + "\n" + lang_instruction(language),
        f"USER REQUEST: {description}\n"
        f"USER PROFESSION (context, may be empty): {profession or 'unknown'}",
        max_tokens=1000,
    )
    if parsed is not None and parsed.get("system_prompt"):
        return _normalize(parsed, method="llm", matched="custom_llm")
    return await _fallback(description, language)
