"""
AgentNet — BOSQICH 2: Kompyuter-agent "miyasi" (computer-use planner).
--------------------------------------------------------------------------------
Anthropic "computer use" naqshining aynan o'zi, veb o'rniga NATIV ish stolida:
  skrinshot -> LLM tahlili -> harakat (bosish/yozish/tugma) -> qayta skrinshot -> tekshirish.

Loop OZGINA farq bilan brauzer-agentnikiga o'xshaydi, LEKIN sahifa-DOM'i O'RNIGA
model to'g'ridan-to'g'ri SKRINSHOTni ko'radi (Gemini multimodal) va PIKSEL
koordinatalarida harakat qaytaradi. Harakatni companion (foydalanuvchi mashinasidagi
yordamchi ilova) bajaradi — server bevosita ish stoliga tegmaydi.

Amal formati (companion shu formatni bajaradi):
  {"action":"click","x":<int>,"y":<int>}
  {"action":"double_click","x":<int>,"y":<int>}
  {"action":"type","text":"..."}
  {"action":"key","keys":"ctrl+s"}
  {"action":"scroll","dx":0,"dy":-500}
  {"action":"wait","ms":800}
  {"action":"done","summary":"..."}
  {"action":"fail","reason":"..."}

Xavfsizlik: bu miya faqat REJA beradi. Haqiqiy bajarish DevicePermission bilan
cheklangan (fail-closed) va har amal DeviceActionLog'ga yoziladi (API tomonda).
Koordinatalar skrinshot o'lchamiga nisbatan — companion ekran ko'lamiga moslaydi.
"""

from __future__ import annotations

import base64
from typing import Any

from llm_utils import (
    GEMINI_MODEL,
    active_provider,
    extract_json,
    gemini_client,
    gemini_types,
    lang_instruction,
)

# SEC-02 (Engineering Contract, Phase 1): 15 -> 10. Har qadam NestJS tomonda
# alohida charge/consume qilinadi (device-companion.service.ts computerUsePlan) —
# past chegara, past xarajat tomoni.
MAX_STEPS = 10

_VALID = {"click", "double_click", "type", "key", "scroll", "wait", "done", "fail"}

_SYSTEM = """\
You control a real desktop computer for a user, like Anthropic Computer Use.
You are given the user's GOAL, the SCREEN SIZE, a SCREENSHOT of the current screen,
and the HISTORY of actions already taken. Decide the SINGLE next action.

Reply ONLY with JSON, one of:
 {"action":"click","x":<0-1000>,"y":<0-1000>,"reason":"..."}
 {"action":"double_click","x":<0-1000>,"y":<0-1000>,"reason":"..."}
 {"action":"type","text":"...","reason":"..."}
 {"action":"key","keys":"ctrl+s","reason":"..."}
 {"action":"scroll","dx":0,"dy":-500,"reason":"..."}
 {"action":"wait","ms":800,"reason":"..."}
 {"action":"done","summary":"what was accomplished","reason":"..."}
 {"action":"fail","reason":"why the goal cannot be completed"}

Rules:
- Coordinates are NORMALIZED to 0-1000 for BOTH axes, origin top-left
  (x=0 left edge, x=1000 right edge; y=0 top, y=1000 bottom). Target the CENTER
  of the element. This normalized grounding is more reliable than raw pixels.
- Prefer keyboard shortcuts and typing over clicking when reliable.
- Do exactly ONE step. Finish with "done" as soon as the goal is satisfied.
- Never guess a click if the target is not visible — scroll or "fail" honestly.
- Never take destructive/irreversible actions unless the goal explicitly asks.
"""


async def plan_computer_step(
    goal: str,
    screenshot_b64: str | None,
    screen: dict[str, int] | None,
    history: list[dict[str, Any]],
    language: str = "en",
) -> dict[str, Any]:
    """Skrinshotга qarab keyingi ish-stoli harakatini tanlaydi (Gemini vision)."""
    if len(history) >= MAX_STEPS:
        return {"action": "fail", "reason": f"Step budget ({MAX_STEPS}) exhausted.", "method": "guard"}

    # Bu miya VISION talab qiladi — hozircha Gemini multimodal orqali. (Anthropic
    # kalit qo'shilsa, u ham vision qo'llaydi; keyin shu yerda qo'shiladi.)
    gemini = gemini_client()
    if active_provider() != "gemini" or gemini is None or not screenshot_b64:
        return {
            "action": "fail",
            "reason": "Computer-use vision requires GEMINI_API_KEY and a screenshot.",
            "method": "guard",
        }

    w = (screen or {}).get("width", 0)
    h = (screen or {}).get("height", 0)
    hist_lines = [
        f"{i+1}. {a.get('action')} {a.get('x','')},{a.get('y','')} {a.get('text','')} -> {str(a.get('result',''))[:80]}"
        for i, a in enumerate(history[-8:])
    ]
    prompt = (
        f"GOAL: {goal}\n"
        f"SCREEN SIZE: {w}x{h}\n\n"
        "HISTORY:\n" + ("\n".join(hist_lines) or "(first step)") + "\n\n"
        "Decide the single next action from the screenshot."
    )

    types_mod = gemini_types()
    try:
        img_bytes = base64.b64decode(_strip_data_url(screenshot_b64))
        response = await gemini.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=[
                types_mod.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
                prompt,
            ],
            config=types_mod.GenerateContentConfig(
                system_instruction=_SYSTEM + "\n" + lang_instruction(language),
                max_output_tokens=500,
                response_mime_type="application/json",
            ),
        )
        parsed = extract_json((getattr(response, "text", "") or "").strip())
    except Exception as e:  # noqa: BLE001
        return {"action": "fail", "reason": f"Vision planner error: {str(e)[:160]}", "method": "error"}

    if parsed and parsed.get("action") in _VALID:
        parsed["method"] = "llm-vision"
        # Normallashtirilgan 0-1000 koordinatani ekran pikseliga aylantiramiz
        # (companion aynan piksel kutadi). Ekran o'lchami bo'lsa.
        if parsed.get("action") in {"click", "double_click"} and w and h:
            if isinstance(parsed.get("x"), (int, float)):
                parsed["x"] = round(parsed["x"] / 1000 * w)
            if isinstance(parsed.get("y"), (int, float)):
                parsed["y"] = round(parsed["y"] / 1000 * h)
        return parsed
    return {"action": "fail", "reason": "Planner returned no valid action.", "method": "llm-vision"}


def _strip_data_url(s: str) -> str:
    return s.split(",", 1)[1] if s.startswith("data:") else s


def describe_capabilities() -> dict[str, Any]:
    return {
        "tier": 2,
        "scope": "desktop computer-use (screenshot -> vision LLM -> click/type/key) via companion",
        "max_steps": MAX_STEPS,
        "vision": active_provider() == "gemini",
        "note": "Companion app on the user's machine executes actions; server only plans. Beta.",
    }
