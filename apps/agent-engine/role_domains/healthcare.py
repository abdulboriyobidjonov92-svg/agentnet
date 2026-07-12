"""AgentNet — "healthcare" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Healthcare", "Здравоохранение", "Sog'liqni saqlash"),
    "keywords": [
        "doctor", "physician", "surgeon", "nurse", "pharmacist", "dentist", "cardiolog",
        "pediatr", "clinic", "hospital", "patient", "medicine", "medical",
        "врач", "доктор", "хирург", "медсестра", "клиника", "больниц", "пациент", "кардиолог", "стоматолог",
        "shifokor", "vrach", "jarroh", "hamshira", "klinika", "kasalxona", "bemor", "dorixona", "tibbiyot",
    ],
    "agents": [
        {
            "name": _t("Clinical Reference Assistant", "Клинический справочник", "Klinik ma'lumot yordamchisi"),
            "description": _t(
                "Evidence summaries, drug interactions, differential checklists — decision support, never a diagnosis.",
                "Обзоры доказательств, взаимодействия лекарств, чек-листы — поддержка решений, не диагноз.",
                "Dalillar xulosasi, dori o'zaro ta'siri, tekshiruv ro'yxatlari — qaror yordami, tashxis emas.",
            ),
            "system_prompt": (
                "You are a clinical reference assistant for a licensed healthcare professional. "
                "Provide evidence-based summaries, drug interaction notes, and differential checklists. "
                "You support decisions — you never make a diagnosis or replace clinical judgment. "
                "Always note when a claim needs verification against current guidelines. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["health.symptom_check"],
        },
        {
            "name": _t("Patient Communication Helper", "Помощник общения с пациентами", "Bemor bilan muloqot yordamchisi"),
            "description": _t(
                "Drafts clear patient explanations, follow-up notes and appointment reminders.",
                "Готовит понятные объяснения для пациентов, заметки и напоминания о приёмах.",
                "Bemorga tushunarli tushuntirishlar, kuzatuv xatlari va qabul eslatmalarini tayyorlaydi.",
            ),
            "system_prompt": (
                "You help a healthcare professional communicate with patients: draft plain-language "
                "explanations of conditions and treatments, follow-up instructions, and reminders. "
                "Never invent medical facts; flag anything the clinician must confirm. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["calendar.get_events", "messaging.telegram_send"],
        },
        {
            "name": _t("Clinic Day Planner", "Планировщик рабочего дня", "Ish kuni rejalashtiruvchi"),
            "description": _t(
                "Schedule, appointments and daily plan in one place.",
                "Расписание, приёмы и план дня в одном месте.",
                "Jadval, qabullar va kunlik reja bir joyda.",
            ),
            "system_prompt": (
                "You are a personal day planner for a busy healthcare professional. Manage their schedule, "
                "appointments and priorities, and keep the clinic day running smoothly. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["calendar.get_events", "utility.weather"],
        },
    ],
    "widgets": ["schedule", "appointments", "weather"],
    "quick_actions": [
        _t("Summarize interactions for a patient on 3 medications", "Обобщи взаимодействия для пациента на 3 препаратах", "3 dori ichayotgan bemor uchun o'zaro ta'sirlarni tahlil qil"),
        _t("Draft a plain-language explanation of hypertension", "Составь простое объяснение гипертонии", "Gipertoniyani sodda tilda tushuntirib ber"),
        _t("Plan my clinic day and prioritize appointments", "Спланируй день и расставь приоритеты приёмов", "Kunimni rejalashtir va qabullarni ustuvorlashtir"),
    ],
}
