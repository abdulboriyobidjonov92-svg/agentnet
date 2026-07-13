"""
AgentNet — "One Command" Super Mode
-------------------------------------
Beshta imkoniyatning birgalikdagi flagman namoyishi. Foydalanuvchi bitta
buyruq beradi ("bugungi kunimni boshqar") va platforma:

  1. KONTEKST   — Life Twin faktlari, maqsadlar, kalendar (data spine)
  2. REJA       — kunlik vaqt-bloklangan reja (Goal Achievement uslubida)
  3. AGENTLAR   — reja bloklarini mos agent-rollar orqali bajarish (Fusion routing)
  4. AXLOQ      — har bir amal Ethical Decision Engine'dan o'tadi
  5. BILIM      — jonli ma'lumot (ob-havo, kurs) manba atributsiyasi bilan
  6. HISOBOT    — yakuniy xulosa

Har bir bosqich real modul chaqiruvi — teatr emas, kompozitsiya.
"""

from __future__ import annotations

from typing import Any

import ethics as ethics_engine
import knowledge_sync
from goal_engine import execute_task
from llm_utils import lang_instruction, llm_json
from tools.calendar_tools import get_events

_PLAN_SYSTEM = """\
You are AgentNet's Super Mode day planner. Build a realistic time-blocked
plan for the user's day from their command, calendar events, Life Twin facts,
and active goals. 5-8 blocks, each with: time (HH:MM-HH:MM), activity,
and optionally agent_role (accountant, business_consultant, marketer, lawyer,
doctor, teacher, engineer, government_liaison, personal_assistant, researcher)
when an AI agent should produce a deliverable for that block.
Respect prayer times culturally when the user is Muslim (values tradition islamic).
Reply ONLY with JSON:
{"blocks": [{"time": "...", "activity": "...", "agent_role": null_or_string}],
 "focus": "one sentence: the day's single most important outcome"}
"""

_T = {
    "en": {
        "s_context": "Context gathered (Life Twin)",
        "s_plan": "Day plan built",
        "s_agents": "Agent tasks executed",
        "s_ethics": "Ethics review",
        "s_knowledge": "Live knowledge pulled",
        "s_report": "Report",
        "ctx_facts": "Life Twin facts", "ctx_goals": "active goals", "ctx_events": "calendar events",
        "plan_fallback_focus": "Move the most important goal forward while keeping obligations intact.",
        "blocks": [
            ("07:00-08:00", "Morning routine, prayer, planning", None),
            ("08:00-11:00", "Deep work on the top active goal", "personal_assistant"),
            ("11:00-12:00", "Communications: messages, calls, follow-ups", "personal_assistant"),
            ("13:00-14:00", "Lunch and rest (Friday: Jumu'ah)", None),
            ("14:00-17:00", "Profession work block", None),
            ("17:00-18:00", "Finances: record today's income/expenses", "accountant"),
            ("20:00-21:00", "Family time and tomorrow's 3 priorities", None),
        ],
        "report": "Day orchestrated: {blocks} blocks planned, {deliverables} agent deliverables produced, {ethics} actions ethics-checked ({verdicts}), live data attached from {sources} sources.",
        "offline_note": " Offline mode: with an Anthropic API key, planning and deliverables become fully personalized.",
    },
    "ru": {
        "s_context": "Контекст собран (Life Twin)",
        "s_plan": "План дня построен",
        "s_agents": "Задачи агентов выполнены",
        "s_ethics": "Этическая проверка",
        "s_knowledge": "Живые данные получены",
        "s_report": "Отчёт",
        "ctx_facts": "фактов Life Twin", "ctx_goals": "активных целей", "ctx_events": "событий календаря",
        "plan_fallback_focus": "Продвинуть главную цель, сохранив обязательства.",
        "blocks": [
            ("07:00-08:00", "Утренние дела, намаз, планирование", None),
            ("08:00-11:00", "Глубокая работа над главной целью", "personal_assistant"),
            ("11:00-12:00", "Коммуникации: сообщения, звонки", "personal_assistant"),
            ("13:00-14:00", "Обед и отдых (пятница: джума)", None),
            ("14:00-17:00", "Профессиональный блок", None),
            ("17:00-18:00", "Финансы: записать доходы/расходы дня", "accountant"),
            ("20:00-21:00", "Семья и 3 приоритета завтрашнего дня", None),
        ],
        "report": "День оркестрован: {blocks} блоков в плане, {deliverables} результатов агентов, {ethics} действий проверено этикой ({verdicts}), живые данные из {sources} источников.",
        "offline_note": " Офлайн-режим: с ключом Anthropic API план и результаты станут полностью персональными.",
    },
    "uz": {
        "s_context": "Kontekst yig'ildi (Life Twin)",
        "s_plan": "Kun rejasi qurildi",
        "s_agents": "Agent vazifalari bajarildi",
        "s_ethics": "Axloqiy tekshiruv",
        "s_knowledge": "Jonli ma'lumot olindi",
        "s_report": "Hisobot",
        "ctx_facts": "Life Twin fakti", "ctx_goals": "faol maqsad", "ctx_events": "kalendar tadbiri",
        "plan_fallback_focus": "Majburiyatlarni saqlagan holda eng muhim maqsadni oldinga surish.",
        "blocks": [
            ("07:00-08:00", "Tonggi tartib, namoz, rejalashtirish", None),
            ("08:00-11:00", "Asosiy maqsad ustida chuqur ish", "personal_assistant"),
            ("11:00-12:00", "Muloqot: xabarlar, qo'ng'iroqlar", "personal_assistant"),
            ("13:00-14:00", "Tushlik va dam (juma: juma namozi)", None),
            ("14:00-17:00", "Kasbiy ish bloki", None),
            ("17:00-18:00", "Moliya: bugungi kirim-chiqimni yozish", "accountant"),
            ("20:00-21:00", "Oila vaqti va ertangi 3 ustuvorlik", None),
        ],
        "report": "Kun boshqarildi: rejada {blocks} blok, {deliverables} agent natijasi, {ethics} amal axloqdan tekshirildi ({verdicts}), {sources} manbadan jonli ma'lumot.",
        "offline_note": " Oflayn rejim: Anthropic API kaliti bilan reja va natijalar to'liq shaxsiylashadi.",
    },
}


async def run(
    command: str,
    twin_facts: list[dict[str, Any]],
    goals: list[dict[str, Any]],
    values: dict[str, Any] | None,
    profession: str = "",
    city: str = "Tashkent",
    language: str = "en",
) -> dict[str, Any]:
    T = _T.get(language, _T["en"])
    stages: list[dict[str, Any]] = []

    # ---- 1. KONTEKST (Life Twin — data spine) ----
    calendar = await get_events()
    events = calendar.get("tadbirlar", [])
    facts_by_cat: dict[str, int] = {}
    for f in twin_facts:
        facts_by_cat[f["category"]] = facts_by_cat.get(f["category"], 0) + 1
    stages.append({
        "id": "context",
        "title": T["s_context"],
        "output": {
            "facts_total": len(twin_facts),
            "facts_by_category": facts_by_cat,
            "goals_active": len(goals),
            "goal_titles": [g.get("title", "") for g in goals[:3]],
            "calendar_events": [{"title": e.get("sarlavha"), "time": e.get("boshlanish")} for e in events],
        },
    })

    # ---- 2. REJA (Goal Achievement uslubi) ----
    facts_text = "\n".join(f"- [{f['category']}] {f['label']}: {f['value']}" for f in twin_facts) or "(none)"
    goals_text = "\n".join(f"- {g.get('title')}" for g in goals) or "(none)"
    events_text = "\n".join(f"- {e.get('sarlavha')} @ {e.get('boshlanish')}" for e in events) or "(none)"
    plan = await llm_json(
        _PLAN_SYSTEM + "\n" + lang_instruction(language),
        f"COMMAND: {command}\nPROFESSION: {profession or 'unknown'}\n"
        f"VALUES TRADITION: {(values or {}).get('tradition', 'islamic')}\n"
        f"CALENDAR:\n{events_text}\nLIFE TWIN FACTS:\n{facts_text}\nACTIVE GOALS:\n{goals_text}",
        max_tokens=1200,
    )
    plan_method = "llm"
    if not (plan and plan.get("blocks")):
        plan_method = "heuristic"
        plan = {
            "blocks": [{"time": tm, "activity": act, "agent_role": role} for tm, act, role in T["blocks"]],
            "focus": T["plan_fallback_focus"],
        }
    stages.append({
        "id": "plan",
        "title": T["s_plan"],
        "output": {"focus": plan.get("focus", ""), "blocks": plan["blocks"], "method": plan_method},
    })

    # ---- 3. AGENTLAR (Fusion routing: bloklarni mos rollar bajaradi) ----
    agent_blocks = [b for b in plan["blocks"] if b.get("agent_role")][:3]
    deliverables = []
    for block in agent_blocks:
        result = await execute_task(
            {"title": block["activity"], "description": "", "agent_role": block["agent_role"]},
            twin_facts,
            goal_title=goals[0].get("title", "") if goals else command,
            profession=profession,
            language=language,
        )
        deliverables.append({
            "time": block.get("time", ""),
            "activity": block["activity"],
            "agent_role": block["agent_role"],
            "deliverable": result["result"],
            "method": result["method"],
        })
    stages.append({"id": "agents", "title": T["s_agents"], "output": {"deliverables": deliverables}})

    # ---- 4. AXLOQ (har bir amal Ethical Decision Engine'dan) ----
    ethics_results = []
    for block in agent_blocks:
        verdict = await ethics_engine.evaluate(
            f"{block['activity']} ({block.get('agent_role')})",
            values,
            profession=profession,
            language=language,
        )
        ethics_results.append({
            "action": block["activity"],
            "verdict": verdict["verdict"],
            "reasoning": verdict["reasoning"],
            "method": verdict["method"],
        })
    stages.append({"id": "ethics", "title": T["s_ethics"], "output": {"checks": ethics_results}})

    # ---- 5. BILIM (jonli manbalar, atributsiya bilan) ----
    weather = await knowledge_sync.fetch_weather(city, default_city=city)
    currency = await knowledge_sync.fetch_currency("usd")
    knowledge = {"sources": [weather, currency]}
    stages.append({"id": "knowledge", "title": T["s_knowledge"], "output": knowledge})

    # ---- 6. HISOBOT ----
    verdict_counts: dict[str, int] = {}
    for r in ethics_results:
        verdict_counts[r["verdict"]] = verdict_counts.get(r["verdict"], 0) + 1
    report = T["report"].format(  # type: ignore[attr-defined]
        blocks=len(plan["blocks"]),
        deliverables=len(deliverables),
        ethics=len(ethics_results),
        verdicts=", ".join(f"{k}:{v}" for k, v in verdict_counts.items()) or "—",
        sources=sum(1 for s in knowledge["sources"] if s.get("items")),
    )
    if plan_method == "heuristic":
        report += T["offline_note"]
    stages.append({"id": "report", "title": T["s_report"], "output": {"summary": report}})

    return {"command": command, "stages": stages, "method": plan_method}
