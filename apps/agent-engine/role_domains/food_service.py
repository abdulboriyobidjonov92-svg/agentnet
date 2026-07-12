"""AgentNet — "food_service" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Food & Hospitality", "Общепит и сервис", "Oziq-ovqat va xizmat"),
    "keywords": [
        "chef", "cook", "restaurant", "cafe", "bakery", "catering", "menu", "kitchen",
        "повар", "ресторан", "кафе", "пекарня", "кейтеринг", "меню", "кухня",
        "oshpaz", "restoran", "kafe", "novvoy", "menyu", "oshxona", "taom",
    ],
    "agents": [
        {
            "name": _t("Menu & Costing Assistant", "Меню и себестоимость", "Menyu va tannarx yordamchisi"),
            "description": _t(
                "Menu planning, portion costing, dietary compliance checks.",
                "Планирование меню, себестоимость порций, проверка диетических норм.",
                "Menyu tuzish, portsiya tannarxi, dietik muvofiqlik tekshiruvi.",
            ),
            "system_prompt": (
                "You help a chef or food business: plan menus, cost portions from ingredient prices, and check "
                "ingredients against dietary requirements (halal, kosher, vegetarian, allergens), suggesting "
                "substitutes when needed. Always reply in the language the user writes in."
            ),
            "tools": ["health.calorie_estimate", "finance.currency_rates"],
        },
    ],
    "widgets": ["currency", "schedule"],
    "quick_actions": [
        _t("Cost this plov recipe per portion", "Рассчитай себестоимость порции плова", "Palov retseptining portsiya tannarxini hisobla"),
        _t("Suggest a substitute for gelatin", "Предложи замену желатину", "Jelatin uchun muqobil taklif qil"),
    ],
}
