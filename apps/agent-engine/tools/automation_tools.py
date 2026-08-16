"""S1: web.automate — agent vositasi.

Har qanday agent (toolsConfig'ida web.automate bo'lsa) foydalanuvchi nomidan
veb-ilovani boshqara oladi: NestJS'dagi Playwright bridge to'liq yurgizishni
bajaradi, qadam-qadam rejani esa engine'ning /automation/plan endpointi beradi.
"""
import os

import httpx

_API_URL = os.getenv("API_URL", "http://localhost:3001")
_INTERNAL_TOKEN = os.getenv("INTERNAL_API_TOKEN", "agentnet-internal-dev")


async def web_automate(goal: str, start_url: str = "", user_id: str = "", language: str = "en") -> dict:
    """Brauzer-avtomatlashtirish yurgizishini boshlaydi va natijasini qaytaradi."""
    if not goal:
        return {"holat": "xato", "sabab": "goal bo'sh"}
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            res = await client.post(
                f"{_API_URL}/api/automation/internal/run",
                json={"goal": goal, "startUrl": start_url or None, "userId": user_id, "language": language},
                headers={"x-internal-token": _INTERNAL_TOKEN},
            )
            res.raise_for_status()
            return res.json()
    except Exception as e:
        return {"holat": "xato", "sabab": f"Browser bridge bilan aloqa yo'q: {e}"}


async def connector_invoke(
    connector_id: str,
    action: str,
    params: dict | None = None,
    user_id: str = "",
    agent_id: str = "",
) -> dict:
    """S2: Connector SDK amali — agent har qanday ulangan integratsiyani chaqiradi.

    `agent_id` — qaysi agent chaqirayotgani. API tomonda konnektor
    konfiguratsiyasini tanlashda ishlatiladi: agentga BIRIKTIRILGAN sozlama
    ustun, bo'lmasa umumiy (barcha agentlar uchun) sozlama olinadi.
    """
    if not connector_id or not action:
        return {"holat": "xato", "sabab": "connector_id va action majburiy"}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post(
                f"{_API_URL}/api/connectors/internal/invoke",
                json={
                    "userId": user_id,
                    "connectorId": connector_id,
                    "action": action,
                    "params": params or {},
                    "agentId": agent_id or None,
                },
                headers={"x-internal-token": _INTERNAL_TOKEN},
            )
            res.raise_for_status()
            return res.json()
    except Exception as e:
        return {"holat": "xato", "sabab": f"Connector SDK bilan aloqa yo'q: {e}"}
