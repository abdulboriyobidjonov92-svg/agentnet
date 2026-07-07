"""
AgentNet — Retail Forecast tahlili (agent #1 bashorat qatlami)
--------------------------------------------------------------
NestJS RetailService oddiy statistik trenddan har mahsulot uchun bashorat
hisoblaydi (necha kunda tugaydi, kunlik tezlik, trend, tavsiya miqdor). Bu
modul o'sha JSON'ni oladi va Claude'ga "shu trendga asoslanib nima qilish
kerak" degan qisqa, ustuvor xulosa yozdiradi (brief tamoyili). LLM-first;
kalitsiz — deterministik heuristik xulosa (baribir faqat berilgan raqamlardan).
"""

from __future__ import annotations

import json
from typing import Any

from llm_utils import lang_instruction, llm_json

_SYSTEM = """\
You are a retail demand analyst for a small shop owner. You receive per-product
forecasts already computed from the last weeks of sales: days_until_stockout,
daily velocity, trend, and a recommended reorder quantity. Turn them into a
SHORT, prioritized owner briefing — which products need action now and why, in
plain language. Use ONLY the numbers given; never invent figures.

Reply ONLY with JSON:
{"headline": "one-line summary of the situation",
 "priorities": ["one short action line per urgent product, most urgent first"],
 "advice": "1-2 sentences of practical guidance"}
"""


async def analyze(forecasts: list[dict[str, Any]], summary: dict[str, Any], language: str = "uz") -> dict[str, Any]:
    parsed = await llm_json(
        _SYSTEM + "\n" + lang_instruction(language),
        "FORECASTS (computed from real sales):\n"
        + json.dumps({"summary": summary, "products": forecasts}, ensure_ascii=False, default=str)[:3500],
        max_tokens=700,
    )
    if parsed and (parsed.get("headline") or parsed.get("priorities")):
        parsed["method"] = "llm"
        return parsed
    return _heuristic(forecasts, summary, language)


# ------------------------------------------------------------------
# Heuristik xulosa — kalitsiz ham berilgan raqamlardan
# ------------------------------------------------------------------

_T = {
    "uz": {
        "head_crit": "{n} ta tovar shoshilinch buyurtma talab qiladi",
        "head_warn": "{n} ta tovar yaqinda tugaydi — buyurtmani rejalashtiring",
        "head_ok": "Zaxira holati barqaror — shoshilinch chora kerak emas",
        "prio": "{name}: ~{days} kunda tugaydi, {qty} dona buyurtma bering",
        "advice": "Eng shoshilinchlaridan boshlang; kunlik savdo tezligi buyurtma miqdorini belgiladi.",
    },
    "ru": {
        "head_crit": "{n} товар(ов) требуют срочного заказа",
        "head_warn": "{n} товар(ов) скоро закончатся — запланируйте заказ",
        "head_ok": "Запасы стабильны — срочных действий не требуется",
        "prio": "{name}: закончится через ~{days} дн., закажите {qty} шт.",
        "advice": "Начните с самых срочных; объём заказа рассчитан по скорости продаж.",
    },
    "en": {
        "head_crit": "{n} product(s) need an urgent reorder",
        "head_warn": "{n} product(s) run out soon — plan a reorder",
        "head_ok": "Stock levels are stable — no urgent action needed",
        "prio": "{name}: runs out in ~{days} days, order {qty} units",
        "advice": "Start with the most urgent; order sizes are sized to the sales pace.",
    },
}


def _heuristic(forecasts: list[dict[str, Any]], summary: dict[str, Any], language: str) -> dict[str, Any]:
    t = _T.get(language, _T["en"])
    crit = int(summary.get("critical", 0) or 0)
    warn = int(summary.get("warning", 0) or 0)

    if crit > 0:
        headline = t["head_crit"].format(n=crit)
    elif warn > 0:
        headline = t["head_warn"].format(n=warn)
    else:
        headline = t["head_ok"]

    priorities: list[str] = []
    for f in forecasts:
        if f.get("urgency") not in ("critical", "warning"):
            continue
        if not f.get("recommendedOrderQty"):
            continue
        priorities.append(
            t["prio"].format(
                name=f.get("name", "?"),
                days=f.get("daysUntilStockout", "?"),
                qty=f.get("recommendedOrderQty", 0),
            )
        )
        if len(priorities) >= 8:
            break

    return {"headline": headline, "priorities": priorities, "advice": t["advice"], "method": "heuristic"}
