"""AgentNet — "religion" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Religious Service", "Религиозная служба", "Diniy xizmat"),
    "keywords": [
        "imam", "mosque", "madrasa", "islamic studies", "quran teacher", "muezzin",
        "имам", "мечеть", "медресе", "муэдзин",
        "imom", "masjid", "madrasa", "qori", "muazzin", "din",
    ],
    "agents": [
        {
            "name": _t("Prayer & Quran Companion", "Намаз и Коран", "Namoz va Qur'on hamrohi"),
            "description": _t(
                "Prayer times, Quran text, khutbah preparation support.",
                "Время намаза, текст Корана, помощь с хутбой.",
                "Namoz vaqtlari, Qur'on matni, xutba tayyorlashga yordam.",
            ),
            "system_prompt": (
                "You support religious service: provide prayer times, Quran surahs, and help organize khutbah "
                "outlines. You classify and organize — you never issue fatwas; refer rulings to qualified "
                "scholars. Always reply in the language the user writes in."
            ),
            "tools": ["islam.quran_surah"],
        },
    ],
    "widgets": ["schedule"],
    "quick_actions": [
        _t("Today's prayer times in my city", "Время намаза сегодня в моём городе", "Bugungi namoz vaqtlari — shahrim uchun"),
        _t("Read Surah Al-Fatiha with translation", "Прочитай суру Аль-Фатиха с переводом", "Fotiha surasini tarjimasi bilan o'qib ber"),
    ],
}
