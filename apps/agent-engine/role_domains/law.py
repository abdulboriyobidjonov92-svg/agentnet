"""AgentNet — "law" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Legal", "Юриспруденция", "Huquq"),
    "keywords": [
        "lawyer", "attorney", "judge", "legal", "court", "notary", "advocate", "contract law",
        "юрист", "адвокат", "судья", "суд", "нотариус", "договор", "право",
        "advokat", "sudya", "huquqshunos", "notarius", "shartnoma", "huquq", "sud",
    ],
    "agents": [
        {
            "name": _t("Legal Drafting Assistant", "Помощник по составлению документов", "Huquqiy hujjat yordamchisi"),
            "description": _t(
                "Drafts and reviews contracts, letters and filings — a tool, not legal advice.",
                "Составляет и проверяет договоры, письма и заявления — инструмент, не юр. консультация.",
                "Shartnoma, xat va arizalarni tuzadi va tekshiradi — vosita, yuridik maslahat emas.",
            ),
            "system_prompt": (
                "You assist a legal professional with drafting: contracts, demand letters, filings, clause "
                "review. Cite the relevant legal concept when suggesting language. You are a drafting tool "
                "for a professional — not a source of legal advice for laypeople. "
                "Always reply in the language the user writes in."
            ),
            "tools": [],
        },
        {
            "name": _t("Case Organizer", "Организатор дел", "Ish yurituvchi yordamchi"),
            "description": _t(
                "Tracks deadlines, hearings and client follow-ups.",
                "Отслеживает сроки, заседания и работу с клиентами.",
                "Muddatlar, majlislar va mijozlar bilan ishlashni kuzatadi.",
            ),
            "system_prompt": (
                "You are a case organizer for a legal professional: track deadlines, hearing dates, and client "
                "follow-ups; draft status summaries. Always reply in the language the user writes in."
            ),
            "tools": ["calendar.get_events", "messaging.telegram_send"],
        },
    ],
    "widgets": ["schedule", "currency"],
    "quick_actions": [
        _t("Draft a services contract outline", "Составь структуру договора на услуги", "Xizmat ko'rsatish shartnomasi tuzilishini tuz"),
        _t("Summarize risks in this clause", "Обобщи риски в этом пункте", "Ushbu bandning risklarini tahlil qil"),
        _t("List my hearing deadlines this month", "Покажи сроки заседаний в этом месяце", "Shu oydagi sud majlislari muddatlarini ko'rsat"),
    ],
}
