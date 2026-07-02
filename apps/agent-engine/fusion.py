"""
AgentNet — Cross-Profession Agent Fusion
------------------------------------------
Bir nechta mutaxassis-agent (shifokor + advokat + buxgalter ...) bitta
ishchi guruh sifatida murakkab, ko'p-sohali muammoni birga tahlil qiladi
va UCHTA ALOHIDA JAVOB EMAS, BITTA YAXLIT javob qaytaradi.

LLM rejimi: har bir mutaxassis nuqtai nazari + ziddiyatlar + sintez —
bitta tuzilgan chaqiriqda (arzon va barqaror).
Fallback: muammo kalit so'zlariga bog'langan rol-shablonlari + sintez.
"""

from __future__ import annotations

from typing import Any

from llm_utils import lang_instruction, llm_json

EXPERT_ROLES: dict[str, dict[str, Any]] = {
    "doctor": {
        "label": {"en": "Doctor", "ru": "Врач", "uz": "Shifokor"},
        "hints": ["kasal", "davola", "diagnoz", "health", "medical", "болезн", "лечени", "simptom", "dori", "shifo",
                  "hospital", "treatment", "больниц", "kasalxona", "doctor", "patient"],
        "fallback": {
            "en": "From the medical side: verify the clinical facts first (diagnoses, dates, treatment records). Any decision must not compromise ongoing treatment; get documentation from the treating physician before acting.",
            "ru": "С медицинской стороны: сначала проверьте клинические факты (диагнозы, даты, записи о лечении). Решение не должно навредить текущему лечению; запросите документы у лечащего врача.",
            "uz": "Tibbiy tomondan: avval klinik faktlarni tekshiring (tashxislar, sanalar, davolash yozuvlari). Qaror davolanishga zarar bermasligi kerak; amal qilishdan oldin shifokordan hujjat oling.",
        },
    },
    "lawyer": {
        "label": {"en": "Lawyer", "ru": "Юрист", "uz": "Advokat"},
        "hints": ["shartnoma", "sud", "huquq", "legal", "contract", "договор", "суд", "прав", "nizo", "dispute", "insurance", "sug'urta", "страхов"],
        "fallback": {
            "en": "From the legal side: identify the governing document (contract/policy/law) and its exact clauses. Put everything in writing, meet deadlines for claims/appeals, and do not sign new documents before review.",
            "ru": "С юридической стороны: определите регулирующий документ (договор/полис/закон) и конкретные пункты. Всё фиксируйте письменно, соблюдайте сроки претензий и не подписывайте новое без проверки.",
            "uz": "Huquqiy tomondan: tartibga soluvchi hujjatni (shartnoma/polis/qonun) va aniq bandlarini aniqlang. Hammasini yozma qiling, da'vo/shikoyat muddatlariga rioya qiling, tekshirmasdan yangi hujjat imzolamang.",
        },
    },
    "accountant": {
        "label": {"en": "Accountant", "ru": "Бухгалтер", "uz": "Buxgalter"},
        "hints": ["pul", "to'lov", "hisob", "money", "cost", "деньг", "оплат", "налог", "soliq", "xarajat", "budget", "byudjet"],
        "fallback": {
            "en": "From the financial side: total the real costs (direct + hidden), check what is reimbursable, and flag any interest-bearing element for a halal alternative. Keep receipts for every payment.",
            "ru": "С финансовой стороны: посчитайте реальные затраты (прямые + скрытые), проверьте, что возмещается, и пометьте процентные элементы для халяльной альтернативы. Храните чеки.",
            "uz": "Moliyaviy tomondan: haqiqiy xarajatlarni jamlang (to'g'ridan-to'g'ri + yashirin), nimasi qoplanishini tekshiring, foizli elementlarni halol muqobil uchun belgilang. Har to'lov chekini saqlang.",
        },
    },
    "business_consultant": {
        "label": {"en": "Business consultant", "ru": "Бизнес-консультант", "uz": "Biznes maslahatchi"},
        "hints": ["biznes", "business", "mijoz", "client", "sotuv", "sales", "raqobat", "компани"],
        "fallback": {
            "en": "From the business side: weigh the decision against cash flow and reputation. Choose the option that keeps optionality — avoid irreversible commitments while facts are still unclear.",
            "ru": "Со стороны бизнеса: взвесьте решение против денежного потока и репутации. Выбирайте вариант, сохраняющий свободу манёвра, пока факты не ясны.",
            "uz": "Biznes tomondan: qarorni pul oqimi va obro'ga solishtirib torting. Faktlar noaniq ekan, qaytarib bo'lmas majburiyatlardan qoching — moslashuvchan variantni tanlang.",
        },
    },
    "teacher": {
        "label": {"en": "Educator", "ru": "Педагог", "uz": "Pedagog"},
        "hints": ["ta'lim", "o'qi", "maktab", "school", "study", "учеб", "bola o'qishi", "kurs"],
        "fallback": {
            "en": "From the education side: break the topic into small learnable steps and set a weekly review. Understanding beats speed — verify comprehension before moving on.",
            "ru": "Со стороны образования: разбейте тему на малые шаги и назначьте еженедельный разбор. Понимание важнее скорости.",
            "uz": "Ta'lim tomondan: mavzuni kichik o'rganiladigan qadamlarga bo'ling va haftalik takrorlash belgilang. Tushunish tezlikdan muhim.",
        },
    },
    "imam": {
        "label": {"en": "Islamic ethics advisor", "ru": "Советник по исламской этике", "uz": "Islomiy odob maslahatchisi"},
        "hints": ["halol", "halal", "harom", "riba", "zakot", "islom", "shariat", "намаз", "ислам"],
        "fallback": {
            "en": "From the ethical side: check the decision for riba, deception, and harm to others. If a doubtful element remains, prefer the cautious path and consult a qualified scholar — this platform does not issue fatwas.",
            "ru": "С этической стороны: проверьте решение на рибу, обман и вред другим. При сомнении выбирайте осторожный путь и обратитесь к квалифицированному учёному — платформа не выносит фетвы.",
            "uz": "Axloqiy tomondan: qarorni riba, aldov va boshqalarga zarar jihatidan tekshiring. Shubha qolsa, ehtiyot yo'lini tanlang va malakali olimga murojaat qiling — platforma fatvo chiqarmaydi.",
        },
    },
    "government_liaison": {
        "label": {"en": "Government liaison", "ru": "Специалист по госорганам", "uz": "Davlat idoralari mutaxassisi"},
        "hints": ["davlat", "hujjat", "litsenziya", "government", "госуслуг", "разрешени", "ruxsatnoma", "ariza"],
        "fallback": {
            "en": "From the administrative side: list the required documents and the exact office/portal for each. File through official channels only and keep stamped/registered copies of every submission.",
            "ru": "С административной стороны: составьте список требуемых документов и точное ведомство/портал для каждого. Подавайте только официально, храните копии с отметками.",
            "uz": "Ma'muriy tomondan: talab qilinadigan hujjatlar va har biri uchun aniq idora/portal ro'yxatini tuzing. Faqat rasmiy kanaldan topshiring, muhrlangan nusxalarni saqlang.",
        },
    },
    "engineer": {
        "label": {"en": "Engineer", "ru": "Инженер", "uz": "Muhandis"},
        "hints": ["texnik", "tizim", "dastur", "system", "software", "техни", "qurilma", "avtomat"],
        "fallback": {
            "en": "From the technical side: prototype the smallest working version first and measure it. Choose boring, proven tools over novel ones for anything critical.",
            "ru": "С технической стороны: сначала соберите минимальную работающую версию и измерьте её. Для критичного выбирайте проверенные инструменты.",
            "uz": "Texnik tomondan: avval eng kichik ishlaydigan versiyani yig'ib o'lchang. Muhim narsalar uchun sinalgan vositalarni tanlang.",
        },
    },
}

_SYNTH_FALLBACK = {
    "en": "Joint conclusion (offline mode): the perspectives above agree on one sequence — (1) fix the facts and documents first, (2) quantify the money involved, (3) act only through official/written channels, and (4) prefer the reversible option while uncertainty remains. Resolve the specific conflicts listed before committing.",
    "ru": "Совместный вывод (офлайн-режим): перспективы сходятся в одной последовательности — (1) сначала факты и документы, (2) затем посчитать деньги, (3) действовать только официально/письменно, (4) предпочитать обратимый вариант, пока есть неопределённость.",
    "uz": "Birgalikdagi xulosa (oflayn rejim): yuqoridagi nuqtai nazarlar bitta ketma-ketlikda birlashadi — (1) avval faktlar va hujjatlarni aniqlang, (2) pulni hisoblang, (3) faqat rasmiy/yozma kanaldan harakat qiling, (4) noaniqlik bor ekan, qaytariladigan variantni tanlang.",
}

_FUSION_SYSTEM = """\
You are AgentNet's Cross-Profession Fusion engine: a working group of the
listed experts jointly reasoning about ONE complex problem. Produce:
- perspectives: each expert's analysis of THIS specific problem (grounded,
  concrete, referencing the user's facts where given; 3-5 sentences each)
- conflicts: where the experts' recommendations genuinely tension with each
  other, stated explicitly
- synthesis: ONE coherent joint answer that resolves or sequences the
  conflicts — not a summary of separate answers
- action_plan: 3-6 ordered concrete steps
Reply ONLY with JSON:
{"perspectives": [{"role": "...", "role_label": "...", "analysis": "..."}],
 "conflicts": ["..."], "synthesis": "...", "action_plan": ["..."]}
"""


def suggest_roles(problem: str, max_roles: int = 3) -> list[str]:
    lower = problem.lower()
    scored = [
        (slug, sum(1 for h in cfg["hints"] if h in lower))
        for slug, cfg in EXPERT_ROLES.items()
    ]
    hits = [s for s, n in sorted(scored, key=lambda x: -x[1]) if n > 0][:max_roles]
    if len(hits) >= 2:
        return hits
    # kamida 2 rol: eng ko'p uchraydigan universal juftlik
    base = hits or []
    for fallback_role in ("business_consultant", "lawyer", "accountant"):
        if fallback_role not in base:
            base.append(fallback_role)
        if len(base) >= 2:
            break
    return base


async def fuse(
    problem: str,
    roles: list[str],
    twin_facts: list[dict[str, Any]],
    profession: str = "",
    language: str = "en",
) -> dict[str, Any]:
    roles = [r for r in roles if r in EXPERT_ROLES] or suggest_roles(problem)
    role_labels = {r: EXPERT_ROLES[r]["label"].get(language, EXPERT_ROLES[r]["label"]["en"]) for r in roles}
    facts_text = "\n".join(f"- [{f['category']}] {f['label']}: {f['value']}" for f in twin_facts) or "(none)"

    parsed = await llm_json(
        _FUSION_SYSTEM + "\n" + lang_instruction(language),
        f"EXPERTS: {', '.join(f'{r} ({role_labels[r]})' for r in roles)}\n"
        f"PROBLEM: {problem}\nUSER PROFESSION: {profession or 'unknown'}\n"
        f"LIFE TWIN FACTS:\n{facts_text}",
        max_tokens=2000,
    )
    if parsed is not None and parsed.get("synthesis"):
        parsed["roles"] = roles
        parsed["method"] = "llm"
        return parsed

    # ---------- Fallback: rol-shablonlari + sintez ----------
    perspectives = [
        {
            "role": r,
            "role_label": role_labels[r],
            "analysis": EXPERT_ROLES[r]["fallback"].get(language, EXPERT_ROLES[r]["fallback"]["en"]),
        }
        for r in roles
    ]
    return {
        "roles": roles,
        "perspectives": perspectives,
        "conflicts": [],
        "synthesis": _SYNTH_FALLBACK.get(language, _SYNTH_FALLBACK["en"]),
        "action_plan": [],
        "method": "heuristic",
    }


def roles_catalog(language: str = "en") -> list[dict[str, str]]:
    return [
        {"slug": slug, "label": cfg["label"].get(language, cfg["label"]["en"])}
        for slug, cfg in EXPERT_ROLES.items()
    ]
