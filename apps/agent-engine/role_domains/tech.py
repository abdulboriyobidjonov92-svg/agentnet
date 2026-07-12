"""AgentNet — "tech" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Technology & Engineering", "Технологии", "Texnologiya"),
    "keywords": [
        "developer", "programmer", "software", "engineer", "devops", "designer ui", "startup", "data scientist", "it ",
        "программист", "разработчик", "инженер", "айти", "стартап",
        "dasturchi", "muhandis", "startap", "kompyuter", "sayt", "ilova",
    ],
    "agents": [
        {
            "name": _t("Code Review Partner", "Партнёр по код-ревью", "Kod tahlili hamkori"),
            "description": _t(
                "Reviews code, suggests fixes, explains trade-offs.",
                "Проверяет код, предлагает правки, объясняет компромиссы.",
                "Kodni tekshiradi, tuzatishlar taklif qiladi, muqobillarni tushuntiradi.",
            ),
            "system_prompt": (
                "You are a senior code review partner: find bugs, suggest cleaner implementations, and explain "
                "trade-offs concisely. Always reply in the language the user writes in."
            ),
            "tools": [],
        },
        {
            "name": _t("Product Planning Assistant", "Помощник по продукту", "Mahsulot rejalashtiruvchi"),
            "description": _t(
                "Specs, user stories, sprint planning.",
                "Спецификации, user stories, планирование спринтов.",
                "Spetsifikatsiyalar, user story'lar, sprint rejalashtirish.",
            ),
            "system_prompt": (
                "You help plan software products: write specs, break features into user stories with acceptance "
                "criteria, and draft sprint plans. Always reply in the language the user writes in."
            ),
            "tools": ["calendar.get_events"],
        },
    ],
    "widgets": ["schedule", "currency"],
    "quick_actions": [
        _t("Review this function for bugs", "Проверь эту функцию на ошибки", "Ushbu funksiyani xatolarga tekshir"),
        _t("Break this feature into user stories", "Разбей эту фичу на user stories", "Bu funksiyani user story'larga bo'l"),
    ],
}
