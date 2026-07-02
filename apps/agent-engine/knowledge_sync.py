"""
AgentNet — Real-time Global Knowledge Sync
--------------------------------------------
Agentlar statik trening bilimiga emas, jonli manbalarga tayanadi.
Har bir natija MANBA ATRIBUTSIYASI bilan qaytadi (nom + URL + vaqt).

Manbalar (barchasi bepul, API kalitisiz):
  - Yangiliklar : Google News RSS (til-sezgir qidiruv)
  - Ensiklopedi : Wikipedia API (til-sezgir)
  - Valyuta     : open.er-api.com
  - Ob-havo     : Open-Meteo

Router: so'rov mazmuniga qarab mos manbalar tanlanadi.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any
from xml.etree import ElementTree

import httpx

from tools.utility_tools import currency_rates, weather

_GNEWS_LANG = {"en": ("en-US", "US"), "ru": ("ru", "RU"), "uz": ("uz", "UZ")}
_WIKI_LANG = {"en": "en", "ru": "ru", "uz": "uz"}

_CURRENCY_HINTS = ["kurs", "valyuta", "currency", "exchange rate", "курс", "валют", "dollar", "usd", "eur", "so'm narxi"]
_WEATHER_HINTS = ["ob-havo", "obhavo", "weather", "погода", "harorat", "temperature"]
_NEWS_HINTS = ["news", "yangilik", "новост", "so'nggi", "latest", "bugungi voqea", "headlines"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ------------------------------------------------------------------
# Manbalar
# ------------------------------------------------------------------


async def fetch_news(query: str, language: str = "en", limit: int = 5) -> dict[str, Any]:
    """Google News RSS — jonli yangiliklar sarlavhalari, havolalari bilan."""
    hl, gl = _GNEWS_LANG.get(language, _GNEWS_LANG["en"])
    url = "https://news.google.com/rss/search"
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            res = await client.get(url, params={"q": query, "hl": hl, "gl": gl, "ceid": f"{gl}:{hl}"})
            res.raise_for_status()
            root = ElementTree.fromstring(res.text)
            items = []
            for item in root.iter("item"):
                title = item.findtext("title") or ""
                link = item.findtext("link") or ""
                pub = item.findtext("pubDate") or ""
                src = item.find("{https://news.google.com/rss}source")
                publisher = src.text if src is not None else ""
                items.append({"title": title, "url": link, "published": pub, "publisher": publisher})
                if len(items) >= limit:
                    break
            return {
                "source": "Google News",
                "source_url": f"https://news.google.com/search?q={query}",
                "retrieved_at": _now_iso(),
                "items": items,
            }
    except Exception as e:
        return {"source": "Google News", "error": str(e), "items": []}


async def fetch_wikipedia(query: str, language: str = "en") -> dict[str, Any]:
    """Wikipedia — mavzu bo'yicha qisqa, atributsiyalangan xulosa."""
    lang = _WIKI_LANG.get(language, "en")
    api = f"https://{lang}.wikipedia.org/w/api.php"
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            res = await client.get(api, params={
                "action": "query", "format": "json", "generator": "search",
                "gsrsearch": query, "gsrlimit": 1,
                "prop": "extracts|info", "exintro": 1, "explaintext": 1,
                "exsentences": 4, "inprop": "url",
            })
            res.raise_for_status()
            pages = (res.json().get("query") or {}).get("pages") or {}
            if not pages:
                return {"source": "Wikipedia", "items": []}
            page = next(iter(pages.values()))
            return {
                "source": "Wikipedia",
                "source_url": page.get("fullurl", ""),
                "retrieved_at": _now_iso(),
                "items": [{
                    "title": page.get("title", ""),
                    "summary": (page.get("extract") or "").strip(),
                    "url": page.get("fullurl", ""),
                }],
            }
    except Exception as e:
        return {"source": "Wikipedia", "error": str(e), "items": []}


async def fetch_currency(query: str) -> dict[str, Any]:
    data = await currency_rates(base="USD", symbols="UZS,EUR,RUB,KZT")
    return {
        "source": "Open Exchange Rates API (open.er-api.com)",
        "source_url": "https://open.er-api.com",
        "retrieved_at": _now_iso(),
        "items": [] if "xato" in data else [{"title": "USD kursi", "data": data.get("kurslar", {}), "updated": data.get("yangilangan", "")}],
    }


async def fetch_weather(query: str, default_city: str = "Tashkent") -> dict[str, Any]:
    # So'rovdan shahar nomini topishga urinamiz (bosh harfli so'z), topilmasa default
    m = re.search(r"\b([A-ZА-Я][a-zа-я']{3,})\b", query)
    city = m.group(1) if m else default_city
    data = await weather(city=city)
    return {
        "source": "Open-Meteo",
        "source_url": "https://open-meteo.com",
        "retrieved_at": _now_iso(),
        "items": [] if "xato" in data else [{"title": f"{data.get('shahar')} ob-havosi", "data": data}],
    }


# ------------------------------------------------------------------
# Router — so'rov mazmuniga qarab manbalarni tanlaydi
# ------------------------------------------------------------------


async def search(query: str, language: str = "en", city: str = "Tashkent") -> dict[str, Any]:
    lower = query.lower()
    results: list[dict[str, Any]] = []

    if any(h in lower for h in _CURRENCY_HINTS):
        results.append(await fetch_currency(query))
    if any(h in lower for h in _WEATHER_HINTS):
        results.append(await fetch_weather(query, default_city=city))

    # Yangiliklar — har doim foydali; agar maxsus manba topilmagan bo'lsa Wikipedia ham
    if not results or any(h in lower for h in _NEWS_HINTS):
        results.append(await fetch_news(query, language))
    if not any(r.get("items") for r in results):
        results.append(await fetch_wikipedia(query, language))
    elif not any(h in lower for h in _NEWS_HINTS + _CURRENCY_HINTS + _WEATHER_HINTS):
        results.append(await fetch_wikipedia(query, language))

    return {
        "query": query,
        "retrieved_at": _now_iso(),
        "method": "live",
        "sources": results,
    }


# ------------------------------------------------------------------
# Agent tool sifatida (registry uchun)
# ------------------------------------------------------------------


async def knowledge_search_tool(query: str = "", language: str = "en", city: str = "Tashkent") -> dict[str, Any]:
    if not query:
        return {"xato": "query bo'sh"}
    return await search(query, language=language, city=city)
