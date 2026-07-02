"""
AgentNet — Life Twin (raqamli egizak)
--------------------------------------
Foydalanuvchining hayotiy faktlari (rol, moliya, sog'liq, oila, odatlar)
asosida ishlaydigan ikkita qobiliyat:

  1. extract_facts(text)  — suhbat/matndan hayotiy faktlarni ajratib olish
  2. whatif(question, facts, ...) — "agar shu qarorni qabul qilsam, 6 oydan
     keyin hayotim qanday bo'ladi?" — faktlarga ASOSLANGAN, ssenariyli
     prognoz (tayyor javob emas)

LLM-first: API kaliti bo'lsa Claude chuqur tahlil qiladi.
Fallback: faktlardagi haqiqiy raqamlar bilan parametrlangan arifmetik
prognoz — demo rejimda ham mazmunli natija.
"""

from __future__ import annotations

import re
from typing import Any

from llm_utils import lang_instruction, llm_json

# ------------------------------------------------------------------
# 1. Fakt ajratish
# ------------------------------------------------------------------

_EXTRACT_SYSTEM = """\
You are the Life Twin fact extractor for AgentNet. From the user's text,
extract durable personal facts worth remembering long-term (income, expenses,
family, health conditions, work patterns, habits, assets, debts, education).

Rules:
- Only clear, durable facts. No opinions, no one-off events, no guesses.
- category must be one of: health, finance, family, work, habits, education, other
- label: short name in the user's language; value: the fact itself.
- If there are no durable facts, return {"facts": []}.
Reply ONLY with JSON: {"facts": [{"category": "...", "label": "...", "value": "...", "confidence": 0.0}]}
"""

# Konservativ regex fallback — faqat aniq naqshlar (demo rejim)
_MONEY = r"(\d[\d\s.,]{0,12})\s*(mln|million|ming|so'm|сум|som|млн|тыс|\$|dollar|usd|евро|eur)"
_FALLBACK_PATTERNS: list[tuple[str, str, str]] = [
    # (category, label, regex)
    ("finance", "Daromad", r"(?:daromad|oylik|maosh|income|salary|зарплат|доход)[^\d]{0,20}" + _MONEY),
    ("finance", "Xarajat", r"(?:xarajat|expense|расход)[^\d]{0,20}" + _MONEY),
    ("finance", "Qarz", r"(?:qarz|debt|кредит|credit|loan)[^\d]{0,20}" + _MONEY),
    ("family", "Farzandlar", r"(\d{1,2})\s*(?:ta\s+)?(?:farzand|bola|child|children|дет)"),
    ("work", "Ish tajribasi", r"(\d{1,2})\s*(?:yil|year|лет|года)\s*(?:tajriba|experience|стаж|ishla)"),
    ("health", "Sog'liq holati", r"\b(diabet|gipertoniya|hypertension|астма|asthma|allergiya|allergy|qon bosim)\w*\b"),
]


async def extract_facts(text: str, language: str = "en") -> dict[str, Any]:
    parsed = await llm_json(
        _EXTRACT_SYSTEM + "\n" + lang_instruction(language),
        text,
        max_tokens=800,
    )
    if parsed is not None and isinstance(parsed.get("facts"), list):
        facts = [
            {
                "category": str(f.get("category", "other")),
                "label": str(f.get("label", ""))[:80],
                "value": str(f.get("value", ""))[:300],
                "confidence": max(0.0, min(1.0, float(f.get("confidence", 0.8)))),
            }
            for f in parsed["facts"]
            if f.get("label") and f.get("value")
        ]
        return {"facts": facts[:8], "method": "llm"}

    # Fallback: konservativ regexlar
    facts = []
    for category, label, pattern in _FALLBACK_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            facts.append({
                "category": category,
                "label": label,
                "value": m.group(0).strip()[:300],
                "confidence": 0.6,
            })
    return {"facts": facts, "method": "heuristic"}


# ------------------------------------------------------------------
# 2. What-if ssenariy prognozi
# ------------------------------------------------------------------

_WHATIF_SYSTEM = """\
You are the Life Twin scenario engine of AgentNet. The user asks a "what if"
question about a life/work decision. You are given their REAL life facts
(finances, family, health, work, habits) and goals.

Produce a rigorous, grounded 6-month scenario projection:
- Ground every claim in the provided facts; never invent numbers.
- Where facts contain numbers, do the arithmetic explicitly.
- Be honest about uncertainty; state assumptions.
- This is decision support, not financial/medical/legal advice — note that.

Reply ONLY with JSON:
{"summary": "...", "assumptions": ["..."],
 "timeline": [{"period": "1 oy / 1 month ...", "projection": "..."}],
 "risks": ["..."], "opportunities": ["..."],
 "recommendation": "...", "confidence": 0.0,
 "used_facts": ["label: value", "..."]}
Timeline must have 3 entries (≈1 month, 3 months, 6 months).
"""

_DECISION_TYPES: dict[str, list[str]] = {
    "purchase": ["sotib ol", "buy", "purchase", "куп", "olsam", "olmoqchi"],
    "career": ["ishdan", "quit", "job", "ishga", "career", "рабо", "lavozim"],
    "business": ["biznes", "business", "do'kon och", "startup", "kengaytir", "expand"],
    "study": ["o'qi", "study", "kurs", "course", "учи", "universitet"],
    "move": ["ko'chib", "move", "переех", "boshqa shahar"],
    "invest": ["invest", "sarmoya", "инвест", "omonat"],
}

_HEURISTIC_TEXT = {
    "en": {
        "summary": "Projection based on your stored Life Twin facts (offline mode — approximate arithmetic, no AI reasoning).",
        "no_facts": "Your Life Twin has few facts so far — add income, expenses and family facts for a sharper projection.",
        "assume": "Your current facts stay stable over the period",
        "m1": "Month 1", "m3": "Month 3", "m6": "Month 6",
        "risk_generic": "Unplanned expenses or income interruptions would tighten the plan",
        "opp_generic": "Reviewing recurring expenses could free additional margin",
        "rec": "Decide only after checking the 6-month cash effect below against your obligations. This is decision support, not professional advice.",
        "cost_note": "estimated decision cost found in your question",
        "income_note": "monthly income on file",
        "cash6": "Approximate 6-month cash effect",
        "committed": "~{share}% of {months}-month income committed",
    },
    "ru": {
        "summary": "Прогноз на основе фактов вашего Life Twin (офлайн-режим — приблизительная арифметика, без ИИ-рассуждений).",
        "no_facts": "В вашем Life Twin пока мало фактов — добавьте доход, расходы и семью для точного прогноза.",
        "assume": "Ваши текущие факты остаются стабильными в течение периода",
        "m1": "1-й месяц", "m3": "3-й месяц", "m6": "6-й месяц",
        "risk_generic": "Незапланированные расходы или перебои дохода усложнят план",
        "opp_generic": "Пересмотр регулярных расходов может высвободить запас",
        "rec": "Принимайте решение после проверки 6-месячного денежного эффекта ниже. Это поддержка решения, а не профессиональный совет.",
        "cost_note": "оценочная стоимость решения из вашего вопроса",
        "income_note": "месячный доход в профиле",
        "cash6": "Приблизительный денежный эффект за 6 месяцев",
        "committed": "занято ~{share}% дохода за {months} мес.",
    },
    "uz": {
        "summary": "Life Twin faktlaringizga asoslangan prognoz (oflayn rejim — taxminiy arifmetika, AI mulohazasisiz).",
        "no_facts": "Life Twin'ingizda hozircha faktlar kam — aniqroq prognoz uchun daromad, xarajat va oila faktlarini qo'shing.",
        "assume": "Joriy faktlaringiz davr mobaynida barqaror qoladi",
        "m1": "1-oy", "m3": "3-oy", "m6": "6-oy",
        "risk_generic": "Kutilmagan xarajatlar yoki daromad uzilishlari rejani qiyinlashtiradi",
        "opp_generic": "Doimiy xarajatlarni qayta ko'rib chiqish qo'shimcha zaxira ochishi mumkin",
        "rec": "Qarorni quyidagi 6 oylik pul ta'sirini majburiyatlaringizga solishtirib ko'rib qabul qiling. Bu qaror-yordami, professional maslahat emas.",
        "cost_note": "savolingizdan topilgan taxminiy qaror narxi",
        "income_note": "profildagi oylik daromad",
        "cash6": "6 oylik taxminiy pul ta'siri",
        "committed": "{months} oylik daromadning ~{share}% i band bo'ladi",
    },
}


def _parse_amount(text: str) -> float | None:
    """Matndan birinchi pul miqdorini (mln/ming ko'paytmasi bilan) oladi."""
    m = re.search(_MONEY, text, re.IGNORECASE)
    if not m:
        return None
    try:
        num = float(m.group(1).replace(" ", "").replace(",", "."))
    except ValueError:
        return None
    unit = m.group(2).lower()
    if unit in ("mln", "million", "млн"):
        num *= 1_000_000
    elif unit in ("ming", "тыс"):
        num *= 1_000
    return num


def _fmt(n: float) -> str:
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f} mln"
    if n >= 1_000:
        return f"{n / 1_000:.0f} ming"
    return f"{n:.0f}"


async def whatif(
    question: str,
    facts: list[dict[str, Any]],
    goals: list[str],
    profession: str = "",
    language: str = "en",
) -> dict[str, Any]:
    facts_text = "\n".join(f"- [{f['category']}] {f['label']}: {f['value']}" for f in facts) or "(no facts yet)"
    goals_text = "\n".join(f"- {g}" for g in goals) or "(none)"

    parsed = await llm_json(
        _WHATIF_SYSTEM + "\n" + lang_instruction(language),
        f"QUESTION: {question}\n\nPROFESSION: {profession or 'unknown'}\n\n"
        f"LIFE TWIN FACTS:\n{facts_text}\n\nGOALS:\n{goals_text}",
        max_tokens=1800,
    )
    if parsed is not None and parsed.get("timeline"):
        parsed["method"] = "llm"
        return parsed

    # ---------- Heuristik fallback: haqiqiy faktlar bilan arifmetika ----------
    T = _HEURISTIC_TEXT.get(language, _HEURISTIC_TEXT["en"])
    lower = question.lower()
    decision = next(
        (dt for dt, kws in _DECISION_TYPES.items() if any(k in lower for k in kws)),
        "generic",
    )

    income = None
    used: list[str] = []
    for f in facts:
        if f["category"] == "finance" and income is None:
            amt = _parse_amount(f["value"])
            if amt and ("daromad" in f["label"].lower() or "income" in f["label"].lower()
                        or "доход" in f["label"].lower() or "oylik" in f["label"].lower()):
                income = amt
                used.append(f"{f['label']}: {f['value']}")
    cost = _parse_amount(question)

    timeline = []
    assumptions = [T["assume"]]
    if cost is not None:
        assumptions.append(f"{T['cost_note']}: ~{_fmt(cost)}")
    if income is not None:
        assumptions.append(f"{T['income_note']}: ~{_fmt(income)}")

    for key, months in ((T["m1"], 1), (T["m3"], 3), (T["m6"], 6)):
        parts = []
        if cost is not None and income is not None:
            share = cost / (income * months) * 100
            if months == 6:
                parts.append(f"{T['cash6']}: -{_fmt(cost)} ({share:.0f}%)")
            else:
                parts.append(T["committed"].format(share=f"{share:.0f}", months=months))
        elif cost is not None:
            parts.append(f"-{_fmt(cost)}")
        if not parts:
            parts.append(T["no_facts"])
        timeline.append({"period": key, "projection": "; ".join(parts)})

    return {
        "summary": T["summary"],
        "assumptions": assumptions,
        "timeline": timeline,
        "risks": [T["risk_generic"]],
        "opportunities": [T["opp_generic"]],
        "recommendation": T["rec"],
        "confidence": 0.4,
        "used_facts": used,
        "decision_type": decision,
        "method": "heuristic",
    }
