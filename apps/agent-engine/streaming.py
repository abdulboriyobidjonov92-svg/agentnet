"""
AgentNet — SSE Streaming Agent Endpoint
Claude API streaming + Halal Filter integration.

Agar haqiqiy ANTHROPIC_API_KEY mavjud bo'lsa — Claude orqali real javob.
Aks holda — DEMO REJIM (streaming_demo.py): haqiqiy halal filter (keyword)
+ haqiqiy tool'lar (namoz vaqtlari, Qur'on — bepul API) + token-token
simulyatsiya qilingan javob.
"""
from typing import AsyncIterator

from anthropic import AsyncAnthropic
from halal_filter import HalalFilter, Action

import compliance_packs
from streaming_demo import demo_stream, _sse

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

    # S3: Vertical Compliance Pack — agent vertikaliga qarab avtomatik yuklanadi.
    # Tizim-promptga majburiy xulq qoidalari qo'shiladi (HIPAA-style by default).
    vertical = agent_definition.get("vertical")
    language = agent_definition.get("language", "en")
    pack_addendum = compliance_packs.system_addendum(vertical)
    if pack_addendum:
        system_prompt = f"{system_prompt}\n\n{pack_addendum}"

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
            async for ev in demo_stream(message, agent_definition, user_id):
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

    yield _sse({"type": "done", "halal_flag": input_check.action.value, "demo_mode": not used_real_api})
