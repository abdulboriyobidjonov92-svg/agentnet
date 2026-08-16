"""
AgentNet — FREE TARIF uchun OpenRouter ko'p-model zanjiri.

NEGA ALOHIDA MODUL: free tarif pullik zanjirdan (Anthropic) BUTUNLAY ajratilgan.
Founder byudjeti nol — har bepul obunachiga pullik model chaqiruvini
moliyalashtirib bo'lmaydi. Shuning uchun free tarif OpenRouter'ning `:free`
modellariga tayanadi, pullik tarif esa mavjud zanjirda qoladi va bu fayl uni
UMUMAN ko'rmaydi.

ROTATSIYA NEGA KERAK: `:free` modellar HISOB darajasida cheklangan
`[FROM-RESEARCH]` — 20 so'rov/daqiqa doim, kunlik esa 50 (hisobda $10 kredit
sotib olinmagan bo'lsa) yoki 1000 (bir marta sotib olingach). Bu limit butun
mahsulot uchun umumiy. Bundan tashqari alohida model vaqtincha yiqilishi yoki
provayder navbatida turib qolishi mumkin. Shuning uchun bitta modelga tayanmaymiz:
ro'yxat bo'ylab navbat bilan o'tamiz va birinchi ISHLAGANIDA to'xtaymiz.

MODEL TANLASH MEZONI (2026-08-16 da `GET /api/v1/models` dan tekshirilgan):
  1. `:free` narx (prompt=0, completion=0);
  2. `supported_parameters` ichida `tools` BOR — tool-calling'siz model bu yerda
     foydasiz, chunki mahsulotning butun qiymati konnektor chaqirishida;
  3. vendor xilma-xilligi — bitta oilaning umumiy uzilishi hammasini
     o'chirmasligi uchun (NVIDIA / Google / Cohere).
Ro'yxat tez-tez eskiradi: OpenRouter modellarni qo'shadi va olib tashlaydi.
`OPENROUTER_FREE_MODELS` env (vergul bilan) ro'yxatni deploy'siz almashtiradi.
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

_API_URL = "https://openrouter.ai/api/v1/chat/completions"

#: Sukut bo'yicha zanjir — "eng qobiliyatlisi birinchi" tartibida.
#: agentic_index (artificial_analysis, 2026-08-16): 27.5 / 14.4 / 13.8 / 11.0 / 3.1
DEFAULT_FREE_MODELS: list[str] = [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "google/gemma-4-31b-it:free",
    "nvidia/nemotron-3.5-lightning:free",
    "google/gemma-4-26b-a4b-it:free",
    "cohere/north-mini-code:free",
]


class NoFreeModelAvailable(Exception):
    """Zanjirdagi HAMMA model ishlamadi (429 / uzilish / xato)."""


def api_key() -> str:
    return os.getenv("OPENROUTER_API_KEY", "").strip()


def free_models() -> list[str]:
    raw = os.getenv("OPENROUTER_FREE_MODELS", "").strip()
    if raw:
        models = [m.strip() for m in raw.split(",") if m.strip()]
        if models:
            return models
    return list(DEFAULT_FREE_MODELS)


def to_openai_tools(anthropic_tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Anthropic tool-sxemasini OpenAI `function` sxemasiga o'giradi.

    `agent_tools.build_tools` Anthropic shaklini (`input_schema`) beradi, chunki
    pullik yo'l shuni kutadi. Ikkita alohida quruvchi yozish o'rniga bitta
    manbadan o'girib olamiz — shunda free va pullik tarif AYNAN bir xil
    tool to'plamini ko'radi va ular bir-biridan sezilmay uzoqlashib ketmaydi.
    """
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("input_schema") or {"type": "object", "properties": {}},
            },
        }
        for t in anthropic_tools
    ]


def parse_tool_calls(message: dict[str, Any]) -> list[dict[str, Any]]:
    """OpenAI `tool_calls` -> ijro qatlami kutadigan shakl.

    `arguments` — JSON MATN (obyekt emas). Buzuq JSON kelsa bo'sh dict beramiz:
    kichik bepul modellar ba'zan yaroqsiz JSON chiqaradi va bu butun javobni
    yiqitmasligi kerak — tool o'zi "parametr yetishmayapti" deb javob beradi.
    """
    out: list[dict[str, Any]] = []
    for call in message.get("tool_calls") or []:
        fn = call.get("function") or {}
        raw = fn.get("arguments") or "{}"
        try:
            args = json.loads(raw) if isinstance(raw, str) else dict(raw)
        except (ValueError, TypeError):
            args = {}
        out.append(
            {
                "id": call.get("id") or "",
                "name": fn.get("name") or "",
                "args": args if isinstance(args, dict) else {},
            }
        )
    return out


async def complete(
    *,
    system: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    max_tokens: int = 2048,
    timeout: float = 90.0,
) -> dict[str, Any]:
    """Zanjir bo'ylab birinchi ISHLAGAN modeldan javob oladi.

    Qaytadi: `{"text": str, "tool_calls": [...], "model": str, "attempts": [...]}`.
    Hamma model yiqilsa `NoFreeModelAvailable` — chaqiruvchi buni foydalanuvchiga
    "servis band" deb ko'rsatadi (demo-javob EMAS: demo javob uchun pul olinmasa
    ham, u foydalanuvchini "ishladi" deb aldaydi).
    """
    key = api_key()
    if not key:
        raise NoFreeModelAvailable("OPENROUTER_API_KEY sozlanmagan")

    payload_base: dict[str, Any] = {
        "max_tokens": max_tokens,
        "messages": [{"role": "system", "content": system}, *messages],
    }
    if tools:
        payload_base["tools"] = to_openai_tools(tools)
        payload_base["tool_choice"] = "auto"

    attempts: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=timeout) as client:
        for model in free_models():
            try:
                resp = await client.post(
                    _API_URL,
                    headers={
                        "Authorization": f"Bearer {key}",
                        # OpenRouter atributsiya sarlavhalari — bepul tarifda
                        # ular so'rovni "anonim" bo'lishdan saqlaydi.
                        "HTTP-Referer": os.getenv("PUBLIC_APP_URL", "https://agentnet.uz"),
                        "X-Title": "AgentNet",
                    },
                    json={**payload_base, "model": model},
                )
            except Exception as e:  # tarmoq/timeout — keyingi modelga
                attempts.append({"model": model, "error": type(e).__name__})
                continue

            # 429 = shu model (yoki hisob) chegarasi. 5xx = provayder uzilishi.
            # Ikkalasida ham keyingi modelga o'tamiz. 4xx (429 dan boshqa) —
            # bu bizning so'rovimiz xatosi, boshqa modelda ham takrorlanadi,
            # lekin baribir sinab ko'ramiz: modellar sxema qat'iyligida farq qiladi.
            if resp.status_code != 200:
                attempts.append({"model": model, "status": resp.status_code})
                continue

            try:
                data = resp.json()
                choice = (data.get("choices") or [{}])[0]
                message = choice.get("message") or {}
            except Exception as e:
                attempts.append({"model": model, "error": f"parse:{type(e).__name__}"})
                continue

            text = (message.get("content") or "").strip()
            calls = parse_tool_calls(message)
            if not text and not calls:
                # Bo'sh javob — model "ishladi" lekin foydasi yo'q; keyingisi.
                attempts.append({"model": model, "error": "empty"})
                continue

            attempts.append({"model": model, "status": 200})
            return {"text": text, "tool_calls": calls, "model": model, "attempts": attempts}

    raise NoFreeModelAvailable(json.dumps(attempts, ensure_ascii=False))
