"""Telegram xabar yuborish vositasi."""
import os
import httpx


async def telegram_send(chat_id: str, xabar: str, bot_token: str = "") -> dict:
    """Telegram orqali xabar yuboradi."""
    token = bot_token or os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        return {"holat": "xato", "sabab": "TELEGRAM_BOT_TOKEN o'rnatilmagan"}

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            res = await client.post(url, json={
                "chat_id": chat_id,
                "text": xabar,
                "parse_mode": "HTML",
            })
            res.raise_for_status()
            return {"holat": "yuborildi", "chat_id": chat_id}
        except Exception as e:
            return {"holat": "xato", "sabab": str(e)}
