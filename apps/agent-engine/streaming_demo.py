"""
DEMO REJIM — API kalitisiz ishlaydigan to'liq oqim.
ANTHROPIC_API_KEY yo'q yoki stream muvaffaqiyatsiz bo'lganda streaming.py
shu yerdagi _demo_stream()ga tushadi: haqiqiy tool'lar (namoz vaqtlari,
Qur'on, ob-havo, valyuta, jonli bilim, brauzer) + token-token simulyatsiya.
"""
import asyncio
import json
import re
from typing import AsyncIterator

import knowledge_sync
from tools.islam_tools import prayer_times, quran_surah
from tools.utility_tools import weather, currency_rates


def _sse(payload: dict) -> str:
    # Faqat JSON qaytaramiz — EventSourceResponse 'data: ' prefiksini o'zi qo'shadi.
    return json.dumps(payload, ensure_ascii=False)


async def demo_stream(message: str, agent_definition: dict, user_id: str = "") -> AsyncIterator[str]:
    """
    Haqiqiy tool'lar bilan demo javob. '__TEXT__' prefiksli event'lar
    to'liq javobga qo'shiladi (chiqish halal tekshiruvi uchun).
    """
    name = agent_definition.get("name", "Agent")
    tool_ids = {t.get("tool_id") for t in agent_definition.get("tools", [])}
    lower = message.lower()

    parts: list[str] = []

    # --- Namoz vaqtlari tool'i (haqiqiy Aladhan API) ---
    if "islam.prayer_times" in tool_ids and any(
        k in lower for k in ["namoz", "vaqt", "bomdod", "peshin", "asr", "shom", "xufton", "prayer"]
    ):
        city = _extract_city(message)
        yield _sse({"type": "tool_result", "result": {"tool_id": "islam.prayer_times", "calling": city}})
        res = await prayer_times(city=city)
        if "xato" in res:
            parts.append(f"Namoz vaqtlarini olishda xatolik: {res['xato']}")
        else:
            parts.append(f"📿 **{res.get('city', city)}** uchun bugungi namoz vaqtlari ({res.get('date', '')}):\n\n")
            for label, vaqt in (res.get("namoz_vaqtlari") or {}).items():
                parts.append(f"- **{label}**: {vaqt}\n")
            parts.append(f"\nHijriy sana: {res.get('hijri_sana', '')}\n\nAlloh ibodatlaringizni qabul qilsin. 🤲")

    # --- Qur'on sura tool'i (haqiqiy AlQuran.cloud API) ---
    elif "islam.quran_surah" in tool_ids and any(k in lower for k in ["sura", "surah", "oyat", "qur'on", "quran", "fotiha"]):
        num = _extract_surah_number(message)
        yield _sse({"type": "tool_result", "result": {"tool_id": "islam.quran_surah", "surah": num}})
        res = await quran_surah(surah_number=num)
        if "xato" in res:
            parts.append(f"Surani olishda xatolik: {res['xato']}")
        else:
            parts.append(f"📖 **{res.get('sura_nomi', f'Sura {num}')}** ({res.get('oyatlar_soni', '')} oyat)\n\n")
            for ayah in (res.get("birinchi_10_oyat") or [])[:5]:
                parts.append(f"{ayah.get('raqam', '')}. {ayah.get('matn', '')}\n\n")

    # --- Ob-havo tool'i (haqiqiy Open-Meteo API) ---
    elif "utility.weather" in tool_ids and any(k in lower for k in ["ob-havo", "obhavo", "harorat", "weather", "погода", "градус"]):
        city = _extract_city(message)
        yield _sse({"type": "tool_result", "result": {"tool_id": "utility.weather", "calling": city}})
        res = await weather(city=city)
        if "xato" in res:
            parts.append(f"Ob-havoni olishda xatolik: {res['xato']}")
        else:
            parts.append(f"🌤️ **{res.get('shahar', city)}, {res.get('davlat', '')}** — joriy ob-havo:\n\n")
            parts.append(f"- Harorat: **{res.get('harorat_C')}°C**\n")
            parts.append(f"- Holat: {res.get('holat')}\n")
            parts.append(f"- Namlik: {res.get('namlik_foiz')}%\n")
            parts.append(f"- Shamol: {res.get('shamol_km_s')} km/soat\n")

    # --- Jonli bilim (Knowledge Sync — yangiliklar, Wikipedia, atributsiya bilan) ---
    elif "knowledge.search" in tool_ids and any(
        k in lower for k in ["news", "yangilik", "новост", "so'nggi", "latest", "nima bo'lyapti", "what is", "kim bu", "who is", "что такое"]
    ):
        yield _sse({"type": "tool_result", "result": {"tool_id": "knowledge.search", "calling": message[:60]}})
        res = await knowledge_sync.search(message, language="en")
        parts.append("🌍 **Jonli manbalardan** (Real-time Knowledge Sync):\n\n")
        for src in res.get("sources", []):
            items = src.get("items") or []
            if not items:
                continue
            parts.append(f"**{src.get('source')}** ({src.get('retrieved_at', '')[:16]}):\n")
            for it in items[:4]:
                title = it.get("title", "")
                url = it.get("url", "")
                summary = it.get("summary", "")
                if url:
                    parts.append(f"- [{title}]({url})\n")
                elif summary:
                    parts.append(f"- **{title}**: {summary[:300]}\n")
                elif it.get("data"):
                    parts.append(f"- {title}: `{json.dumps(it['data'], ensure_ascii=False)[:200]}`\n")
            parts.append("\n")
        if len(parts) == 1:
            parts.append("Jonli manbalardan natija topilmadi — so'rovni aniqlashtiring.")

    # --- S1: Brauzer-avtomatlashtirish (haqiqiy Playwright bridge orqali) ---
    elif "web.automate" in tool_ids and (
        re.search(r"https?://", message)
        or any(k in lower for k in ["avtomat", "automate", "открой сайт", "saytni och", "open the site", "browse"])
    ):
        from tools.automation_tools import web_automate

        yield _sse({"type": "tool_result", "result": {"tool_id": "web.automate", "calling": message[:60]}})
        res = await web_automate(goal=message, user_id=user_id, language=agent_definition.get("language", "en"))
        if res.get("holat") == "xato":
            parts.append(f"Brauzer-avtomatlashtirishda xatolik: {res.get('sabab')}")
        else:
            result = res.get("result") or {}
            parts.append(f"🌐 **Brauzer yurgizishi** — holat: **{res.get('status', '?')}**\n\n")
            if result.get("summary"):
                parts.append(f"{result['summary']}\n\n")
            if result.get("extracted"):
                parts.append(f"Olingan ma'lumot:\n\n{str(result['extracted'])[:800]}\n")
            if result.get("finalUrl"):
                parts.append(f"\nYakuniy sahifa: {result['finalUrl']} — \"{result.get('finalTitle', '')}\"")

    # --- Valyuta kurslari (haqiqiy open.er-api.com) ---
    elif "finance.currency_rates" in tool_ids and any(k in lower for k in ["valyuta", "kurs", "dollar", "currency", "курс", "валюта", "usd", "eur"]):
        yield _sse({"type": "tool_result", "result": {"tool_id": "finance.currency_rates", "calling": "USD"}})
        res = await currency_rates(base="USD", symbols="UZS,EUR,RUB")
        if "xato" in res:
            parts.append(f"Kurslarni olishda xatolik: {res['xato']}")
        else:
            parts.append(f"💱 **{res.get('asos', 'USD')}** kursi:\n\n")
            for cur, val in (res.get("kurslar") or {}).items():
                parts.append(f"- 1 USD = **{val} {cur}**\n")

    # --- Umumiy demo javob ---
    if not parts:
        parts.append(
            f"Assalomu alaykum! Men **{name}**man. \n\n"
            f"Siz yozgan xabar: _\"{message}\"_\n\n"
            "Hozir **demo rejimda** ishlayapman — haqiqiy Claude javoblari uchun "
            "`.env` faylga `ANTHROPIC_API_KEY` qo'shish kerak. "
            "Lekin halal filter va vositalar (namoz vaqtlari, Qur'on) allaqachon **to'liq ishlayapti**! ✅"
        )

    # Token-token oqim simulyatsiyasi
    text = "".join(parts)
    for token in re.findall(r"\S+\s*", text):
        yield _sse({"type": "token", "content": token})
        yield "__TEXT__" + token
        await asyncio.sleep(0.015)


def _extract_city(message: str) -> str:
    cities = {
        "toshkent": "Tashkent", "tashkent": "Tashkent", "samarqand": "Samarkand",
        "buxoro": "Bukhara", "andijon": "Andijan", "namangan": "Namangan",
        "farg'ona": "Fergana", "fargona": "Fergana", "nukus": "Nukus",
        "qarshi": "Qarshi", "navoiy": "Navoi", "jizzax": "Jizzakh", "termiz": "Termez",
    }
    low = message.lower()
    for k, v in cities.items():
        if k in low:
            return v
    return "Tashkent"


def _extract_surah_number(message: str) -> int:
    m = re.search(r"\b(\d{1,3})\b", message)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 114:
            return n
    if "fotiha" in message.lower() or "fatiha" in message.lower():
        return 1
    return 1
