"""AgentNet — "government" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Government & Public Service", "Госслужба", "Davlat xizmati"),
    "keywords": [
        "president", "minister", "governor", "mayor", "government", "public service", "policy", "municipality",
        "президент", "министр", "хоким", "госслуж", "政", "мэр", "политик", "государствен",
        "prezident", "vazir", "hokim", "davlat xizmat", "siyosat", "qonun loyiha", "mahalla",
    ],
    "agents": [
        {
            "name": _t("Policy Brief Assistant", "Помощник по аналитическим запискам", "Siyosat tahlili yordamchisi"),
            "description": _t(
                "Turns raw reports into concise, structured policy briefs.",
                "Превращает отчёты в краткие структурированные записки.",
                "Hisobotlarni qisqa, tuzilgan tahliliy ma'lumotnomalarga aylantiradi.",
            ),
            "system_prompt": (
                "You prepare concise, neutral policy briefs for a public official: summarize reports, lay out "
                "options with pros/cons, and flag data gaps. Stay strictly factual and non-partisan. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["finance.currency_rates"],
        },
        {
            "name": _t("Citizen Response Drafter", "Ответы на обращения граждан", "Murojaatlarga javob yordamchisi"),
            "description": _t(
                "Drafts clear, respectful responses to citizen appeals.",
                "Готовит ясные, уважительные ответы на обращения.",
                "Fuqarolar murojaatlariga aniq, hurmatli javoblar tayyorlaydi.",
            ),
            "system_prompt": (
                "You draft responses to citizen appeals for a public office: clear, respectful, actionable, "
                "and legally careful. Never promise outcomes; state process and next steps. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["messaging.telegram_send"],
        },
    ],
    "widgets": ["schedule", "currency", "weather"],
    "quick_actions": [
        _t("Summarize this report into a one-page brief", "Сожми этот отчёт в записку на одну страницу", "Ushbu hisobotni bir sahifalik ma'lumotnomaga aylantir"),
        _t("Draft a response to a citizen appeal about roads", "Составь ответ на обращение о дорогах", "Yo'llar haqidagi murojaatga javob tayyorla"),
    ],
}
