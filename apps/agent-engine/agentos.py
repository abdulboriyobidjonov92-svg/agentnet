"""
AgentNet — AgentOS (korxona/enterprise orkestratori)
------------------------------------------------------
Flagman oqim: rahbar bitta buyruq beradi ("bu yangi mahsulotni ishga tushir")
→ Orchestrator uni bo'ladi va rol-asosidagi C-suite agentlariga yo'naltiradi
→ har biri o'z hujjatini/tahlilini ishlab chiqaradi
→ har bir amal Ethical Decision Engine'dan o'tadi
→ natijalar BITTA hisobotga yig'iladi.

Beshta C-suite roli (Part 1 agent/tool infratuzilmasidan foydalanadi):
  CEO — strategiya, ustuvorlik
  CFO — byudjet, pul oqimi, moliyaviy hisobot
  CMO — kontent, reklama, SEO/SMM
  CLO — shartnoma, litsenziya, muvofiqlik
  CTO — kod, xatolarni tuzatish, deploy yordami

LLM-first (Claude bo'lsa chuqur), aks holda parametrlangan heuristik fallback.
Har bir kirish Halal Filter'dan o'tadi (main.py'dagi _guard).
"""

from __future__ import annotations

from typing import Any

import ethics as ethics_engine
from llm_utils import lang_instruction, llm_json

# C-suite rollari — nomlar, tavsiflar, fallback matnlari (3 tilda)
CSUITE: dict[str, dict[str, Any]] = {
    "ceo": {
        "label": {"en": "AI-CEO", "ru": "AI-CEO", "uz": "AI-CEO"},
        "focus": {"en": "strategy & prioritization", "ru": "стратегия и приоритеты", "uz": "strategiya va ustuvorlik"},
        "fallback": {
            "en": "Strategy: define the single measurable objective and the 3 highest-leverage moves. Sequence departments so nothing blocks the critical path; set a weekly checkpoint and one clear owner per workstream.",
            "ru": "Стратегия: определить одну измеримую цель и 3 самых результативных шага. Выстроить последовательность отделов так, чтобы ничто не блокировало критический путь; еженедельный контроль и один ответственный на поток.",
            "uz": "Strategiya: bitta o'lchanadigan maqsad va 3 ta eng samarali qadamni belgilash. Bo'limlarni kritik yo'l bloklanmaydigan tartibda joylash; haftalik nazorat va har oqim uchun bitta mas'ul.",
        },
    },
    "cfo": {
        "label": {"en": "AI-CFO", "ru": "AI-CFO", "uz": "AI-CFO"},
        "focus": {"en": "budget, cash flow, reporting", "ru": "бюджет, денежный поток, отчётность", "uz": "byudjet, pul oqimi, hisobot"},
        "fallback": {
            "en": "Finance: draft a lean budget with a 3-month cash runway view. Separate one-off vs recurring costs, flag any interest-bearing item for a Shariah-compliant alternative, and tie each spend to an expected return.",
            "ru": "Финансы: составить экономный бюджет с обзором денежного запаса на 3 месяца. Разделить разовые и постоянные затраты, пометить процентные позиции для шариатски-совместимой альтернативы, привязать каждый расход к ожидаемой отдаче.",
            "uz": "Moliya: 3 oylik pul zaxirasi ko'rinishi bilan tejamkor byudjet tuzish. Bir martalik va doimiy xarajatlarni ajratish, foizli moddalarni shariatga mos muqobil uchun belgilash, har xarajatni kutilgan daromadga bog'lash.",
        },
    },
    "cmo": {
        "label": {"en": "AI-CMO", "ru": "AI-CMO", "uz": "AI-CMO"},
        "focus": {"en": "content, ads, SEO/SMM", "ru": "контент, реклама, SEO/SMM", "uz": "kontent, reklama, SEO/SMM"},
        "fallback": {
            "en": "Marketing: define the core message and the single best channel to start. Draft a 2-week content calendar (3 posts/week), an honest ad angle (no exaggeration), and one measurable launch metric.",
            "ru": "Маркетинг: определить ключевое сообщение и лучший стартовый канал. Составить контент-план на 2 недели (3 поста/нед), честный рекламный посыл (без преувеличений) и одну измеримую метрику запуска.",
            "uz": "Marketing: asosiy xabar va boshlash uchun eng yaxshi bitta kanalni aniqlash. 2 haftalik kontent-reja (haftasiga 3 post), halol reklama yo'nalishi (mubolag'asiz) va bitta o'lchanadigan ishga tushirish ko'rsatkichi.",
        },
    },
    "clo": {
        "label": {"en": "AI-CLO", "ru": "AI-CLO", "uz": "AI-CLO"},
        "focus": {"en": "contracts, licensing, compliance", "ru": "договоры, лицензии, соответствие", "uz": "shartnoma, litsenziya, muvofiqlik"},
        "fallback": {
            "en": "Legal: list the required documents (registration, licenses, contracts) and the exact office/portal for each. Put every agreement in writing, keep stamped copies, and flag any compliance deadline early.",
            "ru": "Юридически: перечислить нужные документы (регистрация, лицензии, договоры) и точное ведомство/портал для каждого. Всё письменно, хранить копии с отметками, заранее отмечать сроки соответствия.",
            "uz": "Huquqiy: kerakli hujjatlar (ro'yxatdan o'tish, litsenziyalar, shartnomalar) va har biri uchun aniq idora/portal ro'yxatini tuzish. Har kelishuvni yozma qilish, muhrlangan nusxalarni saqlash, muvofiqlik muddatlarini oldindan belgilash.",
        },
    },
    "cto": {
        "label": {"en": "AI-CTO", "ru": "AI-CTO", "uz": "AI-CTO"},
        "focus": {"en": "code, bug fixing, deployment", "ru": "код, исправление ошибок, деплой", "uz": "kod, xatolarni tuzatish, deploy"},
        "fallback": {
            "en": "Technology: ship the smallest working version first and measure it. Choose proven, boring tools for anything critical, set up basic monitoring, and keep a one-command deploy so releases are cheap and reversible.",
            "ru": "Технологии: сначала выпустить минимальную рабочую версию и измерить. Для критичного — проверенные инструменты, базовый мониторинг, деплой одной командой (дёшево и обратимо).",
            "uz": "Texnologiya: avval eng kichik ishlaydigan versiyani chiqarib o'lchash. Muhim narsalar uchun sinalgan vositalar, oddiy monitoring, bitta buyruqli deploy — relizlar arzon va qaytariladigan bo'lsin.",
        },
    },
}

DEFAULT_ROLES = ["ceo", "cfo", "cmo", "clo", "cto"]

_ORCH_SYSTEM = """\
You are the AgentOS Orchestrator for a company. A leader issues one high-level
command. Break it down and assign concrete deliverables to the relevant
C-suite agents (ceo, cfo, cmo, clo, cto). For each assigned role, produce the
ACTUAL deliverable (a concrete analysis/plan/draft, not a promise), grounded in
the company's context. Keep each deliverable under 130 words, structured.
Only include roles that are genuinely relevant to this command.
Reply ONLY with JSON:
{"assignments": [{"role": "ceo|cfo|cmo|clo|cto", "title": "...", "output": "..."}],
 "report": "one-paragraph executive roll-up of the whole effort"}
"""

_REPORT_FALLBACK = {
    "en": "Executive roll-up (offline mode): {n} departments engaged ({roles}). Sequence — CEO sets the single objective, CFO frames the budget and runway, CMO prepares the honest go-to-market, CLO clears documents and compliance, CTO ships the minimal version. Each deliverable above is immediately actionable; with an Anthropic API key these become fully company-specific.",
    "ru": "Сводка для руководства (офлайн-режим): задействовано {n} отделов ({roles}). Последовательность — CEO задаёт цель, CFO — бюджет и запас, CMO — честный вывод на рынок, CLO — документы и соответствие, CTO — минимальная версия. Каждый результат готов к действию; с ключом Anthropic API они станут полностью специфичными для компании.",
    "uz": "Rahbariyat uchun xulosa (oflayn rejim): {n} bo'lim jalb qilindi ({roles}). Ketma-ketlik — CEO maqsadni belgilaydi, CFO byudjet va zaxirani tuzadi, CMO halol bozorga chiqishni tayyorlaydi, CLO hujjat va muvofiqlikni hal qiladi, CTO minimal versiyani chiqaradi. Har bir natija darhol amalga oshiriladi; Anthropic API kaliti bilan ular to'liq kompaniyaga xoslashadi.",
}


def csuite_catalog(language: str = "en") -> list[dict[str, str]]:
    return [
        {
            "role": role,
            "label": cfg["label"].get(language, cfg["label"]["en"]),
            "focus": cfg["focus"].get(language, cfg["focus"]["en"]),
        }
        for role, cfg in CSUITE.items()
    ]


async def run_command(
    command: str,
    org_name: str,
    org_kind: str,
    industry: str,
    roles: list[str] | None,
    values: dict[str, Any] | None,
    language: str = "en",
) -> dict[str, Any]:
    roles = [r for r in (roles or DEFAULT_ROLES) if r in CSUITE] or DEFAULT_ROLES
    context = (
        f"COMPANY: {org_name} ({org_kind}"
        + (f", {industry}" if industry else "")
        + f")\nLEADER COMMAND: {command}\nAVAILABLE ROLES: {', '.join(roles)}"
    )

    parsed = await llm_json(
        _ORCH_SYSTEM + "\n" + lang_instruction(language),
        context,
        max_tokens=2200,
    )

    departments: list[dict[str, Any]] = []
    method = "llm"
    if parsed and parsed.get("assignments"):
        for a in parsed["assignments"]:
            role = a.get("role")
            if role not in CSUITE:
                continue
            departments.append({
                "role": role,
                "label": CSUITE[role]["label"].get(language, CSUITE[role]["label"]["en"]),
                "title": a.get("title", ""),
                "output": a.get("output", ""),
            })
        report = parsed.get("report", "")
    else:
        method = "heuristic"
        for role in roles:
            cfg = CSUITE[role]
            departments.append({
                "role": role,
                "label": cfg["label"].get(language, cfg["label"]["en"]),
                "title": cfg["focus"].get(language, cfg["focus"]["en"]),
                "output": cfg["fallback"].get(language, cfg["fallback"]["en"]),
            })
        report = _REPORT_FALLBACK.get(language, _REPORT_FALLBACK["en"]).format(
            n=len(departments),
            roles=", ".join(d["label"] for d in departments),
        )

    # Har bir bo'lim natijasi Ethical Decision Engine'dan o'tadi
    for dept in departments:
        verdict = await ethics_engine.evaluate(
            f"{dept['title']}: {dept['output'][:400]}",
            values,
            profession=f"{dept['label']} of {org_name}",
            language=language,
        )
        dept["ethics"] = {"verdict": verdict["verdict"], "reasoning": verdict["reasoning"]}

    verdict_counts: dict[str, int] = {}
    for d in departments:
        v = d["ethics"]["verdict"]
        verdict_counts[v] = verdict_counts.get(v, 0) + 1

    return {
        "command": command,
        "departments": departments,
        "report": report,
        "ethics_summary": verdict_counts,
        "method": method,
    }
