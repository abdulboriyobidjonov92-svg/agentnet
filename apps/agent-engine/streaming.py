"""
AgentNet — SSE Streaming Agent Endpoint
Claude API streaming + Halal Filter integration.

Agar haqiqiy ANTHROPIC_API_KEY mavjud bo'lsa — Claude orqali real javob.
Aks holda — DEMO REJIM: haqiqiy halal filter (keyword) + haqiqiy tool'lar
(namoz vaqtlari, Qur'on — bepul API) + token-token simulyatsiya qilingan javob.
"""
import asyncio
import json
import re
from typing import AsyncIterator

from anthropic import AsyncAnthropic
from halal_filter import HalalFilter, Action

import knowledge_sync
from agent_engine import registry
from tools.islam_tools import prayer_times, quran_surah
from tools.utility_tools import weather, currency_rates

_anthropic = AsyncAnthropic()
_halal = HalalFilter()


async def stream_agent_response(
    agent_definition: dict,
    user_id: str,
    message: str,
    conversation_history: list[dict] | None = None,
    profession: str = "",
) -> AsyncIterator[str]:
    """SSE event generatori. Har bir event: 'data: {json}\\n\\n' formatida."""

    # 1. Halal filter — kirish tekshiruvi (keyword qatlami API'siz ishlaydi)
    input_check = await _halal.classify(
        message,
        agent_name=agent_definition.get("name", ""),
        direction="kiruvchi",
        profession=profession,
    )

    if input_check.action == Action.BLOCK:
        yield _sse({"type": "halal_block", "reason": input_check.reasoning, "category": str(input_check.category)})
        return

    if input_check.action == Action.HUMAN_REVIEW:
        yield _sse({"type": "halal_warning", "reason": input_check.reasoning})

    history = conversation_history or []
    messages = history + [{"role": "user", "content": message}]
    system_prompt = agent_definition.get("system_prompt", "Sen foydali AI yordamchisisan.")
    model = agent_definition.get("model", "claude-sonnet-4-6")

    full_response = ""
    used_real_api = False

    # 2. Haqiqiy Claude streaming'ni sinash
    try:
        async with _anthropic.messages.stream(
            model=model,
            max_tokens=2048,
            system=system_prompt,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                used_real_api = True
                full_response += text
                yield _sse({"type": "token", "content": text})
    except Exception:
        # API mavjud emas — demo rejimga o'tamiz (hech qanday token chiqmagan bo'lsa)
        if not used_real_api:
            async for ev in _demo_stream(message, agent_definition):
                if ev.startswith("__TEXT__"):
                    full_response += ev[len("__TEXT__"):]
                else:
                    yield ev
        else:
            yield _sse({"type": "error", "message": "Stream uzildi"})
            return

    # 3. Halal filter — chiqish tekshiruvi
    if full_response.strip():
        output_check = await _halal.classify(
            full_response,
            agent_name=agent_definition.get("name", ""),
            direction="chiquvchi",
            profession=profession,
        )
        if output_check.action == Action.BLOCK:
            yield _sse({"type": "replace", "content": "🚫 Javob Halal Filter tomonidan bloklandi."})

    yield _sse({"type": "done", "halal_flag": input_check.action.value, "demo_mode": not used_real_api})


# ----------------------------------------------------------------
# DEMO REJIM — API kalitisiz ishlaydigan to'liq oqim
# ----------------------------------------------------------------

async def _demo_stream(message: str, agent_definition: dict) -> AsyncIterator[str]:
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


def _sse(payload: dict) -> str:
    # Faqat JSON qaytaramiz — EventSourceResponse 'data: ' prefiksini o'zi qo'shadi.
    return json.dumps(payload, ensure_ascii=False)
