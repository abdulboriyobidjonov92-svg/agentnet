"""
AgentNet — Autonomous Goal Achievement
----------------------------------------
Foydalanuvchi yuqori darajadagi maqsadni oddiy tilda aytadi
("daromadimni 3 baravar oshirish", "mahallamni raqamlashtirish").
Bu modul:

  1. decompose(goal_text, ...) — maqsadni bosqich (milestone) va
     vazifalarga (task) ajratadi, har biriga mos agent-rol va kadans beradi
  2. execute_task(task, ...)   — bitta vazifani "bajaradi": mos agent-rol
     nomidan konkret, foydalanuvchi darhol ishlatadigan natija ishlab chiqaradi

API tomonida cron har kuni faol maqsadlarning navbatdagi vazifalarini
shu modul orqali yuritadi — foydalanuvchi rejani o'zi boshqarmaydi.
"""

from __future__ import annotations

from typing import Any

from llm_utils import lang_instruction, llm_json

# ------------------------------------------------------------------
# 1. Maqsadni dekompozitsiya qilish
# ------------------------------------------------------------------

_DECOMPOSE_SYSTEM = """\
You are the goal-planning engine of AgentNet. The user states a high-level
life or business goal in plain language. Decompose it into a realistic,
staged plan the platform's agents can execute over time.

Rules:
- 3 milestones max, each with 2-3 concrete tasks.
- Each task gets: title, one-sentence description, agent_role (one of:
  accountant, business_consultant, marketer, lawyer, doctor, teacher,
  engineer, government_liaison, personal_assistant, researcher),
  cadence ("once" | "daily" | "weekly").
- Tasks must be executable by an AI agent producing text deliverables
  (analyses, drafts, plans, checklists, messages) — not physical actions.
- Ground the plan in the user's Life Twin facts where given.
Reply ONLY with JSON:
{"title": "...", "reasoning": "...",
 "milestones": [{"title": "...", "tasks": [{"title": "...", "description": "...",
   "agent_role": "...", "cadence": "..."}]}]}
"""

# Fallback shablonlari: maqsad turi → parametrlangan reja
_GOAL_TYPES: dict[str, list[str]] = {
    "income": ["daromad", "income", "доход", "pul top", "boyi", "triple", "oshir", "earn"],
    "business": ["biznes", "business", "do'kon", "kengaytir", "mijoz", "sotuv", "sales", "клиент"],
    "digitize": ["raqamlashtir", "digitiz", "цифров", "mahalla", "avtomatlashtir", "automate"],
    "learn": ["o'rgan", "learn", "kurs", "til o'rgan", "выучи", "study", "imtihon"],
    "health": ["vazn", "weight", "sog'l", "health", "sport", "похуд", "fitness"],
    "savings": ["jamg'ar", "save", "накоп", "omonat", "hajj", "uy uchun yig"],
}

_TEMPLATES: dict[str, dict[str, Any]] = {
    "income": {
        "milestones": [
            {"title": {"en": "Understand current position", "ru": "Понять текущее положение", "uz": "Joriy holatni tushunish"},
             "tasks": [
                 {"title": {"en": "Income & expense audit", "ru": "Аудит доходов и расходов", "uz": "Daromad-xarajat auditi"},
                  "description": {"en": "Break down current income streams and costs; find the 3 biggest leaks.", "ru": "Разобрать источники дохода и расходы; найти 3 главные утечки.", "uz": "Daromad manbalari va xarajatlarni tahlil qilish; 3 ta asosiy yo'qotishni topish."},
                  "agent_role": "accountant", "cadence": "once"},
                 {"title": {"en": "Market rate research", "ru": "Исследование рыночных ставок", "uz": "Bozor narxlarini o'rganish"},
                  "description": {"en": "Research what similar work/products earn in the current market.", "ru": "Изучить, сколько приносит аналогичная работа/товар на рынке.", "uz": "Shunga o'xshash ish/mahsulot bozorda qancha daromad keltirishini o'rganish."},
                  "agent_role": "researcher", "cadence": "once"},
             ]},
            {"title": {"en": "Grow revenue streams", "ru": "Растить источники дохода", "uz": "Daromad manbalarini o'stirish"},
             "tasks": [
                 {"title": {"en": "New income channel plan", "ru": "План нового канала дохода", "uz": "Yangi daromad kanali rejasi"},
                  "description": {"en": "Design one additional realistic income channel with first steps.", "ru": "Спроектировать один реалистичный дополнительный канал с первыми шагами.", "uz": "Bitta realistik qo'shimcha daromad kanalini birinchi qadamlari bilan loyihalash."},
                  "agent_role": "business_consultant", "cadence": "once"},
                 {"title": {"en": "Weekly sales/offer push", "ru": "Еженедельный прогон предложений", "uz": "Haftalik taklif yuritish"},
                  "description": {"en": "Draft weekly outreach/offers and track responses.", "ru": "Готовить еженедельные предложения и отслеживать отклики.", "uz": "Haftalik takliflar tayyorlash va javoblarni kuzatish."},
                  "agent_role": "marketer", "cadence": "weekly"},
             ]},
            {"title": {"en": "Protect and compound", "ru": "Защитить и приумножить", "uz": "Himoyalash va ko'paytirish"},
             "tasks": [
                 {"title": {"en": "Halal savings plan", "ru": "Халяльный план накоплений", "uz": "Halol jamg'arma rejasi"},
                  "description": {"en": "Set up a riba-free savings/reinvestment structure for new income.", "ru": "Настроить безрибовую структуру накоплений/реинвестиций.", "uz": "Yangi daromad uchun ribosiz jamg'arma/qayta-sarmoya tuzilmasini yo'lga qo'yish."},
                  "agent_role": "accountant", "cadence": "once"},
             ]},
        ],
    },
    "digitize": {
        "milestones": [
            {"title": {"en": "Map current processes", "ru": "Описать текущие процессы", "uz": "Joriy jarayonlarni xaritalash"},
             "tasks": [
                 {"title": {"en": "Process inventory", "ru": "Инвентаризация процессов", "uz": "Jarayonlar ro'yxati"},
                  "description": {"en": "List every recurring paper/manual process and who owns it.", "ru": "Перечислить все бумажные/ручные процессы и их владельцев.", "uz": "Barcha qog'oz/qo'l jarayonlarini va mas'ullarini ro'yxatlash."},
                  "agent_role": "government_liaison", "cadence": "once"},
                 {"title": {"en": "Quick-win selection", "ru": "Выбор быстрых побед", "uz": "Tezkor yutuqlarni tanlash"},
                  "description": {"en": "Pick 3 processes that digitize fastest with most impact.", "ru": "Выбрать 3 процесса с быстрым и заметным эффектом.", "uz": "Eng tez va ta'sirli raqamlashadigan 3 jarayonni tanlash."},
                  "agent_role": "engineer", "cadence": "once"},
             ]},
            {"title": {"en": "Digitize quick wins", "ru": "Цифровизовать быстрые победы", "uz": "Tezkor yutuqlarni raqamlashtirish"},
             "tasks": [
                 {"title": {"en": "Digital workflow drafts", "ru": "Черновики цифровых процессов", "uz": "Raqamli jarayon qoralamalari"},
                  "description": {"en": "Design simple digital versions (forms, registries, notifications).", "ru": "Спроектировать простые цифровые версии (формы, реестры, уведомления).", "uz": "Oddiy raqamli versiyalarni loyihalash (formalar, reyestrlar, bildirishnomalar)."},
                  "agent_role": "engineer", "cadence": "weekly"},
                 {"title": {"en": "Staff/citizen guide", "ru": "Инструкция для сотрудников/граждан", "uz": "Xodim/fuqaro yo'riqnomasi"},
                  "description": {"en": "Write plain-language guides for the new digital flow.", "ru": "Написать простые инструкции по новому цифровому процессу.", "uz": "Yangi raqamli jarayon bo'yicha sodda yo'riqnomalar yozish."},
                  "agent_role": "teacher", "cadence": "once"},
             ]},
            {"title": {"en": "Scale and report", "ru": "Масштабировать и отчитаться", "uz": "Kengaytirish va hisobot"},
             "tasks": [
                 {"title": {"en": "Progress report draft", "ru": "Черновик отчёта о прогрессе", "uz": "Taraqqiyot hisoboti qoralamasi"},
                  "description": {"en": "Summarize adoption metrics and next-phase proposal.", "ru": "Обобщить метрики внедрения и предложение следующего этапа.", "uz": "Joriy etish ko'rsatkichlari va keyingi bosqich taklifini umumlashtirish."},
                  "agent_role": "government_liaison", "cadence": "weekly"},
             ]},
        ],
    },
    "generic": {
        "milestones": [
            {"title": {"en": "Clarify and baseline", "ru": "Уточнить и зафиксировать базу", "uz": "Aniqlashtirish va boshlang'ich holat"},
             "tasks": [
                 {"title": {"en": "Goal breakdown & success criteria", "ru": "Разбор цели и критерии успеха", "uz": "Maqsad tahlili va muvaffaqiyat mezonlari"},
                  "description": {"en": "Define what success looks like and the current baseline.", "ru": "Определить, как выглядит успех, и текущую базу.", "uz": "Muvaffaqiyat qanday ko'rinishini va joriy holatni aniqlash."},
                  "agent_role": "personal_assistant", "cadence": "once"},
             ]},
            {"title": {"en": "Execute core steps", "ru": "Выполнить ключевые шаги", "uz": "Asosiy qadamlarni bajarish"},
             "tasks": [
                 {"title": {"en": "Weekly action brief", "ru": "Еженедельный план действий", "uz": "Haftalik amal rejasi"},
                  "description": {"en": "Produce this week's 3 concrete actions toward the goal.", "ru": "Готовить 3 конкретных действия недели к цели.", "uz": "Maqsad sari shu haftaning 3 ta aniq amalini tayyorlash."},
                  "agent_role": "personal_assistant", "cadence": "weekly"},
                 {"title": {"en": "Obstacle research", "ru": "Исследование препятствий", "uz": "To'siqlarni o'rganish"},
                  "description": {"en": "Identify likely blockers and mitigation options.", "ru": "Определить вероятные блокеры и способы их обхода.", "uz": "Ehtimoliy to'siqlar va ularni yengish yo'llarini aniqlash."},
                  "agent_role": "researcher", "cadence": "once"},
             ]},
            {"title": {"en": "Review and adjust", "ru": "Оценить и скорректировать", "uz": "Baholash va moslashtirish"},
             "tasks": [
                 {"title": {"en": "Progress review", "ru": "Обзор прогресса", "uz": "Taraqqiyot tahlili"},
                  "description": {"en": "Compare progress vs. plan and adjust next steps.", "ru": "Сравнить прогресс с планом и скорректировать шаги.", "uz": "Taraqqiyotni reja bilan solishtirib keyingi qadamlarni moslashtirish."},
                  "agent_role": "personal_assistant", "cadence": "weekly"},
             ]},
        ],
    },
}
# learn/health/savings/business generic'dan foydalanadi — LLM rejimida baribir maxsus reja chiqadi
for _slug in ("business", "learn", "health", "savings"):
    _TEMPLATES[_slug] = _TEMPLATES["generic"]

_FALLBACK_REASONING = {
    "en": "Plan built from a proven template for this goal type (offline mode). With an Anthropic API key the plan becomes fully personalized.",
    "ru": "План построен по проверенному шаблону для этого типа цели (офлайн-режим). С ключом Anthropic API план станет полностью персональным.",
    "uz": "Reja ushbu maqsad turi uchun sinalgan shablondan qurildi (oflayn rejim). Anthropic API kaliti bilan reja to'liq shaxsiylashadi.",
}


async def decompose(
    goal_text: str,
    twin_facts: list[dict[str, Any]],
    profession: str = "",
    language: str = "en",
) -> dict[str, Any]:
    facts_text = "\n".join(f"- [{f['category']}] {f['label']}: {f['value']}" for f in twin_facts) or "(none)"
    parsed = await llm_json(
        _DECOMPOSE_SYSTEM + "\n" + lang_instruction(language),
        f"GOAL: {goal_text}\nPROFESSION: {profession or 'unknown'}\nLIFE TWIN FACTS:\n{facts_text}",
        max_tokens=1800,
    )
    if parsed is not None and parsed.get("milestones"):
        parsed["method"] = "llm"
        return parsed

    # Fallback: shablon
    lower = goal_text.lower()
    goal_type = next(
        (gt for gt, kws in _GOAL_TYPES.items() if any(k in lower for k in kws)),
        "generic",
    )
    tpl = _TEMPLATES.get(goal_type, _TEMPLATES["generic"])
    milestones = [
        {
            "title": m["title"].get(language, m["title"]["en"]),
            "tasks": [
                {
                    "title": t["title"].get(language, t["title"]["en"]),
                    "description": t["description"].get(language, t["description"]["en"]),
                    "agent_role": t["agent_role"],
                    "cadence": t["cadence"],
                }
                for t in m["tasks"]
            ],
        }
        for m in tpl["milestones"]
    ]
    return {
        "title": goal_text[:100],
        "reasoning": _FALLBACK_REASONING.get(language, _FALLBACK_REASONING["en"]),
        "milestones": milestones,
        "goal_type": goal_type,
        "method": "heuristic",
    }


# ------------------------------------------------------------------
# 2. Vazifani bajarish
# ------------------------------------------------------------------

_EXECUTE_SYSTEM = """\
You are an AgentNet task-execution agent acting in the role given below.
Produce the actual deliverable for this task — concrete, immediately usable
text (a checklist, analysis, draft message, plan, or brief). Not a promise
to do it later; the deliverable itself. Keep it under 250 words, structured
with short headers or bullets.
Reply ONLY with JSON: {"result": "..."}
"""

_FALLBACK_RESULT = {
    "en": "Action brief (offline mode):\n1) Define the single measurable outcome for \"{title}\".\n2) List the 3 inputs you already have (from your Life Twin: {facts}).\n3) Block 45 minutes today for the first step; write down what blocked you, if anything.\n4) Mark this task done and the next task will build on it.\n\n(With an Anthropic API key this becomes a fully personalized deliverable.)",
    "ru": "План действий (офлайн-режим):\n1) Определите один измеримый результат для «{title}».\n2) Выпишите 3 ресурса, которые уже есть (из Life Twin: {facts}).\n3) Выделите сегодня 45 минут на первый шаг; зафиксируйте, что помешало, если что-то помешало.\n4) Отметьте задачу выполненной — следующая будет опираться на неё.\n\n(С ключом Anthropic API это станет полностью персональным результатом.)",
    "uz": "Amal rejasi (oflayn rejim):\n1) \"{title}\" uchun bitta o'lchanadigan natijani aniqlang.\n2) Sizda mavjud 3 ta resursni yozing (Life Twin'dan: {facts}).\n3) Bugun birinchi qadam uchun 45 daqiqa ajrating; to'siq bo'lsa, yozib qo'ying.\n4) Vazifani bajarilgan deb belgilang — keyingisi shunga tayanadi.\n\n(Anthropic API kaliti bilan bu to'liq shaxsiy natijaga aylanadi.)",
}


async def execute_task(
    task: dict[str, Any],
    twin_facts: list[dict[str, Any]],
    goal_title: str = "",
    profession: str = "",
    language: str = "en",
) -> dict[str, Any]:
    facts_text = "\n".join(f"- [{f['category']}] {f['label']}: {f['value']}" for f in twin_facts) or "(none)"
    parsed = await llm_json(
        _EXECUTE_SYSTEM + "\n" + lang_instruction(language),
        f"ROLE: {task.get('agent_role', 'personal_assistant')}\n"
        f"GOAL: {goal_title}\nTASK: {task.get('title')}\nDESCRIPTION: {task.get('description', '')}\n"
        f"USER PROFESSION: {profession or 'unknown'}\nLIFE TWIN FACTS:\n{facts_text}",
        max_tokens=900,
    )
    if parsed is not None and parsed.get("result"):
        return {"result": str(parsed["result"]), "method": "llm"}

    tmpl = _FALLBACK_RESULT.get(language, _FALLBACK_RESULT["en"])
    fact_labels = ", ".join(f["label"] for f in twin_facts[:3]) or "—"
    return {
        "result": tmpl.format(title=task.get("title", ""), facts=fact_labels),
        "method": "heuristic",
    }
