"""AgentNet — "construction" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Construction & Architecture", "Строительство", "Qurilish"),
    "keywords": [
        "builder", "construction", "architect", "renovation", "cement", "site foreman", "contractor",
        "строитель", "архитектор", "ремонт", "стройка", "прораб", "подрядчик",
        "quruvchi", "arxitektor", "ta'mir", "qurilish", "prorab", "usta",
    ],
    "agents": [
        {
            "name": _t("Project Estimator", "Сметчик", "Smeta hisoblovchi"),
            "description": _t(
                "Material estimates, cost breakdowns, schedules.",
                "Расчёт материалов, смета, график работ.",
                "Material hisobi, xarajatlar taqsimoti, ish jadvali.",
            ),
            "system_prompt": (
                "You help estimate construction projects: material quantities, cost breakdowns, and work "
                "schedules from the user's description. State assumptions explicitly. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["finance.currency_rates", "utility.weather"],
        },
    ],
    "widgets": ["weather", "currency", "schedule"],
    "quick_actions": [
        _t("Estimate materials for a 100m² house foundation", "Рассчитай материалы для фундамента 100м²", "100m² uy poydevori uchun materiallarni hisobla"),
    ],
}
