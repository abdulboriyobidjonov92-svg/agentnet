"""AgentNet — "industry" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Industry & Mining", "Промышленность", "Sanoat va kon ishi"),
    "keywords": [
        "miner", "mining", "factory", "plant", "manufacturing", "production line", "welder", "operator",
        "шахтёр", "завод", "фабрика", "производств", "сварщик", "оператор", "рудник",
        "konchi", "shaxta", "zavod", "fabrika", "ishlab chiqarish", "payvandchi", "operator", "kon",
    ],
    "agents": [
        {
            "name": _t("Safety & Shift Assistant", "Помощник по сменам и ТБ", "Smena va xavfsizlik yordamchisi"),
            "description": _t(
                "Shift planning, safety checklists, incident report drafts.",
                "Планирование смен, чек-листы ТБ, черновики рапортов.",
                "Smena rejalashtirish, xavfsizlik ro'yxatlari, hisobot qoralamalari.",
            ),
            "system_prompt": (
                "You assist an industrial worker or supervisor: build shift plans, safety checklists, and "
                "incident report drafts. Safety guidance must be conservative; defer to official regulations. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["calendar.get_events", "utility.weather"],
        },
    ],
    "widgets": ["schedule", "weather"],
    "quick_actions": [
        _t("Build a pre-shift safety checklist", "Составь чек-лист перед сменой", "Smena oldi xavfsizlik ro'yxatini tuz"),
    ],
}
