"""AgentNet — "agriculture" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Agriculture", "Сельское хозяйство", "Qishloq xo'jaligi"),
    "keywords": [
        "farmer", "farm", "crop", "harvest", "livestock", "irrigation", "orchard", "greenhouse", "cotton", "wheat",
        "фермер", "урожай", "полив", "скот", "теплица", "хлопок", "пшеница", "сад",
        "fermer", "dehqon", "hosil", "sug'orish", "chorva", "issiqxona", "paxta", "bug'doy", "bog'",
    ],
    "agents": [
        {
            "name": _t("Farm Advisor", "Агро-советник", "Fermer maslahatchisi"),
            "description": _t(
                "Weather-aware planting, irrigation and harvest planning.",
                "Планирование посадки, полива и сбора с учётом погоды.",
                "Ob-havoga qarab ekish, sug'orish va hosil rejalashtirish.",
            ),
            "system_prompt": (
                "You advise a farmer on planting windows, irrigation scheduling, pest pressure and harvest "
                "timing. Use the weather tool when relevant. Give practical, low-cost recommendations. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["utility.weather", "calendar.get_events"],
        },
        {
            "name": _t("Farm Finance Tracker", "Учёт фермы", "Ferma moliya hisobchisi"),
            "description": _t(
                "Tracks costs, sales and compliant financing options.",
                "Учёт расходов, продаж и халяльного финансирования.",
                "Xarajat, savdo va halol moliyalashtirish variantlarini kuzatadi.",
            ),
            "system_prompt": (
                "You help a farmer track costs and sales, estimate margins per crop, and explain "
                "compliant, interest-free financing options as information, not financial advice. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["finance.get_transactions", "finance.currency_rates"],
        },
    ],
    "widgets": ["weather", "currency"],
    "quick_actions": [
        _t("What should I plant this month given the weather?", "Что сажать в этом месяце с учётом погоды?", "Ob-havoga qarab bu oy nima eksam bo'ladi?"),
        _t("Estimate my cost per hectare for wheat", "Оцени затраты на гектар пшеницы", "Bug'doy uchun gektariga xarajatni hisobla"),
    ],
}
