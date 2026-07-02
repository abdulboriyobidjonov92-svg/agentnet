"""
Foydali vositalar — Ob-havo (Open-Meteo) va Valyuta kurslari (open.er-api.com).
Ikkalasi ham bepul, API kaliti kerak emas.
"""
import httpx

_WEATHER_CODES = {
    0: "Ochiq osmon", 1: "Asosan ochiq", 2: "Qisman bulutli", 3: "Bulutli",
    45: "Tuman", 48: "Qirovli tuman", 51: "Yengil shivalama", 53: "Shivalama",
    55: "Kuchli shivalama", 61: "Yengil yomg'ir", 63: "Yomg'ir", 65: "Kuchli yomg'ir",
    71: "Yengil qor", 73: "Qor", 75: "Kuchli qor", 80: "Jala", 81: "Kuchli jala",
    82: "Juda kuchli jala", 95: "Momaqaldiroq", 96: "Do'l bilan momaqaldiroq",
}


async def weather(city: str = "Tashkent") -> dict:
    """Berilgan shahar uchun joriy ob-havo. Open-Meteo (bepul, kalitsiz)."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            geo = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": city, "count": 1, "language": "en"},
            )
            geo.raise_for_status()
            results = geo.json().get("results")
            if not results:
                return {"xato": f"Shahar topilmadi: {city}"}
            loc = results[0]
            lat, lon = loc["latitude"], loc["longitude"]

            wx = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat, "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
                },
            )
            wx.raise_for_status()
            cur = wx.json()["current"]
            code = cur.get("weather_code", 0)
            return {
                "shahar": loc.get("name", city),
                "davlat": loc.get("country", ""),
                "harorat_C": cur.get("temperature_2m"),
                "namlik_foiz": cur.get("relative_humidity_2m"),
                "shamol_km_s": cur.get("wind_speed_10m"),
                "holat": _WEATHER_CODES.get(code, "Noma'lum"),
            }
        except Exception as e:
            return {"xato": str(e), "shahar": city}


async def currency_rates(base: str = "USD", symbols: str = "UZS,EUR,RUB") -> dict:
    """Valyuta kurslari. open.er-api.com (bepul, kalitsiz)."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            res = await client.get(f"https://open.er-api.com/v6/latest/{base.upper()}")
            res.raise_for_status()
            data = res.json()
            rates = data.get("rates", {})
            wanted = [s.strip().upper() for s in symbols.split(",") if s.strip()]
            selected = {s: rates.get(s) for s in wanted if s in rates}
            return {
                "asos": base.upper(),
                "yangilangan": data.get("time_last_update_utc", ""),
                "kurslar": selected or rates,
            }
        except Exception as e:
            return {"xato": str(e), "asos": base}
