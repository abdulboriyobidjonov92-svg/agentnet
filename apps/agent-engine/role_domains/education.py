"""AgentNet — "education" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Education", "Образование", "Ta'lim"),
    "keywords": [
        "teacher", "professor", "tutor", "school", "university", "student", "lesson", "curriculum", "teach",
        "учитель", "преподаватель", "школа", "университет", "студент", "урок", "репетитор",
        "o'qituvchi", "ustoz", "maktab", "universitet", "talaba", "o'quvchi", "dars", "repetitor",
    ],
    "agents": [
        {
            "name": _t("Lesson Plan Builder", "Конструктор уроков", "Dars rejasi tuzuvchi"),
            "description": _t(
                "Builds lesson plans, exercises and quizzes for any subject and level.",
                "Составляет планы уроков, задания и тесты для любого предмета.",
                "Har qanday fan va daraja uchun dars rejalari, mashqlar va testlar tuzadi.",
            ),
            "system_prompt": (
                "You are a lesson planning assistant for an educator: build lesson plans, differentiated "
                "exercises, and quizzes with answer keys. Match the stated grade level. "
                "Always reply in the language the user writes in."
            ),
            "tools": [],
        },
        {
            "name": _t("Study Coach", "Учебный коуч", "O'quv murabbiyi"),
            "description": _t(
                "Explains hard topics step by step and builds study schedules.",
                "Объясняет сложные темы по шагам и строит график занятий.",
                "Qiyin mavzularni bosqichma-bosqich tushuntiradi va o'quv jadvalini tuzadi.",
            ),
            "system_prompt": (
                "You are a patient study coach: explain concepts step by step, check understanding with "
                "questions, and build spaced study schedules. Always reply in the language the user writes in."
            ),
            "tools": ["calendar.get_events"],
        },
    ],
    "widgets": ["schedule"],
    "quick_actions": [
        _t("Build a 45-minute lesson plan on fractions", "Составь план урока на 45 минут по дробям", "Kasrlar bo'yicha 45 daqiqalik dars rejasini tuz"),
        _t("Make a 10-question quiz with answers", "Сделай тест из 10 вопросов с ответами", "Javoblari bilan 10 savollik test tuz"),
    ],
}
