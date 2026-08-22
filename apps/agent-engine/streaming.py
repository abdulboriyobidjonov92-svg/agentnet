"""
AgentNet — SSE Streaming Agent Endpoint
Claude API streaming + Halal Filter integration.

Agar haqiqiy ANTHROPIC_API_KEY mavjud bo'lsa — Claude orqali real javob.
Aks holda — DEMO REJIM: haqiqiy halal filter (keyword) + haqiqiy tool'lar
(namoz vaqtlari, Qur'on — bepul API) + token-token simulyatsiya qilingan javob.
"""
import asyncio
import json
import logging
import os
import re
from typing import Any, AsyncIterator

from anthropic import AsyncAnthropic

import agent_tools
import compliance_packs
import knowledge_sync
import openrouter_client
from halal_filter import Action, HalalFilter
from tools.islam_tools import prayer_times, quran_surah
from tools.utility_tools import currency_rates, weather

_anthropic = AsyncAnthropic()
_halal = HalalFilter()
_log = logging.getLogger("agentnet.streaming")

# Bitta so'rov ichida tool→javob aylanishlarining maksimal soni (loop/xarajat himoyasi).
_MAX_TOOL_ROUNDS = 4

# Free tarifda javob bir bo'lakda keladi (OpenRouter yo'li non-streaming —
# quyidagi izohga qarang), lekin UI token-token oqim kutadi. Shu o'lchamdagi
# bo'laklarga bo'lib yuboramiz.
_FREE_CHUNK_CHARS = 24


def _anthropic_usage(final: object, model: str) -> dict:
    """Anthropic javobidan token hisobini oladi (P0-5).

    `getattr` — SDK versiyalari `cache_read_input_tokens` ni har doim
    ham bermaydi; yo'q bo'lsa 0. Jimgina yiqilish o'rniga nol.
    """
    u = getattr(final, "usage", None)
    if u is None:
        return {}
    return {
        "model": model,
        "input_tokens": int(getattr(u, "input_tokens", 0) or 0),
        "output_tokens": int(getattr(u, "output_tokens", 0) or 0),
        "cache_read_tokens": int(getattr(u, "cache_read_input_tokens", 0) or 0),
    }


def _accumulate_usage(total: dict, part: dict) -> None:
    """Tool-loop aylanishlarini QO'SHADI (almashtirmaydi).

    Har aylanish alohida LLM chaqiruvi — faqat oxirgisini olish real
    sarfni quyi baholardi va marja soxta yaxshi chiqardi.
    """
    if not part:
        return
    if part.get("model"):
        total["model"] = part["model"]
    for k in ("input_tokens", "output_tokens", "cache_read_tokens"):
        total[k] = int(total.get(k) or 0) + int(part.get(k) or 0)



async def stream_agent_response(
    agent_definition: dict,
    user_id: str,
    message: str,
    conversation_history: list[dict] | None = None,
    profession: str = "",
    tier: str = "paid",
) -> AsyncIterator[str]:
    """SSE event generatori. Har bir event: 'data: {json}\\n\\n' formatida.

    `tier` — "free" bo'lsa javob OpenRouter'ning BEPUL modellari zanjiridan
    keladi (pul yechilmaydi), aks holda mavjud Anthropic yo'li. Bu qaror
    SERVERDA (`AgentsService`) qabul qilinadi va mijozdan KELMAYDI.
    """

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
    messages: list[dict] = history + [{"role": "user", "content": message}]
    system_prompt = agent_definition.get("system_prompt", "Sen foydali AI yordamchisisan.")
    model = agent_definition.get("model", "claude-sonnet-5")

    # S3: Vertical Compliance Pack — agent vertikaliga qarab avtomatik yuklanadi.
    # Tizim-promptga majburiy xulq qoidalari qo'shiladi (HIPAA-style by default).
    vertical = agent_definition.get("vertical")
    language = agent_definition.get("language", "en")
    city = agent_definition.get("city", "Tashkent")
    pack_addendum = compliance_packs.system_addendum(vertical)
    if pack_addendum:
        system_prompt = f"{system_prompt}\n\n{pack_addendum}"

    # #11: agentga biriktirilgan jonli toollar — real rejimda Claude ularni
    # HAQIQATAN chaqiradi. Ilgari real yo'l faqat matn oqimi edi; toollar faqat
    # DEMO rejimda "ishlagandek" ko'rinardi.
    #
    # Endi butun ToolSpec (tool_id + config) uzatiladi, chunki foydalanuvchining
    # ULANGAN KONNEKTORLARI aynan `config` ichida o'z amal-sxemasini olib
    # keladi (NestJS `toolSpecsForAgent` yig'adi). Ilgari faqat `tool_id`
    # ro'yxati olinardi — shu sababli konnektorlar modelga umuman yetib
    # bormasdi.
    agent_tool_specs = [t for t in agent_definition.get("tools", []) if isinstance(t, dict) and t.get("tool_id")]
    tool_defs = agent_tools.build_tools(agent_tool_specs)
    connector_targets = agent_tools.connector_targets(agent_tool_specs)
    tool_ctx = agent_tools.ToolCtx(
        language=language,
        city=city,
        user_id=user_id,
        agent_id=str(agent_definition.get("agent_id") or ""),
    )

    full_response = ""
    used_real_api = False
    # P0-5 — o'lchov yig'indisi (ADR-023). Oqim oxirida BITTA `usage`
    # hodisasi bo'lib chiqadi; API uni `UsageEvent` ga yozadi.
    usage_total: dict[str, Any] = {
        "model": None,
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
    }

    # 2a. FREE TARIF — OpenRouter ko'p-model zanjiri (pullik yo'lga TEGMAYDI).
    if tier == "free":
        try:
            async for ev in _openrouter_rounds(
                system_prompt=system_prompt,
                messages=messages,
                tool_defs=tool_defs,
                connector_targets=connector_targets,
                tool_ctx=tool_ctx,
            ):
                if ev.startswith("__TEXT__"):
                    full_response += ev[len("__TEXT__"):]
                    used_real_api = True
                elif ev.startswith("__USAGE__"):
                    _accumulate_usage(usage_total, json.loads(ev[len("__USAGE__"):]))
                else:
                    yield ev
        except openrouter_client.NoFreeModelAvailable as e:
            # Demo-javob BERILMAYDI: u "ishladi" degan yolg'on taassurot
            # qoldiradi. Aniq holat — foydalanuvchi qayta urinishni biladi.
            _log.warning("OpenRouter zanjiri tugadi: %s", e)
            yield _sse({
                "type": "error",
                "message": "Bepul rejim hozir band — bir necha daqiqadan so'ng qayta urinib ko'ring.",
                "reason": "free_models_unavailable",
            })
            return

    # 2b. PULLIK TARIF — mavjud Claude streaming yo'li (tool-use loop bilan)
    if tier != "free":
        try:
            # Agentic loop: model tool so'rasa — ijro etamiz, natijani qaytaramiz,
            # yakuniy matngacha davom etamiz. Chegara xarajat/loopdan himoya.
            for _ in range(_MAX_TOOL_ROUNDS):
                stream_kwargs: dict = {
                    "model": model,
                    "max_tokens": 2048,
                    "system": system_prompt,
                    "messages": messages,
                    # Sonnet 5 adaptiv fikrlashni sukut bo'yicha yoqadi — chat oqimida
                    # bu javob token-byudjetini yeyishi mumkin; Sonnet 4.6 bilan bir xil
                    # xulq uchun o'chiramiz.
                    "extra_body": {"thinking": {"type": "disabled"}},
                }
                if tool_defs:
                    stream_kwargs["tools"] = tool_defs

                async with _anthropic.messages.stream(**stream_kwargs) as stream:  # type: ignore[arg-type]
                    async for text in stream.text_stream:
                        used_real_api = True
                        full_response += text
                        yield _sse({"type": "token", "content": text})
                    final = await stream.get_final_message()

                # P0-5: har aylanish o'z tokenini qo'shadi (tool-loop bir
                # necha marta aylanadi — faqat oxirgisini olish sarfni
                # QUYI baholardi).
                _accumulate_usage(usage_total, _anthropic_usage(final, model))

                # Tool so'ralmagan bo'lsa — javob tugadi.
                if not tool_defs or final.stop_reason != "tool_use":
                    break

                # Model tool(lar)ni chaqirdi: assistant xabarini qo'shamiz, har toolni
                # ijro etamiz va natijani `tool_result` sifatida qaytaramiz.
                messages.append({"role": "assistant", "content": final.content})
                tool_results: list[dict] = []
                for block in final.content:
                    if getattr(block, "type", None) != "tool_use":
                        continue
                    # getattr — content-block union'i (ThinkingBlock, ...) uchun mypy
                    # union-attr xatolarini oldini oladi; ish paytida faqat tool_use
                    # bloklariga yetib kelamiz (yuqoridagi tekshiruv).
                    b_name = getattr(block, "name", "")
                    b_input = getattr(block, "input", None) or {}
                    b_id = getattr(block, "id", "")
                    yield _sse({"type": "tool_result", "result": {"tool": b_name, "calling": b_input}})
                    out = await agent_tools.run_tool(b_name, dict(b_input), tool_ctx, connector_targets)
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": b_id,
                            "content": agent_tools.to_tool_result_content(out),
                        }
                    )
                messages.append({"role": "user", "content": tool_results})
                # keyingi aylanada model tool natijalari asosida yakuniy javob beradi
        except Exception:
            if used_real_api:
                yield _sse({"type": "error", "message": "Stream uzildi"})
                return
            # MUHIM FARQ: kalit SOZLANGAN bo'lsa, chaqiruv yiqilishi haqiqiy xato —
            # demo-javob berib "muvaffaqiyat" (done) ko'rsatish foydalanuvchidan
            # konserva-javob uchun pul olishga olib kelardi. Error-event BFF'da
            # refund'ni ishga tushiradi. Demo rejim FAQAT kalit umuman yo'q
            # (ataylab demo-instans) bo'lganda ishlaydi.
            if os.getenv("ANTHROPIC_API_KEY", "").strip():
                yield _sse({
                    "type": "error",
                    "message": "AI xizmatida vaqtinchalik uzilish — birozdan so'ng qayta urinib ko'ring",
                })
                return
            async for ev in _demo_stream(message, agent_definition, user_id):
                if ev.startswith("__TEXT__"):
                    full_response += ev[len("__TEXT__"):]
                else:
                    yield ev

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

    # 4. S3: Vertical compliance post-tekshiruvi — taqiqlangan da'vo naqshlari
    # va majburiy disclaimer. Javob o'zgartirilmaydi; disclaimer alohida
    # event sifatida qo'shiladi (UI xabar oxiriga ulaydi).
    if vertical and full_response.strip():
        cc = compliance_packs.check_output(full_response, vertical, language)
        if cc["violations"]:
            yield _sse({
                "type": "compliance_flag",
                "vertical": vertical,
                "violations": len(cc["violations"]),
                "note": "Output matched prohibited-claim patterns for this vertical; corrective disclaimer enforced.",
            })
        if cc["disclaimer_needed"] and cc["disclaimer"]:
            yield _sse({"type": "disclaimer", "content": cc["disclaimer"], "vertical": vertical})

    # P0-5: o'lchov hodisasi `done` dan OLDIN — API oqim yopilishidan
    # avval uni ko'rib ulgursin (tap `done` da run'ni yakunlaydi).
    if usage_total["input_tokens"] or usage_total["output_tokens"]:
        yield _sse({"type": "usage", **usage_total})

    yield _sse({"type": "done", "halal_flag": input_check.action.value, "demo_mode": not used_real_api})


# ----------------------------------------------------------------
# FREE TARIF — OpenRouter ko'p-model zanjiri (tool-calling bilan)
# ----------------------------------------------------------------


async def _openrouter_rounds(
    *,
    system_prompt: str,
    messages: list[dict],
    tool_defs: list[dict],
    connector_targets: dict[str, str],
    tool_ctx: "agent_tools.ToolCtx",
) -> AsyncIterator[str]:
    """Free tarif uchun tool-use loop. `__TEXT__` prefiksli event'lar
    to'liq javobga qo'shiladi (chiqish halal tekshiruvi uchun).

    NEGA NON-STREAMING: OpenRouter oqimida `tool_calls` bo'lak-bo'lak
    (delta) keladi va uni har provayder biroz boshqacha bo'laklaydi.
    Bepul modellar zanjirida ishonchlilik tezlikdan MUHIMROQ, shuning uchun
    har aylanish to'liq javob oladi va matn UI uchun bo'laklarga bo'lib
    yuboriladi. Foydalanuvchi baribir token-token oqim ko'radi.
    """
    for _ in range(_MAX_TOOL_ROUNDS):
        result = await openrouter_client.complete(
            system=system_prompt,
            messages=messages,
            tools=tool_defs or None,
        )
        # Model nomi FAQAT serverda qoladi — UI'da "AgentNet AI" bo'lib
        # ko'rinadi (spetsifikatsiya 2.2: qaysi model ishlatilgani
        # foydalanuvchiga ko'rsatilmaydi).
        _log.info("free-tier javob: model=%s urinishlar=%s", result["model"], result["attempts"])

        # P0-5: o'lchov. `__USAGE__` — ichki signal (SSE emas), uni
        # chaqiruvchi yig'ib, oxirida BITTA `usage` hodisasi qiladi.
        u = result.get("usage") or {}
        if u:
            yield "__USAGE__" + json.dumps(
                {"model": result.get("model"), **u}, ensure_ascii=False
            )
        text = result["text"]
        for i in range(0, len(text), _FREE_CHUNK_CHARS):
            chunk = text[i : i + _FREE_CHUNK_CHARS]
            yield _sse({"type": "token", "content": chunk})
            yield "__TEXT__" + chunk
            await asyncio.sleep(0)

        calls = result["tool_calls"]
        if not tool_defs or not calls:
            return

        # OpenAI shakli: assistant xabari `tool_calls` bilan, keyin har
        # chaqiruvga alohida `role:"tool"` javobi (`tool_call_id` orqali bog'lanadi).
        messages.append(
            {
                "role": "assistant",
                "content": text or None,
                "tool_calls": [
                    {
                        "id": c["id"],
                        "type": "function",
                        "function": {"name": c["name"], "arguments": json.dumps(c["args"], ensure_ascii=False)},
                    }
                    for c in calls
                ],
            }
        )
        for c in calls:
            yield _sse({"type": "tool_result", "result": {"tool": c["name"], "calling": c["args"]}})
            out = await agent_tools.run_tool(c["name"], c["args"], tool_ctx, connector_targets)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": c["id"],
                    "content": agent_tools.to_tool_result_content(out),
                }
            )


# ----------------------------------------------------------------
# DEMO REJIM — API kalitisiz ishlaydigan to'liq oqim
# ----------------------------------------------------------------

async def _demo_stream(message: str, agent_definition: dict, user_id: str = "") -> AsyncIterator[str]:
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
        # Foydalanuvchiga ichki sozlash detali (.env, kalit nomi) ko'rsatilmaydi.
        parts.append(
            f"Assalomu alaykum! Men **{name}**man. \n\n"
            f"Siz yozgan xabar: _\"{message}\"_\n\n"
            "Hozir **demo rejimda** ishlayapman — to'liq AI javoblari bu muhitda "
            "vaqtincha yoqilmagan. Lekin halal filter va jonli vositalar (namoz "
            "vaqtlari, ob-havo, valyuta kurslari) **to'liq ishlaydi**! ✅"
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
