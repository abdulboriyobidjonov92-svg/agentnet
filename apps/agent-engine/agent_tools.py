"""
AgentNet — real-rejim (Claude) uchun tool (function-calling) registri.

Nega kerak: `streaming.py`ning HAQIQIY-API yo'li ilgari faqat matn oqimi edi —
ANTHROPIC_API_KEY qo'yilgach ham namoz-vaqti/ob-havo/valyuta/qidiruv toollari
UMUMAN ishlatilmasdi (faqat DEMO rejim keyword bilan tool chaqirardi). Endi
model haqiqatan bu jonli manbalarni chaqira oladi.

RUXSAT MODELI (o'zgardi). Ilgari bu yerda faqat 5 ta o'qiydigan info-tool bor
edi va `build_tools` tanimagan HAR QANDAY tool_id'ni JIMGINA tashlab yuborardi.
Amalda bu shuni anglatardi: foydalanuvchi UI'da 8 ta vositadan tanlaydi, agent
kartasida ular ko'rinadi, lekin modelga faqat 3 tasi yetib borardi — qolganlari
"bor"dek ko'rinib, hech qachon chaqirilmasdi. Konnektorlar esa umuman yo'q edi.

Endi ruxsat qarori BU YERDA emas, MANBADA qabul qilinadi:
  • statik toollar — agentga yaratishda tanlanganlari (`Agent.toolsConfig`);
  • konnektorlar  — foydalanuvchi ULAGAN va agentga ochiq bo'lganlari
    (`ConnectorsService.toolSpecsForAgent` — u yerda egalik va biriktirish
    tekshiriladi).
Bu fayl endi faqat "shu tool_id'ni Claude sxemasiga o'gir va ijro et" ishini
bajaradi. Yon-taʼsirli tool (telegram, konnektor amali, brauzer) ham shu
yo'ldan o'tadi — chunki uni ro'yxatga QO'SHISH aktining o'zi foydalanuvchining
aniq ruxsati.
"""

from __future__ import annotations

import json
from typing import Any, Awaitable, Callable, NamedTuple

import knowledge_sync
from tools.automation_tools import connector_invoke, web_automate
from tools.calendar_tools import get_events
from tools.finance_tools import get_transactions
from tools.health_tools import calorie_estimate, symptom_check
from tools.islam_tools import prayer_times, quran_surah
from tools.utility_tools import currency_rates, weather

# Claude tool nomi ^[a-zA-Z0-9_-]{1,64}$ ga bo'ysunadi — tool_id'dagi nuqta va
# defis yaroqsiz, shuning uchun API nomi sifatida "_" bilan almashtiriladi va
# ijro paytida orqaga xaritalanadi.

#: Konnektor tool_id prefiksi — NestJS `CONNECTOR_TOOL_PREFIX` bilan bir xil.
CONNECTOR_PREFIX = "connector."


class ToolCtx(NamedTuple):
    """Tool ijrosining foydalanuvchi konteksti (modeldan KELMAYDI — serverdan)."""

    language: str = "en"
    city: str = "Tashkent"
    user_id: str = ""
    agent_id: str = ""


ToolRunner = Callable[[dict[str, Any], ToolCtx], Awaitable[dict[str, Any]]]


def _prayer(args: dict[str, Any], ctx: ToolCtx) -> Awaitable[dict[str, Any]]:
    return prayer_times(city=args.get("city") or ctx.city or "Tashkent", country=args.get("country", "UZ"))


def _quran(args: dict[str, Any], ctx: ToolCtx) -> Awaitable[dict[str, Any]]:
    try:
        num = int(args.get("surah_number", 1))
    except (TypeError, ValueError):
        num = 1
    return quran_surah(surah_number=max(1, min(114, num)))


def _weather(args: dict[str, Any], ctx: ToolCtx) -> Awaitable[dict[str, Any]]:
    return weather(city=args.get("city") or ctx.city or "Tashkent")


def _currency(args: dict[str, Any], ctx: ToolCtx) -> Awaitable[dict[str, Any]]:
    return currency_rates(base=args.get("base", "USD"), symbols=args.get("symbols", "UZS,EUR,RUB"))


def _knowledge(args: dict[str, Any], ctx: ToolCtx) -> Awaitable[dict[str, Any]]:
    return knowledge_sync.search(str(args.get("query", "")), language=ctx.language, city=ctx.city or "Tashkent")


def _calendar(args: dict[str, Any], ctx: ToolCtx) -> Awaitable[dict[str, Any]]:
    return get_events(
        sana_boshlanish=str(args.get("start_date", "")),
        sana_tugash=str(args.get("end_date", "")),
        calendar_id=str(args.get("calendar_id", "primary")),
    )


def _transactions(args: dict[str, Any], ctx: ToolCtx) -> Awaitable[dict[str, Any]]:
    try:
        days = int(args.get("days", 30))
    except (TypeError, ValueError):
        days = 30
    return get_transactions(
        provayider=str(args.get("provider", "payme")),
        hisob_id=str(args.get("account_id", "default")),
        kunlar=max(1, min(365, days)),
    )


def _symptom(args: dict[str, Any], ctx: ToolCtx) -> Awaitable[dict[str, Any]]:
    raw = args.get("symptoms") or []
    symptoms = [str(s) for s in raw] if isinstance(raw, list) else [str(raw)]
    try:
        age = int(args.get("age", 30))
    except (TypeError, ValueError):
        age = 30
    return symptom_check(simptomlar=symptoms, yosh=age, jinsi=str(args.get("sex", "noma'lum")))


def _calories(args: dict[str, Any], ctx: ToolCtx) -> Awaitable[dict[str, Any]]:
    return calorie_estimate(ovqat_tavsifi=str(args.get("food_description", "")))


def _web_automate(args: dict[str, Any], ctx: ToolCtx) -> Awaitable[dict[str, Any]]:
    return web_automate(
        goal=str(args.get("goal", "")),
        start_url=str(args.get("start_url", "")),
        user_id=ctx.user_id,
        language=ctx.language,
    )


def _connector_generic(args: dict[str, Any], ctx: ToolCtx) -> Awaitable[dict[str, Any]]:
    """`connector.invoke` — model konnektorni O'ZI nomlaydi (umumiy shakl)."""
    params = args.get("params")
    return connector_invoke(
        connector_id=str(args.get("connector_id", "")),
        action=str(args.get("action", "")),
        params=params if isinstance(params, dict) else {},
        user_id=ctx.user_id,
        agent_id=ctx.agent_id,
    )


def _telegram(args: dict[str, Any], ctx: ToolCtx) -> Awaitable[dict[str, Any]]:
    """Telegram xabari HAR DOIM konnektor orqali — token foydalanuvchiniki.

    Ilgari `tools.messaging_tools.telegram_send` to'g'ridan-to'g'ri ishlatilishi
    mumkin edi, lekin u faqat platformaning global `TELEGRAM_BOT_TOKEN` env
    kalitini biladi. Konnektor yo'li foydalanuvchining SAQLANGAN (shifrlangan)
    tokenini oladi va u yo'q bo'lsa o'zi env'ga qaytadi — ya'ni bu yo'l qatʼiy
    kengroq va sirlar bitta joyda qoladi.
    """
    return connector_invoke(
        connector_id="telegram-bot",
        action="send_message",
        params={"chat_id": str(args.get("chat_id", "")), "text": str(args.get("text", ""))},
        user_id=ctx.user_id,
        agent_id=ctx.agent_id,
    )


# tool_id -> (Claude api nomi, tavsif, input_schema, runner)
_INFO_TOOLS: dict[str, dict[str, Any]] = {
    "islam.prayer_times": {
        "api_name": "islam_prayer_times",
        "description": "Berilgan shahar uchun bugungi besh vaqt namoz vaqtlarini (Aladhan API) qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "Shahar nomi (masalan Tashkent, Samarkand)."},
                "country": {"type": "string", "description": "Davlat ISO kodi, standart UZ."},
            },
        },
        "run": _prayer,
    },
    "islam.quran_surah": {
        "api_name": "islam_quran_surah",
        "description": "Qur'on surasining birinchi oyatlarini (AlQuran.cloud) qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {"surah_number": {"type": "integer", "description": "Sura raqami 1-114."}},
            "required": ["surah_number"],
        },
        "run": _quran,
    },
    "utility.weather": {
        "api_name": "utility_weather",
        "description": "Berilgan shahar uchun joriy ob-havoni (Open-Meteo) qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {"city": {"type": "string", "description": "Shahar nomi."}},
        },
        "run": _weather,
    },
    "finance.currency_rates": {
        "api_name": "finance_currency_rates",
        "description": "Valyuta kurslarini (open.er-api.com) qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {
                "base": {"type": "string", "description": "Asos valyuta, standart USD."},
                "symbols": {"type": "string", "description": "Vergul bilan ajratilgan valyutalar, masalan UZS,EUR,RUB."},
            },
        },
        "run": _currency,
    },
    "knowledge.search": {
        "api_name": "knowledge_search",
        "description": "Jonli manbalardan (yangiliklar, Wikipedia, kurslar) qidiradi va atributsiya bilan qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Qidiruv so'rovi."}},
            "required": ["query"],
        },
        "run": _knowledge,
    },
    "calendar.get_events": {
        "api_name": "calendar_get_events",
        "description": "Foydalanuvchi kalendaridagi yaqin tadbirlarni qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {"type": "string", "description": "Boshlanish sanasi YYYY-MM-DD (ixtiyoriy)."},
                "end_date": {"type": "string", "description": "Tugash sanasi YYYY-MM-DD (ixtiyoriy)."},
                "calendar_id": {"type": "string", "description": "Kalendar id, standart primary."},
            },
        },
        "run": _calendar,
    },
    "finance.get_transactions": {
        "api_name": "finance_get_transactions",
        "description": "Foydalanuvchining bank/to'lov tranzaksiyalarini (riba belgisi bilan) qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {
                "provider": {"type": "string", "description": "To'lov provayderi, standart payme."},
                "account_id": {"type": "string", "description": "Hisob identifikatori (ixtiyoriy)."},
                "days": {"type": "integer", "description": "Necha kunlik tarix, standart 30."},
            },
        },
        "run": _transactions,
    },
    "health.symptom_check": {
        "api_name": "health_symptom_check",
        "description": "Simptomlar bo'yicha DIAGNOZ EMAS, maʼlumot-ma'noda yo'naltiruvchi ma'lumot qaytaradi.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symptoms": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Simptomlar ro'yxati.",
                },
                "age": {"type": "integer", "description": "Bemor yoshi."},
                "sex": {"type": "string", "description": "Jinsi (erkak/ayol/noma'lum)."},
            },
            "required": ["symptoms"],
        },
        "run": _symptom,
    },
    "health.calorie_estimate": {
        "api_name": "health_calorie_estimate",
        "description": "Ovqat tavsifidan kaloriya va ozuqa tarkibini taxmin qiladi.",
        "input_schema": {
            "type": "object",
            "properties": {"food_description": {"type": "string", "description": "Ovqat tavsifi."}},
            "required": ["food_description"],
        },
        "run": _calories,
    },
    "messaging.telegram_send": {
        "api_name": "messaging_telegram_send",
        "description": (
            "Telegram orqali HAQIQIY xabar yuboradi (foydalanuvchining ulangan boti bilan). "
            "Yon-taʼsirli amal — faqat foydalanuvchi aniq so'raganda chaqiring."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "chat_id": {"type": "string", "description": "Qabul qiluvchi chat ID."},
                "text": {"type": "string", "description": "Yuboriladigan matn."},
            },
            "required": ["chat_id", "text"],
        },
        "run": _telegram,
    },
    "web.automate": {
        "api_name": "web_automate",
        "description": (
            "Haqiqiy brauzerni boshqaradi: sayt ochadi, ma'lumot o'qiydi, forma to'ldiradi. "
            "Sekin va yon-taʼsirli — faqat boshqa yo'l bo'lmaganda."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "goal": {"type": "string", "description": "Tabiiy tilda maqsad."},
                "start_url": {"type": "string", "description": "Boshlang'ich URL (ixtiyoriy)."},
            },
            "required": ["goal"],
        },
        "run": _web_automate,
    },
    "connector.invoke": {
        "api_name": "connector_invoke",
        "description": (
            "Ulangan tashqi xizmat amalini bajaradi (CRM, do'kon, SMS, jadval...). "
            "Konnektor id va amal nomini aniq bilganda ishlating."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "connector_id": {"type": "string", "description": "Konnektor slug, masalan telegram-bot."},
                "action": {"type": "string", "description": "Amal id, masalan send_message."},
                "params": {"type": "object", "description": "Amal parametrlari."},
            },
            "required": ["connector_id", "action"],
        },
        "run": _connector_generic,
    },
}

_API_NAME_TO_ID = {v["api_name"]: k for k, v in _INFO_TOOLS.items()}


def _api_name(tool_id: str) -> str:
    """tool_id -> Claude tool nomi (nuqta/defis "_" ga)."""
    return tool_id.replace(".", "_").replace("-", "_")


def _is_connector_tool(tool_id: str) -> bool:
    """Dinamik konnektor tooli (umumiy `connector.invoke` bundan mustasno)."""
    return tool_id.startswith(CONNECTOR_PREFIX) and tool_id != "connector.invoke"


def _connector_api_name(connector_id: str) -> str:
    """Konnektor slug -> Claude tool nomi. YAGONA manba: `connector_id`.

    `build_tools` va `connector_targets` ikkalasi ham shu funksiyani chaqiradi
    — aks holda ikki joyda ozgina farq qilgan nom qoidasi ijro paytida
    "noma'lum tool" ga olib kelardi.
    """
    return _api_name(f"{CONNECTOR_PREFIX}{connector_id}")


def _connector_tool(spec: dict[str, Any]) -> dict[str, Any] | None:
    """Ulangan konnektordan Claude tool-taʼrifi quradi.

    Har konnektor BITTA tool bo'ladi, amal esa `action` maydonida enum sifatida
    keladi — 18 konnektor x 2-3 amal = 40+ alohida tool bo'lib ketmasligi va
    prompt shishmasligi uchun.
    """
    connector_id = str(spec.get("connector_id") or "")
    if not connector_id:
        return None

    actions = spec.get("actions") or []
    action_ids = [str(a.get("id")) for a in actions if a.get("id")]
    if not action_ids:
        return None

    # Har amalning parametrlarini tavsifga yozamiz — `params` erkin obyekt
    # bo'lgani uchun model nimani to'ldirishni aynan shu yerdan biladi.
    lines: list[str] = []
    for a in actions:
        params = a.get("params") or []
        rendered = ", ".join(
            f"{p.get('key')}:{p.get('type')}{'' if p.get('required') else '?'}" for p in params
        )
        lines.append(f"{a.get('id')} — {a.get('description', '')} params: {{{rendered}}}")

    return {
        "name": _connector_api_name(connector_id),
        "description": (
            f"{spec.get('name', connector_id)} — {spec.get('description', '')}\n"
            f"Mavjud amallar:\n  " + "\n  ".join(lines)
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": action_ids, "description": "Bajariladigan amal."},
                "params": {"type": "object", "description": "Amal parametrlari (yuqoridagi ro'yxatga qarang)."},
            },
            "required": ["action"],
        },
    }


def build_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Agent taʼrifidagi `tools` ro'yxatidan Claude tool-sxemalarini quradi.

    Kirish — `[{tool_id, config}]` (AgentDefinition.tools). Konnektorlar
    `connector.<slug>` tool_id bilan keladi va `config` ichida amal sxemasini
    olib yuradi (NestJS `toolSpecsForAgent` yig'adi).
    """
    defs: list[dict[str, Any]] = []
    seen: set[str] = set()

    for entry in tools:
        tid = entry.get("tool_id") if isinstance(entry, dict) else None
        if not isinstance(tid, str) or not tid:
            continue

        if _is_connector_tool(tid):
            built = _connector_tool(entry.get("config") or {})
            if not built or built["name"] in seen:
                continue
            seen.add(built["name"])
            defs.append(built)
            continue

        spec = _INFO_TOOLS.get(tid)
        if not spec or spec["api_name"] in seen:
            continue
        seen.add(spec["api_name"])
        defs.append(
            {
                "name": spec["api_name"],
                "description": spec["description"],
                "input_schema": spec["input_schema"],
            }
        )
    return defs


def connector_targets(tools: list[dict[str, Any]]) -> dict[str, str]:
    """api_name -> connector_id xaritasi (so'rovga XOS, global holat yo'q).

    `run_tool` shu xarita orqali qaysi konnektor chaqirilayotganini biladi.
    Modul darajasidagi kesh ATAYLAB ishlatilmaydi: bir vaqtda turli
    foydalanuvchilarning so'rovlari ishlaydi va konnektor ro'yxati ular uchun
    har xil.
    """
    out: dict[str, str] = {}
    for entry in tools:
        tid = entry.get("tool_id") if isinstance(entry, dict) else None
        if not isinstance(tid, str) or not _is_connector_tool(tid):
            continue
        cid = (entry.get("config") or {}).get("connector_id")
        if cid:
            out[_connector_api_name(str(cid))] = str(cid)
    return out


async def run_tool(
    api_name: str,
    args: dict[str, Any],
    ctx: ToolCtx,
    connectors: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Claude so'ragan toolni ijro etadi (api nomi -> tool_id -> runner)."""
    connector_id = (connectors or {}).get(api_name)
    if connector_id:
        params = args.get("params")
        try:
            return await connector_invoke(
                connector_id=connector_id,
                action=str(args.get("action", "")),
                params=params if isinstance(params, dict) else {},
                user_id=ctx.user_id,
                agent_id=ctx.agent_id,
            )
        except Exception as e:  # tool ijrosi hech qachon oqimni yiqitmasin
            return {"xato": str(e)}

    tid = _API_NAME_TO_ID.get(api_name)
    if not tid:
        return {"xato": f"Noma'lum tool: {api_name}"}
    try:
        return await _INFO_TOOLS[tid]["run"](args or {}, ctx)
    except Exception as e:  # tool ijrosi hech qachon oqimni yiqitmasin
        return {"xato": str(e)}


def to_tool_result_content(result: dict[str, Any]) -> str:
    """Tool natijasini Claude'ga qaytariladigan matn (JSON) ko'rinishiga keltiradi."""
    return json.dumps(result, ensure_ascii=False)
