"""
Islomiy vositalar — Aladhan API va AlQuran.cloud (API kaliti shart emas)
"""
from datetime import date

import httpx


async def prayer_times(city: str = "Tashkent", country: str = "UZ", method: int = 2) -> dict:
    """
    Namoz vaqtlarini qaytaradi.
    API: https://api.aladhan.com — bepul, API key kerak emas.
    method=2 — Islamic Society of North America
    method=3 — Muslim World League (ko'p O'zbekiston masjidlari)
    """
    today = date.today().strftime("%d-%m-%Y")
    url = f"https://api.aladhan.com/v1/timingsByCity/{today}"
    params = {"city": city, "country": country, "method": method}

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            res = await client.get(url, params=params)
            res.raise_for_status()
            data = res.json()
            timings = data["data"]["timings"]
            return {
                "city": city,
                "date": today,
                "namoz_vaqtlari": {
                    "Bomdod (Fajr)": timings["Fajr"],
                    "Quyosh chiqishi (Sunrise)": timings["Sunrise"],
                    "Peshin (Dhuhr)": timings["Dhuhr"],
                    "Asr": timings["Asr"],
                    "Shom (Maghrib)": timings["Maghrib"],
                    "Xufton (Isha)": timings["Isha"],
                },
                "hijri_sana": data["data"]["date"]["hijri"]["date"],
            }
        except Exception as e:
            return {"xato": str(e), "city": city}


async def quran_surah(surah_number: int = 1, edition: str = "uz.sodik") -> dict:
    """
    Qur'on surasini qaytaradi.
    API: https://api.alquran.cloud — bepul, API key kerak emas.
    edition: "uz.sodik" — O'zbekcha Sodiq Muhammadyusuf tarjimasi
             "ar.alafasy" — arabcha Mishary al-Afasy
    """
    url = f"https://api.alquran.cloud/v1/surah/{surah_number}/{edition}"

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            res = await client.get(url)
            res.raise_for_status()
            data = res.json()["data"]
            ayahs = [
                {"raqam": a["numberInSurah"], "matn": a["text"]}
                for a in data["ayahs"][:10]  # birinchi 10 oyat
            ]
            return {
                "sura_raqami": surah_number,
                "sura_nomi": data["name"],
                "oyatlar_soni": data["numberOfAyahs"],
                "birinchi_10_oyat": ayahs,
                "izoh": f"To'liq suraning {data['numberOfAyahs']} oyati bor. Ko'proq so'rash mumkin.",
            }
        except Exception as e:
            return {"xato": str(e), "sura_raqami": surah_number}
