"""
Moliya vositalari — bank tranzaksiyalari va riba tahlili.
"""
import os

# Sandbox/test tranzaksiyalar — haqiqiy bank API ulanganda almashtiriladi
SAMPLE_TRANSACTIONS = [
    {"id": "tx001", "sana": "2026-06-28", "tavsif": "Korzinka supermarket",  "summa": 85000, "valyuta": "UZS", "riba_belgisi": False},
    {"id": "tx002", "sana": "2026-06-27", "tavsif": "Kommunal to'lov",       "summa": 120000, "valyuta": "UZS", "riba_belgisi": False},
    {"id": "tx003", "sana": "2026-06-26", "tavsif": "Hamkor bank kredit faiz","summa": 45000,  "valyuta": "UZS", "riba_belgisi": True},
    {"id": "tx004", "sana": "2026-06-25", "tavsif": "Restoran Samarqand",    "summa": 65000,  "valyuta": "UZS", "riba_belgisi": False},
    {"id": "tx005", "sana": "2026-06-24", "tavsif": "Netflix obuna",         "summa": 30000,  "valyuta": "UZS", "riba_belgisi": False},
    {"id": "tx006", "sana": "2026-06-23", "tavsif": "Kechiktirilgan to'lov jarima","summa": 5000, "valyuta": "UZS", "riba_belgisi": True},
]

INTEREST_KEYWORDS = ["foiz", "kredit faiz", "interest", "late fee", "jarima", "penya", "stavka"]


def _detect_riba(tavsif: str) -> bool:
    return any(kw in tavsif.lower() for kw in INTEREST_KEYWORDS)


async def get_transactions(
    provayider: str = "payme",
    hisob_id: str = "default",
    kunlar: int = 30,
) -> dict:
    """
    Bank tranzaksiyalarini qaytaradi.
    Haqiqiy bank API yo'q bo'lsa sandbox ma'lumotlari qaytariladi.
    """
    # Haqiqiy implementatsiyada: bank_connector.ts ga HTTP chaqiruv
    # yoki to'g'ridan-to'g'ri Payme/Click API
    api_key = os.getenv(f"{provayider.upper()}_SECRET_KEY", "")

    if not api_key:
        # Sandbox ma'lumotlari
        txs = SAMPLE_TRANSACTIONS.copy()
    else:
        # TODO: haqiqiy API chaqiruvi
        txs = SAMPLE_TRANSACTIONS.copy()

    riba_txs = [t for t in txs if t["riba_belgisi"]]
    jami = sum(t["summa"] for t in txs)  # type: ignore[misc]
    riba_jami = sum(t["summa"] for t in riba_txs)  # type: ignore[misc]

    return {
        "provayider": provayider,
        "davr": f"So'nggi {kunlar} kun",
        "jami_tranzaksiya": len(txs),
        "jami_summa_uzs": jami,
        "tranzaksiyalar": txs,
        "riba_tahlili": {
            "riba_belgili_soni": len(riba_txs),
            "riba_belgili_summa": riba_jami,
            "ogoh_tranzaksiyalar": riba_txs,
            "xabar": (
                f"⚠️ {len(riba_txs)} ta tranzaksiyada riba/foiz belgisi aniqlandi. "
                "Halol muqobillar: murobaha, ijara moliyalashtirish."
            ) if riba_txs else "✅ Riba belgisi topilmadi.",
        },
        "eslatma": "Bu sandbox ma'lumotlari. Haqiqiy tranzaksiyalar uchun bank integratsiyasini ulang.",
    }
