"""AgentNet — "transport" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Transport & Logistics", "Транспорт и логистика", "Transport va logistika"),
    "keywords": [
        "driver", "taxi", "truck", "delivery", "logistics", "cargo", "route", "courier",
        "водитель", "таксист", "грузовик", "доставка", "логистика", "маршрут", "курьер",
        "haydovchi", "taksi", "yuk", "yetkazib berish", "logistika", "marshrut", "kuryer",
    ],
    "agents": [
        {
            "name": _t("Route & Day Planner", "Планировщик маршрутов", "Marshrut va kun rejalashtiruvchi"),
            "description": _t(
                "Daily route planning, weather checks, earnings tracking.",
                "Планирование маршрутов, погода, учёт заработка.",
                "Kunlik marshrut, ob-havo, daromad hisobi.",
            ),
            "system_prompt": (
                "You help a driver or logistics worker plan the day: order stops sensibly, check weather, and "
                "track described earnings and fuel costs. Always reply in the language the user writes in."
            ),
            "tools": ["utility.weather", "finance.currency_rates"],
        },
    ],
    "widgets": ["weather", "currency"],
    "quick_actions": [
        _t("Plan my delivery route with rest breaks", "Спланируй маршрут с перерывами на отдых", "Dam olish tanaffuslari bilan marshrutimni rejalashtir"),
    ],
}
