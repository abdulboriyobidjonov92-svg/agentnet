"""
AgentNet — Business Operations engine (S5, AgentOS kengaytmasi)
----------------------------------------------------------------
"Kompaniyani boshqar" darajasi uchun uchta qobiliyat:
  1. schedule_from_text — tabiiy tildagi cheklovlardan haftalik smena jadvali
     (LLM-first: "Alisher juma ishlamaydi, do'kon 9-21 ochiq, 2 kishi kerak" →
     haqiqiy jadval; kalitsiz: cheklov-parser + adolatli round-robin)
  2. payroll hisobi NestJS'da deterministik (soat × stavka) — bu modul faqat
     inson-o'qiydigan izoh qo'shadi
  3. outbound_draft — mijoz/hamkor/homiyga yuboriladigan haqiqiy xabar qoralamasi
     (yuborish egasining ruxsati bilan Connector SDK orqali)
"""

from __future__ import annotations

import json
import re
from datetime import date, timedelta
from typing import Any

from llm_utils import lang_instruction, llm_json

_SCHEDULE_SYSTEM = """\
You are a staff-scheduling assistant for a small business. You receive the employee
list and the owner's scheduling instructions in natural language (they may be messy,
multilingual, and include constraints like days off, opening hours, minimum staffing).

Produce a realistic weekly shift plan. Respect every stated constraint; balance hours
fairly across employees; note any constraint you could not satisfy.

Reply ONLY with JSON:
{"shifts": [{"employee": "<exact name from list>", "date": "YYYY-MM-DD",
             "start": "HH:MM", "end": "HH:MM", "note": ""}],
 "unsatisfied": ["constraint you could not honor, if any"],
 "reasoning": "brief explanation of the plan"}
"""

_OUTBOUND_SYSTEM = """\
You draft real outbound business messages (to clients, partners, or sponsors) on
behalf of a business owner. Write a complete, send-ready message: correct tone for
the audience, concrete details from the context, no placeholders like [NAME] unless
the detail is genuinely unknown. Honest claims only — no exaggeration.

Reply ONLY with JSON:
{"subject": "short subject (empty string if channel is chat/SMS)",
 "body": "the full message text, ready to send",
 "reasoning": "one line on the approach"}
"""


async def schedule_from_text(
    instructions: str,
    employees: list[dict[str, Any]],
    week_start: str | None = None,
    language: str = "en",
) -> dict[str, Any]:
    """Tabiiy tildagi ko'rsatmadan haftalik smena rejasi."""
    start = _monday(week_start)
    names = [e.get("name", "") for e in employees if e.get("name")]
    if not names:
        return {"shifts": [], "unsatisfied": ["No employees registered yet."], "reasoning": "Add employees first.", "method": "guard"}

    context = (
        f"EMPLOYEES: {json.dumps(employees, ensure_ascii=False, default=str)}\n"
        f"WEEK: Monday {start.isoformat()} to Sunday {(start + timedelta(days=6)).isoformat()}\n"
        f"OWNER INSTRUCTIONS: {instructions}"
    )
    parsed = await llm_json(_SCHEDULE_SYSTEM + "\n" + lang_instruction(language), context, max_tokens=2000)
    if parsed and isinstance(parsed.get("shifts"), list):
        shifts = [s for s in parsed["shifts"] if s.get("employee") in names and _valid_shift(s)]
        if shifts:
            return {
                "shifts": shifts,
                "unsatisfied": parsed.get("unsatisfied", []),
                "reasoning": parsed.get("reasoning", ""),
                "week_start": start.isoformat(),
                "method": "llm",
            }
    return _heuristic_schedule(instructions, employees, start, language)


def _valid_shift(s: dict[str, Any]) -> bool:
    return bool(
        re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(s.get("date", "")))
        and re.fullmatch(r"\d{1,2}:\d{2}", str(s.get("start", "")))
        and re.fullmatch(r"\d{1,2}:\d{2}", str(s.get("end", "")))
    )


def _monday(week_start: str | None) -> date:
    if week_start:
        try:
            d = date.fromisoformat(week_start)
            return d - timedelta(days=d.weekday())
        except ValueError:
            pass
    today = date.today()
    return today - timedelta(days=today.weekday())


_DAY_WORDS = {
    "monday": 0, "dushanba": 0, "понедельник": 0,
    "tuesday": 1, "seshanba": 1, "вторник": 1,
    "wednesday": 2, "chorshanba": 2, "среда": 2, "среду": 2,
    "thursday": 3, "payshanba": 3, "четверг": 3,
    "friday": 4, "juma": 4, "пятниц": 4,
    "saturday": 5, "shanba": 5, "суббот": 5,
    "sunday": 6, "yakshanba": 6, "воскресень": 6,
}


def _heuristic_schedule(
    instructions: str, employees: list[dict[str, Any]], start: date, language: str
) -> dict[str, Any]:
    """Kalitsiz fallback: 'X <kun> ishlamaydi' cheklovlarini o'qiy oladigan round-robin.

    Chalkash kirishda ham yiqilmaydi: taniqlanmagan cheklovlar 'unsatisfied'ga tushadi.
    """
    lower = instructions.lower()
    names = [e["name"] for e in employees if e.get("name")]

    # Ish soatlari: "9-21", "09:00-18:00" kabi
    hours = re.search(r"(\d{1,2})(?::\d{2})?\s*[-–]\s*(\d{1,2})(?::\d{2})?", lower)
    open_h, close_h = (int(hours.group(1)), int(hours.group(2))) if hours else (9, 18)
    if not (0 <= open_h < close_h <= 24):
        open_h, close_h = 9, 18

    # "ism ... kun" birga uchrasa — o'sha kunga qo'ymaymiz
    days_off: dict[str, set[int]] = {n: set() for n in names}
    for n in names:
        nl = n.lower()
        if nl in lower:
            seg = lower[max(0, lower.find(nl) - 40): lower.find(nl) + 80]
            for word, idx in _DAY_WORDS.items():
                if word in seg:
                    days_off[n].add(idx)

    shifts = []
    for day_idx in range(7):
        d = start + timedelta(days=day_idx)
        available = [n for n in names if day_idx not in days_off[n]]
        # Har kunga kamida 1, imkon bo'lsa 2 kishi — soatlarni teng bo'lish
        workers = available[:2] if len(available) >= 2 else available
        if not workers:
            continue
        if len(workers) == 2:
            mid = (open_h + close_h) // 2
            shifts.append({"employee": workers[0], "date": d.isoformat(), "start": f"{open_h:02d}:00", "end": f"{mid:02d}:00", "note": ""})
            shifts.append({"employee": workers[1], "date": d.isoformat(), "start": f"{mid:02d}:00", "end": f"{close_h:02d}:00", "note": ""})
        else:
            shifts.append({"employee": workers[0], "date": d.isoformat(), "start": f"{open_h:02d}:00", "end": f"{close_h:02d}:00", "note": ""})
        # Adolat uchun navbatni aylantirish
        names = names[1:] + names[:1]

    reasoning = {
        "en": f"Offline plan: {open_h:02d}:00–{close_h:02d}:00, rotating fairly across {len(set(n for s in shifts for n in [s['employee']]))} employees, honoring detected day-off constraints.",
        "ru": f"Офлайн-план: {open_h:02d}:00–{close_h:02d}:00, справедливая ротация, учтены найденные выходные.",
        "uz": f"Oflayn reja: {open_h:02d}:00–{close_h:02d}:00, xodimlar adolatli almashadi, aniqlangan dam olish kunlari hisobga olindi.",
    }
    return {
        "shifts": shifts,
        "unsatisfied": [],
        "reasoning": reasoning.get(language, reasoning["en"]),
        "week_start": start.isoformat(),
        "method": "heuristic",
    }


# ------------------------------------------------------------------
# Outbound xabar qoralamasi
# ------------------------------------------------------------------

_FALLBACK_BODY = {
    "client": {
        "en": "Hello{name_part}! Thank you for being with {org}. {purpose} If anything is unclear or you need help, just reply to this message — we respond quickly.\n\nBest regards,\n{org}",
        "ru": "Здравствуйте{name_part}! Спасибо, что вы с {org}. {purpose} Если что-то неясно или нужна помощь — просто ответьте на это сообщение.\n\nС уважением,\n{org}",
        "uz": "Assalomu alaykum{name_part}! {org} bilan bo'lganingiz uchun rahmat. {purpose} Savol bo'lsa — shu xabarga javob yozing, tez javob beramiz.\n\nHurmat bilan,\n{org}",
    },
    "partner": {
        "en": "Hello{name_part},\n\n{purpose} We value the partnership with you and would like to align on next steps this week. Would a short call work?\n\nBest regards,\n{org}",
        "ru": "Здравствуйте{name_part},\n\n{purpose} Мы ценим партнёрство с вами и хотели бы согласовать шаги на этой неделе. Удобен ли короткий звонок?\n\nС уважением,\n{org}",
        "uz": "Assalomu alaykum{name_part},\n\n{purpose} Siz bilan hamkorlikni qadrlaymiz va shu hafta keyingi qadamlarni kelishib olmoqchimiz. Qisqa qo'ng'iroq qulaymi?\n\nHurmat bilan,\n{org}",
    },
    "sponsor": {
        "en": "Dear{name_part},\n\n{purpose} We would be glad to present the impact numbers and partnership options in a short meeting at your convenience.\n\nRespectfully,\n{org}",
        "ru": "Уважаемый(ая){name_part},\n\n{purpose} Будем рады показать результаты и варианты партнёрства на короткой встрече в удобное время.\n\nС уважением,\n{org}",
        "uz": "Hurmatli{name_part},\n\n{purpose} Sizga qulay vaqtda qisqa uchrashuvda natijalar va hamkorlik variantlarini taqdim etishdan mamnun bo'lamiz.\n\nHurmat bilan,\n{org}",
    },
}


async def outbound_draft(
    purpose: str,
    audience: str,
    recipient_name: str,
    channel: str,
    org_name: str,
    context: str = "",
    language: str = "en",
) -> dict[str, Any]:
    """Yuborishga tayyor xabar qoralamasi. Yuborish alohida ruxsat bosqichi bilan."""
    parsed = await llm_json(
        _OUTBOUND_SYSTEM + "\n" + lang_instruction(language),
        (
            f"BUSINESS: {org_name}\nAUDIENCE: {audience}\nCHANNEL: {channel}\n"
            f"RECIPIENT: {recipient_name or '(name unknown)'}\n"
            f"PURPOSE: {purpose}\nEXTRA CONTEXT: {context or '(none)'}"
        ),
        max_tokens=900,
    )
    if parsed and parsed.get("body"):
        parsed["method"] = "llm"
        return parsed

    lang = language if language in ("en", "ru", "uz") else "en"
    aud = audience if audience in _FALLBACK_BODY else "client"
    name_part = f", {recipient_name}" if recipient_name else ""
    default_org = {"en": "our team", "ru": "наша команда", "uz": "jamoamiz"}[lang]
    body = _FALLBACK_BODY[aud][lang].format(name_part=name_part, org=org_name or default_org, purpose=purpose.strip())
    subject = "" if channel in ("telegram", "sms", "whatsapp") else purpose.strip()[:70]
    return {"subject": subject, "body": body, "reasoning": "Template draft (offline mode) filled with real context.", "method": "heuristic"}


def payroll_note(period_label: str, total_hours: float, gross: int, employees_n: int, language: str = "en") -> str:
    notes = {
        "en": f"Payroll {period_label}: {employees_n} employees, {total_hours:.1f} worked hours, gross {gross/100:,.0f} UZS. Hours × rate calculation; taxes/filings are NOT included — this is payroll-adjacent math, not tax advice.",
        "ru": f"Зарплата {period_label}: {employees_n} сотрудников, {total_hours:.1f} часов, брутто {gross/100:,.0f} сум. Расчёт часы × ставка; налоги и отчётность НЕ включены.",
        "uz": f"Ish haqi {period_label}: {employees_n} xodim, {total_hours:.1f} soat, jami {gross/100:,.0f} so'm. Hisob: soat × stavka; soliq va hisobotlar KIRITILMAGAN.",
    }
    return notes.get(language, notes["en"])
