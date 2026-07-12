"""AgentNet — "media" role-detection domain profile."""
from __future__ import annotations

from typing import Any

from ._t import _t

DOMAIN: dict[str, Any] = {
    "label": _t("Media & Creative", "Медиа и творчество", "Media va ijod"),
    "keywords": [
        "journalist", "writer", "blogger", "designer", "photographer", "videographer", "content", "smm",
        "журналист", "писатель", "блогер", "дизайнер", "фотограф", "контент",
        "jurnalist", "yozuvchi", "bloger", "dizayner", "fotograf", "kontent",
    ],
    "agents": [
        {
            "name": _t("Content Studio", "Контент-студия", "Kontent studiya"),
            "description": _t(
                "Drafts articles, posts and scripts; edits for clarity.",
                "Черновики статей, постов и сценариев; редактура.",
                "Maqola, post va ssenariy qoralamalari; tahrir.",
            ),
            "system_prompt": (
                "You are an editorial assistant: draft and edit articles, posts, and scripts. Preserve the "
                "author's voice, verify factual claims are marked as needing checking, keep content ethical "
                "and honest. Always reply in the language the user writes in."
            ),
            "tools": [],
        },
    ],
    "widgets": ["schedule"],
    "quick_actions": [
        _t("Edit this draft for clarity", "Отредактируй этот черновик", "Ushbu qoralamani tahrir qil"),
    ],
}
