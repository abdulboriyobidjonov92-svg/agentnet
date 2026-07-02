"""Kalendar vositalari — Google Calendar (stub, OAuth integratsiyasi keyinroq)."""
from datetime import datetime, timedelta


async def get_events(
    sana_boshlanish: str = "",
    sana_tugash: str = "",
    calendar_id: str = "primary",
) -> dict:
    """Google Calendar eventlarini qaytaradi. OAuth ulanmasa namuna qaytaradi."""
    today = datetime.now()
    # Namuna tadbirlar
    events = [
        {
            "sarlavha": "Juma namozi",
            "boshlanish": f"{today.strftime('%Y-%m-%d')} 13:00",
            "tugash": f"{today.strftime('%Y-%m-%d')} 14:00",
            "joylashuv": "Yaqin masjid",
            "eslatma": "30 daqiqa oldin"
        },
        {
            "sarlavha": "Ish yig'ilishi",
            "boshlanish": f"{(today + timedelta(days=1)).strftime('%Y-%m-%d')} 10:00",
            "tugash": f"{(today + timedelta(days=1)).strftime('%Y-%m-%d')} 11:00",
            "joylashuv": "Zoom",
            "eslatma": "15 daqiqa oldin"
        },
    ]
    return {
        "tadbirlar": events,
        "jami": len(events),
        "eslatma": "Google Calendar OAuth ulanmagan. Haqiqiy eventlar uchun sozlamalardan integratsiyani yoqing.",
    }
