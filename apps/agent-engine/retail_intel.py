"""
AgentNet — Retail Intelligence (S4): kamera + inventar fuziyasi
----------------------------------------------------------------
Lumana/ifactory/ECAM isbotlagan naqsh: xom video-hodisa emas, balki
kamera-hodisasini POS/inventar yozuvlari bilan SOLISHTIRISH signal beradi.

Bu modul deterministik solishtirish natijasida yig'ilgan dalillar to'plamini
oladi (NestJS RetailService yig'adi) va KONTEKSTLI baho beradi:
  - bu haqiqiy signalmi yoki yolg'on trevoga?
  - jiddiylik darajasi qanday?
  - egaga yuboriladigan xabar matni (o'z tilida, qisqa, amalga undaydigan)

LLM-first; kalitsiz oqilona heuristik (lekin baribir dalil-asosli — hech
qachon bitta vision-hodisaning o'zidan ayblov chiqarmaydi).
"""

from __future__ import annotations

from typing import Any

from llm_utils import lang_instruction, llm_json

_ASSESS_SYSTEM = """\
You are a retail loss-prevention and inventory analyst. You receive EVIDENCE that
was already cross-referenced between camera vision events and POS/inventory records.
Your job is contextual judgment, not rigid rules: decide whether this is a real,
actionable signal or a probable false alarm, and write the exact short message the
store owner should receive on their phone.

NEVER accuse a specific person. Vision events are signals, not proof.

Reply ONLY with JSON:
{"kind": "stockout|restock_needed|theft_suspect|discrepancy|false_alarm",
 "severity": "info|warning|critical",
 "is_actionable": true|false,
 "title": "very short title",
 "message": "2-4 sentence push message for the owner: what happened, the cross-referenced evidence, and the one action to take",
 "reasoning": "why you judged it this way"}
"""


async def assess(evidence: dict[str, Any], language: str = "uz") -> dict[str, Any]:
    """Dalil to'plamini baholaydi va ega uchun push-xabar matnini tuzadi.

    evidence = {
      "trigger": "vision_event" | "sale" | "scan",
      "vision_events": [...], "product": {...} | None,
      "recent_sales": [...], "unmatched_pickups": int, ...
    }
    """
    parsed = await llm_json(
        _ASSESS_SYSTEM + "\n" + lang_instruction(language),
        _render_evidence(evidence),
        max_tokens=800,
    )
    if parsed and parsed.get("kind"):
        parsed["method"] = "llm"
        return parsed
    return _heuristic_assess(evidence, language)


def _render_evidence(evidence: dict[str, Any]) -> str:
    import json

    return "CROSS-REFERENCED EVIDENCE:\n" + json.dumps(evidence, ensure_ascii=False, default=str)[:3500]


# ------------------------------------------------------------------
# Heuristik baho — kalitsiz ham dalil-asosli
# ------------------------------------------------------------------

_MSG = {
    "stockout": {
        "en": "'{name}' has run out (stock: {stock}). Camera zone {zone} confirms the empty shelf. Reorder now — recent sales pace: {sold} in the last records.",
        "ru": "Товар '{name}' закончился (остаток: {stock}). Камера (зона {zone}) подтверждает пустую полку. Пора дозаказать — продано недавно: {sold}.",
        "uz": "'{name}' tovari tugadi (qoldiq: {stock}). Kamera ({zone} zonasi) bo'sh javonni tasdiqlaydi. Hozir buyurtma bering — so'nggi sotuvlar: {sold} dona.",
    },
    "restock_needed": {
        "en": "'{name}' is below reorder level ({stock} left, threshold {reorder}). Restock soon.",
        "ru": "'{name}' ниже порога дозаказа (осталось {stock}, порог {reorder}). Скоро нужно пополнить.",
        "uz": "'{name}' buyurtma chegarasidan pastda (qoldiq {stock}, chegara {reorder}). Tez orada to'ldiring.",
    },
    "discrepancy": {
        "en": "Shelf for '{name}' looks empty on camera (zone {zone}), but inventory records {stock} units. Check for misplacement, unrecorded sales or shrinkage.",
        "ru": "Полка '{name}' пуста по камере (зона {zone}), но по учёту {stock} шт. Проверьте перестановку, непробитые продажи или потери.",
        "uz": "Kamera bo'yicha '{name}' javoni bo'sh ({zone} zonasi), lekin hisobda {stock} dona bor. Joyi almashgan, chek urilmagan sotuv yoki kamomadni tekshiring.",
    },
    "theft_suspect": {
        "en": "{count} pickup event(s) at zone {zone} with NO matching POS transaction in the {window}-minute window. Not proof — review the footage around {time}.",
        "ru": "{count} событие(й) взятия товара в зоне {zone} БЕЗ соответствующей POS-транзакции за {window} минут. Это не доказательство — просмотрите запись около {time}.",
        "uz": "{zone} zonasida {count} ta tovar olish hodisasi — {window} daqiqa ichida POS'da mos chek YO'Q. Bu isbot emas — {time} atrofidagi yozuvni ko'rib chiqing.",
    },
    "false_alarm": {
        "en": "Camera flagged an event at zone {zone}, but POS/inventory records match normal activity. No action needed.",
        "ru": "Камера отметила событие в зоне {zone}, но POS/учёт соответствуют обычной активности. Действий не требуется.",
        "uz": "Kamera {zone} zonasida hodisa qayd etdi, lekin POS/inventar odatdagi faoliyatga mos. Amal talab etilmaydi.",
    },
}

_TITLE = {
    "stockout": {"en": "Out of stock", "ru": "Товар закончился", "uz": "Tovar tugadi"},
    "restock_needed": {"en": "Restock needed", "ru": "Нужен дозаказ", "uz": "To'ldirish kerak"},
    "discrepancy": {"en": "Inventory discrepancy", "ru": "Расхождение учёта", "uz": "Hisob nomuvofiqligi"},
    "theft_suspect": {"en": "Unmatched pickup", "ru": "Несовпадение с кассой", "uz": "Chekka mos kelmadi"},
    "false_alarm": {"en": "False alarm", "ru": "Ложная тревога", "uz": "Yolg'on trevoga"},
}


def _fmt(kind: str, language: str, **kw: Any) -> tuple[str, str]:
    lang = language if language in ("en", "ru", "uz") else "en"
    title = _TITLE[kind][lang]
    msg = _MSG[kind][lang].format(**kw)
    return title, msg


def _heuristic_assess(evidence: dict[str, Any], language: str) -> dict[str, Any]:
    product = evidence.get("product") or {}
    events = evidence.get("vision_events") or []
    zone = (events[0].get("zone") if events else None) or product.get("shelfZone") or "?"
    stock = int(product.get("stock", 0) or 0)
    reorder = int(product.get("reorderLevel", 0) or 0)
    sold = sum(int(s.get("qty", 0) or 0) for s in evidence.get("recent_sales") or [])
    unmatched = int(evidence.get("unmatched_pickups", 0) or 0)
    shelf_empty = any(e.get("type") == "shelf_empty" for e in events)
    avg_conf = (
        sum(float(e.get("confidence", 0) or 0) for e in events) / len(events) if events else 0.0
    )

    # Chalkash kirish: hodisa bor, lekin mos mahsulot yozuvi yo'q — bu ham signal,
    # lekin ehtiyotkor turdagi (inventar xaritalash muammosi bo'lishi mumkin)
    if not product and events:
        titles = {
            "en": ("Unmapped camera event", f"Camera flagged '{events[0].get('type')}' at zone {zone}, but no inventory record maps to it. Check the SKU/zone mapping."),
            "ru": ("Несопоставленное событие", f"Камера отметила '{events[0].get('type')}' в зоне {zone}, но в учёте нет соответствующего товара. Проверьте привязку SKU/зоны."),
            "uz": ("Bog'lanmagan hodisa", f"Kamera {zone} zonasida '{events[0].get('type')}' qayd etdi, lekin inventarda mos yozuv yo'q. SKU/zona bog'lanishini tekshiring."),
        }
        lang = language if language in titles else "en"
        title, msg = titles[lang]
        return {
            "kind": "discrepancy", "severity": "info", "is_actionable": True,
            "title": title, "message": msg,
            "reasoning": "Vision event without a matching inventory record — mapping issue, not an accusation.",
            "method": "heuristic",
        }

    # Dalillarni birlashtirib xulosa (bitta hodisa = hech qachon ayblov emas)
    if shelf_empty and stock <= 0:
        kind, severity, actionable = "stockout", "critical", True
        title, msg = _fmt(kind, language, name=product.get("name", "?"), stock=stock, zone=zone, sold=sold)
        reasoning = "Camera shelf_empty + inventory stock=0 agree: confirmed stockout."
    elif shelf_empty and stock > 0:
        kind, severity, actionable = "discrepancy", "warning", True
        title, msg = _fmt(kind, language, name=product.get("name", "?"), stock=stock, zone=zone)
        reasoning = f"Camera says empty but records show {stock} units — the mismatch itself is the signal."
    elif unmatched > 0 and avg_conf >= 0.6:
        kind = "theft_suspect"
        severity = "critical" if unmatched >= 2 else "warning"
        actionable = True
        title, msg = _fmt(
            kind, language, count=unmatched, zone=zone,
            window=evidence.get("match_window_min", 15),
            time=str((events[0].get("createdAt") if events else "") or "")[:16],
        )
        reasoning = f"{unmatched} pickup event(s) with no POS match at confidence {avg_conf:.2f} — review, not accuse."
    elif stock <= reorder and stock > 0:
        kind, severity, actionable = "restock_needed", "warning", True
        title, msg = _fmt(kind, language, name=product.get("name", "?"), stock=stock, reorder=reorder)
        reasoning = "Stock at/below reorder threshold from POS records."
    else:
        kind, severity, actionable = "false_alarm", "info", False
        title, msg = _fmt(kind, language, zone=zone)
        reasoning = f"Vision events (conf {avg_conf:.2f}) reconcile with POS/inventory — no discrepancy found."

    return {
        "kind": kind,
        "severity": severity,
        "is_actionable": actionable,
        "title": title,
        "message": msg,
        "reasoning": reasoning,
        "method": "heuristic",
    }
