"""GovTech (S7): ko'p bosqichli davlat jarayonlari navigatori uchun ma'lumot bazasi."""
from __future__ import annotations

from typing import Any

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
