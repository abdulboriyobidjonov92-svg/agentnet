"""
AgentNet — Cross-Border Trade engine (S6)
------------------------------------------
Import/eksport bizneslar uchun to'rt qobiliyat:
  1. customs_docs    — yuk ta'rifidan bojxona hujjatlari ro'yxati + qoralamalari
  2. tariff_lookup   — tovar → HS bo'lim + O'zbekiston uchun taxminiy boj/QQS
                       (ma'lumotnoma jadval; rasmiy tarif bilan tasdiqlash SHART)
  3. compliance_check— cheklangan/dual-use tovar va yo'nalish skriningi
  4. tracking_info   — trek-raqamdan tashuvchini aniqlash + jonli kuzatuv holati
                       (jonli API kalit talab qiladi — halol ko'rsatiladi)
Valyuta: mavjud finance.currency_rates (open.er-api, kalitsiz) bilan.

LLM-first + to'liq ishlaydigan ma'lumotnoma-fallback. Har javob trade
compliance pack disclaimeri bilan boradi (compliance_packs.trade).
"""

from __future__ import annotations

import json
import re
from typing import Any

from llm_utils import lang_instruction, llm_json
from tools.utility_tools import currency_rates

# ------------------------------------------------------------------
# Ma'lumotnoma jadvallar (halol: taxminiy, tasdiqlash shart)
# O'zbekiston bojxona tarifi bo'yicha keng tarqalgan toifalar.
# ------------------------------------------------------------------

HS_REFERENCE: list[dict[str, Any]] = [
    {"chapter": "08", "label": "Fruits & nuts (meva, yong'oq)", "keywords": ["fruit", "meva", "olma", "uzum", "cherry", "gilos", "apricot", "o'rik", "nut", "yong'oq", "фрукт", "орех"], "duty_pct": 5, "vat_pct": 12},
    {"chapter": "07", "label": "Vegetables (sabzavot)", "keywords": ["vegetable", "sabzavot", "onion", "piyoz", "tomato", "pomidor", "картофель", "овощ"], "duty_pct": 5, "vat_pct": 12},
    {"chapter": "52", "label": "Cotton (paxta)", "keywords": ["cotton", "paxta", "хлопок", "yarn", "ip"], "duty_pct": 0, "vat_pct": 12},
    {"chapter": "61-62", "label": "Apparel & textiles (kiyim, to'qimachilik)", "keywords": ["textile", "to'qimachilik", "apparel", "kiyim", "clothes", "одежда", "футболка", "t-shirt"], "duty_pct": 10, "vat_pct": 12},
    {"chapter": "84", "label": "Machinery (uskuna, mashina)", "keywords": ["machine", "uskuna", "equipment", "stanok", "оборудование", "generator"], "duty_pct": 5, "vat_pct": 12},
    {"chapter": "85", "label": "Electronics (elektronika)", "keywords": ["electronic", "elektronika", "phone", "telefon", "laptop", "kompyuter", "телефон", "электроника", "tv", "televizor"], "duty_pct": 10, "vat_pct": 12},
    {"chapter": "87", "label": "Vehicles & parts (avto, ehtiyot qism)", "keywords": ["car", "avto", "vehicle", "mashina", "запчаст", "ehtiyot qism", "spare part", "tire", "shina"], "duty_pct": 15, "vat_pct": 12},
    {"chapter": "30", "label": "Pharmaceuticals (dori)", "keywords": ["pharma", "dori", "medicine", "лекарств", "drug", "vitamin"], "duty_pct": 0, "vat_pct": 0},
    {"chapter": "94", "label": "Furniture (mebel)", "keywords": ["furniture", "mebel", "мебель", "stol", "divan", "sofa"], "duty_pct": 20, "vat_pct": 12},
    {"chapter": "39", "label": "Plastics (plastmassa)", "keywords": ["plastic", "plastmassa", "пластик", "polymer", "polimer"], "duty_pct": 10, "vat_pct": 12},
    {"chapter": "72-73", "label": "Iron & steel (metall)", "keywords": ["steel", "po'lat", "metal", "metall", "металл", "armatura", "rebar"], "duty_pct": 5, "vat_pct": 12},
    {"chapter": "10", "label": "Cereals (don)", "keywords": ["wheat", "bug'doy", "grain", "don", "rice", "guruch", "пшениц", "зерно"], "duty_pct": 0, "vat_pct": 12},
]

# Skrining ro'yxatlari — asosiy (to'liq emas; litsenziya tekshiruvi uchun signal)
DUAL_USE_KEYWORDS = [
    "drone", "uav", "dron", "night vision", "thermal imager", "teplovizor",
    "encryption hardware", "gps jammer", "radiation", "uranium", "centrifuge",
    "chemical precursor", "explosive", "portlovchi", "weapon", "qurol", "оружие",
    "ammunition", "o'q-dori", "боеприпас",
]
RESTRICTED_DESTINATIONS = [
    # BMT/keng tarqalgan embargo yo'nalishlari — litsenziya/yuridik tekshiruv signali
    "north korea", "kndr", "северная корея", "iran", "eron", "иран",
    "syria", "suriya", "сирия", "cuba", "kuba", "куба", "crimea", "qrim", "крым",
]

DOC_SETS: dict[str, list[str]] = {
    "export": [
        "Commercial invoice (tijorat hisob-fakturasi)",
        "Packing list (o'ram varag'i)",
        "Contract + specification (kontrakt va spetsifikatsiya)",
        "Certificate of origin — CT-1/Form A (kelib chiqish sertifikati)",
        "Customs export declaration (eksport bojxona deklaratsiyasi)",
        "Transport document — CMR/AWB/Bill of lading",
        "Phytosanitary/veterinary certificate (agar oziq-ovqat/qishloq xo'jaligi bo'lsa)",
        "Currency contract registration in EEIS (kontraktni yagona elektron tizimda ro'yxatga olish)",
    ],
    "import": [
        "Commercial invoice (tijorat hisob-fakturasi)",
        "Packing list (o'ram varag'i)",
        "Contract + specification (kontrakt va spetsifikatsiya)",
        "Customs import declaration (import bojxona deklaratsiyasi)",
        "Certificate of conformity (muvofiqlik sertifikati — texnik reglament tovarlari uchun)",
        "Transport document — CMR/AWB/Bill of lading",
        "Import contract registration in EEIS",
        "Payment documents for customs duties/VAT (boj va QQS to'lov hujjatlari)",
    ],
}

_TRADE_SYSTEM = """\
You are a cross-border trade specialist for Central Asian (especially Uzbekistan)
import/export businesses. Ground every answer in real procedure. Numbers you give
for duties are reference estimates that must be confirmed against the official
customs tariff. Reply ONLY with JSON matching the requested schema.
"""


# ------------------------------------------------------------------
# 1. Bojxona hujjatlari
# ------------------------------------------------------------------

async def customs_docs(shipment: dict[str, Any], language: str = "en") -> dict[str, Any]:
    """shipment = {direction, goods, origin, destination, value_usd, transport, incoterm}"""
    direction = "export" if str(shipment.get("direction", "")).lower().startswith("ex") else "import"

    parsed = await llm_json(
        _TRADE_SYSTEM + "\n" + lang_instruction(language) +
        '\nSchema: {"documents": [{"name":"...","why":"...","where":"office/portal"}],'
        ' "invoice_draft": {"seller":"...","buyer":"...","goods":"...","incoterm":"...","value":"...","currency":"USD"},'
        ' "notes": ["..."]}',
        f"SHIPMENT ({direction}): {json.dumps(shipment, ensure_ascii=False)}",
        max_tokens=1600,
    )
    if parsed and parsed.get("documents"):
        parsed["direction"] = direction
        parsed["method"] = "llm"
        return parsed

    docs = [{"name": d, "why": "", "where": "bojxona.uz / broker"} for d in DOC_SETS[direction]]
    return {
        "direction": direction,
        "documents": docs,
        "invoice_draft": {
            "seller": shipment.get("seller", "(your company)"),
            "buyer": shipment.get("buyer", "(counterparty)"),
            "goods": shipment.get("goods", ""),
            "incoterm": shipment.get("incoterm", "FCA"),
            "value": str(shipment.get("value_usd", "")),
            "currency": "USD",
        },
        "notes": [
            "Reference checklist (offline mode) — a customs broker must confirm the final set.",
            "Food/agro shipments additionally need phytosanitary/veterinary certificates.",
        ],
        "method": "heuristic",
    }


# ------------------------------------------------------------------
# 2. Tarif/boj ma'lumotnomasi
# ------------------------------------------------------------------

async def tariff_lookup(goods: str, destination: str = "Uzbekistan", language: str = "en") -> dict[str, Any]:
    parsed = await llm_json(
        _TRADE_SYSTEM + "\n" + lang_instruction(language) +
        '\nSchema: {"hs_chapter":"..","hs_label":"..","duty_pct_estimate":<num>,"vat_pct":<num>,'
        '"restrictions":["..."],"confidence":"high|medium|low","explanation":"..."}',
        f"GOODS: {goods}\nDESTINATION: {destination}\nGive the HS chapter and Uzbekistan reference duty/VAT if destination is Uzbekistan.",
        max_tokens=700,
    )
    if parsed and parsed.get("hs_chapter"):
        parsed["method"] = "llm"
        parsed["disclaimer"] = "Reference estimate — confirm with the official customs tariff (bojxona.uz)."
        return parsed

    lower = goods.lower()
    best = None
    best_hits = 0
    for row in HS_REFERENCE:
        hits = sum(1 for k in row["keywords"] if k in lower)
        if hits > best_hits:
            best, best_hits = row, hits
    if not best:
        return {
            "hs_chapter": None,
            "hs_label": "Not matched in offline reference table",
            "duty_pct_estimate": None,
            "vat_pct": 12,
            "restrictions": [],
            "confidence": "low",
            "explanation": "Offline reference covers common categories only; describe the goods more specifically or add ANTHROPIC_API_KEY for full HS mapping.",
            "disclaimer": "Reference estimate — confirm with the official customs tariff (bojxona.uz).",
            "method": "heuristic",
        }
    return {
        "hs_chapter": best["chapter"],
        "hs_label": best["label"],
        "duty_pct_estimate": best["duty_pct"],
        "vat_pct": best["vat_pct"],
        "restrictions": [],
        "confidence": "medium" if best_hits > 1 else "low",
        "explanation": f"Matched by keyword(s) to HS chapter {best['chapter']} ({best['label']}).",
        "disclaimer": "Reference estimate — confirm with the official customs tariff (bojxona.uz).",
        "method": "heuristic",
    }


# ------------------------------------------------------------------
# 3. Savdo-muvofiqlik skriningi
# ------------------------------------------------------------------

async def compliance_check(
    goods: str, origin: str, destination: str, counterparty: str = "", language: str = "en"
) -> dict[str, Any]:
    lower = f"{goods} {counterparty}".lower()
    dest_lower = destination.lower()

    flags: list[dict[str, str]] = []
    for kw in DUAL_USE_KEYWORDS:
        if kw in lower:
            flags.append({"type": "dual_use", "match": kw,
                          "action": "Export-control license check required before contracting."})
    for dest in RESTRICTED_DESTINATIONS:
        if dest in dest_lower:
            flags.append({"type": "restricted_destination", "match": dest,
                          "action": "Sanctions/legal review required — many banks will not process payment."})

    base = {
        "goods": goods, "origin": origin, "destination": destination,
        "flags": flags,
        "status": "flagged" if flags else "clear_on_basic_screen",
        "screen_note": "Basic keyword screen against dual-use and embargo lists (not exhaustive; not legal clearance).",
    }

    parsed = await llm_json(
        _TRADE_SYSTEM + "\n" + lang_instruction(language) +
        '\nSchema: {"assessment":"...","additional_risks":["..."],"recommended_steps":["..."]}',
        f"Trade compliance screen result: {json.dumps(base, ensure_ascii=False)}\n"
        f"Assess contextually: real risk level, what could the basic screen have missed, concrete next steps.",
        max_tokens=800,
    )
    if parsed and parsed.get("assessment"):
        base.update(parsed)
        base["method"] = "llm"
    else:
        base["assessment"] = (
            "Flagged items need a license/sanctions review before signing."
            if flags else
            "No matches on the basic screen; for high-value deals verify the counterparty in official registries."
        )
        base["recommended_steps"] = (
            ["Consult a licensed customs broker / export-control lawyer", "Do not prepay until cleared"]
            if flags else
            ["Verify counterparty registration", "Fix currency terms in the contract", "Register the contract in EEIS"]
        )
        base["method"] = "heuristic"
    return base


# ------------------------------------------------------------------
# 4. Yuk kuzatuvi
# ------------------------------------------------------------------

_CARRIER_PATTERNS = [
    (r"^1Z[0-9A-Z]{16}$", "UPS"),
    (r"^\d{12}$", "FedEx"),
    (r"^\d{10}$", "DHL Express"),
    (r"^[A-Z]{2}\d{9}UZ$", "O'zbekiston pochtasi (EMS/registered)"),
    (r"^[A-Z]{2}\d{9}[A-Z]{2}$", "Universal postal (UPU S10)"),
    (r"^\d{11}$", "DHL eCommerce"),
    (r"^(GLS|TNT)", "GLS/TNT"),
]


def tracking_info(tracking_number: str) -> dict[str, Any]:
    tn = tracking_number.strip().upper().replace(" ", "")
    carrier = next((c for pat, c in _CARRIER_PATTERNS if re.match(pat, tn)), None)
    return {
        "tracking_number": tn,
        "carrier_guess": carrier or "Unknown format",
        "live_status": None,
        "live_note": (
            "Live tracking needs a carrier API key — connect the 'aftership-tracking' "
            "connector (Connectors page) to activate real-time status."
        ),
        "manual_links": {
            "17track": f"https://t.17track.net/en#nums={tn}",
            "uzpost": "https://pochta.uz/en/tracking",
        },
    }


# ------------------------------------------------------------------
# 5. Valyuta (mavjud kalitsiz manba)
# ------------------------------------------------------------------

async def fx(base: str = "USD", symbols: str = "UZS,EUR,RUB,CNY,KZT") -> dict[str, Any]:
    return await currency_rates(base=base, symbols=symbols)
