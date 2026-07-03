"""
AgentNet — GovTech engine (S7): mahalla/tuman raqamlashtirish
--------------------------------------------------------------
Ikki qobiliyat:
  1. classify_request — fuqaro murojaatini erkin matndan tasniflab, mas'ul
     xizmatga yo'naltiradi (kategoriya, idora, ustuvorlik, qadamlar).
     LLM-first + 3 tilli keyword-fallback. Chalkash matnda ham yiqilmaydi.
  2. process_guide — ko'p bosqichli davlat jarayonlari bo'yicha navigator
     (pasport, propiska, YaTT, tug'ilganlik, pensiya...). To'liq bosqich,
     hujjat, idora/portal, muddat va (taxminiy) to'lov bilan.

HALOL CHEGARA: jonli davlat tizimlariga topshirish/holat olish uchun rasmiy
data-sharing shartnomasi va API kerak (my.gov.uz). Hozircha har javobda
live=false ko'rsatiladi; tizim ichki marshrutlangan tiket sifatida ishlaydi.
"""

from __future__ import annotations

import json
from typing import Any

from llm_utils import lang_instruction, llm_json

# ------------------------------------------------------------------
# Mas'ul xizmatlar taksonomiyasi (kategoriya → idora)
# ------------------------------------------------------------------

SERVICES: dict[str, dict[str, Any]] = {
    "utilities": {
        "label": {"en": "Utilities (water/gas/power/heating)", "ru": "Коммунальные услуги", "uz": "Kommunal xizmatlar (suv/gaz/svet/issiqlik)"},
        "office": {"en": "District utility provider + khokimiyat communal dept", "ru": "Районный поставщик + отдел ЖКХ хокимията", "uz": "Tuman ta'minotchisi + hokimlik kommunal bo'limi"},
        "keywords": ["water", "suv", "вода", "gaz", "gas", "газ", "svet", "elektr", "электрич", "light", "issiqlik", "отоплен", "kanaliz", "канализац"],
        "priority": "high",
    },
    "roads": {
        "label": {"en": "Roads & public works", "ru": "Дороги и благоустройство", "uz": "Yo'l va obodonlashtirish"},
        "office": {"en": "District khokimiyat public works dept", "ru": "Отдел благоустройства хокимията", "uz": "Tuman hokimligi obodonlashtirish bo'limi"},
        "keywords": ["road", "yo'l", "дорог", "asphalt", "asfalt", "асфальт", "chuqur", "яма", "pothole", "svetofor", "светофор", "ko'cha", "улиц", "street light", "chiroq"],
        "priority": "normal",
    },
    "documents": {
        "label": {"en": "Documents & registry (passport, propiska, certificates)", "ru": "Документы и регистрация", "uz": "Hujjatlar va ro'yxatga olish (pasport, propiska, ma'lumotnoma)"},
        "office": {"en": "Public service center (DXX) / my.gov.uz", "ru": "Центр госуслуг / my.gov.uz", "uz": "Davlat xizmatlari markazi / my.gov.uz"},
        "keywords": ["passport", "pasport", "паспорт", "propiska", "прописк", "ro'yxat", "ma'lumotnoma", "справк", "certificate", "guvohnoma", "id karta", "metrika"],
        "priority": "normal",
    },
    "social": {
        "label": {"en": "Social support (benefits, pension, disability)", "ru": "Соцподдержка (пособия, пенсия)", "uz": "Ijtimoiy himoya (nafaqa, pensiya, nogironlik)"},
        "office": {"en": "District social support agency + mahalla commission", "ru": "Отдел соцобеспечения + махаллинская комиссия", "uz": "Tuman ijtimoiy himoya bo'limi + mahalla komissiyasi"},
        "keywords": ["nafaqa", "пособие", "benefit", "pensiya", "пенси", "pension", "nogiron", "инвалид", "disab", "kam ta'minlangan", "малообеспечен", "yordam puli", "temir daftar"],
        "priority": "high",
    },
    "sanitation": {
        "label": {"en": "Sanitation & waste", "ru": "Санитария и вывоз мусора", "uz": "Sanitariya va chiqindi"},
        "office": {"en": "District sanitation service (Toza Hudud)", "ru": "Служба санитарной очистки (Toza Hudud)", "uz": "Toza Hudud tuman bo'limi"},
        "keywords": ["musor", "chiqindi", "мусор", "waste", "trash", "axlat", "tozalash", "уборк"],
        "priority": "normal",
    },
    "dispute": {
        "label": {"en": "Neighborhood disputes & order", "ru": "Споры и общественный порядок", "uz": "Qo'shnichilik nizolari va tartib"},
        "office": {"en": "Mahalla reconciliation commission / district police inspector", "ru": "Примирительная комиссия махалли / участковый", "uz": "Mahalla yarashtirish komissiyasi / profilaktika inspektori"},
        "keywords": ["nizo", "спор", "dispute", "qo'shni", "сосед", "neighbor", "shovqin", "шум", "noise", "janjal", "конфликт"],
        "priority": "normal",
    },
    "business": {
        "label": {"en": "Business & licensing", "ru": "Бизнес и лицензии", "uz": "Tadbirkorlik va litsenziya"},
        "office": {"en": "Public service center / soliq.uz / license.gov.uz", "ru": "ЦГУ / soliq.uz / license.gov.uz", "uz": "DXM / soliq.uz / license.gov.uz"},
        "keywords": ["biznes", "бизнес", "business", "yatt", "ип ", "litsenziya", "лицензи", "license", "tadbirkor", "soliq", "налог", "tax", "do'kon ochish"],
        "priority": "normal",
    },
    "other": {
        "label": {"en": "Other / general", "ru": "Другое", "uz": "Boshqa / umumiy"},
        "office": {"en": "District khokimiyat reception (single window)", "ru": "Приёмная хокимията (единое окно)", "uz": "Tuman hokimligi qabulxonasi (yagona darcha)"},
        "keywords": [],
        "priority": "normal",
    },
}

_URGENT_HINTS = ["favqulodda", "авари", "emergency", "portla", "yong'in", "пожар", "flood", "suv bosdi", "затопил", "gaz hidi", "запах газа", "bolalar xavf", "опасно", "xavfli"]

_CLASSIFY_SYSTEM = """\
You are a citizen-request intake specialist for a district (tuman) / mahalla
digital office in Uzbekistan. You receive a citizen's request in free text
(Uzbek, Russian or English, often messy). Classify and route it.

Categories: utilities | roads | documents | social | sanitation | dispute | business | other

Reply ONLY with JSON:
{"category":"...","priority":"low|normal|high|urgent",
 "summary":"one-line neutral summary of the request",
 "service":"name of the responsible service",
 "office":"specific office/portal to route to",
 "steps":["concrete next step 1","step 2","step 3"],
 "needs_documents":["document the citizen should prepare, if any"],
 "reasoning":"why routed this way"}
"""


async def classify_request(text: str, language: str = "uz") -> dict[str, Any]:
    parsed = await llm_json(
        _CLASSIFY_SYSTEM + "\n" + lang_instruction(language),
        f"CITIZEN REQUEST: {text}",
        max_tokens=900,
    )
    if parsed and parsed.get("category") in SERVICES:
        parsed["live"] = False
        parsed["live_note"] = _live_note(language)
        parsed["method"] = "llm"
        return parsed
    return _heuristic_classify(text, language)


def _heuristic_classify(text: str, language: str) -> dict[str, Any]:
    lower = text.lower()
    lang = language if language in ("en", "ru", "uz") else "en"

    best_cat, best_hits = "other", 0
    for cat, cfg in SERVICES.items():
        hits = sum(1 for k in cfg["keywords"] if k in lower)
        if hits > best_hits:
            best_cat, best_hits = cat, hits

    cfg = SERVICES[best_cat]
    priority = "urgent" if any(h in lower for h in _URGENT_HINTS) else cfg["priority"]

    steps_by_lang = {
        "en": [
            f"Request registered and routed to: {cfg['office']['en']}",
            "Operator confirms details with the citizen (phone/visit)",
            "Responsible service resolves and the status is updated here",
        ],
        "ru": [
            f"Обращение зарегистрировано и направлено: {cfg['office']['ru']}",
            "Оператор уточняет детали у гражданина",
            "Ответственная служба решает вопрос, статус обновляется здесь",
        ],
        "uz": [
            f"Murojaat ro'yxatga olindi va yo'naltirildi: {cfg['office']['uz']}",
            "Operator fuqaro bilan tafsilotlarni aniqlaydi (telefon/tashrif)",
            "Mas'ul xizmat hal qiladi, holat shu yerda yangilanadi",
        ],
    }
    return {
        "category": best_cat,
        "priority": priority,
        "summary": text.strip()[:140],
        "service": cfg["label"][lang],
        "office": cfg["office"][lang],
        "steps": steps_by_lang[lang],
        "needs_documents": [],
        "reasoning": (
            f"Keyword routing ({best_hits} match(es)) to '{best_cat}'."
            if best_hits else "No category keywords matched — routed to the general single-window desk for manual triage."
        ),
        "live": False,
        "live_note": _live_note(lang),
        "method": "heuristic",
    }


def _live_note(language: str) -> str:
    notes = {
        "en": "Internal routed ticket. Direct submission into government systems requires an official data-sharing agreement + my.gov.uz API access.",
        "ru": "Внутренний маршрутизированный тикет. Прямая подача в госсистемы требует официального соглашения об обмене данными + API my.gov.uz.",
        "uz": "Ichki marshrutlangan tiket. To'g'ridan-to'g'ri davlat tizimlariga topshirish rasmiy data-sharing shartnomasi + my.gov.uz API'sini talab qiladi.",
    }
    return notes.get(language, notes["en"])


# ------------------------------------------------------------------
# Ko'p bosqichli jarayon navigatorlari
# ------------------------------------------------------------------

PROCESS_GUIDES: dict[str, dict[str, Any]] = {
    "biometric_passport": {
        "label": {"en": "Biometric passport / ID card", "ru": "Биометрический паспорт / ID-карта", "uz": "Biometrik pasport / ID-karta"},
        "keywords": ["passport", "pasport", "паспорт", "id karta", "id card", "id-karta"],
        "duration": "1-15 ish kuni (tarifga qarab)",
        "where": "Migratsiya va fuqarolikni rasmiylashtirish bo'limi / DXM; my.gov.uz'da navbat",
        "steps": [
            "my.gov.uz yoki DXM orqali navbatga yoziling",
            "Hujjatlar: eski pasport/metrika, fotosurat joyida olinadi, davlat boji kvitansiyasi",
            "Biometrik ma'lumot topshirish (barmoq izi, surat) — shaxsan",
            "Tayyor hujjatni olish (SMS xabar keladi)",
        ],
        "documents": ["Eski pasport yoki tug'ilganlik guvohnomasi", "Davlat boji to'lovi kvitansiyasi"],
        "fee_note": "Boj tarifi muddatga qarab farq qiladi — my.gov.uz'da joriy stavkani tekshiring",
    },
    "propiska": {
        "label": {"en": "Residence registration (propiska)", "ru": "Прописка / регистрация", "uz": "Doimiy/vaqtinchalik ro'yxatga olish (propiska)"},
        "keywords": ["propiska", "прописк", "ro'yxatga olish", "registration", "yashash joyi"],
        "duration": "1-3 ish kuni",
        "where": "DXM / my.gov.uz (elektron), murakkab holatda migratsiya bo'limi",
        "steps": [
            "my.gov.uz'da 'yashash joyi bo'yicha ro'yxatga olish' xizmatini oching",
            "Uy egasining roziligi (elektron imzo yoki shaxsan)",
            "Hujjat: pasport, uy hujjati (kadastr/order), ariza",
            "Elektron tasdiqni yuklab oling",
        ],
        "documents": ["Pasport/ID", "Uy-joy hujjati", "Uy egasining roziligi"],
        "fee_note": "Ko'p holatda bepul yoki minimal boj",
    },
    "yatt_registration": {
        "label": {"en": "Individual entrepreneur (YaTT) registration", "ru": "Регистрация ИП (ЯТТ)", "uz": "Yakka tartibdagi tadbirkor (YaTT) ro'yxatdan o'tkazish"},
        "keywords": ["yatt", "tadbirkor", "ип", "entrepreneur", "biznes ochish", "бизнес открыть", "self-employ"],
        "duration": "30 daqiqa - 1 kun (elektron)",
        "where": "soliq.uz / my.gov.uz / DXM",
        "steps": [
            "Faoliyat turini (OKED) tanlang",
            "soliq.uz'da elektron ariza (ERI bilan) yoki DXMga boring",
            "Davlat boji to'lang (elektron arzonroq)",
            "Guvohnoma elektron shaklda keladi; soliq rejimini tanlang (aylanma/QQS)",
        ],
        "documents": ["Pasport/ID", "ERI (elektron imzo) — tavsiya"],
        "fee_note": "Boj BHM'ga bog'liq — soliq.uz'da joriy summani tekshiring",
    },
    "birth_certificate": {
        "label": {"en": "Child birth registration", "ru": "Регистрация рождения", "uz": "Tug'ilganlikni ro'yxatga olish (metrika)"},
        "keywords": ["tug'ilgan", "metrika", "рожден", "birth", "chaqaloq", "новорожден"],
        "duration": "Tug'ruqxonada yoki FHDYo'da 1 kun",
        "where": "FHDYo (ZAGS) / ko'p tug'ruqxonalarda joyida",
        "steps": [
            "Tug'ruqxona ma'lumotnomasini oling",
            "Ota-ona pasportlari va nikoh guvohnomasi bilan FHDYo'ga",
            "Guvohnoma bepul beriladi; my.gov.uz'da ham mavjud",
        ],
        "documents": ["Tug'ruqxona ma'lumotnomasi", "Ota-ona pasportlari", "Nikoh guvohnomasi (bo'lsa)"],
        "fee_note": "Bepul",
    },
    "pension": {
        "label": {"en": "Pension application", "ru": "Оформление пенсии", "uz": "Pensiya rasmiylashtirish"},
        "keywords": ["pensiya", "пенси", "pension", "nafaqa yoshi"],
        "duration": "10-15 ish kuni",
        "where": "Pensiya jamg'armasi tuman bo'limi / my.gov.uz",
        "steps": [
            "Yosh/staj shartlarini tekshiring",
            "Mehnat daftarchasi va ish staji hujjatlarini yig'ing",
            "Pensiya jamg'armasiga ariza (yoki my.gov.uz)",
            "Qaror va birinchi to'lov — plastik kartaga",
        ],
        "documents": ["Pasport", "Mehnat daftarchasi", "Ish haqi ma'lumotnomasi (kerak bo'lsa)"],
        "fee_note": "Bepul",
    },
    "marriage": {
        "label": {"en": "Marriage registration", "ru": "Регистрация брака", "uz": "Nikohni ro'yxatga olish"},
        "keywords": ["nikoh", "брак", "marriage", "to'y", "fhdyo", "загс"],
        "duration": "Ariza + 1 oy kutish (qisqartirilishi mumkin)",
        "where": "FHDYo (ZAGS) / my.gov.uz'da ariza",
        "steps": [
            "Ikkala tomon pasporti bilan FHDYo'ga ariza (yoki elektron)",
            "Tibbiy ko'rik ma'lumotnomalari",
            "Belgilangan sanada ro'yxatdan o'tish",
        ],
        "documents": ["Pasportlar", "Tibbiy ko'rik ma'lumotnomasi", "Davlat boji kvitansiyasi"],
        "fee_note": "Boj minimal — joriy stavkani FHDYo'da tekshiring",
    },
    "cadastre": {
        "label": {"en": "Property cadastre / registration", "ru": "Кадастр недвижимости", "uz": "Ko'chmas mulk kadastri"},
        "keywords": ["kadastr", "кадастр", "cadastre", "uy hujjat", "mulk", "недвижимост", "yer", "земл"],
        "duration": "3-10 ish kuni",
        "where": "Kadastr agentligi tuman bo'limi / my.gov.uz",
        "steps": [
            "Mulk hujjatlarini yig'ing (oldi-sotdi, meros, order)",
            "Kadastr bo'limiga ariza (elektron mumkin)",
            "Texnik pasport/o'lchov (kerak bo'lsa)",
            "Kadastr hujjatini oling",
        ],
        "documents": ["Pasport", "Mulk asosi hujjati", "Avvalgi kadastr (bo'lsa)"],
        "fee_note": "Xizmat turiga qarab — my.gov.uz'da kalkulyator bor",
    },
    "driving_license": {
        "label": {"en": "Driving license", "ru": "Водительские права", "uz": "Haydovchilik guvohnomasi"},
        "keywords": ["prava", "haydovchi", "водительск", "driving", "guvohnoma olish", "avtomaktab"],
        "duration": "Kurs 2-3 oy + imtihon",
        "where": "Avtomaktab + YHX imtihon markazi",
        "steps": [
            "Litsenziyalangan avtomaktabga yoziling",
            "Tibbiy ma'lumotnoma oling",
            "Nazariy va amaliy imtihon (YHX markazida)",
            "Guvohnoma tayyorlanadi (plastik)",
        ],
        "documents": ["Pasport/ID", "Tibbiy ma'lumotnoma", "Avtomaktab sertifikati"],
        "fee_note": "Avtomaktab narxi + davlat boji",
    },
}

_GUIDE_SYSTEM = """\
You are a government-service navigator for Uzbekistan. The user asks about a
bureaucratic process. You get a matched reference guide (steps, documents, offices).
Adapt it to the user's exact situation, answer their specific question, and keep
every claim procedural (cite the office/portal). If their situation may differ,
say what to verify. Reply ONLY with JSON:
{"title":"...","steps":["..."],"documents":["..."],"where":"...","duration":"...",
 "fee_note":"...","personalized_answer":"direct answer to their exact question",
 "verify":["thing to double-check with the office"]}
"""


async def process_guide(query: str, language: str = "uz") -> dict[str, Any]:
    lower = query.lower()
    lang = language if language in ("en", "ru", "uz") else "en"

    best_key, best_hits = None, 0
    for key, g in PROCESS_GUIDES.items():
        hits = sum(1 for k in g["keywords"] if k in lower)
        if hits > best_hits:
            best_key, best_hits = key, hits

    guide = PROCESS_GUIDES.get(best_key) if best_key else None

    parsed = await llm_json(
        _GUIDE_SYSTEM + "\n" + lang_instruction(language),
        f"USER QUESTION: {query}\n\nMATCHED REFERENCE GUIDE: "
        + (json.dumps(guide, ensure_ascii=False) if guide else "(no close match — answer from general Uzbekistan public-service procedure, conservatively)"),
        max_tokens=1200,
    )
    if parsed and parsed.get("steps"):
        parsed["matched_guide"] = best_key
        parsed["live"] = False
        parsed["live_note"] = _live_note(lang)
        parsed["method"] = "llm"
        return parsed

    if guide:
        return {
            "title": guide["label"][lang],
            "steps": guide["steps"],
            "documents": guide["documents"],
            "where": guide["where"],
            "duration": guide["duration"],
            "fee_note": guide["fee_note"],
            "personalized_answer": "",
            "verify": ["Joriy boj stavkasi va ish tartibini my.gov.uz yoki idoraning o'zida tekshiring"],
            "matched_guide": best_key,
            "live": False,
            "live_note": _live_note(lang),
            "method": "heuristic",
        }
    return {
        "title": {"en": "No matching process guide", "ru": "Подходящий процесс не найден", "uz": "Mos jarayon topilmadi"}[lang],
        "steps": [],
        "documents": [],
        "where": {"en": "District public service center (single window) can triage any request", "ru": "Центр госуслуг примет любой запрос", "uz": "Davlat xizmatlari markazi (yagona darcha) istalgan so'rovni qabul qiladi"}[lang],
        "duration": "",
        "fee_note": "",
        "personalized_answer": "",
        "verify": [],
        "matched_guide": None,
        "live": False,
        "live_note": _live_note(lang),
        "method": "heuristic",
    }


def guides_catalog(language: str = "uz") -> list[dict[str, str]]:
    lang = language if language in ("en", "ru", "uz") else "en"
    return [{"id": key, "label": g["label"][lang], "duration": g["duration"]} for key, g in PROCESS_GUIDES.items()]


def services_catalog(language: str = "uz") -> list[dict[str, str]]:
    lang = language if language in ("en", "ru", "uz") else "en"
    return [
        {"id": key, "label": cfg["label"][lang], "office": cfg["office"][lang]}
        for key, cfg in SERVICES.items()
    ]
