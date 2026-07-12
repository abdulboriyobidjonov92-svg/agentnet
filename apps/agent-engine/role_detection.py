"""
AgentNet — Role Detection & Adaptive Profiling
------------------------------------------------
Foydalanuvchi onboarding'da o'zi haqida erkin matnda yozadi
("Men Samarqandda kardiologman", "I run a small grocery store" ...).
Bu modul:
  1. Matndan kasb/soha (domain) ni aniqlaydi — LLM-first, keyword fallback
     (demo rejimda ham to'liq ishlaydi)
  2. Aniqlangan domain uchun tavsiya agentlar, dashboard vidjetlari va
     tezkor amallarni qaytaradi

MUHIM: kirish matni endpoint darajasida Halal Filter'dan o'tadi (main.py).
Domain — yopiq dropdown EMAS: taksonomiya faqat moslashuvchi "profil"
manbai; noma'lum kasblar "general" profilga tushadi, professionTitle esa
har doim foydalanuvchining o'z so'zi bo'yicha saqlanadi.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from anthropic import AsyncAnthropic

from role_domains import DOMAINS

_client = AsyncAnthropic()  # ANTHROPIC_API_KEY env'dan; yo'q bo'lsa fallback ishlaydi

Lang = str  # "en" | "ru" | "uz"


# ------------------------------------------------------------------
# Domain taksonomiyasi endi role_domains/ paketida — har bir domain
# (nom, keyword'lar, tavsiya agentlar, vidjetlar, tezkor amallar) o'z
# faylida. Bu yerda faqat aniqlash mantig'i qoladi.
# ------------------------------------------------------------------


# ------------------------------------------------------------------
# Aniqlash natijasi
# ------------------------------------------------------------------


@dataclass
class RoleProfile:
    profession_title: str
    domain: str
    confidence: float
    reasoning: str
    goals: list[str] = field(default_factory=list)
    method: str = "keyword"  # "llm" | "keyword"

    def to_response(self, language: Lang = "en") -> dict[str, Any]:
        domain_cfg = DOMAINS.get(self.domain, DOMAINS["general"])
        return {
            "profession_title": self.profession_title,
            "domain": self.domain,
            "domain_label": domain_cfg["label"],
            "confidence": round(self.confidence, 2),
            "reasoning": self.reasoning,
            "goals": self.goals,
            "method": self.method,
            "recommended_agents": [
                {
                    "name": a["name"],
                    "description": a["description"],
                    "system_prompt": a["system_prompt"],
                    "tools": [{"tool_id": t, "config": {}} for t in a["tools"]],
                }
                for a in domain_cfg["agents"]
            ],
            "dashboard": {
                "widgets": domain_cfg["widgets"],
                "quick_actions": domain_cfg["quick_actions"],
            },
        }


# ------------------------------------------------------------------
# 1-usul: LLM (Claude) orqali aniqlash — API kaliti bo'lsa
# ------------------------------------------------------------------

_LLM_SYSTEM = """\
You are the role-detection component of AgentNet, an adaptive AI platform.
The user describes themselves and their goals in free text (any language:
Uzbek, Russian, English, or mixed). Infer their profession and map it to
exactly one domain slug from this list:

healthcare, law, government, education, agriculture, retail, finance, tech,
construction, transport, food_service, industry, religion, media, sports, general

Rules:
- "profession_title" is the user's role in THEIR OWN words/language, cleaned up
  (e.g. "kardiolog", "владелец магазина", "farmer"). Never translate it.
- If no domain clearly fits, use "general" — never force a wrong fit.
- "goals": up to 4 short goal phrases extracted from the text, in the user's language.
- "confidence": 0.0-1.0.
- Reply with ONLY this JSON, no other text:
{"profession_title": "...", "domain": "...", "confidence": 0.0,
 "reasoning": "one sentence, in the user's language", "goals": ["..."]}
"""


async def _detect_with_llm(text: str) -> RoleProfile | None:
    try:
        response = await _client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=400,
            system=_LLM_SYSTEM,
            messages=[{"role": "user", "content": text}],
        )
        raw = response.content[0].text.strip()
        # JSON'ni ajratib olish (LLM ba'zan atrofga matn qo'shishi mumkin)
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            return None
        parsed = json.loads(m.group(0))
        domain = parsed.get("domain", "general")
        if domain not in DOMAINS:
            domain = "general"
        return RoleProfile(
            profession_title=str(parsed.get("profession_title", "")).strip() or "—",
            domain=domain,
            confidence=max(0.0, min(1.0, float(parsed.get("confidence", 0.5)))),
            reasoning=str(parsed.get("reasoning", "")),
            goals=[str(g) for g in (parsed.get("goals") or [])][:4],
            method="llm",
        )
    except Exception:
        return None


# ------------------------------------------------------------------
# 2-usul: Keyword fallback — API kalitisiz (demo rejim) ham ishlaydi
# ------------------------------------------------------------------

_REASONING_BY_LANG = {
    "en": "Detected from keywords in your description (offline mode).",
    "ru": "Определено по ключевым словам в вашем описании (офлайн-режим).",
    "uz": "Tavsifingizdagi kalit so'zlar orqali aniqlandi (oflayn rejim).",
}

_UNKNOWN_TITLE = {"en": "Not specified", "ru": "Не указано", "uz": "Ko'rsatilmagan"}


def _detect_with_keywords(text: str, language: Lang) -> RoleProfile:
    lower = text.lower()
    scores: dict[str, int] = {}
    matched: dict[str, list[str]] = {}

    for slug, cfg in DOMAINS.items():
        hits = [kw for kw in cfg["keywords"] if kw in lower]
        if hits:
            scores[slug] = len(hits)
            matched[slug] = hits

    if not scores:
        return RoleProfile(
            profession_title=_UNKNOWN_TITLE.get(language, _UNKNOWN_TITLE["en"]),
            domain="general",
            confidence=0.3,
            reasoning=_REASONING_BY_LANG.get(language, _REASONING_BY_LANG["en"]),
            method="keyword",
        )

    best = max(scores, key=lambda s: scores[s])
    # Ishonch: nechta keyword mos kelganiga qarab 0.5–0.85 oralig'ida
    confidence = min(0.85, 0.5 + 0.1 * scores[best])

    # Kasb nomi: foydalanuvchi matnidan mos kelgan eng uzun keyword atrofidagi so'z
    title = _extract_title(text, matched[best]) or _UNKNOWN_TITLE.get(language, "—")

    return RoleProfile(
        profession_title=title,
        domain=best,
        confidence=confidence,
        reasoning=_REASONING_BY_LANG.get(language, _REASONING_BY_LANG["en"]),
        method="keyword",
    )


def _extract_title(text: str, hits: list[str]) -> str | None:
    """Mos kelgan keyword joylashgan asl matn bo'lagini kasb nomi sifatida oladi.

    Keyword ro'yxatlarida kasb-otlari (doctor, fermer...) faoliyat so'zlaridan
    (inventory, sales...) oldin turadi — shuning uchun birinchi moslik olinadi.
    """
    m = re.search(re.escape(hits[0]) + r"[\w'’]*", text, re.IGNORECASE)
    return m.group(0) if m else None


# ------------------------------------------------------------------
# Umumiy kirish nuqtasi
# ------------------------------------------------------------------


async def detect_role(text: str, language: Lang = "en") -> dict[str, Any]:
    """Erkin matndan kasb-profilni aniqlaydi. LLM-first, keyword fallback."""
    profile = await _detect_with_llm(text)
    if profile is None:
        profile = _detect_with_keywords(text, language)
    return profile.to_response(language)


def domains_summary() -> list[dict[str, Any]]:
    return [
        {
            "slug": slug,
            "label": cfg["label"],
            "agent_count": len(cfg["agents"]),
            "widgets": cfg["widgets"],
        }
        for slug, cfg in DOMAINS.items()
    ]


def domain_profile(slug: str, language: Lang = "en") -> dict[str, Any]:
    """Saqlangan domain bo'yicha tavsiyalarni qayta olish (onboarding'siz)."""
    if slug not in DOMAINS:
        slug = "general"
    return RoleProfile(
        profession_title="",
        domain=slug,
        confidence=1.0,
        reasoning="stored profile",
        method="stored",
    ).to_response(language)
