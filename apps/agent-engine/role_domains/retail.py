"""AgentNet — "retail" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Retail & Commerce", "Торговля", "Savdo"),
    "keywords": [
        "shop", "store", "retail", "merchant", "seller", "inventory", "customers", "sales", "market stall", "boutique",
        "магазин", "торгов", "продавец", "склад", "покупател", "продаж", "лавка", "бутик",
        "do'kon", "dokon", "savdo", "sotuvchi", "ombor", "mijoz", "mahsulot", "rasta", "bozor",
    ],
    "agents": [
        {
            "name": _t("Shop Operations Assistant", "Помощник по магазину", "Do'kon boshqaruv yordamchisi"),
            "description": _t(
                "Inventory tracking, reorder reminders, sales summaries.",
                "Учёт товара, напоминания о закупке, сводки продаж.",
                "Tovar hisobi, buyurtma eslatmalari, savdo xulosalari.",
            ),
            "system_prompt": (
                "You are an operations assistant for a shop owner: track inventory the owner describes, "
                "suggest reorder points, summarize daily sales, and draft supplier messages. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["finance.get_transactions", "messaging.telegram_send"],
        },
        {
            "name": _t("Compliance Bookkeeper", "Халяль-бухгалтер", "Halol moliya hisobchisi"),
            "description": _t(
                "Categorizes transactions and flags riba/interest items.",
                "Категоризация транзакций и пометка рибы/процентов.",
                "Tranzaksiyalarni tasniflaydi va riba/foizni belgilaydi.",
            ),
            "system_prompt": (
                "You are a bookkeeping assistant for a small business: categorize transactions, flag anything "
                "with interest-based markers, and suggest compliant alternatives as information, not financial "
                "advice. Always reply in the language the user writes in."
            ),
            "tools": ["finance.get_transactions", "finance.currency_rates"],
        },
        {
            "name": _t("Customer Message Writer", "Сообщения клиентам", "Mijozlarga xabar yozuvchi"),
            "description": _t(
                "Promotions, replies and announcements for Telegram.",
                "Акции, ответы и объявления для Telegram.",
                "Aksiyalar, javoblar va e'lonlar — Telegram uchun.",
            ),
            "system_prompt": (
                "You write short, friendly customer messages for a shop: promotions, restock announcements, "
                "and replies to inquiries. Keep them honest — no exaggerated claims. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["messaging.telegram_send"],
        },
    ],
    "widgets": ["currency", "schedule"],
    "quick_actions": [
        _t("Summarize today's sales and flag slow items", "Сводка продаж за день и залежавшиеся товары", "Bugungi savdo xulosasi va sekin sotilayotgan tovarlar"),
        _t("Draft a restock message to my supplier", "Составь сообщение поставщику о закупке", "Yetkazib beruvchiga buyurtma xabarini tayyorla"),
        _t("Check today's USD exchange rate", "Курс доллара на сегодня", "Bugungi dollar kursini ko'rsat"),
    ],
}
