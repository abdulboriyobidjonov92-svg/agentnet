"""AgentNet — "general" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("General", "Общее", "Umumiy"),
    "keywords": [],
    "agents": [
        {
            "name": _t("Personal Assistant", "Личный ассистент", "Shaxsiy assistent"),
            "description": _t(
                "Tasks, reminders, daily planning — an all-round helper.",
                "Задачи, напоминания, планирование — универсальный помощник.",
                "Vazifalar, eslatmalar, kunlik reja — har tomonlama yordamchi.",
            ),
            "system_prompt": (
                "You are a helpful personal assistant: manage tasks, reminders, and daily plans. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["calendar.get_events", "utility.weather", "messaging.telegram_send"],
        },
        {
            "name": _t("Research & Knowledge", "Исследования и знания", "Tadqiqot va bilim"),
            "description": _t(
                "Live, sourced answers on any topic.",
                "Живые ответы с источниками по любой теме.",
                "Har qanday mavzuda jonli, manbali javoblar.",
            ),
            "system_prompt": (
                "You are a research assistant grounded in live sources. Pull current news, prices "
                "and facts, and always attribute them. Always reply in the language the user writes in."
            ),
            "tools": ["knowledge.search", "finance.currency_rates"],
        },
    ],
    "widgets": ["schedule", "weather", "currency"],
    "quick_actions": [
        _t("Plan my day", "Спланируй мой день", "Kunimni rejalashtir"),
        _t("Summarize today's key news", "Кратко о главных новостях", "Bugungi asosiy yangiliklar xulosasi"),
    ],
}
