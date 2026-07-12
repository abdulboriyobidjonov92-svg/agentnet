"""GovTech (S7): mas'ul xizmatlar taksonomiyasi (kategoriya -> idora)."""
from __future__ import annotations

from typing import Any

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

URGENT_HINTS = ["favqulodda", "авари", "emergency", "portla", "yong'in", "пожар", "flood", "suv bosdi", "затопил", "gaz hidi", "запах газа", "bolalar xavf", "опасно", "xavfli"]
