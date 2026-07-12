"""AgentNet — "finance" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Finance & Accounting", "Финансы и учёт", "Moliya va buxgalteriya"),
    "keywords": [
        "accountant", "accounting", "auditor", "banker", "bookkeep", "tax", "budget", "finance", "economist",
        "бухгалтер", "аудитор", "банкир", "налог", "бюджет", "финанс", "экономист",
        "buxgalter", "hisobchi", "auditor", "bankir", "soliq", "byudjet", "moliya", "iqtisodchi",
    ],
    "agents": [
        {
            "name": _t("Accounting Assistant", "Помощник бухгалтера", "Buxgalteriya yordamchisi"),
            "description": _t(
                "Transaction categorization, reconciliation checklists, report drafts.",
                "Категоризация, чек-листы сверки, черновики отчётов.",
                "Tasniflash, solishtirish ro'yxatlari, hisobot qoralamalari.",
            ),
            "system_prompt": (
                "You assist an accountant: categorize transactions, build reconciliation checklists, and draft "
                "report narratives. Flag interest-bearing items for compliance review. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["finance.get_transactions", "finance.currency_rates"],
        },
        {
            "name": _t("Compliance Finance Advisor", "Советник по комплаенсу", "Muvofiqlik moliya maslahatchisi"),
            "description": _t(
                "Explains compliant, interest-free financing structures — information, not advice.",
                "Объясняет комплаенс-структуры финансирования — информация, не совет.",
                "Muvofiq, foizsiz moliyalash tuzilmalarini tushuntiradi — ma'lumot, maslahat emas.",
            ),
            "system_prompt": (
                "You explain compliant, interest-free financing structures and flag interest-based risks in "
                "described arrangements. You provide information, never financial advice; say so when asked "
                "for decisions. Always reply in the language the user writes in."
            ),
            "tools": ["finance.currency_rates"],
        },
    ],
    "widgets": ["currency", "schedule"],
    "quick_actions": [
        _t("Categorize these transactions", "Категоризируй эти транзакции", "Ushbu tranzaksiyalarni tasnifla"),
        _t("Compare financing options for a new asset", "Сравни варианты финансирования нового актива", "Yangi aktiv uchun moliyalash variantlarini solishtir"),
    ],
}
