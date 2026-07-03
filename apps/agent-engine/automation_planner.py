"""
AgentNet — Universal App Control, Tier 1 (S1): brauzer-avtomatlashtirish rejalashtiruvchisi
--------------------------------------------------------------------------------
Arxitektura (Claude Computer Use / OpenAI Operator naqshiga mos, veb doirasida):
  - Brauzer (Playwright) NestJS "browser bridge"da yashaydi — u sahifa holatini
    (URL, sarlavha, matn, interaktiv elementlar ro'yxati) yig'ib beradi.
  - Har qadamda BU modul keyingi amalni hal qiladi: LLM-first (Claude sahifa
    holatiga qarab mulohaza yuritadi), kalitsiz esa skriptli fallback
    (URL ochish + ma'lumot o'qish kabi oddiy retseptlar).

Amal formati (bridge shu formatni bajaradi):
  {"action": "navigate", "url": "..."}
  {"action": "click",    "element_index": 3}
  {"action": "fill",     "element_index": 2, "value": "..."}
  {"action": "extract",  "what": "page_text" | "title"}
  {"action": "done",     "summary": "...", "extracted": "..."}
  {"action": "fail",     "reason": "..."}

Tier 2 (native OS boshqaruvi) bu modulda YO'Q — ROADMAP_WOW_FEATURES.md'da
halol texnik yo'l xaritasi bilan hujjatlashtirilgan.
"""

from __future__ import annotations

import json
import re
from typing import Any

from llm_utils import lang_instruction, llm_json

MAX_STEPS = 10

_PLANNER_SYSTEM = """\
You are a careful browser-automation planner operating a real web browser for a user.
You receive the user's GOAL, the CURRENT PAGE STATE (url, title, visible text excerpt,
and a numbered list of interactive elements), and the HISTORY of steps already taken.

Decide the SINGLE next action. Reply ONLY with JSON, one of:
 {"action":"navigate","url":"https://...","reason":"..."}
 {"action":"click","element_index":<int>,"reason":"..."}
 {"action":"fill","element_index":<int>,"value":"...","reason":"..."}
 {"action":"extract","what":"page_text","reason":"..."}
 {"action":"done","summary":"what was accomplished","extracted":"the concrete data the user asked for","reason":"..."}
 {"action":"fail","reason":"honest explanation of why the goal cannot be completed"}

Rules:
- Prefer finishing ("done") as soon as the goal is genuinely satisfied; include the
  actual extracted data, not a promise.
- Never invent element indexes; only use ones from the list.
- Never submit payment, delete data, or send messages unless the goal explicitly asks.
- If the page is a login wall and you have no credentials in the goal, use "fail"
  and say credentials are required.
- If history shows the same action repeated twice without progress, choose a different
  approach or "fail" honestly.
"""


async def plan_next_step(
    goal: str,
    page_state: dict[str, Any] | None,
    history: list[dict[str, Any]],
    language: str = "en",
) -> dict[str, Any]:
    """Keyingi amalni tanlaydi. LLM-first; kalitsiz skriptli fallback."""
    if len(history) >= MAX_STEPS:
        return {
            "action": "fail",
            "reason": f"Step budget ({MAX_STEPS}) exhausted before the goal was met.",
            "method": "guard",
        }

    parsed = await llm_json(
        _PLANNER_SYSTEM + "\n" + lang_instruction(language),
        _render_context(goal, page_state, history),
        max_tokens=700,
    )
    if parsed and parsed.get("action") in {"navigate", "click", "fill", "extract", "done", "fail"}:
        parsed["method"] = "llm"
        return parsed

    return _scripted_plan(goal, page_state, history)


def _render_context(goal: str, page_state: dict[str, Any] | None, history: list[dict[str, Any]]) -> str:
    elements = (page_state or {}).get("elements") or []
    el_lines = [
        f"[{i}] <{e.get('tag')}> {e.get('type') or ''} \"{(e.get('text') or e.get('placeholder') or e.get('name') or '')[:80]}\""
        for i, e in enumerate(elements[:40])
    ]
    hist_lines = [
        f"{i+1}. {h.get('action')} {h.get('target') or ''} -> {str(h.get('observation'))[:120]}"
        for i, h in enumerate(history[-8:])
    ]
    state = page_state or {}
    return (
        f"GOAL: {goal}\n\n"
        f"CURRENT PAGE:\nurl: {state.get('url', '(no page loaded yet)')}\n"
        f"title: {state.get('title', '')}\n"
        f"text excerpt: {str(state.get('text', ''))[:1500]}\n\n"
        f"INTERACTIVE ELEMENTS:\n" + ("\n".join(el_lines) or "(none)") + "\n\n"
        f"HISTORY:\n" + ("\n".join(hist_lines) or "(first step)")
    )


# ------------------------------------------------------------------
# Skriptli fallback — API kalitisiz ham halol ishlaydigan retseptlar
# ------------------------------------------------------------------

_URL_RE = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)
_DOMAIN_RE = re.compile(r"\b([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b", re.IGNORECASE)
_FILL_RE = re.compile(r"fill\s+([\w .-]+?)\s*=\s*\"([^\"]+)\"", re.IGNORECASE)


def _scripted_plan(goal: str, page_state: dict[str, Any] | None, history: list[dict[str, Any]]) -> dict[str, Any]:
    """Oddiy, oshkora retseptlar: URL ochish → (formalar bo'lsa to'ldirish) → o'qish → yakun.

    Bu LLM emas — murakkab ko'p-qadamli maqsadlar uchun halol "fail" qaytaradi.
    """
    done_actions = [h.get("action") for h in history]

    # 1. Hali sahifa ochilmagan bo'lsa: maqsaddan URL topib navigate
    if "navigate" not in done_actions:
        m = _URL_RE.search(goal)
        url = m.group(0) if m else None
        if not url:
            dm = _DOMAIN_RE.search(goal)
            if dm and "." in dm.group(1):
                url = "https://" + dm.group(1)
        if url:
            return {"action": "navigate", "url": url, "reason": "Scripted: open the URL named in the goal.", "method": "scripted"}
        return {
            "action": "fail",
            "reason": "Scripted mode needs an explicit URL in the goal (LLM planning requires ANTHROPIC_API_KEY).",
            "method": "scripted",
        }

    # 2. Maqsadda fill ko'rsatmalari bo'lsa: 'fill <maydon> = "qiymat"'
    fills_done = sum(1 for a in done_actions if a == "fill")
    fill_specs = _FILL_RE.findall(goal)
    if fill_specs and fills_done < len(fill_specs):
        field_name, value = fill_specs[fills_done]
        idx = _find_element(page_state, field_name)
        if idx is not None:
            return {
                "action": "fill", "element_index": idx, "value": value,
                "reason": f"Scripted: fill '{field_name}'.", "method": "scripted",
            }

    # 3. Ma'lumot o'qish
    if "extract" not in done_actions:
        return {"action": "extract", "what": "page_text", "reason": "Scripted: read the page content.", "method": "scripted"}

    # 4. Yakun — o'qilgan matndan xulosa
    last_extract = next(
        (h.get("observation") for h in reversed(history) if h.get("action") == "extract"),
        "",
    )
    state = page_state or {}
    return {
        "action": "done",
        "summary": f"Opened {state.get('url', '')} — \"{state.get('title', '')}\" and read the page content.",
        "extracted": str(last_extract)[:1200],
        "reason": "Scripted recipe complete.",
        "method": "scripted",
    }


def _find_element(page_state: dict[str, Any] | None, field_name: str) -> int | None:
    """Element ro'yxatidan nom/placeholder/label bo'yicha eng mos maydonni topadi."""
    needle = field_name.strip().lower()
    for i, e in enumerate((page_state or {}).get("elements") or []):
        hay = " ".join(
            str(e.get(k) or "") for k in ("name", "placeholder", "text", "id", "label")
        ).lower()
        if needle and needle in hay:
            return i
    return None


def describe_capabilities() -> dict[str, Any]:
    return {
        "tier": 1,
        "scope": "web/browser automation (navigate, click, fill, read) via Playwright bridge",
        "max_steps": MAX_STEPS,
        "planning": "LLM-first (Claude) with scripted keyless fallback",
        "tier2_note": "Native OS/device control requires a companion app — see ROADMAP_WOW_FEATURES.md",
    }


async def summarize_run(goal: str, steps: list[dict[str, Any]], language: str = "en") -> str:
    """Yakuniy inson-o'qiydigan xulosa (LLM bo'lsa boyroq, bo'lmasa deterministik)."""
    parsed = await llm_json(
        "Summarize this browser automation run for the user in 2-3 sentences. "
        "Reply ONLY JSON: {\"summary\": \"...\"}\n" + lang_instruction(language),
        json.dumps({"goal": goal, "steps": steps[-10:]}, ensure_ascii=False)[:4000],
        max_tokens=300,
    )
    if parsed and parsed.get("summary"):
        return str(parsed["summary"])
    ok = sum(1 for s in steps if not str(s.get("observation", "")).startswith("ERROR"))
    return f"Ran {len(steps)} browser steps ({ok} succeeded) toward: {goal[:120]}"
