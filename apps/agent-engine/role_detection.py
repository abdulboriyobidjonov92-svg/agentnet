"""
AgentNet — Role Detection & Adaptive Profiling
------------------------------------------------
Foydalanuvchi onboarding'da o'zi haqida erkin matnda yozadi
("Men Samarqandda kardiologman", "I run a small grocery store" ...).
Bu modul:
  1. Matndan kasb/soha (domain) ni aniqlaydi — LLM-first, keyword fallback
     (demo rejimda ham to'liq ishlaydi)
  2. Aniqlangan domain uchun tavsiya agentlar, dashboard vidjetlari va
     tezkor amallarni qaytaradi

MUHIM: kirish matni endpoint darajasida Halal Filter'dan o'tadi (main.py).
Domain — yopiq dropdown EMAS: taksonomiya faqat moslashuvchi "profil"
manbai; noma'lum kasblar "general" profilga tushadi, professionTitle esa
har doim foydalanuvchining o'z so'zi bo'yicha saqlanadi.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from anthropic import AsyncAnthropic

_client = AsyncAnthropic()  # ANTHROPIC_API_KEY env'dan; yo'q bo'lsa fallback ishlaydi

Lang = str  # "en" | "ru" | "uz"


def _t(en: str, ru: str, uz: str) -> dict[str, str]:
    return {"en": en, "ru": ru, "uz": uz}


# ------------------------------------------------------------------
# Domain taksonomiyasi
# Har bir domain: nom, keyword'lar (uz/ru/en), tavsiya agentlar,
# dashboard vidjetlari va tezkor amallar (namuna promptlar).
# ------------------------------------------------------------------

DOMAINS: dict[str, dict[str, Any]] = {
    "healthcare": {
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
    },
    "law": {
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
    },
    "government": {
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
    },
    "education": {
        "label": _t("Education", "Образование", "Ta'lim"),
        "keywords": [
            "teacher", "professor", "tutor", "school", "university", "student", "lesson", "curriculum", "teach",
            "учитель", "преподаватель", "школа", "университет", "студент", "урок", "репетитор",
            "o'qituvchi", "ustoz", "maktab", "universitet", "talaba", "o'quvchi", "dars", "repetitor",
        ],
        "agents": [
            {
                "name": _t("Lesson Plan Builder", "Конструктор уроков", "Dars rejasi tuzuvchi"),
                "description": _t(
                    "Builds lesson plans, exercises and quizzes for any subject and level.",
                    "Составляет планы уроков, задания и тесты для любого предмета.",
                    "Har qanday fan va daraja uchun dars rejalari, mashqlar va testlar tuzadi.",
                ),
                "system_prompt": (
                    "You are a lesson planning assistant for an educator: build lesson plans, differentiated "
                    "exercises, and quizzes with answer keys. Match the stated grade level. "
                    "Always reply in the language the user writes in."
                ),
                "tools": [],
            },
            {
                "name": _t("Study Coach", "Учебный коуч", "O'quv murabbiyi"),
                "description": _t(
                    "Explains hard topics step by step and builds study schedules.",
                    "Объясняет сложные темы по шагам и строит график занятий.",
                    "Qiyin mavzularni bosqichma-bosqich tushuntiradi va o'quv jadvalini tuzadi.",
                ),
                "system_prompt": (
                    "You are a patient study coach: explain concepts step by step, check understanding with "
                    "questions, and build spaced study schedules. Always reply in the language the user writes in."
                ),
                "tools": ["calendar.get_events"],
            },
        ],
        "widgets": ["schedule"],
        "quick_actions": [
            _t("Build a 45-minute lesson plan on fractions", "Составь план урока на 45 минут по дробям", "Kasrlar bo'yicha 45 daqiqalik dars rejasini tuz"),
            _t("Make a 10-question quiz with answers", "Сделай тест из 10 вопросов с ответами", "Javoblari bilan 10 savollik test tuz"),
        ],
    },
    "agriculture": {
        "label": _t("Agriculture", "Сельское хозяйство", "Qishloq xo'jaligi"),
        "keywords": [
            "farmer", "farm", "crop", "harvest", "livestock", "irrigation", "orchard", "greenhouse", "cotton", "wheat",
            "фермер", "урожай", "полив", "скот", "теплица", "хлопок", "пшеница", "сад",
            "fermer", "dehqon", "hosil", "sug'orish", "chorva", "issiqxona", "paxta", "bug'doy", "bog'",
        ],
        "agents": [
            {
                "name": _t("Farm Advisor", "Агро-советник", "Fermer maslahatchisi"),
                "description": _t(
                    "Weather-aware planting, irrigation and harvest planning.",
                    "Планирование посадки, полива и сбора с учётом погоды.",
                    "Ob-havoga qarab ekish, sug'orish va hosil rejalashtirish.",
                ),
                "system_prompt": (
                    "You advise a farmer on planting windows, irrigation scheduling, pest pressure and harvest "
                    "timing. Use the weather tool when relevant. Give practical, low-cost recommendations. "
                    "Always reply in the language the user writes in."
                ),
                "tools": ["utility.weather", "calendar.get_events"],
            },
            {
                "name": _t("Farm Finance Tracker", "Учёт фермы", "Ferma moliya hisobchisi"),
                "description": _t(
                    "Tracks costs, sales and compliant financing options.",
                    "Учёт расходов, продаж и халяльного финансирования.",
                    "Xarajat, savdo va halol moliyalashtirish variantlarini kuzatadi.",
                ),
                "system_prompt": (
                    "You help a farmer track costs and sales, estimate margins per crop, and explain "
                    "compliant, interest-free financing options as information, not financial advice. "
                    "Always reply in the language the user writes in."
                ),
                "tools": ["finance.get_transactions", "finance.currency_rates"],
            },
        ],
        "widgets": ["weather", "currency"],
        "quick_actions": [
            _t("What should I plant this month given the weather?", "Что сажать в этом месяце с учётом погоды?", "Ob-havoga qarab bu oy nima eksam bo'ladi?"),
            _t("Estimate my cost per hectare for wheat", "Оцени затраты на гектар пшеницы", "Bug'doy uchun gektariga xarajatni hisobla"),
        ],
    },
    "retail": {
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
    },
    "finance": {
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
    },
    "tech": {
        "label": _t("Technology & Engineering", "Технологии", "Texnologiya"),
        "keywords": [
            "developer", "programmer", "software", "engineer", "devops", "designer ui", "startup", "data scientist", "it ",
            "программист", "разработчик", "инженер", "айти", "стартап",
            "dasturchi", "muhandis", "startap", "kompyuter", "sayt", "ilova",
        ],
        "agents": [
            {
                "name": _t("Code Review Partner", "Партнёр по код-ревью", "Kod tahlili hamkori"),
                "description": _t(
                    "Reviews code, suggests fixes, explains trade-offs.",
                    "Проверяет код, предлагает правки, объясняет компромиссы.",
                    "Kodni tekshiradi, tuzatishlar taklif qiladi, muqobillarni tushuntiradi.",
                ),
                "system_prompt": (
                    "You are a senior code review partner: find bugs, suggest cleaner implementations, and explain "
                    "trade-offs concisely. Always reply in the language the user writes in."
                ),
                "tools": [],
            },
            {
                "name": _t("Product Planning Assistant", "Помощник по продукту", "Mahsulot rejalashtiruvchi"),
                "description": _t(
                    "Specs, user stories, sprint planning.",
                    "Спецификации, user stories, планирование спринтов.",
                    "Spetsifikatsiyalar, user story'lar, sprint rejalashtirish.",
                ),
                "system_prompt": (
                    "You help plan software products: write specs, break features into user stories with acceptance "
                    "criteria, and draft sprint plans. Always reply in the language the user writes in."
                ),
                "tools": ["calendar.get_events"],
            },
        ],
        "widgets": ["schedule", "currency"],
        "quick_actions": [
            _t("Review this function for bugs", "Проверь эту функцию на ошибки", "Ushbu funksiyani xatolarga tekshir"),
            _t("Break this feature into user stories", "Разбей эту фичу на user stories", "Bu funksiyani user story'larga bo'l"),
        ],
    },
    "construction": {
        "label": _t("Construction & Architecture", "Строительство", "Qurilish"),
        "keywords": [
            "builder", "construction", "architect", "renovation", "cement", "site foreman", "contractor",
            "строитель", "архитектор", "ремонт", "стройка", "прораб", "подрядчик",
            "quruvchi", "arxitektor", "ta'mir", "qurilish", "prorab", "usta",
        ],
        "agents": [
            {
                "name": _t("Project Estimator", "Сметчик", "Smeta hisoblovchi"),
                "description": _t(
                    "Material estimates, cost breakdowns, schedules.",
                    "Расчёт материалов, смета, график работ.",
                    "Material hisobi, xarajatlar taqsimoti, ish jadvali.",
                ),
                "system_prompt": (
                    "You help estimate construction projects: material quantities, cost breakdowns, and work "
                    "schedules from the user's description. State assumptions explicitly. "
                    "Always reply in the language the user writes in."
                ),
                "tools": ["finance.currency_rates", "utility.weather"],
            },
        ],
        "widgets": ["weather", "currency", "schedule"],
        "quick_actions": [
            _t("Estimate materials for a 100m² house foundation", "Рассчитай материалы для фундамента 100м²", "100m² uy poydevori uchun materiallarni hisobla"),
        ],
    },
    "transport": {
        "label": _t("Transport & Logistics", "Транспорт и логистика", "Transport va logistika"),
        "keywords": [
            "driver", "taxi", "truck", "delivery", "logistics", "cargo", "route", "courier",
            "водитель", "таксист", "грузовик", "доставка", "логистика", "маршрут", "курьер",
            "haydovchi", "taksi", "yuk", "yetkazib berish", "logistika", "marshrut", "kuryer",
        ],
        "agents": [
            {
                "name": _t("Route & Day Planner", "Планировщик маршрутов", "Marshrut va kun rejalashtiruvchi"),
                "description": _t(
                    "Daily route planning, weather checks, earnings tracking.",
                    "Планирование маршрутов, погода, учёт заработка.",
                    "Kunlik marshrut, ob-havo, daromad hisobi.",
                ),
                "system_prompt": (
                    "You help a driver or logistics worker plan the day: order stops sensibly, check weather, and "
                    "track described earnings and fuel costs. Always reply in the language the user writes in."
                ),
                "tools": ["utility.weather", "finance.currency_rates"],
            },
        ],
        "widgets": ["weather", "currency"],
        "quick_actions": [
            _t("Plan my delivery route with rest breaks", "Спланируй маршрут с перерывами на отдых", "Dam olish tanaffuslari bilan marshrutimni rejalashtir"),
        ],
    },
    "food_service": {
        "label": _t("Food & Hospitality", "Общепит и сервис", "Oziq-ovqat va xizmat"),
        "keywords": [
            "chef", "cook", "restaurant", "cafe", "bakery", "catering", "menu", "kitchen",
            "повар", "ресторан", "кафе", "пекарня", "кейтеринг", "меню", "кухня",
            "oshpaz", "restoran", "kafe", "novvoy", "menyu", "oshxona", "taom",
        ],
        "agents": [
            {
                "name": _t("Menu & Costing Assistant", "Меню и себестоимость", "Menyu va tannarx yordamchisi"),
                "description": _t(
                    "Menu planning, portion costing, dietary compliance checks.",
                    "Планирование меню, себестоимость порций, проверка диетических норм.",
                    "Menyu tuzish, portsiya tannarxi, dietik muvofiqlik tekshiruvi.",
                ),
                "system_prompt": (
                    "You help a chef or food business: plan menus, cost portions from ingredient prices, and check "
                    "ingredients against dietary requirements (halal, kosher, vegetarian, allergens), suggesting "
                    "substitutes when needed. Always reply in the language the user writes in."
                ),
                "tools": ["health.calorie_estimate", "finance.currency_rates"],
            },
        ],
        "widgets": ["currency", "schedule"],
        "quick_actions": [
            _t("Cost this plov recipe per portion", "Рассчитай себестоимость порции плова", "Palov retseptining portsiya tannarxini hisobla"),
            _t("Suggest a substitute for gelatin", "Предложи замену желатину", "Jelatin uchun muqobil taklif qil"),
        ],
    },
    "industry": {
        "label": _t("Industry & Mining", "Промышленность", "Sanoat va kon ishi"),
        "keywords": [
            "miner", "mining", "factory", "plant", "manufacturing", "production line", "welder", "operator",
            "шахтёр", "завод", "фабрика", "производств", "сварщик", "оператор", "рудник",
            "konchi", "shaxta", "zavod", "fabrika", "ishlab chiqarish", "payvandchi", "operator", "kon",
        ],
        "agents": [
            {
                "name": _t("Safety & Shift Assistant", "Помощник по сменам и ТБ", "Smena va xavfsizlik yordamchisi"),
                "description": _t(
                    "Shift planning, safety checklists, incident report drafts.",
                    "Планирование смен, чек-листы ТБ, черновики рапортов.",
                    "Smena rejalashtirish, xavfsizlik ro'yxatlari, hisobot qoralamalari.",
                ),
                "system_prompt": (
                    "You assist an industrial worker or supervisor: build shift plans, safety checklists, and "
                    "incident report drafts. Safety guidance must be conservative; defer to official regulations. "
                    "Always reply in the language the user writes in."
                ),
                "tools": ["calendar.get_events", "utility.weather"],
            },
        ],
        "widgets": ["schedule", "weather"],
        "quick_actions": [
            _t("Build a pre-shift safety checklist", "Составь чек-лист перед сменой", "Smena oldi xavfsizlik ro'yxatini tuz"),
        ],
    },
    "religion": {
        "label": _t("Religious Service", "Религиозная служба", "Diniy xizmat"),
        "keywords": [
            "imam", "mosque", "madrasa", "islamic studies", "quran teacher", "muezzin",
            "имам", "мечеть", "медресе", "муэдзин",
            "imom", "masjid", "madrasa", "qori", "muazzin", "din",
        ],
        "agents": [
            {
                "name": _t("Prayer & Quran Companion", "Намаз и Коран", "Namoz va Qur'on hamrohi"),
                "description": _t(
                    "Prayer times, Quran text, khutbah preparation support.",
                    "Время намаза, текст Корана, помощь с хутбой.",
                    "Namoz vaqtlari, Qur'on matni, xutba tayyorlashga yordam.",
                ),
                "system_prompt": (
                    "You support religious service: provide prayer times, Quran surahs, and help organize khutbah "
                    "outlines. You classify and organize — you never issue fatwas; refer rulings to qualified "
                    "scholars. Always reply in the language the user writes in."
                ),
                "tools": ["islam.quran_surah"],
            },
        ],
        "widgets": ["schedule"],
        "quick_actions": [
            _t("Today's prayer times in my city", "Время намаза сегодня в моём городе", "Bugungi namoz vaqtlari — shahrim uchun"),
            _t("Read Surah Al-Fatiha with translation", "Прочитай суру Аль-Фатиха с переводом", "Fotiha surasini tarjimasi bilan o'qib ber"),
        ],
    },
    "media": {
        "label": _t("Media & Creative", "Медиа и творчество", "Media va ijod"),
        "keywords": [
            "journalist", "writer", "blogger", "designer", "photographer", "videographer", "content", "smm",
            "журналист", "писатель", "блогер", "дизайнер", "фотограф", "контент",
            "jurnalist", "yozuvchi", "bloger", "dizayner", "fotograf", "kontent",
        ],
        "agents": [
            {
                "name": _t("Content Studio", "Контент-студия", "Kontent studiya"),
                "description": _t(
                    "Drafts articles, posts and scripts; edits for clarity.",
                    "Черновики статей, постов и сценариев; редактура.",
                    "Maqola, post va ssenariy qoralamalari; tahrir.",
                ),
                "system_prompt": (
                    "You are an editorial assistant: draft and edit articles, posts, and scripts. Preserve the "
                    "author's voice, verify factual claims are marked as needing checking, keep content ethical "
                    "and honest. Always reply in the language the user writes in."
                ),
                "tools": [],
            },
        ],
        "widgets": ["schedule"],
        "quick_actions": [
            _t("Edit this draft for clarity", "Отредактируй этот черновик", "Ushbu qoralamani tahrir qil"),
        ],
    },
    "sports": {
        "label": _t("Sports & Fitness", "Спорт и фитнес", "Sport va fitnes"),
        "keywords": [
            "coach", "athlete", "trainer", "fitness", "gym", "football", "boxing", "wrestling",
            "тренер", "спортсмен", "фитнес", "зал", "футбол", "бокс", "борьба",
            "murabbiy", "sportchi", "fitnes", "zal", "futbol", "boks", "kurash",
        ],
        "agents": [
            {
                "name": _t("Training Plan Coach", "Тренировочные планы", "Mashg'ulot rejasi murabbiyi"),
                "description": _t(
                    "Training programs, nutrition estimates, session schedules.",
                    "Программы тренировок, питание, расписание занятий.",
                    "Mashg'ulot dasturlari, ovqatlanish hisobi, jadval.",
                ),
                "system_prompt": (
                    "You build training programs and session schedules, and estimate nutrition needs. You are not "
                    "a doctor: recommend medical consultation for injuries or health conditions. "
                    "Always reply in the language the user writes in."
                ),
                "tools": ["health.calorie_estimate", "calendar.get_events"],
            },
        ],
        "widgets": ["schedule", "weather"],
        "quick_actions": [
            _t("Build a 4-week strength program", "Составь силовую программу на 4 недели", "4 haftalik kuch mashg'uloti dasturini tuz"),
        ],
    },
    "general": {
        "label": _t("General", "Общее", "Umumiy"),
        "keywords": [],
        "agents": [
            {
                "name": _t("Personal Assistant", "Личный ассистент", "Shaxsiy assistent"),
                "description": _t(
                    "Tasks, reminders, daily planning — an all-round helper.",
                    "Задачи, напоминания, планирование — универсальный помощник.",
                    "Vazifalar, eslatmalar, kunlik reja — har tomonlama yordamchi.",
                ),
                "system_prompt": (
                    "You are a helpful personal assistant: manage tasks, reminders, and daily plans. "
                    "Always reply in the language the user writes in."
                ),
                "tools": ["calendar.get_events", "utility.weather", "messaging.telegram_send"],
            },
            {
                "name": _t("Research & Knowledge", "Исследования и знания", "Tadqiqot va bilim"),
                "description": _t(
                    "Live, sourced answers on any topic.",
                    "Живые ответы с источниками по любой теме.",
                    "Har qanday mavzuda jonli, manbali javoblar.",
                ),
                "system_prompt": (
                    "You are a research assistant grounded in live sources. Pull current news, prices "
                    "and facts, and always attribute them. Always reply in the language the user writes in."
                ),
                "tools": ["knowledge.search", "finance.currency_rates"],
            },
        ],
        "widgets": ["schedule", "weather", "currency"],
        "quick_actions": [
            _t("Plan my day", "Спланируй мой день", "Kunimni rejalashtir"),
            _t("Summarize today's key news", "Кратко о главных новостях", "Bugungi asosiy yangiliklar xulosasi"),
        ],
    },
}


# ------------------------------------------------------------------
# Aniqlash natijasi
# ------------------------------------------------------------------


@dataclass
class RoleProfile:
    profession_title: str
    domain: str
    confidence: float
    reasoning: str
    goals: list[str] = field(default_factory=list)
    method: str = "keyword"  # "llm" | "keyword"

    def to_response(self, language: Lang = "en") -> dict[str, Any]:
        domain_cfg = DOMAINS.get(self.domain, DOMAINS["general"])
        return {
            "profession_title": self.profession_title,
            "domain": self.domain,
            "domain_label": domain_cfg["label"],
            "confidence": round(self.confidence, 2),
            "reasoning": self.reasoning,
            "goals": self.goals,
            "method": self.method,
            "recommended_agents": [
                {
                    "name": a["name"],
                    "description": a["description"],
                    "system_prompt": a["system_prompt"],
                    "tools": [{"tool_id": t, "config": {}} for t in a["tools"]],
                }
                for a in domain_cfg["agents"]
            ],
            "dashboard": {
                "widgets": domain_cfg["widgets"],
                "quick_actions": domain_cfg["quick_actions"],
            },
        }


# ------------------------------------------------------------------
# 1-usul: LLM (Claude) orqali aniqlash — API kaliti bo'lsa
# ------------------------------------------------------------------

_LLM_SYSTEM = """\
You are the role-detection component of AgentNet, an adaptive AI platform.
The user describes themselves and their goals in free text (any language:
Uzbek, Russian, English, or mixed). Infer their profession and map it to
exactly one domain slug from this list:

healthcare, law, government, education, agriculture, retail, finance, tech,
construction, transport, food_service, industry, religion, media, sports, general

Rules:
- "profession_title" is the user's role in THEIR OWN words/language, cleaned up
  (e.g. "kardiolog", "владелец магазина", "farmer"). Never translate it.
- If no domain clearly fits, use "general" — never force a wrong fit.
- "goals": up to 4 short goal phrases extracted from the text, in the user's language.
- "confidence": 0.0-1.0.
- Reply with ONLY this JSON, no other text:
{"profession_title": "...", "domain": "...", "confidence": 0.0,
 "reasoning": "one sentence, in the user's language", "goals": ["..."]}
"""


async def _detect_with_llm(text: str) -> RoleProfile | None:
    try:
        response = await _client.messages.create(
            model="claude-sonnet-5",
            max_tokens=400,
            system=_LLM_SYSTEM,
            messages=[{"role": "user", "content": text}],
            # Sonnet 5 sukutdagi adaptiv fikrlashi past max_tokens'da JSON'ni
            # kesib qo'yishi mumkin — xulqni bir xil saqlab, o'chiramiz.
            extra_body={"thinking": {"type": "disabled"}},
        )
        raw = getattr(response.content[0], "text", "").strip()
        # JSON'ni ajratib olish (LLM ba'zan atrofga matn qo'shishi mumkin)
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            return None
        parsed = json.loads(m.group(0))
        domain = parsed.get("domain", "general")
        if domain not in DOMAINS:
            domain = "general"
        return RoleProfile(
            profession_title=str(parsed.get("profession_title", "")).strip() or "—",
            domain=domain,
            confidence=max(0.0, min(1.0, float(parsed.get("confidence", 0.5)))),
            reasoning=str(parsed.get("reasoning", "")),
            goals=[str(g) for g in (parsed.get("goals") or [])][:4],
            method="llm",
        )
    except Exception:
        return None


# ------------------------------------------------------------------
# 2-usul: Keyword fallback — API kalitisiz (demo rejim) ham ishlaydi
# ------------------------------------------------------------------

_REASONING_BY_LANG = {
    "en": "Detected from keywords in your description (offline mode).",
    "ru": "Определено по ключевым словам в вашем описании (офлайн-режим).",
    "uz": "Tavsifingizdagi kalit so'zlar orqali aniqlandi (oflayn rejim).",
}

_UNKNOWN_TITLE = {"en": "Not specified", "ru": "Не указано", "uz": "Ko'rsatilmagan"}


def _detect_with_keywords(text: str, language: Lang) -> RoleProfile:
    lower = text.lower()
    scores: dict[str, int] = {}
    matched: dict[str, list[str]] = {}

    for slug, cfg in DOMAINS.items():
        hits = [kw for kw in cfg["keywords"] if kw in lower]
        if hits:
            scores[slug] = len(hits)
            matched[slug] = hits

    if not scores:
        return RoleProfile(
            profession_title=_UNKNOWN_TITLE.get(language, _UNKNOWN_TITLE["en"]),
            domain="general",
            confidence=0.3,
            reasoning=_REASONING_BY_LANG.get(language, _REASONING_BY_LANG["en"]),
            method="keyword",
        )

    best = max(scores, key=lambda s: scores[s])
    # Ishonch: nechta keyword mos kelganiga qarab 0.5–0.85 oralig'ida
    confidence = min(0.85, 0.5 + 0.1 * scores[best])

    # Kasb nomi: foydalanuvchi matnidan mos kelgan eng uzun keyword atrofidagi so'z
    title = _extract_title(text, matched[best]) or _UNKNOWN_TITLE.get(language, "—")

    return RoleProfile(
        profession_title=title,
        domain=best,
        confidence=confidence,
        reasoning=_REASONING_BY_LANG.get(language, _REASONING_BY_LANG["en"]),
        method="keyword",
    )


def _extract_title(text: str, hits: list[str]) -> str | None:
    """Mos kelgan keyword joylashgan asl matn bo'lagini kasb nomi sifatida oladi.

    Keyword ro'yxatlarida kasb-otlari (doctor, fermer...) faoliyat so'zlaridan
    (inventory, sales...) oldin turadi — shuning uchun birinchi moslik olinadi.
    """
    m = re.search(re.escape(hits[0]) + r"[\w'’]*", text, re.IGNORECASE)
    return m.group(0) if m else None


# ------------------------------------------------------------------
# Umumiy kirish nuqtasi
# ------------------------------------------------------------------


async def detect_role(text: str, language: Lang = "en") -> dict[str, Any]:
    """Erkin matndan kasb-profilni aniqlaydi. LLM-first, keyword fallback."""
    profile = await _detect_with_llm(text)
    if profile is None:
        profile = _detect_with_keywords(text, language)
    return profile.to_response(language)


def domains_summary() -> list[dict[str, Any]]:
    return [
        {
            "slug": slug,
            "label": cfg["label"],
            "agent_count": len(cfg["agents"]),
            "widgets": cfg["widgets"],
        }
        for slug, cfg in DOMAINS.items()
    ]


def domain_profile(slug: str, language: Lang = "en") -> dict[str, Any]:
    """Saqlangan domain bo'yicha tavsiyalarni qayta olish (onboarding'siz)."""
    if slug not in DOMAINS:
        slug = "general"
    return RoleProfile(
        profession_title="",
        domain=slug,
        confidence=1.0,
        reasoning="stored profile",
        method="stored",
    ).to_response(language)
