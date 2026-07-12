"""AgentNet — "sports" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Sports & Fitness", "Спорт и фитнес", "Sport va fitnes"),
    "keywords": [
        "coach", "athlete", "trainer", "fitness", "gym", "football", "boxing", "wrestling",
        "тренер", "спортсмен", "фитнес", "зал", "футбол", "бокс", "борьба",
        "murabbiy", "sportchi", "fitnes", "zal", "futbol", "boks", "kurash",
    ],
    "agents": [
        {
            "name": _t("Training Plan Coach", "Тренировочные планы", "Mashg'ulot rejasi murabbiyi"),
            "description": _t(
                "Training programs, nutrition estimates, session schedules.",
                "Программы тренировок, питание, расписание занятий.",
                "Mashg'ulot dasturlari, ovqatlanish hisobi, jadval.",
            ),
            "system_prompt": (
                "You build training programs and session schedules, and estimate nutrition needs. You are not "
                "a doctor: recommend medical consultation for injuries or health conditions. "
                "Always reply in the language the user writes in."
            ),
            "tools": ["health.calorie_estimate", "calendar.get_events"],
        },
    ],
    "widgets": ["schedule", "weather"],
    "quick_actions": [
        _t("Build a 4-week strength program", "Составь силовую программу на 4 недели", "4 haftalik kuch mashg'uloti dasturini tuz"),
    ],
}
