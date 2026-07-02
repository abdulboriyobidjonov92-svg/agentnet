"""
AgentNet — Ethical Decision Engine
------------------------------------
Har qanday muhim agent-amal yoki foydalanuvchi qarori OLDIDAN chaqiriladigan
qaror-yordam qatlami. Ikki bosqich:

  1. Halal Filter (mavjud qatlam QAYTA ISHLATILADI, dublikat emas) —
     kontent darajasidagi qat'iy tekshiruv. BLOCK → darhol REJECT.
  2. Qadriyatlar qatlami — foydalanuvchining e'lon qilgan qadriyatlari
     (islomiy va/yoki shaxsiy) bilan muvofiqlikni baholaydi.

Natija: APPROVE | CAUTION | REJECT + sabab + qadriyat-mosligi.
"""

from __future__ import annotations

from typing import Any

from halal_filter import Action, HalalFilter
from llm_utils import lang_instruction, llm_json

_halal = HalalFilter()

_ETHICS_SYSTEM = """\
You are AgentNet's Ethical Decision Engine. Evaluate the proposed
action/decision against the user's DECLARED values (listed below). You are
decision support: give a verdict with honest reasoning, not moralizing and
not a religious ruling (no fatwas — refer doubtful religious questions to
qualified scholars).

verdict: "APPROVE" (aligned), "CAUTION" (proceed with named safeguards),
or "REJECT" (clearly violates declared values or causes harm).

Reply ONLY with JSON:
{"verdict": "...", "reasoning": "...",
 "value_alignment": [{"value": "...", "status": "aligned|conflict|neutral", "note": "..."}],
 "safeguards": ["..."]}
"""

# Fallback qoidalar: (belgi so'zlar, hukm, sabab kaliti)
_RISK_RULES: list[tuple[list[str], str, str]] = [
    (["foizli kredit", "interest loan", "процентный кредит", "sudxo'r"], "REJECT", "riba"),
    (["aldash", "yashirish", "deceive", "hide from", "обмануть", "скрыть от", "fake", "soxta"], "REJECT", "deception"),
    (["pora", "bribe", "взятк"], "REJECT", "corruption"),
    (["qarz ol", "borrow", "займ", "kredit ol", "loan"], "CAUTION", "debt"),
    (["ishdan bo'shat", "fire ", "uvolit", "layoff"], "CAUTION", "impact_on_others"),
    (["risk", "tavakkal", "рискован"], "CAUTION", "risk"),
]

_REASON_TEXT = {
    "riba": {
        "en": "The action involves interest (riba), which conflicts with Islamic financial values. Consider murabaha/ijara alternatives.",
        "ru": "Действие связано с процентами (риба), что противоречит исламским финансовым ценностям. Рассмотрите мурабаху/иджару.",
        "uz": "Amal foiz (riba) bilan bog'liq — bu islomiy moliya qadriyatlariga zid. Murobaha/ijara muqobillarini ko'rib chiqing.",
    },
    "deception": {
        "en": "The action involves concealment or deception, which conflicts with honesty values.",
        "ru": "Действие связано с сокрытием или обманом, что противоречит ценности честности.",
        "uz": "Amal yashirish yoki aldov bilan bog'liq — bu halollik qadriyatiga zid.",
    },
    "corruption": {
        "en": "The action involves bribery/corruption — rejected regardless of declared values.",
        "ru": "Действие связано со взяткой/коррупцией — отклоняется независимо от заявленных ценностей.",
        "uz": "Amal pora/korrupsiya bilan bog'liq — e'lon qilingan qadriyatlardan qat'i nazar rad etiladi.",
    },
    "debt": {
        "en": "Taking on debt: verify the structure is interest-free and repayment fits your income facts.",
        "ru": "Займ: убедитесь, что структура беспроцентная и погашение соответствует вашим доходам.",
        "uz": "Qarz olish: tuzilma foizsiz ekanini va to'lov daromadingizga mosligini tekshiring.",
    },
    "impact_on_others": {
        "en": "This decision materially affects other people — weigh fairness and communicate transparently.",
        "ru": "Решение существенно влияет на других — взвесьте справедливость и действуйте прозрачно.",
        "uz": "Bu qaror boshqalarga sezilarli ta'sir qiladi — adolatni torting va ochiq muloqot qiling.",
    },
    "risk": {
        "en": "Elevated risk detected — define the maximum acceptable loss before proceeding.",
        "ru": "Повышенный риск — определите максимально допустимую потерю до начала.",
        "uz": "Yuqori risk aniqlandi — boshlashdan oldin maksimal yo'qotish chegarasini belgilang.",
    },
    "ok": {
        "en": "No conflict found with your declared values (offline keyword check). With an API key this becomes a reasoned evaluation.",
        "ru": "Конфликтов с заявленными ценностями не найдено (офлайн-проверка по ключевым словам). С API-ключом оценка станет рассуждающей.",
        "uz": "E'lon qilingan qadriyatlaringizga zidlik topilmadi (oflayn kalit-so'z tekshiruvi). API kaliti bilan baholash mulohazali bo'ladi.",
    },
    "halal_block": {
        "en": "Blocked by the Halal Filter",
        "ru": "Заблокировано Halal Filter",
        "uz": "Halal Filter tomonidan bloklandi",
    },
}


async def evaluate(
    action: str,
    values: dict[str, Any] | None,
    profession: str = "",
    language: str = "en",
) -> dict[str, Any]:
    values = values or {}
    tradition = values.get("tradition", "islamic")
    statements: list[str] = [s for s in (values.get("statements") or []) if s]

    # ---- 1-bosqich: mavjud Halal Filter (qayta ishlatish, chetlab o'tish yo'q)
    halal = await _halal.classify(action, agent_name="ethics-engine", direction="kiruvchi", profession=profession)
    halal_payload = {
        "category": str(halal.category.value),
        "action": str(halal.action.value),
        "reasoning": halal.reasoning,
        "layer": halal.layer,
    }
    if halal.action == Action.BLOCK:
        t = _REASON_TEXT["halal_block"]
        return {
            "verdict": "REJECT",
            "reasoning": f"{t.get(language, t['en'])}: {halal.reasoning}",
            "value_alignment": [],
            "safeguards": [],
            "halal": halal_payload,
            "method": "halal_filter",
        }

    # ---- 2-bosqich: qadriyatlar qatlami (LLM-first)
    values_text = "\n".join(f"- {s}" for s in statements) or "(none declared)"
    parsed = await llm_json(
        _ETHICS_SYSTEM + "\n" + lang_instruction(language),
        f"PROPOSED ACTION/DECISION: {action}\n"
        f"VALUE TRADITION: {tradition}\nDECLARED VALUES:\n{values_text}\n"
        f"USER PROFESSION: {profession or 'unknown'}",
        max_tokens=1000,
    )
    if parsed is not None and parsed.get("verdict") in ("APPROVE", "CAUTION", "REJECT"):
        parsed["halal"] = halal_payload
        parsed["method"] = "llm"
        return parsed

    # ---- Fallback: qoida-asoslangan tekshiruv
    lower = action.lower()
    verdict, reason_key = "APPROVE", "ok"
    for keywords, rule_verdict, key in _RISK_RULES:
        if any(k in lower for k in keywords):
            verdict, reason_key = rule_verdict, key
            break
    t = _REASON_TEXT[reason_key]
    alignment = [
        {"value": s, "status": "conflict" if verdict == "REJECT" else "neutral", "note": ""}
        for s in statements[:5]
    ]
    return {
        "verdict": verdict,
        "reasoning": t.get(language, t["en"]),
        "value_alignment": alignment,
        "safeguards": [],
        "halal": halal_payload,
        "method": "heuristic",
    }
